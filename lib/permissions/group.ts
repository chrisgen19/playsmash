import { prisma, GroupMemberStatus, GroupStatus } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";

import { ForbiddenError, NotFoundError } from "./errors";
import {
  roleSatisfiesAny,
  type GroupRoleValue,
} from "./roles";

export type { GroupRoleValue } from "./roles";
export { roleSatisfies, roleSatisfiesAny } from "./roles";

/** Returns the current user's role in `groupId`, or null if not a member. */
export async function getGroupRole(
  userId: string,
  groupId: string,
): Promise<GroupRoleValue | null> {
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { role: true, status: true },
  });
  if (!member) return null;
  if (member.status !== GroupMemberStatus.ACTIVE) return null;
  return member.role;
}

export type GroupAuthResult = {
  userId: string;
  role: GroupRoleValue;
};

/**
 * Use at the top of every server action / server-component data fetch that
 * touches group-scoped data. Verifies the user is signed in, the group exists
 * and is not archived, the user is an ACTIVE member, and their role satisfies
 * the `allowed` list.
 *
 * Archived groups are rejected here — this is the single backstop that makes
 * "archive freezes the group" true for *every* entry point, including direct
 * form POSTs to a server action that never pass through the group layout.
 *
 * Throws ForbiddenError or NotFoundError — never returns a "maybe authorized"
 * value. Calling code should rely on this and skip ad-hoc checks.
 */
export async function requireGroupRole(
  groupId: string,
  allowed: readonly GroupRoleValue[],
): Promise<GroupAuthResult> {
  const user = await requireUser();
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, status: true },
  });
  if (!group) throw new NotFoundError("Group not found");
  if (group.status === GroupStatus.ARCHIVED) {
    throw new ForbiddenError("This group is archived");
  }

  const role = await getGroupRole(user.id, groupId);
  if (!role) throw new ForbiddenError("You are not a member of this group");
  if (!roleSatisfiesAny(role, allowed)) {
    throw new ForbiddenError("Your role does not allow this action");
  }
  return { userId: user.id, role };
}
