/**
 * Plain-shape match record used by the stats algorithm. No Prisma types
 * here so the pure functions are trivially unit-testable. Mapped from
 * `prisma.match.findMany` rows by the queries layer.
 *
 * Only COMPLETED matches with both team-2 players are admitted (doubles
 * only in MVP). Scores are guaranteed non-null at that point.
 */
export type StatsMatch = {
  matchId: string;
  roundNumber: number;
  completedAt: Date | null;
  team1: readonly string[]; // PlayerProfile ids
  team2: readonly string[];
  team1Score: number;
  team2Score: number;
  winningTeam: "TEAM_1" | "TEAM_2";
};

export type PlayerStats = {
  playerId: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  /** 0..1; defined as 0 when gamesPlayed === 0. */
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifferential: number;
};

export type PartnerEntry = {
  partnerId: string;
  gamesTogether: number;
  winsTogether: number;
};

export type LeaderboardRow = PlayerStats & { rank: number };
