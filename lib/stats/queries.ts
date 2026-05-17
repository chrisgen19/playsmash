import {
  prisma,
  MatchStatus,
  PlayerStatus,
} from "@/lib/db";
import { NotFoundError } from "@/lib/permissions/errors";

import {
  computeGroupLeaderboard,
  computePartnerHistory,
  computePlayerStats,
} from "./compute";
import type {
  LeaderboardRow,
  PartnerEntry,
  PlayerStats,
  StatsMatch,
} from "./types";

/**
 * Convert a Prisma match row into the plain shape the stats algorithm reads.
 * Doubles-only — we drop matches that don't have both team-2 players, and
 * matches that are not COMPLETED never reach this function in the first place.
 */
function toStatsMatch(m: {
  id: string;
  roundNumber: number;
  completedAt: Date | null;
  team1Player1Id: string;
  team1Player2Id: string | null;
  team2Player1Id: string;
  team2Player2Id: string | null;
  team1Score: number | null;
  team2Score: number | null;
  winningTeam: string | null;
}): StatsMatch | null {
  if (
    m.team1Player2Id === null ||
    m.team2Player2Id === null ||
    m.team1Score === null ||
    m.team2Score === null ||
    m.winningTeam === null
  ) {
    return null;
  }
  return {
    matchId: m.id,
    roundNumber: m.roundNumber,
    completedAt: m.completedAt,
    team1: [m.team1Player1Id, m.team1Player2Id],
    team2: [m.team2Player1Id, m.team2Player2Id],
    team1Score: m.team1Score,
    team2Score: m.team2Score,
    winningTeam: m.winningTeam as "TEAM_1" | "TEAM_2",
  };
}

const MATCH_SELECT = {
  id: true,
  roundNumber: true,
  completedAt: true,
  team1Player1Id: true,
  team1Player2Id: true,
  team2Player1Id: true,
  team2Player2Id: true,
  team1Score: true,
  team2Score: true,
  winningTeam: true,
} as const;

/**
 * Leaderboard for an entire group. Includes every non-REMOVED player profile
 * so the roster is complete (zero-game players show up at the bottom), and
 * uses every completed match across all sessions for the maths.
 *
 * Caller must have already authorized read access to `groupId` via
 * `requireGroupRole(groupId, ANY_MEMBER)`.
 */
export async function getGroupLeaderboard(
  groupId: string,
): Promise<{ rows: LeaderboardRow[]; players: PlayerHeader[] }> {
  const [players, rawMatches] = await Promise.all([
    prisma.playerProfile.findMany({
      where: { groupId, status: { not: PlayerStatus.REMOVED } },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true, status: true, userId: true },
    }),
    prisma.match.findMany({
      where: {
        status: MatchStatus.COMPLETED,
        session: { groupId },
      },
      select: MATCH_SELECT,
    }),
  ]);

  const matches = rawMatches
    .map(toStatsMatch)
    .filter((m): m is StatsMatch => m !== null);
  const rows = computeGroupLeaderboard(
    matches,
    players.map((p) => p.id),
  );
  return { rows, players };
}

/** Same as the group leaderboard but scoped to a single session. */
export async function getSessionLeaderboard(
  sessionId: string,
  groupId: string,
): Promise<{ rows: LeaderboardRow[]; players: PlayerHeader[] }> {
  // Tenant isolation: ensure the session belongs to the group before reading
  // its matches — never trust a session id from the URL.
  const session = await prisma.playSession.findUnique({
    where: { id: sessionId },
    select: { groupId: true },
  });
  if (!session || session.groupId !== groupId) {
    throw new NotFoundError("Session not found in this group");
  }

  const [sessionPlayers, rawMatches] = await Promise.all([
    prisma.sessionPlayer.findMany({
      where: { sessionId },
      orderBy: { checkInOrder: "asc" },
      select: {
        player: {
          select: { id: true, displayName: true, status: true, userId: true },
        },
      },
    }),
    prisma.match.findMany({
      where: { sessionId, status: MatchStatus.COMPLETED },
      select: MATCH_SELECT,
    }),
  ]);

  const players = sessionPlayers.map((sp) => sp.player);
  const matches = rawMatches
    .map(toStatsMatch)
    .filter((m): m is StatsMatch => m !== null);
  const rows = computeGroupLeaderboard(
    matches,
    players.map((p) => p.id),
  );
  return { rows, players };
}

export type PlayerHistoryEntry = StatsMatch & {
  sessionId: string;
  sessionName: string;
  partners: string[]; // partner display names, in roster order
  opponents: string[];
  result: "W" | "L";
};

export type PlayerHeader = {
  id: string;
  displayName: string;
  status: string;
  userId: string | null;
};

/**
 * Per-player page: header, computed stats, partner table, recent matches
 * with the names of partners + opponents and a W/L marker. Authorized by
 * the caller (`requireGroupRole(groupId, ANY_MEMBER)`).
 */
export async function getPlayerHistory(
  playerId: string,
  groupId: string,
): Promise<{
  player: PlayerHeader;
  stats: PlayerStats;
  partners: (PartnerEntry & { displayName: string })[];
  recent: PlayerHistoryEntry[];
}> {
  const player = await prisma.playerProfile.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      groupId: true,
      displayName: true,
      status: true,
      userId: true,
    },
  });
  if (!player || player.groupId !== groupId) {
    throw new NotFoundError("Player not found in this group");
  }

  const rawMatches = await prisma.match.findMany({
    where: {
      status: MatchStatus.COMPLETED,
      session: { groupId },
      OR: [
        { team1Player1Id: playerId },
        { team1Player2Id: playerId },
        { team2Player1Id: playerId },
        { team2Player2Id: playerId },
      ],
    },
    orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
    select: {
      ...MATCH_SELECT,
      sessionId: true,
      session: { select: { name: true } },
    },
  });

  const statsMatches = rawMatches
    .map((m) => {
      const sm = toStatsMatch(m);
      return sm ? { sm, sessionId: m.sessionId, sessionName: m.session.name } : null;
    })
    .filter(
      (x): x is { sm: StatsMatch; sessionId: string; sessionName: string } =>
        x !== null,
    );

  const justMatches = statsMatches.map((x) => x.sm);
  const stats = computePlayerStats(justMatches, playerId);
  const partnerEntries = computePartnerHistory(justMatches, playerId);

  // Display-name lookup so the UI doesn't need to fan out N round-trips.
  const otherIds = new Set<string>();
  for (const m of justMatches) {
    for (const pid of [...m.team1, ...m.team2]) {
      if (pid !== playerId) otherIds.add(pid);
    }
  }
  const profiles = await prisma.playerProfile.findMany({
    where: { id: { in: Array.from(otherIds) } },
    select: { id: true, displayName: true },
  });
  const nameById = new Map(profiles.map((p) => [p.id, p.displayName]));

  const partners = partnerEntries.map((e) => ({
    ...e,
    displayName: nameById.get(e.partnerId) ?? "Unknown",
  }));

  const recent: PlayerHistoryEntry[] = statsMatches
    .slice(0, 20)
    .map(({ sm, sessionId, sessionName }) => {
      const onTeam1 = sm.team1.includes(playerId);
      const myTeam = onTeam1 ? sm.team1 : sm.team2;
      const theirTeam = onTeam1 ? sm.team2 : sm.team1;
      const won = onTeam1
        ? sm.winningTeam === "TEAM_1"
        : sm.winningTeam === "TEAM_2";
      return {
        ...sm,
        sessionId,
        sessionName,
        partners: myTeam
          .filter((pid) => pid !== playerId)
          .map((pid) => nameById.get(pid) ?? "Unknown"),
        opponents: theirTeam.map((pid) => nameById.get(pid) ?? "Unknown"),
        result: won ? "W" : "L",
      };
    });

  return { player, stats, partners, recent };
}
