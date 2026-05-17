import { matchupKey, pairKey, type PairingHistory } from "./stats";

/**
 * Penalty weights — higher numbers are worse. Tuned by intent, not measurement:
 *   - Repeated partner is the worst sin (the most visible "unfair" outcome).
 *   - Same exact team facing the same exact opponents from a recent round is
 *     just as bad — it's literally a replay.
 *   - Repeated opponents are mildly bad.
 *
 * Imbalance penalty is applied at the player-selection stage, not here.
 */
const REPEATED_PARTNER = 100;
const RECENT_SAME_MATCH = 80; // both teams identical to the immediately-previous round
const REPEATED_OPPONENT = 8;

export type CourtCandidate = {
  team1: [string, string];
  team2: [string, string];
};

/**
 * Score a single court arrangement. Lower is better. Pure: only reads from
 * the precomputed PairingHistory.
 *
 * `currentRound` is the round number we're about to generate. The
 * "recent same match" rule fires when both teams partnered together in
 * `currentRound - 1`.
 */
export function scoreCandidateMatch(
  candidate: CourtCandidate,
  history: PairingHistory,
  currentRound: number,
): number {
  let score = 0;

  const partnerKey1 = pairKey(candidate.team1[0], candidate.team1[1]);
  const partnerKey2 = pairKey(candidate.team2[0], candidate.team2[1]);

  score += (history.partners.get(partnerKey1) ?? 0) * REPEATED_PARTNER;
  score += (history.partners.get(partnerKey2) ?? 0) * REPEATED_PARTNER;

  // True replay: both pairs faced each other *in the same prior match*, not
  // just on different courts in the same round. Track via lastMatchupRound.
  const lastMatchup = history.lastMatchupRound.get(
    matchupKey(partnerKey1, partnerKey2),
  );
  if (lastMatchup !== undefined && lastMatchup >= currentRound - 1) {
    score += RECENT_SAME_MATCH;
  }

  for (const a of candidate.team1) {
    for (const b of candidate.team2) {
      score += (history.opponents.get(pairKey(a, b)) ?? 0) * REPEATED_OPPONENT;
    }
  }

  return score;
}

/**
 * Enumerate the 3 distinct ways to split 4 players into two doubles teams.
 * Given [A,B,C,D]:
 *   - AB vs CD
 *   - AC vs BD
 *   - AD vs BC
 * We always lexicographically order each team and the match itself so the
 * same arrangement isn't scored twice.
 */
export function enumerateCourtCandidates(
  four: readonly [string, string, string, string],
): CourtCandidate[] {
  const [a, b, c, d] = four;
  return [
    { team1: orderPair(a, b), team2: orderPair(c, d) },
    { team1: orderPair(a, c), team2: orderPair(b, d) },
    { team1: orderPair(a, d), team2: orderPair(b, c) },
  ];
}

function orderPair(x: string, y: string): [string, string] {
  return x < y ? [x, y] : [y, x];
}
