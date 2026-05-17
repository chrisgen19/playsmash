import {
  prisma,
  GroupRole,
  GroupMemberStatus,
  PlayerStatus,
  InviteStatus,
} from "@/lib/db";
import { ActivityAction, logActivity } from "@/lib/activity/log";

/**
 * Domain errors thrown by joinGroupByCode. We return the discriminant on
 * `code` so the action layer can map each to a user-facing message without
 * pattern-matching on the message text.
 */
export class JoinGroupError extends Error {
  constructor(
    public readonly code:
      | "CODE_INVALID"
      | "CODE_DISABLED"
      | "CODE_EXPIRED"
      | "CODE_MAX_USES"
      | "MEMBER_BANNED",
    message: string,
  ) {
    super(message);
    this.name = "JoinGroupError";
  }
}

export type JoinGroupResult = {
  groupId: string;
  alreadyMember: boolean;
};

/**
 * Flow 2 (join by code). One transaction:
 *   - validate the Invite (active, not expired, under maxUses)
 *   - increment usedCount
 *   - upsert GroupMember as PLAYER (or revive a LEFT/REMOVED row; banned rows error)
 *   - ensure a PlayerProfile linked to this user exists (create if not)
 *   - log activity
 *
 * Idempotent: if the user is already an ACTIVE member, returns
 * `alreadyMember: true` and writes nothing.
 */
export async function joinGroupByCode(params: {
  userId: string;
  userName?: string | null;
  userEmail: string;
  code: string;
}): Promise<JoinGroupResult> {
  const code = params.code.trim().toUpperCase();

  const invite = await prisma.invite.findUnique({
    where: { code },
    select: {
      id: true,
      groupId: true,
      status: true,
      expiresAt: true,
      maxUses: true,
      usedCount: true,
    },
  });
  if (!invite) {
    throw new JoinGroupError("CODE_INVALID", "Join code is not valid");
  }
  if (invite.status !== InviteStatus.ACTIVE) {
    throw new JoinGroupError("CODE_DISABLED", "Join code is disabled");
  }
  if (invite.expiresAt && invite.expiresAt.getTime() <= Date.now()) {
    throw new JoinGroupError("CODE_EXPIRED", "Join code has expired");
  }
  if (
    invite.maxUses !== null &&
    invite.usedCount >= invite.maxUses
  ) {
    throw new JoinGroupError(
      "CODE_MAX_USES",
      "Join code has reached its usage limit",
    );
  }

  const existingMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: invite.groupId, userId: params.userId } },
    select: { id: true, status: true },
  });

  if (existingMember?.status === GroupMemberStatus.BANNED) {
    throw new JoinGroupError("MEMBER_BANNED", "You are banned from this group");
  }

  if (existingMember?.status === GroupMemberStatus.ACTIVE) {
    return { groupId: invite.groupId, alreadyMember: true };
  }

  const displayName =
    params.userName?.trim() || params.userEmail.split("@")[0] || "Player";

  await prisma.$transaction(async (tx) => {
    // Bump usedCount atomically.
    await tx.invite.update({
      where: { id: invite.id },
      data: { usedCount: { increment: 1 } },
    });

    // Member: upsert. We `update` on the unique (groupId, userId) so a
    // previously LEFT/REMOVED row gets revived as PLAYER/ACTIVE rather than
    // creating a duplicate (which the unique constraint would reject anyway).
    if (existingMember) {
      await tx.groupMember.update({
        where: { id: existingMember.id },
        data: {
          role: GroupRole.PLAYER,
          status: GroupMemberStatus.ACTIVE,
          joinedAt: new Date(),
        },
      });
    } else {
      await tx.groupMember.create({
        data: {
          groupId: invite.groupId,
          userId: params.userId,
          role: GroupRole.PLAYER,
          status: GroupMemberStatus.ACTIVE,
        },
      });
    }

    // Ensure a player profile exists for this user in this group.
    const existingProfile = await tx.playerProfile.findUnique({
      where: {
        groupId_userId: { groupId: invite.groupId, userId: params.userId },
      },
      select: { id: true, status: true },
    });
    if (!existingProfile) {
      await tx.playerProfile.create({
        data: {
          groupId: invite.groupId,
          userId: params.userId,
          displayName,
          status: PlayerStatus.ACTIVE,
          createdByUserId: params.userId,
        },
      });
    } else if (existingProfile.status === PlayerStatus.REMOVED) {
      await tx.playerProfile.update({
        where: { id: existingProfile.id },
        data: { status: PlayerStatus.ACTIVE },
      });
    }

    await logActivity(
      {
        groupId: invite.groupId,
        userId: params.userId,
        action: ActivityAction.MEMBER_JOINED,
        targetType: "GroupMember",
        targetId: params.userId,
        newValue: { role: GroupRole.PLAYER, via: "invite_code" },
      },
      tx,
    );
  });

  return { groupId: invite.groupId, alreadyMember: false };
}
