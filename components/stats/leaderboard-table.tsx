import Link from "next/link";

import type { LeaderboardRow, PlayerStats } from "@/lib/stats/types";

type Player = { id: string; displayName: string };

/**
 * Sort plus rank in `compute.ts` already gave us deterministic order;
 * here we just render. Players with zero games are shown at the bottom
 * (a feature, not a bug — surfaces newcomers without inflating their
 * rank, since winPct=0 sorts them last along with anyone winless).
 */
export function LeaderboardTable({
  rows,
  players,
  groupId,
  emptyText,
}: {
  rows: LeaderboardRow[];
  players: Player[];
  groupId: string;
  emptyText: string;
}) {
  const nameById = new Map(players.map((p) => [p.id, p.displayName]));
  const totalGames = rows.reduce((sum, r) => sum + r.gamesPlayed, 0);

  if (totalGames === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-muted-foreground border-border/60 border-b text-xs uppercase tracking-wider">
          <tr>
            <th className="w-10 py-2 text-left">#</th>
            <th className="py-2 text-left">Player</th>
            <th className="py-2 pr-2 text-right">GP</th>
            <th className="py-2 pr-2 text-right">W–L</th>
            <th className="py-2 pr-2 text-right">Win %</th>
            <th className="py-2 pr-2 text-right">PF</th>
            <th className="py-2 pr-2 text-right">PA</th>
            <th className="py-2 text-right">±</th>
          </tr>
        </thead>
        <tbody className="divide-border/60 divide-y">
          {rows.map((r) => (
            <tr key={r.playerId}>
              <td className="py-2 font-mono text-xs">{r.rank}</td>
              <td className="py-2">
                <Link
                  href={`/groups/${groupId}/players/${r.playerId}`}
                  className="font-medium hover:underline"
                >
                  {nameById.get(r.playerId) ?? "Unknown"}
                </Link>
              </td>
              <td className="py-2 pr-2 text-right">{r.gamesPlayed}</td>
              <td className="py-2 pr-2 text-right">
                {r.wins}–{r.losses}
              </td>
              <td className="py-2 pr-2 text-right">{winPctText(r)}</td>
              <td className="py-2 pr-2 text-right">{r.pointsFor}</td>
              <td className="py-2 pr-2 text-right">{r.pointsAgainst}</td>
              <td className="py-2 text-right">
                {r.pointDifferential > 0 ? "+" : ""}
                {r.pointDifferential}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function winPctText(s: PlayerStats): string {
  if (s.gamesPlayed === 0) return "—";
  return `${Math.round(s.winPct * 100)}%`;
}
