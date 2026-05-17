/** Input rows for the stacking algorithm. Plain shapes — no Prisma types. */

export type StackingPlayer = {
  /** PlayerProfile id. */
  id: string;
  /** Order players checked in to the session. Earlier = sooner to play. */
  checkInOrder: number;
};

/** A completed (or queued) match drawn from the session's history. */
export type StackingMatch = {
  roundNumber: number;
  team1: [string, string]; // player ids; doubles assumed
  team2: [string, string];
};

export type GenerateRoundInput = {
  /** Players currently available (status AVAILABLE or WAITING). */
  players: readonly StackingPlayer[];
  /** All previously-generated matches in this session. */
  history: readonly StackingMatch[];
  /** Court count for the session. */
  numberOfCourts: number;
  /** Seed for deterministic tiebreaks. */
  seed: number;
};

export type GeneratedMatch = {
  /** 0-based court index — caller maps this to real Court ids. */
  courtIndex: number;
  team1: [string, string];
  team2: [string, string];
};

export type GenerateRoundOutput = {
  /** New round number (max existing round + 1, or 1 if none yet). */
  roundNumber: number;
  /** One per court used. Doubles only in MVP. */
  matches: GeneratedMatch[];
  /** Players left out this round — WAITING / RESTING in the DB layer. */
  restingPlayerIds: string[];
};

export type PlayerStats = {
  /** Times this player has appeared in any match in the session. */
  gamesPlayed: number;
  /** Rounds since they last played (or `Infinity` if they've never played). */
  roundsSincePlayed: number;
  /** checkInOrder, mirrored for sorting. */
  checkInOrder: number;
};
