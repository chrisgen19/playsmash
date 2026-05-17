import Link from "next/link";

import { AppHeader } from "@/components/shared/app-header";
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
    // Archived groups drop off the dashboard.
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
          // Keep these filters in lockstep with app/groups/[groupId]/page.tsx
          // so the dashboard cards and the group detail page never disagree.
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

  return (
    <>
      <AppHeader userEmail={user.email} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6 border-b border-border/70 pb-8">
          <div className="space-y-3">
            <p className="eyebrow text-muted-foreground inline-flex items-center gap-2">
              <span aria-hidden className="inline-block size-1.5 bg-accent" />
              Your groups — {String(memberships.length).padStart(2, "0")}
            </p>
            <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
              Hey {user.name ?? user.email?.split("@")[0]}.
            </h1>
            <p className="text-muted-foreground max-w-prose">
              Here&apos;s what you&apos;re a part of. Pick a group to set up
              the next session, or join one with a code.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="accent" size="lg">
              <Link href="/groups/new">Create group</Link>
            </Button>
          </div>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="font-display text-lg">Join a group</CardTitle>
            <CardDescription>
              Got a join code from an admin? Drop it here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <JoinGroupForm compact />
          </CardContent>
        </Card>

        {memberships.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center space-y-4">
              <p className="eyebrow text-muted-foreground">Empty courts</p>
              <p className="font-display text-3xl tracking-tight">No groups yet.</p>
              <p className="text-muted-foreground mx-auto max-w-sm text-sm">
                Spin up your first group to start tracking sessions and scores.
              </p>
              <Button asChild variant="accent" size="lg">
                <Link href="/groups/new">Create your first group</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {memberships.map(({ role, group }) => (
              <Link key={group.id} href={`/groups/${group.id}`}>
                <Card className="hover:border-foreground/25 hover:shadow-[0_2px_0_0_var(--color-accent)] transition-all">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="font-display text-xl tracking-tight">
                          {group.name}
                        </CardTitle>
                        {group.description && (
                          <CardDescription className="line-clamp-2 mt-1">
                            {group.description}
                          </CardDescription>
                        )}
                      </div>
                      <RoleBadge role={role as GroupRoleValue} />
                    </div>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {group._count.members} member
                      {group._count.members === 1 ? "" : "s"} ·{" "}
                      {group._count.players} player
                      {group._count.players === 1 ? "" : "s"}
                    </span>
                    <span className="numeric text-sm text-accent-foreground bg-accent px-2 py-0.5 rounded-[3px]">
                      {group.joinCode}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
