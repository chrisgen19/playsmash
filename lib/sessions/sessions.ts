import {
  prisma,
  PlaySessionStatus,
  PlayerStatus,
  SessionPlayerStatus,
  type PlaySession,
} from "@/lib/db";
import { ActivityAction, logActivity } from "@/lib/activity/log";
import { NotFoundError } from "@/lib/permissions/errors";
import type { CreateSessionInput } from "@/lib/validations/sessions";

export class SessionActionError extends Error {
  constructor(
    public readonly code:
      | "NOT_PLANNED"
      | "PLAYERS_OUTSIDE_GROUP"
      | "NO_PLAYERS",
    message: string,
  ) {
    super(message);
    this.name = "SessionActionError";
  }
}

/**
 * Resolve the PlayerProfile ids the caller selected, keeping only those that
 * belong to `groupId` and aren't REMOVED. Returns the validated set; throws
 * if any submitted id is outside the group (never trust client ids).
 */
async function validateGroupPlayers(
  groupId: string,
  playerIds: string[],
): Promise<string[]> {
  const unique = [...new Set(playerIds)];
  if (unique.length === 0) return [];

  const found = await prisma.playerProfile.findMany({
    where: {
      id: { in: unique },
      groupId,
      status: { not: PlayerStatus.REMOVED },
    },
    select: { id: true },
  });
  if (found.length !== unique.length) {
    throw new SessionActionError(
      "PLAYERS_OUTSIDE_GROUP",
      "One or more selected players do not belong to this group",
    );
  }
  return unique;
}

/**
 * Flow 5 (create session) — atomic.
 *
 * Creates the PlaySession, its Court rows (named "Court 1".."Court N"), and a
 * SessionPlayer row per selected player. `checkInOrder` is assigned in
 * selection order starting at 1.
 */
export async function createSession(params: {
  groupId: string;
  actorUserId: string;
  input: CreateSessionInput;
}): Promise<PlaySession> {
  const { groupId, actorUserId, input } = params;
  const playerIds = await validateGroupPlayers(groupId, input.playerIds);

  return prisma.$transaction(async (tx) => {
    const session = await tx.playSession.create({
      data: {
        groupId,
        name: input.name,
        date: input.date,
        location: input.location,
        numberOfCourts: input.numberOfCourts,
        scoringType: input.scoringType,
        pointsToWin: input.pointsToWin,
        winByTwo: input.winByTwo,
        status: PlaySessionStatus.PLANNED,
        createdByUserId: actorUserId,
      },
    });

    await tx.court.createMany({
      data: Array.from({ length: input.numberOfCourts }, (_, i) => ({
        groupId,
        sessionId: session.id,
        name: `Court ${i + 1}`,
        courtNumber: i + 1,
      })),
    });

    if (playerIds.length > 0) {
      await tx.sessionPlayer.createMany({
        data: playerIds.map((playerProfileId, idx) => ({
          sessionId: session.id,
          playerProfileId,
          status: SessionPlayerStatus.AVAILABLE,
          checkInOrder: idx + 1,
        })),
      });
    }

    await logActivity(
      {
        groupId,
        userId: actorUserId,
        action: ActivityAction.SESSION_CREATED,
        targetType: "PlaySession",
        targetId: session.id,
        newValue: {
          name: input.name,
          numberOfCourts: input.numberOfCourts,
          playerCount: playerIds.length,
        },
      },
      tx,
    );

    return session;
  });
}

/** Fetch a session and assert it belongs to `groupId`. */
async function requireSessionInGroup(sessionId: string, groupId: string) {
  const session = await prisma.playSession.findUnique({
    where: { id: sessionId },
    select: { id: true, groupId: true, status: true },
  });
  if (!session || session.groupId !== groupId) {
    throw new NotFoundError("Session not found in this group");
  }
  return session;
}

/**
 * Replace a PLANNED session's available-player set. Adds new SessionPlayer
 * rows (status AVAILABLE, appended check-in order) and removes ones no longer
 * selected. Once a session is ACTIVE the roster is frozen here — players move
 * via match flow in later phases.
 */
export async function setSessionAttendance(params: {
  groupId: string;
  actorUserId: string;
  sessionId: string;
  playerIds: string[];
}): Promise<void> {
  const session = await requireSessionInGroup(
    params.sessionId,
    params.groupId,
  );
  if (session.status !== PlaySessionStatus.PLANNED) {
    throw new SessionActionError(
      "NOT_PLANNED",
      "Attendance can only be edited while the session is planned",
    );
  }

  const desired = await validateGroupPlayers(
    params.groupId,
    params.playerIds,
  );
  const desiredSet = new Set(desired);

  const existing = await prisma.sessionPlayer.findMany({
    where: { sessionId: session.id },
    select: { id: true, playerProfileId: true, checkInOrder: true },
  });
  const existingByPlayer = new Map(
    existing.map((sp) => [sp.playerProfileId, sp]),
  );

  const toRemove = existing.filter(
    (sp) => !desiredSet.has(sp.playerProfileId),
  );
  const toAdd = desired.filter((id) => !existingByPlayer.has(id));
  if (toRemove.length === 0 && toAdd.length === 0) return;

  let nextOrder =
    existing.reduce((max, sp) => Math.max(max, sp.checkInOrder), 0) + 1;

  await prisma.$transaction(async (tx) => {
    if (toRemove.length > 0) {
      await tx.sessionPlayer.deleteMany({
        where: { id: { in: toRemove.map((sp) => sp.id) } },
      });
    }
    if (toAdd.length > 0) {
      await tx.sessionPlayer.createMany({
        data: toAdd.map((playerProfileId) => ({
          sessionId: session.id,
          playerProfileId,
          status: SessionPlayerStatus.AVAILABLE,
          checkInOrder: nextOrder++,
        })),
      });
    }
    await logActivity(
      {
        groupId: params.groupId,
        userId: params.actorUserId,
        action: ActivityAction.SESSION_PLAYERS_UPDATED,
        targetType: "PlaySession",
        targetId: session.id,
        newValue: { added: toAdd.length, removed: toRemove.length },
      },
      tx,
    );
  });
}

/** Move a PLANNED session to ACTIVE. Requires at least one player. */
export async function startSession(params: {
  groupId: string;
  actorUserId: string;
  sessionId: string;
}): Promise<void> {
  const session = await requireSessionInGroup(
    params.sessionId,
    params.groupId,
  );
  if (session.status !== PlaySessionStatus.PLANNED) {
    throw new SessionActionError(
      "NOT_PLANNED",
      "Only a planned session can be started",
    );
  }

  const playerCount = await prisma.sessionPlayer.count({
    where: { sessionId: session.id },
  });
  if (playerCount === 0) {
    throw new SessionActionError(
      "NO_PLAYERS",
      "Add at least one player before starting the session",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.playSession.update({
      where: { id: session.id },
      data: { status: PlaySessionStatus.ACTIVE },
    });
    await logActivity(
      {
        groupId: params.groupId,
        userId: params.actorUserId,
        action: ActivityAction.SESSION_STARTED,
        targetType: "PlaySession",
        targetId: session.id,
        oldValue: { status: session.status },
        newValue: { status: PlaySessionStatus.ACTIVE },
      },
      tx,
    );
  });
}
