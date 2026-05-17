import Link from "next/link";
import { notFound } from "next/navigation";

import { RoleBadge } from "@/components/shared/role-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma, GroupMemberStatus, GroupRole, PlayerStatus } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getGroupRole } from "@/lib/permissions/group";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const user = await requireUser();
  // Layout already authorized — this is for the typed role badge.
  const role = await getGroupRole(user.id, groupId);
  if (!role) notFound();

  const canManage = role === GroupRole.OWNER || role === GroupRole.ADMIN;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      description: true,
      joinCode: true,
      visibility: true,
      createdAt: true,
      _count: {
        select: {
          members: { where: { status: GroupMemberStatus.ACTIVE } },
          players: { where: { status: { not: PlayerStatus.REMOVED } } },
        },
      },
    },
  });
  if (!group) notFound();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {group.name}
            </h1>
            <RoleBadge role={role} />
          </div>
          {group.description && (
            <p className="text-muted-foreground text-sm">
              {group.description}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Join code</CardDescription>
            <CardTitle className="font-mono text-2xl tracking-widest">
              {group.joinCode}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            Share this with players so they can join
            {canManage ? (
              <>
                {" "}
                — or{" "}
                <Link
                  href={`/groups/${group.id}/settings`}
                  className="text-foreground underline"
                >
                  regenerate it
                </Link>
                .
              </>
            ) : (
              "."
            )}
          </CardContent>
        </Card>

        <Link href={`/groups/${group.id}/members`}>
          <Card className="hover:border-foreground/20 h-full transition-colors">
            <CardHeader>
              <CardDescription>Members</CardDescription>
              <CardTitle className="text-2xl">
                {group._count.members}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-xs">
              Registered accounts. Manage roles →
            </CardContent>
          </Card>
        </Link>

        <Link href={`/groups/${group.id}/players`}>
          <Card className="hover:border-foreground/20 h-full transition-colors">
            <CardHeader>
              <CardDescription>Players</CardDescription>
              <CardTitle className="text-2xl">
                {group._count.players}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-xs">
              Profiles for sessions, incl. temporary →
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Sessions</CardTitle>
          <CardDescription>
            Schedule a play day, assign courts, generate stacking, and track
            scores.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Sessions and court rotation arrive in Phase 3 / Phase 4. The current
          build covers auth, groups, members, players, and invites.
        </CardContent>
      </Card>
    </main>
  );
}
