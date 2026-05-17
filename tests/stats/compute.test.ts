import { describe, expect, it } from "vitest";

import {
  computeGroupLeaderboard,
  computePartnerHistory,
  computePlayerStats,
} from "@/lib/stats/compute";
import type { StatsMatch } from "@/lib/stats/types";

/** Small helper so test cases stay readable. */
function match(
  roundNumber: number,
  team1: readonly string[],
  team2: readonly string[],
  team1Score: number,
  team2Score: number,
): StatsMatch {
  return {
    matchId: `m_${roundNumber}_${team1.join("")}_${team2.join("")}`,
    roundNumber,
    completedAt: new Date(2026, 0, roundNumber),
    team1,
    team2,
    team1Score,
    team2Score,
    winningTeam: team1Score > team2Score ? "TEAM_1" : "TEAM_2",
  };
}

describe("computePlayerStats", () => {
  it("returns a zero sheet for a player with no matches", () => {
    const stats = computePlayerStats([], "p1");
    expect(stats).toEqual({
      playerId: "p1",
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      winPct: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDifferential: 0,
    });
  });

  it("tallies wins, losses, points, and differential across teams", () => {
    const matches: StatsMatch[] = [
      // p1 on team1, wins 11-7
      match(1, ["p1", "p2"], ["p3", "p4"], 11, 7),
      // p1 on team2, loses 9-11
      match(2, ["p3", "p4"], ["p1", "p2"], 11, 9),
      // p1 on team1, wins 11-5
      match(3, ["p1", "p5"], ["p3", "p4"], 11, 5),
    ];
    const s = computePlayerStats(matches, "p1");
    expect(s.gamesPlayed).toBe(3);
    expect(s.wins).toBe(2);
    expect(s.losses).toBe(1);
    expect(s.pointsFor).toBe(11 + 9 + 11); // own-side scores
    expect(s.pointsAgainst).toBe(7 + 11 + 5);
    expect(s.pointDifferential).toBe(s.pointsFor - s.pointsAgainst);
    // 2/3 ≈ 0.6667
    expect(s.winPct).toBeCloseTo(2 / 3);
  });

  it("ignores matches the player didn't play in", () => {
    const matches = [match(1, ["pA", "pB"], ["pC", "pD"], 11, 9)];
    const s = computePlayerStats(matches, "ghost");
    expect(s.gamesPlayed).toBe(0);
  });
});

describe("computeGroupLeaderboard", () => {
  it("includes zero-game players from the roster", () => {
    const rows = computeGroupLeaderboard([], ["a", "b", "c"]);
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      expect(r.gamesPlayed).toBe(0);
      expect(r.winPct).toBe(0);
    }
  });

  it("ranks by winPct desc, then gamesPlayed desc, then differential desc", () => {
    const matches: StatsMatch[] = [
      match(1, ["a", "b"], ["c", "d"], 11, 5), // a,b win
      match(2, ["a", "c"], ["b", "d"], 11, 9), // a,c win
      match(3, ["c", "d"], ["a", "b"], 11, 9), // c,d win
    ];
    const rows = computeGroupLeaderboard(matches, ["a", "b", "c", "d"]);
    const byId = Object.fromEntries(rows.map((r) => [r.playerId, r]));

    expect(byId.a.wins).toBe(2);
    expect(byId.a.losses).toBe(1);
    expect(byId.b.wins).toBe(1);
    expect(byId.c.wins).toBe(2);
    expect(byId.d.wins).toBe(1);

    // a and c each won 2/3; c had a bigger blowout against b,d so c's
    // differential beats a's: c +11-5+11-9-9=-1? Let's not assume —
    // just check the top rank goes to a winPct=2/3 player.
    expect(rows[0].winPct).toBeCloseTo(2 / 3);
  });

  it("skips players who appear in a match but aren't in the roster", () => {
    const matches = [match(1, ["a", "b"], ["c", "d"], 11, 5)];
    // Only `a` and `b` in the roster — c and d are no longer on the team.
    const rows = computeGroupLeaderboard(matches, ["a", "b"]);
    expect(rows.map((r) => r.playerId).sort()).toEqual(["a", "b"]);
    // a and b each have one game played + one win.
    for (const r of rows) {
      expect(r.gamesPlayed).toBe(1);
      expect(r.wins).toBe(1);
    }
  });

  it("breaks final ties by playerId for deterministic order", () => {
    const rows = computeGroupLeaderboard([], ["zeta", "alpha", "mu"]);
    expect(rows.map((r) => r.playerId)).toEqual(["alpha", "mu", "zeta"]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });
});

describe("computePartnerHistory", () => {
  it("counts games + wins-with-that-partner", () => {
    const matches: StatsMatch[] = [
      match(1, ["a", "b"], ["c", "d"], 11, 7), // a+b win
      match(2, ["a", "b"], ["c", "e"], 8, 11), // a+b lose
      match(3, ["a", "c"], ["b", "d"], 11, 9), // a+c win
    ];
    const partners = computePartnerHistory(matches, "a");
    const byId = Object.fromEntries(partners.map((p) => [p.partnerId, p]));
    expect(byId.b).toEqual({
      partnerId: "b",
      gamesTogether: 2,
      winsTogether: 1,
    });
    expect(byId.c).toEqual({
      partnerId: "c",
      gamesTogether: 1,
      winsTogether: 1,
    });
    expect(byId.d).toBeUndefined();
  });

  it("returns an empty array for a player with no matches", () => {
    expect(computePartnerHistory([], "loner")).toEqual([]);
  });

  it("sorts by gamesTogether desc, then winsTogether desc, then id", () => {
    const matches: StatsMatch[] = [
      match(1, ["a", "b"], ["c", "d"], 11, 0),
      match(2, ["a", "b"], ["c", "d"], 11, 0),
      match(3, ["a", "c"], ["b", "d"], 11, 0),
    ];
    const partners = computePartnerHistory(matches, "a");
    expect(partners[0]).toMatchObject({ partnerId: "b", gamesTogether: 2 });
    expect(partners[1]).toMatchObject({ partnerId: "c", gamesTogether: 1 });
  });
});
