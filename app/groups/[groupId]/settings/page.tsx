import { notFound, redirect } from "next/navigation";

import { DangerZone } from "@/components/groups/danger-zone";
import { EditGroupForm } from "@/components/groups/edit-group-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma, GroupMemberStatus, GroupRole } from "@/lib/db";
import {
  ForbiddenError,
  NotFoundError,
} from "@/lib/permissions/errors";
import { requireGroupRole } from "@/lib/permissions/group";

import { regenerateJoinCodeAction } from "./actions";

const OWNERS_AND_ADMINS = [GroupRole.OWNER, GroupRole.ADMIN] as const;

export default async function GroupSettingsPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;

  let role: GroupRole;
  try {
    const auth = await requireGroupRole(groupId, OWNERS_AND_ADMINS);
    role = auth.role;
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    if (err instanceof ForbiddenError) redirect(`/groups/${groupId}`);
    throw err;
  }
  const isOwner = role === GroupRole.OWNER;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      joinCode: true,
      visibility: true,
      description: true,
    },
  });
  if (!group) notFound();

  // Candidates for ownership transfer — every other ACTIVE member.
  const transferCandidates = isOwner
    ? await prisma.groupMember.findMany({
        where: {
          groupId,
          status: GroupMemberStatus.ACTIVE,
          role: { not: GroupRole.OWNER },
        },
        orderBy: { joinedAt: "asc" },
        select: {
          id: true,
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
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Group details</CardTitle>
          <CardDescription>
            Name, description, and who can find or join the group.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditGroupForm
            groupId={group.id}
            name={group.name}
            description={group.description}
            visibility={group.visibility}
          />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Join code</CardTitle>
          <CardDescription>
            Share this code with players to let them join. Regenerating
            disables the current code immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-mono text-2xl tracking-widest">
            {group.joinCode}
          </div>
          <form action={regenerateJoinCodeAction}>
            <input type="hidden" name="groupId" value={group.id} />
            <Button type="submit" variant="outline">
              Regenerate
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Danger zone</CardTitle>
          <CardDescription>
            {isOwner
              ? "Owner-only actions. Both ask for confirmation."
              : "Only the group owner can transfer ownership or archive the group."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isOwner ? (
            <DangerZone
              groupId={group.id}
              candidates={transferCandidates.map((m) => ({
                memberId: m.id,
                label:
                  m.user.name ??
                  ([m.user.firstName, m.user.lastName]
                    .filter(Boolean)
                    .join(" ") || m.user.email),
              }))}
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              You&apos;re an admin — ask the owner for these changes.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
