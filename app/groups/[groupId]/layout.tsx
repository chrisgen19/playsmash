import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/shared/app-header";
import { requireUser } from "@/lib/auth/session";
import { GroupRole } from "@/lib/db";
import {
  ForbiddenError,
  NotFoundError,
} from "@/lib/permissions/errors";
import { requireGroupRole } from "@/lib/permissions/group";

const ANY_MEMBER = [
  GroupRole.OWNER,
  GroupRole.ADMIN,
  GroupRole.PLAYER,
  GroupRole.VIEWER,
] as const;

/**
 * Server-side guard for every page under /groups/[groupId]/*.
 * Confirms the user is signed in, the group exists, and they're an active
 * member of *some* role. Page-level actions still re-check the specific role.
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

  return (
    <>
      <AppHeader userEmail={user.email} />
      {children}
    </>
  );
}
