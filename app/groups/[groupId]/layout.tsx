import { notFound, redirect } from "next/navigation";

import { GroupTabs } from "@/components/groups/group-tabs";
import { AppHeader } from "@/components/shared/app-header";
import { requireUser } from "@/lib/auth/session";
import { prisma, GroupRole, GroupStatus } from "@/lib/db";
import {
  ForbiddenError,
  NotFoundError,
} from "@/lib/permissions/errors";
import { getGroupRole, requireGroupRole } from "@/lib/permissions/group";

const ANY_MEMBER = [
  GroupRole.OWNER,
  GroupRole.ADMIN,
  GroupRole.PLAYER,
  GroupRole.VIEWER,
] as const;

/**
 * Server-side guard for every page under /groups/[groupId]/*.
 * Confirms the user is signed in, the group exists, and they're an active
 * member of *some* role. Page-level actions still re-check the specific role
 * — this layout only gates "is this user in this group at all?".
 */
export default async function GroupLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const user = await requireUser(`/groups/${groupId}`);

  try {
    await requireGroupRole(groupId, ANY_MEMBER);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    if (err instanceof ForbiddenError) redirect("/dashboard");
    throw err;
  }

  // Archived groups are read-frozen — bounce everyone back to the dashboard.
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { status: true },
  });
  if (group?.status === GroupStatus.ARCHIVED) redirect("/dashboard");

  const role = await getGroupRole(user.id, groupId);
  const showSettings =
    role === GroupRole.OWNER || role === GroupRole.ADMIN;

  return (
    <>
      <AppHeader userEmail={user.email} />
      <GroupTabs groupId={groupId} showSettings={showSettings} />
      {children}
    </>
  );
}
