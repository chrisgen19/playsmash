import { describe, expect, it } from "vitest";

import {
  assignPlayersToCourts,
  buildPairingHistory,
  generateRoundMatches,
  mulberry32,
  pairKey,
  scoreCandidateMatch,
  type GenerateRoundOutput,
  type StackingMatch,
  type StackingPlayer,
} from "@/lib/stacking";

const FIXED_SEED = 42;

function makePlayers(n: number): StackingPlayer[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    checkInOrder: i + 1,
  }));
}

/** Every player id that appears in the round, across both teams of every match. */
function playersInRound(out: GenerateRoundOutput): string[] {
  return out.matches.flatMap((m) => [...m.team1, ...m.team2]);
}

describe("generateRoundMatches — shape & invariants", () => {
  it("4 players, 1 court → exactly 1 match, 0 resting", () => {
    const out = generateRoundMatches({
      players: makePlayers(4),
      history: [],
      numberOfCourts: 1,
      seed: FIXED_SEED,
    });
    expect(out.matches).toHaveLength(1);
    expect(out.restingPlayerIds).toEqual([]);
    expect(out.matches[0].team1).toHaveLength(2);
    expect(out.matches[0].team2).toHaveLength(2);
    expect(out.roundNumber).toBe(1);
  });

  it("8 players, 2 courts → 2 matches, 0 resting", () => {
    const out = generateRoundMatches({
      players: makePlayers(8),
      history: [],
      numberOfCourts: 2,
      seed: FIXED_SEED,
    });
    expect(out.matches).toHaveLength(2);
    expect(out.restingPlayerIds).toEqual([]);
    expect(playersInRound(out)).toHaveLength(8);
  });

  it("9 players, 2 courts → 2 matches, 1 resting", () => {
    const out = generateRoundMatches({
      players: makePlayers(9),
      history: [],
      numberOfCourts: 2,
      seed: FIXED_SEED,
    });
    expect(out.matches).toHaveLength(2);
    expect(out.restingPlayerIds).toHaveLength(1);
    expect(playersInRound(out)).toHaveLength(8);
  });

  it("court count is capped by available players", () => {
    // 5 players, 3 courts requested — only 1 court fits, 1 resting.
    const out = generateRoundMatches({
      players: makePlayers(5),
      history: [],
      numberOfCourts: 3,
      seed: FIXED_SEED,
    });
    expect(out.matches).toHaveLength(1);
    expect(out.restingPlayerIds).toHaveLength(1);
  });

  it("never places the same player twice in a round", () => {
    const out = generateRoundMatches({
      players: makePlayers(12),
      history: [],
      numberOfCourts: 3,
      seed: FIXED_SEED,
    });
    const all = playersInRound(out);
    const unique = new Set(all);
    expect(unique.size).toBe(all.length);
    // And no overlap with resting.
    for (const r of out.restingPlayerIds) expect(unique.has(r)).toBe(false);
  });

  it("is deterministic for the same input + seed", () => {
    const input = {
      players: makePlayers(8),
      history: [] as StackingMatch[],
      numberOfCourts: 2,
      seed: 1234,
    };
    const a = generateRoundMatches(input);
    const b = generateRoundMatches(input);
    expect(b).toEqual(a);
  });
});

describe("scoreCandidateMatch — penalty signal", () => {
  it("penalises repeated partners", () => {
    const history = buildPairingHistory([
      { roundNumber: 1, team1: ["p1", "p2"], team2: ["p3", "p4"] },
    ]);
    const sameTeam = scoreCandidateMatch(
      { team1: ["p1", "p2"], team2: ["p5", "p6"] },
      history,
      2,
    );
    const newTeam = scoreCandidateMatch(
      { team1: ["p1", "p5"], team2: ["p2", "p6"] },
      history,
      2,
    );
    expect(sameTeam).toBeGreaterThan(newTeam);
  });

  it("penalises an identical replay of the previous round's match", () => {
    const history = buildPairingHistory([
      { roundNumber: 1, team1: ["p1", "p2"], team2: ["p3", "p4"] },
    ]);
    const replay = scoreCandidateMatch(
      { team1: ["p1", "p2"], team2: ["p3", "p4"] },
      history,
      2,
    );
    const onlyOneRepeatedPair = scoreCandidateMatch(
      { team1: ["p1", "p2"], team2: ["p5", "p6"] },
      history,
      2,
    );
    expect(replay).toBeGreaterThan(onlyOneRepeatedPair);
  });

  it("does NOT replay-penalise pairs that played in the same round on different courts", () => {
    // Round 1 had two matches on two courts:
    //   Court A: (p1,p2) vs (p3,p4)
    //   Court B: (p5,p6) vs (p7,p8)
    // For round 2, putting (p1,p2) vs (p5,p6) keeps both partner pairs from
    // round 1 — but they never faced each other, so it must NOT be flagged
    // as a recent replay (the old, broken code did flag it).
    const history = buildPairingHistory([
      { roundNumber: 1, team1: ["p1", "p2"], team2: ["p3", "p4"] },
      { roundNumber: 1, team1: ["p5", "p6"], team2: ["p7", "p8"] },
    ]);
    const crossMatch = scoreCandidateMatch(
      { team1: ["p1", "p2"], team2: ["p5", "p6"] },
      history,
      2,
    );
    const trueReplay = scoreCandidateMatch(
      { team1: ["p1", "p2"], team2: ["p3", "p4"] },
      history,
      2,
    );
    // The true replay must be strictly worse than the cross-match arrangement.
    expect(trueReplay).toBeGreaterThan(crossMatch);
    // And the cross-match arrangement carries no replay penalty bump —
    // its penalty is exactly two repeated partners, nothing else.
    // (2 partners * 100 = 200, no opponents repeated since p1/p2 never faced p5/p6.)
    expect(crossMatch).toBe(200);
  });
});

describe("fairness over multiple rounds", () => {
  /**
   * Roll the algorithm forward N rounds and feed each round's matches back
   * in as history. With 8 players and 2 courts everyone plays every round —
   * the test below covers the resting-rotation case.
   */
  function runRounds(
    players: StackingPlayer[],
    courts: number,
    rounds: number,
    seed: number,
  ): {
    history: StackingMatch[];
    gamesPlayed: Map<string, number>;
    partners: Map<string, number>;
  } {
    const history: StackingMatch[] = [];
    const gamesPlayed = new Map<string, number>(
      players.map((p) => [p.id, 0]),
    );
    for (let r = 0; r < rounds; r++) {
      const out = generateRoundMatches({
        players,
        history,
        numberOfCourts: courts,
        seed: seed + r,
      });
      for (const m of out.matches) {
        history.push({
          roundNumber: out.roundNumber,
          team1: m.team1,
          team2: m.team2,
        });
        for (const id of [...m.team1, ...m.team2]) {
          gamesPlayed.set(id, (gamesPlayed.get(id) ?? 0) + 1);
        }
      }
    }
    // Pairing counts.
    const partners = buildPairingHistory(history).partners;
    return { history, gamesPlayed, partners };
  }

  it("rotates resting players fairly with 9 players / 2 courts over 9 rounds", () => {
    const players = makePlayers(9);
    const { gamesPlayed } = runRounds(players, 2, 9, 7);
    const counts = Array.from(gamesPlayed.values());
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    // 9 rounds × 8 player-slots / 9 players = 8 games/player average.
    // The spec allows a small drift; assert it stays within 1.
    expect(max - min).toBeLessThanOrEqual(1);
  });

  it("avoids repeating partners when the math allows it (8 players / 2 courts / 3 rounds)", () => {
    // 8 players forms C(8,2)=28 possible pairs; 3 rounds use only 3*2=6
    // distinct partner pairs, so a fair scheduler should never repeat a pair.
    const players = makePlayers(8);
    const { partners } = runRounds(players, 2, 3, 11);
    for (const [key, count] of partners) {
      expect(count, `pair ${key} repeated`).toBe(1);
    }
  });

  it("no duplicate player slot across rounds (sanity)", () => {
    const players = makePlayers(12);
    const { history } = runRounds(players, 3, 5, 99);
    // Within each round, every player appears at most once.
    const byRound = new Map<number, Set<string>>();
    for (const m of history) {
      const set = byRound.get(m.roundNumber) ?? new Set<string>();
      for (const id of [...m.team1, ...m.team2]) {
        expect(set.has(id), `${id} duplicated in round ${m.roundNumber}`).toBe(
          false,
        );
        set.add(id);
      }
      byRound.set(m.roundNumber, set);
    }
  });
});

describe("pairKey", () => {
  it("is order-independent", () => {
    expect(pairKey("a", "b")).toBe(pairKey("b", "a"));
  });
});

describe("assignPlayersToCourts — input guards", () => {
  it("throws when attempts is not a positive integer", () => {
    const rng = mulberry32(1);
    const history = buildPairingHistory([]);
    const four = ["p1", "p2", "p3", "p4"];
    expect(() =>
      assignPlayersToCourts(four, history, 1, rng, 0),
    ).toThrow(RangeError);
    expect(() =>
      assignPlayersToCourts(four, history, 1, rng, -3),
    ).toThrow(RangeError);
    expect(() =>
      assignPlayersToCourts(four, history, 1, rng, 1.5),
    ).toThrow(RangeError);
  });

  it("works with the minimum attempts (1)", () => {
    const rng = mulberry32(1);
    const history = buildPairingHistory([]);
    const matches = assignPlayersToCourts(
      ["p1", "p2", "p3", "p4"],
      history,
      1,
      rng,
      1,
    );
    expect(matches).toHaveLength(1);
  });
});
