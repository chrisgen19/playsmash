import Link from "next/link";
import { notFound } from "next/navigation";

import { GenerateRoundButton } from "@/components/sessions/generate-round-button";
import { LiveSessionRefresh } from "@/components/sessions/live-session-refresh";
import { MatchControls } from "@/components/sessions/match-controls";
import {
  MatchStatusBadge,
  PlayerStateChip,
  SessionStatusBadge,
} from "@/components/sessions/session-state";
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
  MatchStatus,
  PlaySessionStatus,
  SessionPlayerStatus,
} from "@/lib/db";
import { getGroupRole } from "@/lib/permissions/group";

const OPEN_STATUSES = [MatchStatus.QUEUED, MatchStatus.ACTIVE] as const;

export default async function StackingPage({
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
      status: true,
      numberOfCourts: true,
      courts: {
        orderBy: { courtNumber: "asc" },
        select: { id: true, name: true, courtNumber: true, status: true },
      },
      players: {
        orderBy: { checkInOrder: "asc" },
        select: {
          id: true,
          status: true,
          player: { select: { id: true, displayName: true } },
        },
      },
    },
  });
  if (!session || session.groupId !== groupId) notFound();

  const latestRound = await prisma.match.findFirst({
    where: { sessionId },
    orderBy: { roundNumber: "desc" },
    select: { roundNumber: true },
  });
  const currentRound = latestRound?.roundNumber ?? 0;

  const matches =
    currentRound === 0
      ? []
      : await prisma.match.findMany({
          where: { sessionId, roundNumber: currentRound },
          orderBy: { courtId: "asc" },
          select: {
            id: true,
            courtId: true,
            status: true,
            team1P1: { select: { id: true, displayName: true } },
            team1P2: { select: { id: true, displayName: true } },
            team2P1: { select: { id: true, displayName: true } },
            team2P2: { select: { id: true, displayName: true } },
          },
        });

  const hasOpenRound = matches.some((m) =>
    OPEN_STATUSES.includes(m.status as (typeof OPEN_STATUSES)[number]),
  );
  const courtNameById = new Map(
    session.courts.map((c) => [c.id, c.name] as const),
  );

  const waiting = session.players.filter(
    (sp) =>
      sp.status === SessionPlayerStatus.WAITING ||
      sp.status === SessionPlayerStatus.AVAILABLE,
  );
  const resting = session.players.filter(
    (sp) => sp.status === SessionPlayerStatus.RESTING,
  );

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/groups/${groupId}/sessions/${sessionId}`}>
            ← Back to session
          </Link>
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Round {currentRound || "—"}
            </h1>
            <SessionStatusBadge status={session.status} />
          </div>
          <p className="text-muted-foreground text-sm">{session.name}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <LiveSessionRefresh
            enabled={session.status === PlaySessionStatus.ACTIVE}
          />
          {canManage && session.status === PlaySessionStatus.ACTIVE && (
            <GenerateRoundButton
              groupId={groupId}
              sessionId={session.id}
              hasOpenRound={hasOpenRound}
            />
          )}
        </div>
      </div>

      {matches.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="mb-1 text-base font-medium">No round generated yet</p>
            <p className="text-muted-foreground text-sm">
              {session.status === PlaySessionStatus.ACTIVE
                ? canManage
                  ? "Tap Generate next round to seed matches across courts."
                  : "Waiting for an admin to generate the first round."
                : "Start the session first."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {matches.map((m) => (
            <Card key={m.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">Match</CardTitle>
                  <MatchStatusBadge status={m.status} />
                </div>
                <CardDescription>
                  {courtNameById.get(m.courtId ?? "") ?? "Unassigned court"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid gap-2 min-[420px]:grid-cols-[1fr_auto_1fr] min-[420px]:items-stretch">
                  <TeamLine
                    label="Team 1"
                    names={[m.team1P1.displayName, m.team1P2?.displayName]}
                  />
                  <div className="text-muted-foreground flex items-center justify-center text-xs font-medium uppercase">
                    vs
                  </div>
                  <TeamLine
                    label="Team 2"
                    names={[m.team2P1.displayName, m.team2P2?.displayName]}
                  />
                </div>
                {canManage &&
                  (m.status === MatchStatus.QUEUED ||
                    m.status === MatchStatus.ACTIVE) && (
                    <MatchControls
                      groupId={groupId}
                      sessionId={sessionId}
                      matchId={m.id}
                      showStart={m.status === MatchStatus.QUEUED}
                    />
                  )}
                {m.status === MatchStatus.ACTIVE && (
                  <Link
                    href={`/groups/${groupId}/sessions/${sessionId}/scores`}
                    className="text-foreground text-xs underline"
                  >
                    Enter score →
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Waiting ({waiting.length})
            </CardTitle>
            <CardDescription>
              Available next round, not currently on a court.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {waiting.length === 0 ? (
              <span className="text-muted-foreground text-xs">—</span>
            ) : (
              waiting.map((sp) => (
                <PlayerStateChip key={sp.id} status={sp.status}>
                  {sp.player.displayName}
                </PlayerStateChip>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Resting ({resting.length})
            </CardTitle>
            <CardDescription>Sat out the latest round.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {resting.length === 0 ? (
              <span className="text-muted-foreground text-xs">—</span>
            ) : (
              resting.map((sp) => (
                <PlayerStateChip key={sp.id} status={sp.status}>
                  {sp.player.displayName}
                </PlayerStateChip>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function TeamLine({
  label,
  names,
}: {
  label: string;
  names: (string | null | undefined)[];
}) {
  const present = names.filter((n): n is string => !!n);
  return (
    <div className="border-border/70 rounded-lg border px-3 py-2">
      <p className="text-muted-foreground text-xs tracking-wider uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm leading-5 font-medium">
        {present.join(" + ")}
      </p>
    </div>
  );
}
