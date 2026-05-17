import {
  prisma,
  GroupRole,
  GroupMemberStatus,
  GroupStatus,
  GroupVisibility,
  JoinRequestStatus,
  PlayerStatus,
} from "@/lib/db";
import { ActivityAction, logActivity } from "@/lib/activity/log";
import { NotFoundError } from "@/lib/permissions/errors";

export class JoinRequestError extends Error {
  constructor(
    public readonly code:
      | "NOT_PUBLIC"
      | "GROUP_ARCHIVED"
      | "ALREADY_MEMBER"
      | "ALREADY_PENDING"
      | "BANNED"
      | "REQUEST_NOT_PENDING",
    message: string,
  ) {
    super(message);
    this.name = "JoinRequestError";
  }
}

/**
 * A signed-in non-member asks to join a PUBLIC group. Creates (or revives)
 * a PENDING JoinRequest. Admins approve/reject from the members page.
 */
export async function requestToJoin(params: {
  groupId: string;
  userId: string;
}): Promise<void> {
  const group = await prisma.group.findUnique({
    where: { id: params.groupId },
    select: { id: true, visibility: true, status: true },
  });
  if (!group) throw new NotFoundError("Group not found");
  if (group.status === GroupStatus.ARCHIVED) {
    throw new JoinRequestError("GROUP_ARCHIVED", "This group is archived");
  }
  if (group.visibility !== GroupVisibility.PUBLIC) {
    throw new JoinRequestError(
      "NOT_PUBLIC",
      "This group does not accept join requests",
    );
  }

  const member = await prisma.groupMember.findUnique({
    where: {
      groupId_userId: { groupId: params.groupId, userId: params.userId },
    },
    select: { status: true },
  });
  if (member?.status === GroupMemberStatus.ACTIVE) {
    throw new JoinRequestError("ALREADY_MEMBER", "You are already a member");
  }
  if (member?.status === GroupMemberStatus.BANNED) {
    throw new JoinRequestError("BANNED", "You can't join this group");
  }

  const existing = await prisma.joinRequest.findUnique({
    where: {
      groupId_userId: { groupId: params.groupId, userId: params.userId },
    },
    select: { id: true, status: true },
  });
  if (existing?.status === JoinRequestStatus.PENDING) {
    throw new JoinRequestError(
      "ALREADY_PENDING",
      "Your request is already pending",
    );
  }

  await prisma.$transaction(async (tx) => {
    if (existing) {
      // Revive a prior rejected/cancelled request rather than duplicating.
      await tx.joinRequest.update({
        where: { id: existing.id },
        data: { status: JoinRequestStatus.PENDING },
      });
    } else {
      await tx.joinRequest.create({
        data: {
          groupId: params.groupId,
          userId: params.userId,
          status: JoinRequestStatus.PENDING,
        },
      });
    }
    await logActivity(
      {
        groupId: params.groupId,
        userId: params.userId,
        action: ActivityAction.JOIN_REQUEST_CREATED,
        targetType: "JoinRequest",
        targetId: params.userId,
      },
      tx,
    );
  });
}

/**
 * Approve a pending request: creates the GroupMember (PLAYER) + a linked
 * PlayerProfile, mirroring the join-by-code transaction. OWNER/ADMIN only
 * (caller enforces). Race-safe — the JoinRequest row is the serialization
 * point (its status flips to APPROVED inside the tx).
 */
export async function approveJoinRequest(params: {
  groupId: string;
  actorUserId: string;
  requestId: string;
}): Promise<void> {
  const request = await prisma.joinRequest.findUnique({
    where: { id: params.requestId },
    select: {
      id: true,
      groupId: true,
      userId: true,
      status: true,
      user: { select: { name: true, email: true } },
    },
  });
  if (!request || request.groupId !== params.groupId) {
    throw new NotFoundError("Join request not found in this group");
  }
  if (request.status !== JoinRequestStatus.PENDING) {
    throw new JoinRequestError(
      "REQUEST_NOT_PENDING",
      "This request is no longer pending",
    );
  }

  const displayName =
    request.user.name?.trim() ||
    request.user.email.split("@")[0] ||
    "Player";

  await prisma.$transaction(async (tx) => {
    await tx.joinRequest.update({
      where: { id: request.id },
      data: { status: JoinRequestStatus.APPROVED },
    });

    // Member: revive a LEFT/REMOVED row or create fresh.
    const member = await tx.groupMember.findUnique({
      where: {
        groupId_userId: { groupId: params.groupId, userId: request.userId },
      },
      select: { id: true },
    });
    if (member) {
      await tx.groupMember.update({
        where: { id: member.id },
        data: {
          role: GroupRole.PLAYER,
          status: GroupMemberStatus.ACTIVE,
          joinedAt: new Date(),
        },
      });
    } else {
      await tx.groupMember.create({
        data: {
          groupId: params.groupId,
          userId: request.userId,
          role: GroupRole.PLAYER,
          status: GroupMemberStatus.ACTIVE,
        },
      });
    }

    // Ensure a player profile exists.
    const profile = await tx.playerProfile.findUnique({
      where: {
        groupId_userId: { groupId: params.groupId, userId: request.userId },
      },
      select: { id: true, status: true },
    });
    if (!profile) {
      await tx.playerProfile.create({
        data: {
          groupId: params.groupId,
          userId: request.userId,
          displayName,
          status: PlayerStatus.ACTIVE,
          createdByUserId: request.userId,
        },
      });
    } else if (profile.status === PlayerStatus.REMOVED) {
      await tx.playerProfile.update({
        where: { id: profile.id },
        data: { status: PlayerStatus.ACTIVE },
      });
    }

    await logActivity(
      {
        groupId: params.groupId,
        userId: params.actorUserId,
        action: ActivityAction.JOIN_REQUEST_APPROVED,
        targetType: "JoinRequest",
        targetId: request.id,
        newValue: { userId: request.userId },
      },
      tx,
    );
  });
}

/** Reject a pending request. OWNER/ADMIN only (caller enforces). */
export async function rejectJoinRequest(params: {
  groupId: string;
  actorUserId: string;
  requestId: string;
}): Promise<void> {
  const request = await prisma.joinRequest.findUnique({
    where: { id: params.requestId },
    select: { id: true, groupId: true, userId: true, status: true },
  });
  if (!request || request.groupId !== params.groupId) {
    throw new NotFoundError("Join request not found in this group");
  }
  if (request.status !== JoinRequestStatus.PENDING) {
    throw new JoinRequestError(
      "REQUEST_NOT_PENDING",
      "This request is no longer pending",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.joinRequest.update({
      where: { id: request.id },
      data: { status: JoinRequestStatus.REJECTED },
    });
    await logActivity(
      {
        groupId: params.groupId,
        userId: params.actorUserId,
        action: ActivityAction.JOIN_REQUEST_REJECTED,
        targetType: "JoinRequest",
        targetId: request.id,
        newValue: { userId: request.userId },
      },
      tx,
    );
  });
}
