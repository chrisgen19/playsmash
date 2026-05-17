import {
  prisma,
  CourtStatus,
  MatchStatus,
  SessionPlayerStatus,
} from "@/lib/db";
import { ActivityAction, logActivity } from "@/lib/activity/log";
import { NotFoundError } from "@/lib/permissions/errors";

import { validateScore, type ScoreErrorCode } from "./validate";

/** Action-layer errors. validation errors come from the pure validator. */
export class MatchActionError extends Error {
  constructor(
    public readonly code:
      | "NOT_QUEUED"
      | "NOT_ACTIVE"
      | "NOT_COMPLETED"
      | "ALREADY_COMPLETED"
      | "ALREADY_CANCELLED",
    message: string,
  ) {
    super(message);
    this.name = "MatchActionError";
  }
}

/** Domain error carrying a score-validator code. */
export class ScoreValidationError extends Error {
  constructor(
    public readonly code: ScoreErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ScoreValidationError";
  }
}

/** Player ids on a doubles match (P2 slots are nullable for singles future). */
function playerIdsOnMatch(m: {
  team1Player1Id: string;
  team1Player2Id: string | null;
  team2Player1Id: string;
  team2Player2Id: string | null;
}): string[] {
  return [
    m.team1Player1Id,
    m.team1Player2Id,
    m.team2Player1Id,
    m.team2Player2Id,
  ].filter((id): id is string => !!id);
}

/**
 * Lock the Match row for the rest of the transaction and return its current
 * status. SELECT ... FOR UPDATE serializes concurrent start/complete/cancel
 * on the same match — whichever transaction wins the lock applies its
 * transition; the other reads the updated status and aborts.
 */
async function lockMatchStatus(
  tx: Pick<typeof prisma, "$queryRaw">,
  matchId: string,
): Promise<string | null> {
  const rows = await tx.$queryRaw<Array<{ status: string }>>`
    SELECT "status" FROM "Match" WHERE "id" = ${matchId} FOR UPDATE
  `;
  return rows[0]?.status ?? null;
}

/** Fetch a match and confirm it lives in `groupId` via its session. */
async function requireMatchInGroup(matchId: string, groupId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      sessionId: true,
      courtId: true,
      status: true,
      team1Player1Id: true,
      team1Player2Id: true,
      team2Player1Id: true,
      team2Player2Id: true,
      team1Score: true,
      team2Score: true,
      session: {
        select: {
          groupId: true,
          pointsToWin: true,
          winByTwo: true,
        },
      },
    },
  });
  if (!match || match.session.groupId !== groupId) {
    throw new NotFoundError("Match not found in this group");
  }
  return match;
}

export async function startMatch(params: {
  groupId: string;
  actorUserId: string;
  matchId: string;
}): Promise<void> {
  const match = await requireMatchInGroup(params.matchId, params.groupId);

  await prisma.$transaction(async (tx) => {
    const locked = await lockMatchStatus(tx, match.id);
    if (locked === null) throw new NotFoundError("Match not found");
    if (locked !== MatchStatus.QUEUED) {
      throw new MatchActionError(
        "NOT_QUEUED",
        "Only a queued match can be started",
      );
    }
    await tx.match.update({
      where: { id: match.id },
      data: { status: MatchStatus.ACTIVE, startedAt: new Date() },
    });
    await logActivity(
      {
        groupId: params.groupId,
        userId: params.actorUserId,
        action: ActivityAction.MATCH_STARTED,
        targetType: "Match",
        targetId: match.id,
        oldValue: { status: locked },
        newValue: { status: MatchStatus.ACTIVE },
      },
      tx,
    );
  });
}

export async function completeMatch(params: {
  groupId: string;
  actorUserId: string;
  matchId: string;
  team1Score: unknown;
  team2Score: unknown;
}): Promise<{ winner: "TEAM_1" | "TEAM_2" }> {
  const match = await requireMatchInGroup(params.matchId, params.groupId);

  const validation = validateScore({
    team1Score: params.team1Score,
    team2Score: params.team2Score,
    pointsToWin: match.session.pointsToWin,
    winByTwo: match.session.winByTwo,
  });
  if (!validation.ok) {
    throw new ScoreValidationError(validation.code, validation.message);
  }

  await prisma.$transaction(async (tx) => {
    const locked = await lockMatchStatus(tx, match.id);
    if (locked === null) throw new NotFoundError("Match not found");
    if (locked !== MatchStatus.ACTIVE) {
      throw new MatchActionError(
        "NOT_ACTIVE",
        "Only an active match can be completed",
      );
    }

    await tx.match.update({
      where: { id: match.id },
      data: {
        status: MatchStatus.COMPLETED,
        team1Score: validation.team1Score,
        team2Score: validation.team2Score,
        winningTeam: validation.winner,
        completedAt: new Date(),
      },
    });

    // Free the court.
    if (match.courtId) {
      await tx.court.update({
        where: { id: match.courtId },
        data: { status: CourtStatus.AVAILABLE },
      });
    }

    // Move the four players back to WAITING so they're eligible for the
    // next round generation. Players might already be in some other state
    // if an admin manually moved them — the explicit id-list update only
    // touches the four on this match.
    const playerIds = playerIdsOnMatch(match);
    if (playerIds.length > 0) {
      await tx.sessionPlayer.updateMany({
        where: {
          sessionId: match.sessionId,
          playerProfileId: { in: playerIds },
        },
        data: { status: SessionPlayerStatus.WAITING },
      });
    }

    await logActivity(
      {
        groupId: params.groupId,
        userId: params.actorUserId,
        action: ActivityAction.MATCH_COMPLETED,
        targetType: "Match",
        targetId: match.id,
        oldValue: { status: locked },
        newValue: {
          status: MatchStatus.COMPLETED,
          team1Score: validation.team1Score,
          team2Score: validation.team2Score,
          winningTeam: validation.winner,
        },
      },
      tx,
    );
  });

  return { winner: validation.winner };
}

export async function cancelMatch(params: {
  groupId: string;
  actorUserId: string;
  matchId: string;
}): Promise<void> {
  const match = await requireMatchInGroup(params.matchId, params.groupId);

  await prisma.$transaction(async (tx) => {
    const locked = await lockMatchStatus(tx, match.id);
    if (locked === null) throw new NotFoundError("Match not found");
    if (locked === MatchStatus.COMPLETED) {
      throw new MatchActionError(
        "ALREADY_COMPLETED",
        "A completed match can't be cancelled",
      );
    }
    if (locked === MatchStatus.CANCELLED) {
      throw new MatchActionError(
        "ALREADY_CANCELLED",
        "Match is already cancelled",
      );
    }

    await tx.match.update({
      where: { id: match.id },
      data: { status: MatchStatus.CANCELLED, completedAt: new Date() },
    });

    if (match.courtId) {
      await tx.court.update({
        where: { id: match.courtId },
        data: { status: CourtStatus.AVAILABLE },
      });
    }

    const playerIds = playerIdsOnMatch(match);
    if (playerIds.length > 0) {
      await tx.sessionPlayer.updateMany({
        where: {
          sessionId: match.sessionId,
          playerProfileId: { in: playerIds },
        },
        data: { status: SessionPlayerStatus.WAITING },
      });
    }

    await logActivity(
      {
        groupId: params.groupId,
        userId: params.actorUserId,
        action: ActivityAction.MATCH_CANCELLED,
        targetType: "Match",
        targetId: match.id,
        oldValue: { status: locked },
        newValue: { status: MatchStatus.CANCELLED },
      },
      tx,
    );
  });
}

export async function editMatchScore(params: {
  groupId: string;
  actorUserId: string;
  matchId: string;
  team1Score: unknown;
  team2Score: unknown;
}): Promise<void> {
  const match = await requireMatchInGroup(params.matchId, params.groupId);
  if (match.status !== MatchStatus.COMPLETED) {
    throw new MatchActionError(
      "NOT_COMPLETED",
      "Only completed matches can have their score edited",
    );
  }

  const validation = validateScore({
    team1Score: params.team1Score,
    team2Score: params.team2Score,
    pointsToWin: match.session.pointsToWin,
    winByTwo: match.session.winByTwo,
  });
  if (!validation.ok) {
    throw new ScoreValidationError(validation.code, validation.message);
  }

  // Idempotent: if score + winner are unchanged, log nothing and exit.
  if (
    match.team1Score === validation.team1Score &&
    match.team2Score === validation.team2Score
  ) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    // Re-fetch under a lock so two concurrent edits don't race.
    const locked = await lockMatchStatus(tx, match.id);
    if (locked === null) throw new NotFoundError("Match not found");
    if (locked !== MatchStatus.COMPLETED) {
      throw new MatchActionError(
        "NOT_COMPLETED",
        "Only completed matches can have their score edited",
      );
    }

    await tx.match.update({
      where: { id: match.id },
      data: {
        team1Score: validation.team1Score,
        team2Score: validation.team2Score,
        winningTeam: validation.winner,
      },
    });

    await logActivity(
      {
        groupId: params.groupId,
        userId: params.actorUserId,
        action: ActivityAction.MATCH_SCORE_EDITED,
        targetType: "Match",
        targetId: match.id,
        oldValue: {
          team1Score: match.team1Score,
          team2Score: match.team2Score,
        },
        newValue: {
          team1Score: validation.team1Score,
          team2Score: validation.team2Score,
          winningTeam: validation.winner,
        },
      },
      tx,
    );
  });
}
