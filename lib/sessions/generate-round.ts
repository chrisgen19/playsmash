import {
  prisma,
  CourtStatus,
  MatchStatus,
  PlaySessionStatus,
  SessionPlayerStatus,
} from "@/lib/db";
import { ActivityAction, logActivity } from "@/lib/activity/log";
import { NotFoundError } from "@/lib/permissions/errors";
import {
  generateRoundMatches,
  type StackingMatch,
  type StackingPlayer,
} from "@/lib/stacking";

export class GenerateRoundError extends Error {
  constructor(
    public readonly code:
      | "SESSION_NOT_ACTIVE"
      | "ROUND_IN_PROGRESS"
      | "NOT_ENOUGH_PLAYERS",
    message: string,
  ) {
    super(message);
    this.name = "GenerateRoundError";
  }
}

export type GenerateRoundResult = {
  roundNumber: number;
  matchesCreated: number;
  restingCount: number;
};

/**
 * Phase 4 entry point on the DB side. Loads the session, runs the pure
 * stacking algorithm, then persists the round atomically: new Match rows,
 * SessionPlayer.status flips (PLAYING / WAITING / RESTING), and Court status.
 *
 * Guards:
 *   - Session must belong to `groupId` (tenant isolation).
 *   - Session must be ACTIVE.
 *   - No QUEUED/ACTIVE match may exist — finish or cancel the current round first.
 *   - At least 4 AVAILABLE/WAITING players are required.
 */
export async function generateNextRound(params: {
  groupId: string;
  actorUserId: string;
  sessionId: string;
}): Promise<GenerateRoundResult> {
  const { groupId, actorUserId, sessionId } = params;

  const session = await prisma.playSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      groupId: true,
      status: true,
      numberOfCourts: true,
      courts: {
        orderBy: { courtNumber: "asc" },
        select: { id: true, courtNumber: true },
      },
    },
  });
  if (!session || session.groupId !== groupId) {
    throw new NotFoundError("Session not found in this group");
  }
  if (session.status !== PlaySessionStatus.ACTIVE) {
    throw new GenerateRoundError(
      "SESSION_NOT_ACTIVE",
      "Only an active session can generate a round",
    );
  }

  const openMatchCount = await prisma.match.count({
    where: {
      sessionId,
      status: { in: [MatchStatus.QUEUED, MatchStatus.ACTIVE] },
    },
  });
  if (openMatchCount > 0) {
    throw new GenerateRoundError(
      "ROUND_IN_PROGRESS",
      "Finish or cancel the current round before generating a new one",
    );
  }

  // Players available to play this round. LEFT players are skipped.
  const sessionPlayers = await prisma.sessionPlayer.findMany({
    where: {
      sessionId,
      status: {
        in: [
          SessionPlayerStatus.AVAILABLE,
          SessionPlayerStatus.WAITING,
          SessionPlayerStatus.RESTING,
        ],
      },
    },
    select: { id: true, playerProfileId: true, checkInOrder: true },
  });
  if (sessionPlayers.length < 4) {
    throw new GenerateRoundError(
      "NOT_ENOUGH_PLAYERS",
      "Need at least 4 available players to generate a round",
    );
  }

  // Completed history feeds the algorithm. Cancelled rounds are ignored —
  // they didn't happen for fairness purposes.
  const completed = await prisma.match.findMany({
    where: { sessionId, status: MatchStatus.COMPLETED },
    select: {
      roundNumber: true,
      team1Player1Id: true,
      team1Player2Id: true,
      team2Player1Id: true,
      team2Player2Id: true,
    },
  });

  const algoPlayers: StackingPlayer[] = sessionPlayers.map((sp) => ({
    id: sp.playerProfileId,
    checkInOrder: sp.checkInOrder,
  }));

  const algoHistory: StackingMatch[] = completed
    // Doubles-only for the MVP algorithm; skip singles rows defensively.
    .filter(
      (
        m,
      ): m is typeof m & {
        team1Player2Id: string;
        team2Player2Id: string;
      } => m.team1Player2Id !== null && m.team2Player2Id !== null,
    )
    .map((m) => ({
      roundNumber: m.roundNumber,
      team1: [m.team1Player1Id, m.team1Player2Id],
      team2: [m.team2Player1Id, m.team2Player2Id],
    }));

  // Seed mixes session id + current round so re-runs of the same round
  // (after a cancelled round, say) are stable, while different rounds
  // explore different shuffles.
  const seed =
    hashSeed(session.id) ^
    ((completed.reduce((max, m) => Math.max(max, m.roundNumber), 0) + 1) <<
      16);

  const result = generateRoundMatches({
    players: algoPlayers,
    history: algoHistory,
    numberOfCourts: session.numberOfCourts,
    seed,
  });

  // Map session-player id by player-profile id so we can flip statuses.
  const spByProfile = new Map(
    sessionPlayers.map((sp) => [sp.playerProfileId, sp.id]),
  );

  await prisma.$transaction(async (tx) => {
    for (const match of result.matches) {
      const court = session.courts[match.courtIndex];
      await tx.match.create({
        data: {
          sessionId,
          courtId: court?.id ?? null,
          roundNumber: result.roundNumber,
          team1Player1Id: match.team1[0],
          team1Player2Id: match.team1[1],
          team2Player1Id: match.team2[0],
          team2Player2Id: match.team2[1],
          status: MatchStatus.QUEUED,
        },
      });
      if (court?.id) {
        await tx.court.update({
          where: { id: court.id },
          data: { status: CourtStatus.IN_USE },
        });
      }
    }

    // Players in the round → PLAYING. Resting → RESTING. Anyone else who was
    // AVAILABLE/WAITING but not selected stays WAITING for visibility.
    const playingProfileIds = new Set(
      result.matches.flatMap((m) => [...m.team1, ...m.team2]),
    );
    const playingIds = [...playingProfileIds]
      .map((pid) => spByProfile.get(pid))
      .filter((x): x is string => Boolean(x));
    const restingIds = result.restingPlayerIds
      .map((pid) => spByProfile.get(pid))
      .filter((x): x is string => Boolean(x));

    if (playingIds.length > 0) {
      await tx.sessionPlayer.updateMany({
        where: { id: { in: playingIds } },
        data: { status: SessionPlayerStatus.PLAYING },
      });
    }
    if (restingIds.length > 0) {
      await tx.sessionPlayer.updateMany({
        where: { id: { in: restingIds } },
        data: { status: SessionPlayerStatus.RESTING },
      });
    }

    await logActivity(
      {
        groupId,
        userId: actorUserId,
        action: ActivityAction.SESSION_ROUND_GENERATED,
        targetType: "PlaySession",
        targetId: sessionId,
        newValue: {
          roundNumber: result.roundNumber,
          matches: result.matches.length,
          resting: result.restingPlayerIds.length,
        },
      },
      tx,
    );
  });

  return {
    roundNumber: result.roundNumber,
    matchesCreated: result.matches.length,
    restingCount: result.restingPlayerIds.length,
  };
}

/** djb2-style hash of a string into a 32-bit int. Stable across runtimes. */
function hashSeed(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return h >>> 0;
}
