import { notFound, redirect } from "next/navigation";

import { LeaderboardTable } from "@/components/stats/leaderboard-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GroupRole } from "@/lib/db";
import {
  ForbiddenError,
  NotFoundError,
} from "@/lib/permissions/errors";
import { requireGroupRole } from "@/lib/permissions/group";
import { getGroupLeaderboard } from "@/lib/stats/queries";

const ANY_MEMBER = [
  GroupRole.OWNER,
  GroupRole.ADMIN,
  GroupRole.PLAYER,
  GroupRole.VIEWER,
] as const;

export default async function GroupStatsPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;

  try {
    await requireGroupRole(groupId, ANY_MEMBER);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    if (err instanceof ForbiddenError) redirect("/dashboard");
    throw err;
  }

  const { rows, players } = await getGroupLeaderboard(groupId);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
        <p className="text-muted-foreground text-sm">
          Stats across every completed match in this group.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Group ranking</CardTitle>
          <CardDescription>
            Sorted by win % (gamesPlayed and point differential break ties).
            Temporary players are included.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeaderboardTable
            rows={rows}
            players={players}
            groupId={groupId}
            emptyText="No completed matches yet — finish a round to see stats."
          />
        </CardContent>
      </Card>
    </main>
  );
}
