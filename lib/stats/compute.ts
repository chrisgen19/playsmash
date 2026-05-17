import type {
  LeaderboardRow,
  PartnerEntry,
  PlayerStats,
  StatsMatch,
} from "./types";

/** Empty stats sheet, used as a starting point and for zero-game players. */
function emptyStats(playerId: string): PlayerStats {
  return {
    playerId,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    winPct: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    pointDifferential: 0,
  };
}

/**
 * Per-player stats over the given matches. The function does NOT filter by
 * group / session — callers are expected to pass the right slice.
 *
 * Pure: same input, same output, no I/O.
 */
export function computePlayerStats(
  matches: readonly StatsMatch[],
  playerId: string,
): PlayerStats {
  const stats = emptyStats(playerId);

  for (const m of matches) {
    const onTeam1 = m.team1.includes(playerId);
    const onTeam2 = !onTeam1 && m.team2.includes(playerId);
    if (!onTeam1 && !onTeam2) continue;

    const myScore = onTeam1 ? m.team1Score : m.team2Score;
    const theirScore = onTeam1 ? m.team2Score : m.team1Score;
    const won = onTeam1
      ? m.winningTeam === "TEAM_1"
      : m.winningTeam === "TEAM_2";

    stats.gamesPlayed += 1;
    if (won) stats.wins += 1;
    else stats.losses += 1;
    stats.pointsFor += myScore;
    stats.pointsAgainst += theirScore;
  }

  stats.pointDifferential = stats.pointsFor - stats.pointsAgainst;
  stats.winPct = stats.gamesPlayed === 0 ? 0 : stats.wins / stats.gamesPlayed;
  return stats;
}

/**
 * Compute every player's stats once (single pass over matches), then sort
 * by winPct desc, gamesPlayed desc, pointDifferential desc, playerId asc
 * for a stable order.
 *
 * `playerIds` is the eligible roster — we include zero-game players so
 * everyone shows up, even those who haven't played yet.
 */
export function computeGroupLeaderboard(
  matches: readonly StatsMatch[],
  playerIds: readonly string[],
): LeaderboardRow[] {
  // Single pass over matches: accumulate into a map keyed by playerId.
  const byPlayer = new Map<string, PlayerStats>();
  for (const id of playerIds) byPlayer.set(id, emptyStats(id));

  for (const m of matches) {
    accumulate(byPlayer, m, m.team1, m.team1Score, m.team2Score, "TEAM_1");
    accumulate(byPlayer, m, m.team2, m.team2Score, m.team1Score, "TEAM_2");
  }

  for (const stats of byPlayer.values()) {
    stats.pointDifferential = stats.pointsFor - stats.pointsAgainst;
    stats.winPct =
      stats.gamesPlayed === 0 ? 0 : stats.wins / stats.gamesPlayed;
  }

  const rows = Array.from(byPlayer.values()).sort(compareLeaderboard);
  return rows.map((s, i) => ({ ...s, rank: i + 1 }));
}

function accumulate(
  byPlayer: Map<string, PlayerStats>,
  m: StatsMatch,
  team: readonly string[],
  myScore: number,
  theirScore: number,
  teamLabel: "TEAM_1" | "TEAM_2",
): void {
  const won = m.winningTeam === teamLabel;
  for (const pid of team) {
    const stats = byPlayer.get(pid);
    // Players who appear in a match but aren't in the roster (e.g. since-removed
    // profiles) are intentionally skipped — they're still in the match record
    // but shouldn't pollute the current leaderboard.
    if (!stats) continue;
    stats.gamesPlayed += 1;
    if (won) stats.wins += 1;
    else stats.losses += 1;
    stats.pointsFor += myScore;
    stats.pointsAgainst += theirScore;
  }
}

function compareLeaderboard(a: PlayerStats, b: PlayerStats): number {
  if (a.winPct !== b.winPct) return b.winPct - a.winPct;
  if (a.gamesPlayed !== b.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
  if (a.pointDifferential !== b.pointDifferential) {
    return b.pointDifferential - a.pointDifferential;
  }
  // Stable final tiebreak so tests and UIs see a deterministic order.
  return a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0;
}

/**
 * Times `playerId` partnered with each other player, plus how many of those
 * matches they won together. Sorted by gamesTogether desc, then winsTogether
 * desc, then partnerId for stability.
 */
export function computePartnerHistory(
  matches: readonly StatsMatch[],
  playerId: string,
): PartnerEntry[] {
  const partners = new Map<string, PartnerEntry>();

  for (const m of matches) {
    const onTeam1 = m.team1.includes(playerId);
    const onTeam2 = !onTeam1 && m.team2.includes(playerId);
    if (!onTeam1 && !onTeam2) continue;

    const myTeam = onTeam1 ? m.team1 : m.team2;
    const won = onTeam1
      ? m.winningTeam === "TEAM_1"
      : m.winningTeam === "TEAM_2";

    for (const pid of myTeam) {
      if (pid === playerId) continue;
      const entry = partners.get(pid) ?? {
        partnerId: pid,
        gamesTogether: 0,
        winsTogether: 0,
      };
      entry.gamesTogether += 1;
      if (won) entry.winsTogether += 1;
      partners.set(pid, entry);
    }
  }

  return Array.from(partners.values()).sort((a, b) => {
    if (a.gamesTogether !== b.gamesTogether)
      return b.gamesTogether - a.gamesTogether;
    if (a.winsTogether !== b.winsTogether)
      return b.winsTogether - a.winsTogether;
    return a.partnerId < b.partnerId ? -1 : 1;
  });
}
