import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GroupRole, PlayerStatus } from "@/lib/db";
import {
  ForbiddenError,
  NotFoundError,
} from "@/lib/permissions/errors";
import { requireGroupRole } from "@/lib/permissions/group";
import { getPlayerHistory } from "@/lib/stats/queries";

const ANY_MEMBER = [
  GroupRole.OWNER,
  GroupRole.ADMIN,
  GroupRole.PLAYER,
  GroupRole.VIEWER,
] as const;

function statusBadge(status: string) {
  switch (status) {
    case PlayerStatus.ACTIVE:
      return <Badge variant="secondary">Active</Badge>;
    case PlayerStatus.INACTIVE:
      return <Badge variant="outline">Inactive</Badge>;
    case PlayerStatus.TEMPORARY:
      return <Badge variant="outline">Temporary</Badge>;
    case PlayerStatus.REMOVED:
      return <Badge variant="destructive">Removed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default async function PlayerHistoryPage({
  params,
}: {
  params: Promise<{ groupId: string; playerId: string }>;
}) {
  const { groupId, playerId } = await params;

  try {
    await requireGroupRole(groupId, ANY_MEMBER);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    if (err instanceof ForbiddenError) redirect("/dashboard");
    throw err;
  }

  let data: Awaited<ReturnType<typeof getPlayerHistory>>;
  try {
    data = await getPlayerHistory(playerId, groupId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const { player, stats, partners, recent } = data;

  const winPctText =
    stats.gamesPlayed === 0
      ? "—"
      : `${Math.round(stats.winPct * 100)}%`;
  const diffSign =
    stats.pointDifferential > 0
      ? "+"
      : stats.pointDifferential < 0
        ? ""
        : "";

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/groups/${groupId}/players`}>← Back to players</Link>
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {player.displayName}
            </h1>
            {statusBadge(player.status)}
          </div>
          <p className="text-muted-foreground text-sm">
            {player.userId
              ? "Linked to a registered user."
              : "Temporary profile (no linked account)."}
          </p>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Record">
          {stats.wins}–{stats.losses}
        </StatCard>
        <StatCard label="Win %">{winPctText}</StatCard>
        <StatCard label="Point ±">
          {diffSign}
          {stats.pointDifferential}
        </StatCard>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">
            Partners ({partners.length})
          </CardTitle>
          <CardDescription>
            Sorted by games together, then wins together.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {partners.length === 0 ? (
            <p className="text-muted-foreground py-2 text-center text-sm">
              No partners yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground border-border/60 border-b text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-2 pr-2 text-left">Partner</th>
                    <th className="py-2 pr-2 text-right">Games</th>
                    <th className="py-2 text-right">Wins</th>
                  </tr>
                </thead>
                <tbody className="divide-border/60 divide-y">
                  {partners.map((p) => (
                    <tr key={p.partnerId}>
                      <td className="py-2 pr-2">
                        <Link
                          href={`/groups/${groupId}/players/${p.partnerId}`}
                          className="font-medium hover:underline"
                        >
                          {p.displayName}
                        </Link>
                      </td>
                      <td className="py-2 pr-2 text-right">
                        {p.gamesTogether}
                      </td>
                      <td className="py-2 text-right">{p.winsTogether}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Recent matches ({recent.length})
          </CardTitle>
          <CardDescription>
            Last 20 completed matches across all sessions.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-border/60 divide-y">
          {recent.length === 0 ? (
            <p className="text-muted-foreground py-2 text-center text-sm">
              No completed matches yet.
            </p>
          ) : (
            recent.map((m) => (
              <div
                key={m.matchId}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs uppercase tracking-wider">
                    <Link
                      href={`/groups/${groupId}/sessions/${m.sessionId}/scores`}
                      className="hover:underline"
                    >
                      {m.sessionName}
                    </Link>{" "}
                    · Round {m.roundNumber}
                  </p>
                  <p className="text-sm">
                    with {m.partners.join(" + ") || "—"} vs{" "}
                    {m.opponents.join(" + ") || "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono">
                    {m.team1.includes(player.id)
                      ? `${m.team1Score} – ${m.team2Score}`
                      : `${m.team2Score} – ${m.team1Score}`}
                  </span>
                  <Badge variant={m.result === "W" ? "default" : "outline"}>
                    {m.result}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function StatCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{children}</CardTitle>
      </CardHeader>
    </Card>
  );
}
