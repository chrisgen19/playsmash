import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { prisma, GroupRole, PlaySessionStatus } from "@/lib/db";
import { getGroupRole } from "@/lib/permissions/group";

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === PlaySessionStatus.ACTIVE
      ? "default"
      : status === PlaySessionStatus.PLANNED
        ? "secondary"
        : status === PlaySessionStatus.CANCELLED
          ? "destructive"
          : "outline";
  return <Badge variant={variant}>{status}</Badge>;
}

export default async function SessionsPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const user = await requireUser();
  const role = await getGroupRole(user.id, groupId);
  if (!role) notFound();

  const canManage = role === GroupRole.OWNER || role === GroupRole.ADMIN;

  const sessions = await prisma.playSession.findMany({
    where: { groupId },
    orderBy: { date: "desc" },
    select: {
      id: true,
      name: true,
      date: true,
      location: true,
      status: true,
      numberOfCourts: true,
      _count: { select: { players: true } },
    },
  });

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sessions</h1>
          <p className="text-muted-foreground text-sm">
            {sessions.length} session{sessions.length === 1 ? "" : "s"}.
          </p>
        </div>
        {canManage && (
          <Button asChild>
            <Link href={`/groups/${groupId}/sessions/new`}>New session</Link>
          </Button>
        )}
      </div>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="mb-1 text-base font-medium">No sessions yet</p>
            <p className="text-muted-foreground mb-4 text-sm">
              {canManage
                ? "Schedule a play day, set courts, and pick who's coming."
                : "An admin hasn't scheduled a session yet."}
            </p>
            {canManage && (
              <Button asChild>
                <Link href={`/groups/${groupId}/sessions/new`}>
                  Create the first session
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sessions.map((s) => (
            <Link key={s.id} href={`/groups/${groupId}/sessions/${s.id}`}>
              <Card className="hover:border-foreground/20 h-full transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{s.name}</CardTitle>
                    <StatusBadge status={s.status} />
                  </div>
                  <CardDescription>
                    {s.date.toISOString().slice(0, 16).replace("T", " ")}
                    {s.location ? ` · ${s.location}` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-muted-foreground text-xs">
                  {s.numberOfCourts} court
                  {s.numberOfCourts === 1 ? "" : "s"} · {s._count.players}{" "}
                  player{s._count.players === 1 ? "" : "s"}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
