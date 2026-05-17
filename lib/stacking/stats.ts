import type {
  PlayerStats,
  StackingMatch,
  StackingPlayer,
} from "./types";

/**
 * Per-player stats over the current session. Players who have never appeared
 * in a match get `gamesPlayed: 0` and `roundsSincePlayed: Infinity` so they
 * sort to the very front of the next round.
 */
export function getSessionPlayerStats(
  players: readonly StackingPlayer[],
  history: readonly StackingMatch[],
): Map<string, PlayerStats> {
  const stats = new Map<string, PlayerStats>();
  const maxRound = history.reduce(
    (max, m) => (m.roundNumber > max ? m.roundNumber : max),
    0,
  );

  for (const p of players) {
    stats.set(p.id, {
      gamesPlayed: 0,
      roundsSincePlayed: Infinity,
      checkInOrder: p.checkInOrder,
    });
  }

  for (const m of history) {
    const playersInMatch = [...m.team1, ...m.team2];
    for (const pid of playersInMatch) {
      const cur = stats.get(pid);
      if (!cur) continue; // historical player no longer available
      cur.gamesPlayed += 1;
      const since = maxRound - m.roundNumber;
      if (since < cur.roundsSincePlayed) cur.roundsSincePlayed = since;
    }
  }
  return stats;
}

export type PairingHistory = {
  /** Times `a` and `b` were partners. Use `pairKey(a,b)` for the key. */
  partners: Map<string, number>;
  /** Times `a` and `b` were on opposing teams in the same match. */
  opponents: Map<string, number>;
  /** Map of pair-key -> most recent round they were partners. */
  lastPartnerRound: Map<string, number>;
};

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function inc(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/**
 * Walk the match history once and tally partner + opponent counts and the
 * most recent round each pair partnered. The scorer uses these maps in O(1)
 * lookups per candidate match.
 */
export function buildPairingHistory(
  history: readonly StackingMatch[],
): PairingHistory {
  const partners = new Map<string, number>();
  const opponents = new Map<string, number>();
  const lastPartnerRound = new Map<string, number>();

  for (const m of history) {
    const pk1 = pairKey(m.team1[0], m.team1[1]);
    const pk2 = pairKey(m.team2[0], m.team2[1]);
    inc(partners, pk1);
    inc(partners, pk2);
    lastPartnerRound.set(
      pk1,
      Math.max(lastPartnerRound.get(pk1) ?? 0, m.roundNumber),
    );
    lastPartnerRound.set(
      pk2,
      Math.max(lastPartnerRound.get(pk2) ?? 0, m.roundNumber),
    );
    for (const a of m.team1) {
      for (const b of m.team2) inc(opponents, pairKey(a, b));
    }
  }
  return { partners, opponents, lastPartnerRound };
}
