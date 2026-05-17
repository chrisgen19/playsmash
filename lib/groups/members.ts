import {
  prisma,
  GroupRole,
  GroupMemberStatus,
  PlayerStatus,
} from "@/lib/db";
import { ActivityAction, logActivity } from "@/lib/activity/log";
import {
  ForbiddenError,
  NotFoundError,
} from "@/lib/permissions/errors";
import type { GroupRoleValue } from "@/lib/permissions/roles";

export class MemberActionError extends Error {
  constructor(
    public readonly code:
      | "CANNOT_DEMOTE_OWNER"
      | "CANNOT_REMOVE_OWNER"
      | "CANNOT_PROMOTE_TO_OWNER"
      | "INVALID_ROLE_CHANGE",
    message: string,
  ) {
    super(message);
    this.name = "MemberActionError";
  }
}

/**
 * Change a member's role.
 *
 * Rules:
 *   - Caller must be OWNER or ADMIN (checked by caller via requireGroupRole).
 *   - OWNER role cannot be assigned via this path (use transfer-ownership in Phase 8).
 *   - The single OWNER's role cannot be changed by anyone via this path.
 *   - ADMINs cannot demote other ADMINs (only OWNER can).
 *
 * `actorRole` is passed in so the service can enforce the OWNER-only ADMIN
 * demotions without re-fetching.
 */
export async function changeMemberRole(params: {
  groupId: string;
  actorUserId: string;
  actorRole: GroupRoleValue;
  targetMemberId: string;
  newRole: GroupRoleValue;
}): Promise<void> {
  if (params.newRole === GroupRole.OWNER) {
    throw new MemberActionError(
      "CANNOT_PROMOTE_TO_OWNER",
      "Use transfer-ownership instead",
    );
  }

  const member = await prisma.groupMember.findUnique({
    where: { id: params.targetMemberId },
    select: { id: true, groupId: true, userId: true, role: true, status: true },
  });
  if (!member || member.groupId !== params.groupId) {
    throw new NotFoundError("Member not found in this group");
  }
  if (member.status !== GroupMemberStatus.ACTIVE) {
    throw new MemberActionError(
      "INVALID_ROLE_CHANGE",
      "Cannot change role of an inactive member",
    );
  }
  if (member.role === GroupRole.OWNER) {
    throw new MemberActionError(
      "CANNOT_DEMOTE_OWNER",
      "The group owner cannot be demoted",
    );
  }
  if (
    member.role === GroupRole.ADMIN &&
    params.actorRole !== GroupRole.OWNER
  ) {
    throw new ForbiddenError("Only the owner can demote another admin");
  }
  if (member.role === params.newRole) return; // no-op

  await prisma.$transaction(async (tx) => {
    await tx.groupMember.update({
      where: { id: member.id },
      data: { role: params.newRole },
    });
    await logActivity(
      {
        groupId: params.groupId,
        userId: params.actorUserId,
        action: ActivityAction.MEMBER_ROLE_CHANGED,
        targetType: "GroupMember",
        targetId: member.id,
        oldValue: { role: member.role },
        newValue: { role: params.newRole },
      },
      tx,
    );
  });
}

/**
 * Soft-remove a member: status -> REMOVED. Their PlayerProfile is also
 * marked INACTIVE so they stop appearing in session pickers. Existing match
 * history stays intact (PlayerProfile FK preserved).
 *
 * Rules:
 *   - OWNER cannot be removed via this path.
 *   - ADMINs cannot remove other ADMINs (only OWNER can).
 *   - Caller cannot remove themselves via this path (they should use "leave group" in Phase 8).
 */
export async function removeMember(params: {
  groupId: string;
  actorUserId: string;
  actorRole: GroupRoleValue;
  targetMemberId: string;
}): Promise<void> {
  const member = await prisma.groupMember.findUnique({
    where: { id: params.targetMemberId },
    select: { id: true, groupId: true, userId: true, role: true, status: true },
  });
  if (!member || member.groupId !== params.groupId) {
    throw new NotFoundError("Member not found in this group");
  }
  if (member.role === GroupRole.OWNER) {
    throw new MemberActionError(
      "CANNOT_REMOVE_OWNER",
      "The group owner cannot be removed",
    );
  }
  if (
    member.role === GroupRole.ADMIN &&
    params.actorRole !== GroupRole.OWNER
  ) {
    throw new ForbiddenError("Only the owner can remove another admin");
  }
  if (member.userId === params.actorUserId) {
    throw new ForbiddenError("Use leave-group to remove yourself");
  }

  await prisma.$transaction(async (tx) => {
    await tx.groupMember.update({
      where: { id: member.id },
      data: { status: GroupMemberStatus.REMOVED },
    });

    // Soft-deactivate their player profile so session pickers hide them.
    await tx.playerProfile.updateMany({
      where: {
        groupId: params.groupId,
        userId: member.userId,
        status: { not: PlayerStatus.REMOVED },
      },
      data: { status: PlayerStatus.INACTIVE },
    });

    await logActivity(
      {
        groupId: params.groupId,
        userId: params.actorUserId,
        action: ActivityAction.MEMBER_REMOVED,
        targetType: "GroupMember",
        targetId: member.id,
        oldValue: { role: member.role, status: member.status },
        newValue: { status: GroupMemberStatus.REMOVED },
      },
      tx,
    );
  });
}
