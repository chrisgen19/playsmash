import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { LocalDateTime } from "@/components/shared/local-datetime";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { activityLabel } from "@/lib/activity/labels";
import { prisma, GroupRole } from "@/lib/db";
import {
  ForbiddenError,
  NotFoundError,
} from "@/lib/permissions/errors";
import { requireGroupRole } from "@/lib/permissions/group";

const OWNERS_AND_ADMINS = [GroupRole.OWNER, GroupRole.ADMIN] as const;
const PAGE_SIZE = 30;

/** Compact JSON snippet for the old/new value columns. */
function snippet(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const json = JSON.stringify(value);
  return json.length > 120 ? `${json.slice(0, 117)}…` : json;
}

export default async function ActivityLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { groupId } = await params;
  const { page: pageParam } = await searchParams;

  try {
    await requireGroupRole(groupId, OWNERS_AND_ADMINS);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    if (err instanceof ForbiddenError) redirect(`/groups/${groupId}`);
    throw err;
  }

  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where: { groupId },
      orderBy: { createdAt: "desc" },
      skip,
      // Fetch one extra to know whether a next page exists.
      take: PAGE_SIZE + 1,
      select: {
        id: true,
        action: true,
        targetType: true,
        oldValue: true,
        newValue: true,
        createdAt: true,
        user: {
          select: { name: true, firstName: true, lastName: true, email: true },
        },
      },
    }),
    prisma.activityLog.count({ where: { groupId } }),
  ]);

  const hasNext = logs.length > PAGE_SIZE;
  const rows = hasNext ? logs.slice(0, PAGE_SIZE) : logs;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="text-muted-foreground text-sm">
          {total} event{total === 1 ? "" : "s"} · page {page} of {lastPage}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audit trail</CardTitle>
          <CardDescription>
            Every member, player, session, and score change in this group.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-border/60 divide-y">
          {rows.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No activity recorded yet.
            </p>
          ) : (
            rows.map((log) => {
              const actor =
                log.user?.name ??
                ([log.user?.firstName, log.user?.lastName]
                  .filter(Boolean)
                  .join(" ") ||
                  log.user?.email) ??
                "System";
              const oldV = snippet(log.oldValue);
              const newV = snippet(log.newValue);
              return (
                <div key={log.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p>
                      <span className="font-medium">{actor}</span>{" "}
                      <span className="text-muted-foreground">
                        {activityLabel(log.action)}
                      </span>
                    </p>
                    <span className="text-muted-foreground text-xs">
                      <LocalDateTime iso={log.createdAt.toISOString()} />
                    </span>
                  </div>
                  {(oldV || newV) && (
                    <p className="text-muted-foreground mt-1 font-mono text-xs">
                      {oldV && <span>was {oldV}</span>}
                      {oldV && newV && <span> → </span>}
                      {newV && <span>now {newV}</span>}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <div className="mt-4 flex items-center justify-between">
        <Button
          asChild
          variant="outline"
          size="sm"
          disabled={page <= 1}
        >
          <Link
            href={`/groups/${groupId}/activity?page=${page - 1}`}
            aria-disabled={page <= 1}
            className={page <= 1 ? "pointer-events-none opacity-50" : ""}
          >
            ← Newer
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" disabled={!hasNext}>
          <Link
            href={`/groups/${groupId}/activity?page=${page + 1}`}
            aria-disabled={!hasNext}
            className={!hasNext ? "pointer-events-none opacity-50" : ""}
          >
            Older →
          </Link>
        </Button>
      </div>
    </main>
  );
}
