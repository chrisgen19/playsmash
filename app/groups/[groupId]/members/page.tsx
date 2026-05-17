import { notFound } from "next/navigation";

import { JoinRequestActions } from "@/components/groups/join-request-actions";
import { MemberRowActions } from "@/components/groups/member-row-actions";
import { RoleBadge } from "@/components/shared/role-badge";
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
  GroupRole,
  JoinRequestStatus,
} from "@/lib/db";
import { getGroupRole } from "@/lib/permissions/group";
import type { GroupRoleValue } from "@/lib/permissions/roles";

export default async function GroupMembersPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const user = await requireUser();
  const actorRole = await getGroupRole(user.id, groupId);
  if (!actorRole) notFound();

  const canManage =
    actorRole === GroupRole.OWNER || actorRole === GroupRole.ADMIN;

  const members = await prisma.groupMember.findMany({
    where: { groupId, status: GroupMemberStatus.ACTIVE },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    select: {
      id: true,
      role: true,
      joinedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  // Pending join requests — admins approve/reject them here.
  const pendingRequests = canManage
    ? await prisma.joinRequest.findMany({
        where: { groupId, status: JoinRequestStatus.PENDING },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          createdAt: true,
          user: {
            select: {
              name: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      })
    : [];

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
        <p className="text-muted-foreground text-sm">
          {members.length} active member{members.length === 1 ? "" : "s"}.
          {canManage
            ? " You can change roles or remove members."
            : " Only admins or the owner can change roles."}
        </p>
      </div>

      {canManage && pendingRequests.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">
              Pending join requests ({pendingRequests.length})
            </CardTitle>
            <CardDescription>
              Requests from public-group join links. Approving adds the user
              as a player.
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-border/60 divide-y">
            {pendingRequests.map((r) => {
              const displayName =
                r.user.name ??
                ([r.user.firstName, r.user.lastName]
                  .filter(Boolean)
                  .join(" ") || r.user.email);
              return (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {displayName}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {r.user.email} · requested{" "}
                      {r.createdAt.toISOString().slice(0, 10)}
                    </p>
                  </div>
                  <JoinRequestActions groupId={groupId} requestId={r.id} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Roster</CardTitle>
          <CardDescription>
            The owner can&apos;t be removed or demoted here — use ownership
            transfer in Settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-border/60 divide-y">
          {members.map((m) => {
            const displayName =
              m.user.name ??
              ([m.user.firstName, m.user.lastName].filter(Boolean).join(" ") ||
                m.user.email);
            const isSelf = m.user.id === user.id;
            const isOwnerRow = m.role === GroupRole.OWNER;
            return (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">
                      {displayName}
                      {isSelf && (
                        <span className="text-muted-foreground ml-1 text-xs">
                          (you)
                        </span>
                      )}
                    </p>
                    <RoleBadge role={m.role as GroupRoleValue} />
                  </div>
                  <p className="text-muted-foreground truncate text-xs">
                    {m.user.email} · joined{" "}
                    {m.joinedAt.toISOString().slice(0, 10)}
                  </p>
                </div>
                {canManage ? (
                  <MemberRowActions
                    groupId={groupId}
                    memberId={m.id}
                    currentRole={m.role as GroupRoleValue}
                    isSelf={isSelf}
                    actorRole={actorRole}
                    isOwnerRow={isOwnerRow}
                  />
                ) : (
                  <span className="text-muted-foreground text-xs">
                    Read-only
                  </span>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </main>
  );
}
