import {
  prisma,
  GroupRole,
  GroupMemberStatus,
  GroupStatus,
} from "@/lib/db";
import { ActivityAction, logActivity } from "@/lib/activity/log";
import { NotFoundError } from "@/lib/permissions/errors";
import type { EditGroupInput } from "@/lib/validations/group";

export class ManageGroupError extends Error {
  constructor(
    public readonly code:
      | "ALREADY_ARCHIVED"
      | "TARGET_NOT_MEMBER"
      | "TARGET_ALREADY_OWNER"
      | "GROUP_ARCHIVED",
    message: string,
  ) {
    super(message);
    this.name = "ManageGroupError";
  }
}

/** Lock the Group row and return its status, inside a transaction. */
async function lockGroupStatus(
  tx: Pick<typeof prisma, "$queryRaw">,
  groupId: string,
): Promise<string | null> {
  const rows = await tx.$queryRaw<Array<{ status: string }>>`
    SELECT "status" FROM "Group" WHERE "id" = ${groupId} FOR UPDATE
  `;
  return rows[0]?.status ?? null;
}

/**
 * Edit a group's name / description / visibility. OWNER or ADMIN (caller
 * enforces). Rejected on an archived group.
 */
export async function editGroup(params: {
  groupId: string;
  actorUserId: string;
  input: EditGroupInput;
}): Promise<void> {
  const group = await prisma.group.findUnique({
    where: { id: params.groupId },
    select: {
      id: true,
      name: true,
      description: true,
      visibility: true,
      status: true,
    },
  });
  if (!group) throw new NotFoundError("Group not found");
  if (group.status === GroupStatus.ARCHIVED) {
    throw new ManageGroupError("GROUP_ARCHIVED", "This group is archived");
  }

  await prisma.$transaction(async (tx) => {
    await tx.group.update({
      where: { id: group.id },
      data: {
        name: params.input.name,
        description: params.input.description ?? null,
        visibility: params.input.visibility,
      },
    });
    await logActivity(
      {
        groupId: group.id,
        userId: params.actorUserId,
        action: ActivityAction.GROUP_UPDATED,
        targetType: "Group",
        targetId: group.id,
        oldValue: {
          name: group.name,
          description: group.description,
          visibility: group.visibility,
        },
        newValue: {
          name: params.input.name,
          description: params.input.description ?? null,
          visibility: params.input.visibility,
        },
      },
      tx,
    );
  });
}

/**
 * Soft-delete a group: status -> ARCHIVED. The row is kept so match history
 * survives; archived groups drop off the dashboard and reject mutations.
 * OWNER only (caller enforces). Race-safe via a row lock.
 */
export async function archiveGroup(params: {
  groupId: string;
  actorUserId: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const status = await lockGroupStatus(tx, params.groupId);
    if (status === null) throw new NotFoundError("Group not found");
    if (status === GroupStatus.ARCHIVED) {
      throw new ManageGroupError(
        "ALREADY_ARCHIVED",
        "This group is already archived",
      );
    }
    await tx.group.update({
      where: { id: params.groupId },
      data: { status: GroupStatus.ARCHIVED, archivedAt: new Date() },
    });
    await logActivity(
      {
        groupId: params.groupId,
        userId: params.actorUserId,
        action: ActivityAction.GROUP_ARCHIVED,
        targetType: "Group",
        targetId: params.groupId,
        oldValue: { status },
        newValue: { status: GroupStatus.ARCHIVED },
      },
      tx,
    );
  });
}

/**
 * Transfer ownership to another ACTIVE member. The current OWNER is demoted
 * to ADMIN, the target promoted to OWNER. Atomic and race-safe via a lock on
 * the Group row.
 *
 * Caller MUST verify the actor is the current OWNER before calling.
 */
export async function transferOwnership(params: {
  groupId: string;
  currentOwnerUserId: string;
  targetMemberId: string;
}): Promise<void> {
  const target = await prisma.groupMember.findUnique({
    where: { id: params.targetMemberId },
    select: { id: true, groupId: true, userId: true, role: true, status: true },
  });
  if (!target || target.groupId !== params.groupId) {
    throw new NotFoundError("Member not found in this group");
  }
  if (target.status !== GroupMemberStatus.ACTIVE) {
    throw new ManageGroupError(
      "TARGET_NOT_MEMBER",
      "Ownership can only be transferred to an active member",
    );
  }
  if (target.role === GroupRole.OWNER) {
    throw new ManageGroupError(
      "TARGET_ALREADY_OWNER",
      "That member is already the owner",
    );
  }

  await prisma.$transaction(async (tx) => {
    // Lock the group so two transfers can't interleave.
    const status = await lockGroupStatus(tx, params.groupId);
    if (status === null) throw new NotFoundError("Group not found");
    if (status === GroupStatus.ARCHIVED) {
      throw new ManageGroupError("GROUP_ARCHIVED", "This group is archived");
    }

    // Find the current OWNER membership row by user id.
    const currentOwner = await tx.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: params.groupId,
          userId: params.currentOwnerUserId,
        },
      },
      select: { id: true, role: true },
    });
    if (!currentOwner || currentOwner.role !== GroupRole.OWNER) {
      // The caller already authorized as OWNER; this only trips on a race
      // where ownership changed between the check and the lock.
      throw new ManageGroupError(
        "TARGET_NOT_MEMBER",
        "You are no longer the owner of this group",
      );
    }

    await tx.groupMember.update({
      where: { id: currentOwner.id },
      data: { role: GroupRole.ADMIN },
    });
    await tx.groupMember.update({
      where: { id: target.id },
      data: { role: GroupRole.OWNER },
    });
    await tx.group.update({
      where: { id: params.groupId },
      data: { createdByUserId: target.userId },
    });
    await logActivity(
      {
        groupId: params.groupId,
        userId: params.currentOwnerUserId,
        action: ActivityAction.GROUP_OWNERSHIP_TRANSFERRED,
        targetType: "GroupMember",
        targetId: target.id,
        oldValue: { ownerUserId: params.currentOwnerUserId },
        newValue: { ownerUserId: target.userId },
      },
      tx,
    );
  });
}
