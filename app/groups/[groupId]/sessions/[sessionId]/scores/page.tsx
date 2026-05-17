import Link from "next/link";
import { notFound } from "next/navigation";

import { EditScoreForm } from "@/components/sessions/edit-score-form";
import { LiveSessionRefresh } from "@/components/sessions/live-session-refresh";
import { MatchControls } from "@/components/sessions/match-controls";
import { ScoreEntryForm } from "@/components/sessions/score-entry-form";
import { MatchStatusBadge } from "@/components/sessions/session-state";
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
  WinningTeam,
} from "@/lib/db";
import { getGroupRole } from "@/lib/permissions/group";

export default async function ScoresPage({
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
      pointsToWin: true,
      winByTwo: true,
    },
  });
  if (!session || session.groupId !== groupId) notFound();

  const matches = await prisma.match.findMany({
    where: { sessionId },
    orderBy: [{ roundNumber: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      roundNumber: true,
      status: true,
      team1Score: true,
      team2Score: true,
      winningTeam: true,
      court: { select: { name: true } },
      team1P1: { select: { id: true, displayName: true } },
      team1P2: { select: { id: true, displayName: true } },
      team2P1: { select: { id: true, displayName: true } },
      team2P2: { select: { id: true, displayName: true } },
    },
  });

  const active = matches.filter((m) => m.status === MatchStatus.ACTIVE);
  const queued = matches.filter((m) => m.status === MatchStatus.QUEUED);
  const completed = matches.filter((m) => m.status === MatchStatus.COMPLETED);

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
          <h1 className="text-2xl font-semibold tracking-tight">Scores</h1>
          <p className="text-muted-foreground text-sm">
            {session.name} · first to {session.pointsToWin}
            {session.winByTwo ? ", win by two" : ""}.
          </p>
        </div>
        <LiveSessionRefresh
          enabled={session.status === PlaySessionStatus.ACTIVE}
        />
      </div>

      <SectionHeading
        title="Active"
        helper={`${active.length} match${active.length === 1 ? "" : "es"}`}
      />
      {active.length === 0 ? (
        <EmptyHint
          text={
            canManage
              ? "Start a queued match below to begin scoring."
              : "Waiting for an admin to start a match."
          }
        />
      ) : (
        <div className="mb-6 grid gap-3 md:grid-cols-2">
          {active.map((m) => (
            <Card key={m.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">Match</CardTitle>
                  <MatchStatusBadge status={m.status} />
                </div>
                <CardDescription>
                  Round {m.roundNumber} · {m.court?.name ?? "Unassigned"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 min-[420px]:grid-cols-2">
                  <TeamLine
                    label="Team 1"
                    names={[m.team1P1.displayName, m.team1P2?.displayName]}
                  />
                  <TeamLine
                    label="Team 2"
                    names={[m.team2P1.displayName, m.team2P2?.displayName]}
                  />
                </div>
                {canManage ? (
                  <ScoreEntryForm
                    groupId={groupId}
                    sessionId={sessionId}
                    matchId={m.id}
                    pointsToWin={session.pointsToWin}
                  />
                ) : (
                  <p className="text-muted-foreground text-xs">
                    Score entry is admin-only.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SectionHeading
        title="Queued"
        helper={`${queued.length} match${queued.length === 1 ? "" : "es"}`}
      />
      {queued.length === 0 ? (
        <EmptyHint text="No queued matches — generate the next round from the stacking page." />
      ) : (
        <div className="mb-6 grid gap-3 md:grid-cols-2">
          {queued.map((m) => (
            <Card key={m.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">Match</CardTitle>
                  <MatchStatusBadge status={m.status} />
                </div>
                <CardDescription>
                  Round {m.roundNumber} · {m.court?.name ?? "Unassigned"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid gap-2 min-[420px]:grid-cols-2">
                  <TeamLine
                    label="Team 1"
                    names={[m.team1P1.displayName, m.team1P2?.displayName]}
                  />
                  <TeamLine
                    label="Team 2"
                    names={[m.team2P1.displayName, m.team2P2?.displayName]}
                  />
                </div>
                {canManage && (
                  <MatchControls
                    groupId={groupId}
                    sessionId={sessionId}
                    matchId={m.id}
                    showStart
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SectionHeading
        title="Completed"
        helper={`${completed.length} match${completed.length === 1 ? "" : "es"}`}
      />
      {completed.length === 0 ? (
        <EmptyHint text="No completed matches yet." />
      ) : (
        <div className="divide-border/60 divide-y">
          {completed.map((m) => {
            const team1Wins = m.winningTeam === WinningTeam.TEAM_1;
            return (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs tracking-wider uppercase">
                    Round {m.roundNumber}
                    {m.court?.name ? ` · ${m.court.name}` : ""}
                  </p>
                  <p className="text-sm">
                    <span
                      className={
                        team1Wins ? "font-semibold" : "text-muted-foreground"
                      }
                    >
                      {[m.team1P1.displayName, m.team1P2?.displayName]
                        .filter(Boolean)
                        .join(" + ")}
                    </span>
                    <span className="mx-2 font-mono">
                      {m.team1Score} – {m.team2Score}
                    </span>
                    <span
                      className={
                        !team1Wins ? "font-semibold" : "text-muted-foreground"
                      }
                    >
                      {[m.team2P1.displayName, m.team2P2?.displayName]
                        .filter(Boolean)
                        .join(" + ")}
                    </span>
                  </p>
                </div>
                {canManage && (
                  <EditScoreForm
                    groupId={groupId}
                    sessionId={sessionId}
                    matchId={m.id}
                    team1Score={m.team1Score ?? 0}
                    team2Score={m.team2Score ?? 0}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

function SectionHeading({ title, helper }: { title: string; helper: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between">
      <h2 className="text-sm font-semibold tracking-wider uppercase">
        {title}
      </h2>
      <span className="text-muted-foreground text-xs">{helper}</span>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <Card className="mb-6">
      <CardContent className="text-muted-foreground py-6 text-center text-sm">
        {text}
      </CardContent>
    </Card>
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
    <div>
      <p className="text-muted-foreground text-xs tracking-wider uppercase">
        {label}
      </p>
      <p className="border-border/70 mt-1 rounded-lg border px-3 py-2 text-sm leading-5 font-medium">
        {present.join(" + ")}
      </p>
    </div>
  );
}
