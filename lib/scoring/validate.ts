import { WinningTeam } from "@/lib/db/generated/enums";

/** Discriminated union — see validateScore. */
export type ScoreErrorCode =
  | "NOT_INTEGER"
  | "NEGATIVE"
  | "TIED"
  | "WINNER_BELOW_POINTS_TO_WIN"
  | "MUST_WIN_BY_TWO";

const ERROR_MESSAGES: Record<ScoreErrorCode, string> = {
  NOT_INTEGER: "Scores must be whole numbers.",
  NEGATIVE: "Scores can't be negative.",
  TIED: "There must be a winner.",
  WINNER_BELOW_POINTS_TO_WIN: "Winner must reach the points-to-win target.",
  MUST_WIN_BY_TWO: "Winner must lead by at least 2.",
};

export type ScoreValidation =
  | {
      ok: true;
      winner: (typeof WinningTeam)[keyof typeof WinningTeam];
      team1Score: number;
      team2Score: number;
    }
  | {
      ok: false;
      code: ScoreErrorCode;
      message: string;
    };

export type ValidateScoreInput = {
  team1Score: unknown;
  team2Score: unknown;
  pointsToWin: number;
  winByTwo: boolean;
};

/**
 * Pure score validator. Used both when completing a match and when an admin
 * edits a completed score — same rules apply.
 *
 * The validator coerces strings (form payloads) to numbers, then enforces:
 *   1. Both scores are integers (after coercion).
 *   2. Both scores are non-negative.
 *   3. Scores are not tied.
 *   4. The winner's score is at least `pointsToWin`.
 *   5. If `winByTwo`, the winner's lead is at least 2.
 */
export function validateScore(input: ValidateScoreInput): ScoreValidation {
  const team1 = coerceInt(input.team1Score);
  const team2 = coerceInt(input.team2Score);

  if (team1 === null || team2 === null) {
    return fail("NOT_INTEGER");
  }
  if (team1 < 0 || team2 < 0) {
    return fail("NEGATIVE");
  }
  if (team1 === team2) {
    return fail("TIED");
  }

  const team1Wins = team1 > team2;
  const winnerScore = team1Wins ? team1 : team2;
  const loserScore = team1Wins ? team2 : team1;

  if (winnerScore < input.pointsToWin) {
    return fail("WINNER_BELOW_POINTS_TO_WIN");
  }
  if (input.winByTwo && winnerScore - loserScore < 2) {
    return fail("MUST_WIN_BY_TWO");
  }

  return {
    ok: true,
    winner: team1Wins ? WinningTeam.TEAM_1 : WinningTeam.TEAM_2,
    team1Score: team1,
    team2Score: team2,
  };
}

function coerceInt(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isInteger(n) ? n : null;
  }
  return null;
}

function fail(code: ScoreErrorCode): ScoreValidation {
  return { ok: false, code, message: ERROR_MESSAGES[code] };
}
