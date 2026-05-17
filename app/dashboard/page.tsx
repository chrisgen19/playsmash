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
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Your groups
            </h1>
            <p className="text-muted-foreground text-sm">
              Hey {user.name ?? user.email}, here&apos;s what you&apos;re a part of.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/groups/new">Create group</Link>
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Join a group</CardTitle>
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
            <CardContent className="py-12 text-center">
              <p className="mb-1 text-base font-medium">No groups yet</p>
              <p className="text-muted-foreground mb-4 text-sm">
                Spin up your first group to start tracking sessions and scores.
              </p>
              <Button asChild>
                <Link href="/groups/new">Create your first group</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {memberships.map(({ role, group }) => (
              <Link key={group.id} href={`/groups/${group.id}`}>
                <Card className="hover:border-foreground/20 transition-colors">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">
                          {group.name}
                        </CardTitle>
                        {group.description && (
                          <CardDescription className="line-clamp-2">
                            {group.description}
                          </CardDescription>
                        )}
                      </div>
                      <RoleBadge role={role as GroupRoleValue} />
                    </div>
                  </CardHeader>
                  <CardContent className="text-muted-foreground flex items-center justify-between text-xs">
                    <span>
                      {group._count.members} member
                      {group._count.members === 1 ? "" : "s"} ·{" "}
                      {group._count.players} player
                      {group._count.players === 1 ? "" : "s"}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-wider">
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
