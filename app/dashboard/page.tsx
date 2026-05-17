import Link from "next/link";
import { ArrowRight, Plus, Users } from "lucide-react";

import { TopAppBar } from "@/components/shared/top-app-bar";
import { JoinGroupForm } from "@/components/groups/join-group-form";
import { RoleBadge } from "@/components/shared/role-badge";
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
  GroupMemberStatus,
  GroupStatus,
  PlayerStatus,
} from "@/lib/db";
import type { GroupRoleValue } from "@/lib/permissions/group";

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");

  const memberships = await prisma.groupMember.findMany({
    where: {
      userId: user.id,
      status: GroupMemberStatus.ACTIVE,
      group: { status: GroupStatus.ACTIVE },
    },
    orderBy: { joinedAt: "desc" },
    select: {
      role: true,
      group: {
        select: {
          id: true,
          name: true,
          description: true,
          joinCode: true,
          _count: {
            select: {
              members: { where: { status: GroupMemberStatus.ACTIVE } },
              players: { where: { status: { not: PlayerStatus.REMOVED } } },
            },
          },
        },
      },
    },
  });

  const displayName = user.name ?? user.email?.split("@")[0] ?? "there";
  const totalGroups = memberships.length;
  const totalPlayers = memberships.reduce(
    (sum, m) => sum + m.group._count.players,
    0,
  );
  const totalMembers = memberships.reduce(
    (sum, m) => sum + m.group._count.members,
    0,
  );

  return (
    <>
      <TopAppBar userEmail={user.email} />

      <main className="relative flex-1">
        {/* Greeting + key stats */}
        <section className="bg-[color:var(--md-sys-color-surface-container-low)]">
          <div className="mx-auto w-full max-w-6xl px-6 py-12 lg:py-16">
            <div className="grid gap-10 lg:grid-cols-[2fr_1fr] lg:items-end">
              <div className="space-y-3">
                <p className="md-label-lg text-primary">
                  Dashboard · {today()}
                </p>
                <h1 className="md-display-sm text-foreground">
                  Hey {displayName} 👋
                </h1>
                <p className="md-body-lg text-muted-foreground max-w-prose">
                  Here&apos;s what you&apos;re a part of. Pick a group to set
                  up the next session — or join a new one with a code below.
                </p>
              </div>
              <dl className="grid grid-cols-3 gap-3">
                <StatTile figure={totalGroups} label="Groups" />
                <StatTile figure={totalMembers} label="Members" />
                <StatTile figure={totalPlayers} label="Players" />
              </dl>
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-6xl space-y-10 px-6 py-10">
          {/* Join card */}
          <Card variant="filled">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle>Join an existing group</CardTitle>
                  <CardDescription>
                    Got a join code from an admin? Drop it here.
                  </CardDescription>
                </div>
                <span
                  aria-hidden
                  className="hidden sm:grid size-12 place-items-center rounded-2xl bg-[color:var(--md-sys-color-tertiary-container)] text-[color:var(--md-sys-color-on-tertiary-container)]"
                >
                  <Users className="size-5" />
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <JoinGroupForm compact />
            </CardContent>
          </Card>

          {/* Groups list */}
          <section className="space-y-5">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="md-headline-sm">Your groups</h2>
              <p className="md-label-md text-muted-foreground">
                {totalGroups === 0
                  ? "Nothing yet"
                  : `${totalGroups} ${totalGroups === 1 ? "group" : "groups"}`}
              </p>
            </div>

            {totalGroups === 0 ? (
              <Card variant="outlined">
                <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
                  <span
                    aria-hidden
                    className="grid size-16 place-items-center rounded-full bg-[color:var(--md-sys-color-primary-container)] text-[color:var(--md-sys-color-on-primary-container)]"
                  >
                    <Plus className="size-6" />
                  </span>
                  <div className="space-y-1.5">
                    <p className="md-headline-sm">No groups yet</p>
                    <p className="md-body-md text-muted-foreground mx-auto max-w-sm">
                      Spin up your first group to start tracking sessions and
                      scores.
                    </p>
                  </div>
                  <Button asChild variant="filled" size="lg">
                    <Link href="/groups/new">
                      Create your first group
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {memberships.map(({ role, group }) => (
                  <Link
                    key={group.id}
                    href={`/groups/${group.id}`}
                    className="group focus:outline-none"
                  >
                    <Card
                      variant="outlined"
                      className="h-full transition-all group-hover:md-elev-2 group-focus-visible:ring-2 group-focus-visible:ring-ring"
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between gap-3">
                          <span
                            aria-hidden
                            className="grid size-10 place-items-center rounded-xl bg-[color:var(--md-sys-color-secondary-container)] text-[color:var(--md-sys-color-on-secondary-container)] md-title-md"
                          >
                            {group.name.charAt(0).toUpperCase()}
                          </span>
                          <RoleBadge role={role as GroupRoleValue} />
                        </div>
                        <CardTitle className="mt-3">{group.name}</CardTitle>
                        {group.description && (
                          <CardDescription className="line-clamp-2">
                            {group.description}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="flex items-center justify-between gap-2 pt-1">
                        <span className="md-body-sm text-muted-foreground">
                          {group._count.members} member
                          {group._count.members === 1 ? "" : "s"} ·{" "}
                          {group._count.players} player
                          {group._count.players === 1 ? "" : "s"}
                        </span>
                        <span className="md-label-md inline-flex items-center rounded-md bg-[color:var(--md-sys-color-primary-container)] px-2 py-0.5 font-mono text-[color:var(--md-sys-color-on-primary-container)] tracking-widest">
                          {group.joinCode}
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Extended FAB — MD3 pattern */}
        <Button
          asChild
          variant="filled"
          size="fab"
          className="fixed bottom-6 right-6 z-30 bg-[color:var(--md-sys-color-primary-container)] text-[color:var(--md-sys-color-on-primary-container)] md-elev-3"
        >
          <Link href="/groups/new" aria-label="Create a new group">
            <Plus className="size-5" />
            <span className="hidden sm:inline">New group</span>
          </Link>
        </Button>
      </main>
    </>
  );
}

function StatTile({
  figure,
  label,
}: {
  figure: number;
  label: string;
}) {
  return (
    <div className="rounded-2xl bg-[color:var(--md-sys-color-surface-container-highest)] px-4 py-5 text-center">
      <dt className="md-headline-md text-foreground tabular-nums">
        {figure}
      </dt>
      <dd className="md-label-md text-muted-foreground mt-1">{label}</dd>
    </div>
  );
}

function today() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
