import Link from "next/link";
import { notFound } from "next/navigation";

import { EditAttendanceForm } from "@/components/sessions/edit-attendance-form";
import { StartSessionButton } from "@/components/sessions/start-session-button";
import { LocalDateTime } from "@/components/shared/local-datetime";
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
import {
  prisma,
  GroupRole,
  PlayerStatus,
  PlaySessionStatus,
  SessionPlayerStatus,
} from "@/lib/db";
import { getGroupRole } from "@/lib/permissions/group";

const ATTENDANCE_GROUPS: { status: string; label: string }[] = [
  { status: SessionPlayerStatus.AVAILABLE, label: "Available" },
  { status: SessionPlayerStatus.PLAYING, label: "Playing" },
  { status: SessionPlayerStatus.WAITING, label: "Waiting" },
  { status: SessionPlayerStatus.RESTING, label: "Resting" },
  { status: SessionPlayerStatus.LEFT, label: "Left" },
];

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ groupId: string; sessionId: string }>;
}) {
  const { groupId, sessionId } = await params;
  const user = await requireUser();
  const role = await getGroupRole(user.id, groupId);
  if (!role) notFound();
  const canManage = role === GroupRole.OWNER || role === GroupRole.ADMIN;

  const session = await prisma.playSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      groupId: true,
      name: true,
      date: true,
      location: true,
      numberOfCourts: true,
      scoringType: true,
      pointsToWin: true,
      winByTwo: true,
      status: true,
      courts: {
        orderBy: { courtNumber: "asc" },
        select: { id: true, name: true, courtNumber: true, status: true },
      },
      players: {
        orderBy: { checkInOrder: "asc" },
        select: {
          id: true,
          status: true,
          checkInOrder: true,
          player: { select: { id: true, displayName: true } },
        },
      },
    },
  });
  // Tenant isolation — never trust the sessionId from the URL.
  if (!session || session.groupId !== groupId) notFound();

  const isPlanned = session.status === PlaySessionStatus.PLANNED;
  const attendingIds = session.players.map((sp) => sp.player.id);

  // Group players are needed for the attendance editor (PLANNED + admin only).
  const groupPlayers =
    canManage && isPlanned
      ? await prisma.playerProfile.findMany({
          where: {
            groupId,
            status: { in: [PlayerStatus.ACTIVE, PlayerStatus.TEMPORARY] },
          },
          orderBy: { displayName: "asc" },
          select: { id: true, displayName: true },
        })
      : [];

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/groups/${groupId}/sessions`}>← Back to sessions</Link>
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {session.name}
            </h1>
            <Badge
              variant={isPlanned ? "secondary" : "default"}
            >
              {session.status}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            <LocalDateTime iso={session.date.toISOString()} />
            {session.location ? ` · ${session.location}` : ""}
          </p>
        </div>
        {canManage && isPlanned && (
          <StartSessionButton
            groupId={groupId}
            sessionId={session.id}
            disabled={session.players.length === 0}
          />
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Scoring</CardDescription>
            <CardTitle className="text-lg">{session.scoringType}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            First to {session.pointsToWin}
            {session.winByTwo ? ", win by two" : ""}.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Courts</CardDescription>
            <CardTitle className="text-lg">
              {session.numberOfCourts}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            {session.courts.map((c) => c.name).join(", ")}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Players</CardDescription>
            <CardTitle className="text-lg">
              {session.players.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            Checked in for this session.
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Attendance</CardTitle>
            <CardDescription>
              {isPlanned
                ? "Players selected for this session."
                : "Player states update as matches are generated (Phase 4)."}
            </CardDescription>
          </div>
          {canManage && isPlanned && (
            <EditAttendanceForm
              groupId={groupId}
              sessionId={session.id}
              groupPlayers={groupPlayers}
              attendingIds={attendingIds}
            />
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {session.players.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No players added yet.
            </p>
          ) : (
            ATTENDANCE_GROUPS.map(({ status, label }) => {
              const inGroup = session.players.filter(
                (sp) => sp.status === status,
              );
              if (inGroup.length === 0) return null;
              return (
                <div key={status}>
                  <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                    {label} ({inGroup.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {inGroup.map((sp) => (
                      <Badge key={sp.id} variant="outline">
                        {sp.player.displayName}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Courts</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3">
          {session.courts.map((c) => (
            <div
              key={c.id}
              className="border-border/60 rounded-lg border px-3 py-2 text-sm"
            >
              <span className="font-medium">{c.name}</span>
              <span className="text-muted-foreground ml-2 text-xs">
                {c.status}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Link
        href={`/groups/${groupId}/sessions/${session.id}/stacking`}
        className="mt-4 block"
      >
        <Card className="hover:border-foreground/20 transition-colors">
          <CardHeader>
            <CardTitle className="text-base">Stacking →</CardTitle>
            <CardDescription>
              View the current round, generate the next, see who&apos;s resting.
            </CardDescription>
          </CardHeader>
        </Card>
      </Link>
    </main>
  );
}
