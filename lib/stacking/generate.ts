import { mulberry32, shuffled, type Rng } from "./rng";
import {
  buildPairingHistory,
  getSessionPlayerStats,
  type PairingHistory,
} from "./stats";
import {
  enumerateCourtCandidates,
  scoreCandidateMatch,
  type CourtCandidate,
} from "./score";
import type {
  GenerateRoundInput,
  GenerateRoundOutput,
  GeneratedMatch,
  PlayerStats,
} from "./types";

/**
 * Pick `count` players for the upcoming round, ordered to favour the players
 * who've sat the most. Tiebreak chain:
 *   1. fewest gamesPlayed
 *   2. highest roundsSincePlayed
 *   3. lowest checkInOrder (earlier check-in)
 *   4. random (seeded) to break exact ties stably across runs
 */
export function selectPlayersForRound(
  stats: Map<string, PlayerStats>,
  count: number,
  rng: Rng,
): string[] {
  const candidates = Array.from(stats.entries()).map(([id, s]) => ({
    id,
    s,
    // Stable random key per player.
    r: rng(),
  }));
  candidates.sort((a, b) => {
    if (a.s.gamesPlayed !== b.s.gamesPlayed) {
      return a.s.gamesPlayed - b.s.gamesPlayed;
    }
    if (a.s.roundsSincePlayed !== b.s.roundsSincePlayed) {
      // Higher roundsSincePlayed wins (sat longer).
      return b.s.roundsSincePlayed - a.s.roundsSincePlayed;
    }
    if (a.s.checkInOrder !== b.s.checkInOrder) {
      return a.s.checkInOrder - b.s.checkInOrder;
    }
    return a.r - b.r;
  });
  return candidates.slice(0, count).map((c) => c.id);
}

/**
 * Given the selected players (count must be a multiple of 4), arrange them
 * onto courts to minimize total penalty.
 *
 * Strategy:
 *   - Try `attempts` random shufflings of the player list.
 *   - For each shuffling, take consecutive 4-tuples as court groups.
 *   - For each court group, pick the lowest-penalty of its 3 team-splits.
 *   - Keep the global minimum across all attempts.
 *
 * This is a heuristic — exact optimization is exponential in court count.
 * The shuffle-and-score loop hits a quality plateau quickly because most
 * fairness signal is captured by *which players share a court*, not by which
 * of the 3 ways those four are split.
 */
export function assignPlayersToCourts(
  selected: readonly string[],
  history: PairingHistory,
  currentRound: number,
  rng: Rng,
  attempts = 64,
): GeneratedMatch[] {
  if (selected.length % 4 !== 0) {
    throw new Error(
      `assignPlayersToCourts: player count must be a multiple of 4 (got ${selected.length})`,
    );
  }
  const courts = selected.length / 4;

  let best: { matches: GeneratedMatch[]; score: number } | null = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    // First attempt uses input order so deterministic seeds stay sensible.
    const order = attempt === 0 ? selected.slice() : shuffled(selected, rng);
    const matches: GeneratedMatch[] = [];
    let total = 0;

    for (let c = 0; c < courts; c++) {
      const four = [
        order[c * 4],
        order[c * 4 + 1],
        order[c * 4 + 2],
        order[c * 4 + 3],
      ] as [string, string, string, string];

      let bestForCourt: { cand: CourtCandidate; score: number } | null = null;
      for (const cand of enumerateCourtCandidates(four)) {
        const score = scoreCandidateMatch(cand, history, currentRound);
        if (!bestForCourt || score < bestForCourt.score) {
          bestForCourt = { cand, score };
        }
      }
      // enumerateCourtCandidates always returns 3 entries — bestForCourt is set.
      matches.push({
        courtIndex: c,
        team1: bestForCourt!.cand.team1,
        team2: bestForCourt!.cand.team2,
      });
      total += bestForCourt!.score;
    }

    if (!best || total < best.score) best = { matches, score: total };
    if (best.score === 0) break; // can't do better than zero penalty
  }

  // selected.length >= 4 is enforced above, so `best` is non-null.
  return best!.matches;
}

/**
 * Top-level entry point. Pure: same input, same output.
 *
 * Algorithm:
 *   1. Build per-player stats + pairing history.
 *   2. Pick `min(players, courts * 4)` rounded down to a multiple of 4.
 *      The remainder (resting) are returned for the caller to mark.
 *   3. Assign the selected players to courts using a heuristic.
 *
 * For singles support later, the algorithm needs a different selection step
 * (multiples of 2) and a different scorer.
 */
export function generateRoundMatches(
  input: GenerateRoundInput,
): GenerateRoundOutput {
  const { players, history, numberOfCourts } = input;
  if (numberOfCourts < 1) {
    throw new Error("numberOfCourts must be >= 1");
  }

  const rng = mulberry32(input.seed);
  const stats = getSessionPlayerStats(players, history);
  const pairingHistory = buildPairingHistory(history);

  const maxCourtsByPlayers = Math.floor(players.length / 4);
  const courtsUsed = Math.min(numberOfCourts, maxCourtsByPlayers);
  const selectedCount = courtsUsed * 4;

  const selected = selectPlayersForRound(stats, selectedCount, rng);
  const selectedSet = new Set(selected);

  const restingPlayerIds = players
    .map((p) => p.id)
    .filter((id) => !selectedSet.has(id));

  const roundNumber =
    history.reduce(
      (max, m) => (m.roundNumber > max ? m.roundNumber : max),
      0,
    ) + 1;

  const matches =
    selectedCount === 0
      ? []
      : assignPlayersToCourts(selected, pairingHistory, roundNumber, rng);

  return { roundNumber, matches, restingPlayerIds };
}
