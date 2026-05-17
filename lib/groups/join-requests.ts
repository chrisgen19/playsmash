import {
  prisma,
  Prisma,
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
      | "MEMBER_BANNED"
      | "REQUEST_NOT_PENDING",
    message: string,
  ) {
    super(message);
    this.name = "JoinRequestError";
  }
}

/** Minimal tx shape for the raw locking SELECTs. */
type RawTx = Pick<typeof prisma, "$queryRaw">;

/** Lock a JoinRequest row for the rest of the tx; returns its status. */
async function lockJoinRequestStatus(
  tx: RawTx,
  requestId: string,
): Promise<string | null> {
  const rows = await tx.$queryRaw<Array<{ status: string }>>`
    SELECT "status" FROM "JoinRequest" WHERE "id" = ${requestId} FOR UPDATE
  `;
  return rows[0]?.status ?? null;
}

/**
 * A signed-in non-member asks to join a PUBLIC group. Creates (or revives)
 * a PENDING JoinRequest.
 *
 * All eligibility checks run *inside* the transaction so a concurrent archive
 * or membership change can't let a stale PENDING request through. The
 * (groupId, userId) unique constraint serializes concurrent first-requests —
 * the loser's P2002 is mapped to ALREADY_PENDING.
 */
export async function requestToJoin(params: {
  groupId: string;
  userId: string;
}): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      const group = await tx.group.findUnique({
        where: { id: params.groupId },
        select: { visibility: true, status: true },
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

      const member = await tx.groupMember.findUnique({
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

      const existing = await tx.joinRequest.findUnique({
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

      // Revive a prior rejected/cancelled request, or create a new one.
      const requestId = existing
        ? (
            await tx.joinRequest.update({
              where: { id: existing.id },
              data: { status: JoinRequestStatus.PENDING },
              select: { id: true },
            })
          ).id
        : (
            await tx.joinRequest.create({
              data: {
                groupId: params.groupId,
                userId: params.userId,
                status: JoinRequestStatus.PENDING,
              },
              select: { id: true },
            })
          ).id;

      await logActivity(
        {
          groupId: params.groupId,
          userId: params.userId,
          action: ActivityAction.JOIN_REQUEST_CREATED,
          targetType: "JoinRequest",
          targetId: requestId,
        },
        tx,
      );
    });
  } catch (err) {
    // Two concurrent first-requests: the loser hit the (groupId, userId)
    // unique constraint — the other request is now PENDING.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new JoinRequestError(
        "ALREADY_PENDING",
        "Your request is already pending",
      );
    }
    throw err;
  }
}

/**
 * Approve a pending request: creates the GroupMember (PLAYER) + a linked
 * PlayerProfile, mirroring join-by-code. OWNER/ADMIN only (caller enforces).
 *
 * The JoinRequest row is locked and re-checked PENDING inside the tx, and the
 * group's archived state re-checked, so concurrent moderation can't double-
 * approve or approve into an archived group.
 */
export async function approveJoinRequest(params: {
  groupId: string;
  actorUserId: string;
  requestId: string;
}): Promise<void> {
  // Pre-tx fast-fail for ownership + obvious wrong state.
  const pre = await prisma.joinRequest.findUnique({
    where: { id: params.requestId },
    select: { groupId: true },
  });
  if (!pre || pre.groupId !== params.groupId) {
    throw new NotFoundError("Join request not found in this group");
  }

  await prisma.$transaction(async (tx) => {
    const status = await lockJoinRequestStatus(tx, params.requestId);
    if (status === null) {
      throw new NotFoundError("Join request not found in this group");
    }
    if (status !== JoinRequestStatus.PENDING) {
      throw new JoinRequestError(
        "REQUEST_NOT_PENDING",
        "This request is no longer pending",
      );
    }

    const group = await tx.group.findUnique({
      where: { id: params.groupId },
      select: { status: true },
    });
    if (group?.status === GroupStatus.ARCHIVED) {
      throw new JoinRequestError("GROUP_ARCHIVED", "This group is archived");
    }

    const request = await tx.joinRequest.findUniqueOrThrow({
      where: { id: params.requestId },
      select: {
        userId: true,
        user: { select: { name: true, email: true } },
      },
    });
    const displayName =
      request.user.name?.trim() ||
      request.user.email.split("@")[0] ||
      "Player";

    // Check the existing membership BEFORE flipping the request — a BANNED
    // user shouldn't have their ban silently undone by approving a stale
    // request, and an already-ACTIVE member shouldn't get their role reset.
    const member = await tx.groupMember.findUnique({
      where: {
        groupId_userId: { groupId: params.groupId, userId: request.userId },
      },
      select: { id: true, role: true, status: true },
    });
    if (member?.status === GroupMemberStatus.BANNED) {
      throw new JoinRequestError(
        "MEMBER_BANNED",
        "This user is banned from the group; lift the ban before approving",
      );
    }

    await tx.joinRequest.update({
      where: { id: params.requestId },
      data: { status: JoinRequestStatus.APPROVED },
    });

    // Membership transitions:
    //   - ACTIVE → no-op (already a member; the approve is idempotent on the
    //     membership side, the request flips to APPROVED).
    //   - LEFT / REMOVED / INVITED → revive as PLAYER + ACTIVE. They went
    //     through a join-request flow which is by definition a "fresh start"
    //     as a player; an admin can re-promote afterwards if needed.
    //   - no row → create as PLAYER + ACTIVE.
    if (!member) {
      await tx.groupMember.create({
        data: {
          groupId: params.groupId,
          userId: request.userId,
          role: GroupRole.PLAYER,
          status: GroupMemberStatus.ACTIVE,
        },
      });
    } else if (member.status !== GroupMemberStatus.ACTIVE) {
      await tx.groupMember.update({
        where: { id: member.id },
        data: {
          role: GroupRole.PLAYER,
          status: GroupMemberStatus.ACTIVE,
          joinedAt: new Date(),
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
        targetId: params.requestId,
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
  const pre = await prisma.joinRequest.findUnique({
    where: { id: params.requestId },
    select: { groupId: true },
  });
  if (!pre || pre.groupId !== params.groupId) {
    throw new NotFoundError("Join request not found in this group");
  }

  await prisma.$transaction(async (tx) => {
    const status = await lockJoinRequestStatus(tx, params.requestId);
    if (status === null) {
      throw new NotFoundError("Join request not found in this group");
    }
    if (status !== JoinRequestStatus.PENDING) {
      throw new JoinRequestError(
        "REQUEST_NOT_PENDING",
        "This request is no longer pending",
      );
    }

    const request = await tx.joinRequest.findUniqueOrThrow({
      where: { id: params.requestId },
      select: { userId: true },
    });

    await tx.joinRequest.update({
      where: { id: params.requestId },
      data: { status: JoinRequestStatus.REJECTED },
    });
    await logActivity(
      {
        groupId: params.groupId,
        userId: params.actorUserId,
        action: ActivityAction.JOIN_REQUEST_REJECTED,
        targetType: "JoinRequest",
        targetId: params.requestId,
        newValue: { userId: request.userId },
      },
      tx,
    );
  });
}
