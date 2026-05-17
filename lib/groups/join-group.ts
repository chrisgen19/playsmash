import {
  prisma,
  Prisma,
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

/** Shape of the row returned by the locking SELECT. */
type LockedInvite = {
  id: string;
  groupId: string;
  status: string;
  expiresAt: Date | null;
  maxUses: number | null;
  usedCount: number;
};

/**
 * Flow 2 (join by code) — race-safe.
 *
 * Everything runs inside ONE transaction, and the very first statement locks
 * the invite row with `SELECT ... FOR UPDATE`. That serializes all concurrent
 * joins on the same code, which is what makes both of these safe:
 *   - `maxUses` cannot be exceeded — the second joiner only reads `usedCount`
 *     after the first has committed its increment.
 *   - The idempotency check is reliable — the second joiner sees the member
 *     row the first one created and returns `alreadyMember` instead of racing
 *     a duplicate `create`.
 *
 * As defense-in-depth (e.g. two different active codes for the same group),
 * a unique-constraint violation on `(groupId, userId)` is caught and treated
 * as an already-member success.
 *
 * The transaction:
 *   - locks + validates the Invite (active, not expired, under maxUses)
 *   - resolves the GroupMember (banned -> error; active -> early return)
 *   - increments usedCount
 *   - upserts the member as PLAYER (revives LEFT/REMOVED rows)
 *   - ensures a PlayerProfile linked to this user exists
 *   - logs activity
 */
export async function joinGroupByCode(params: {
  userId: string;
  userName?: string | null;
  userEmail: string;
  code: string;
}): Promise<JoinGroupResult> {
  const code = params.code.trim().toUpperCase();
  const displayName =
    params.userName?.trim() || params.userEmail.split("@")[0] || "Player";

  try {
    return await prisma.$transaction(async (tx) => {
      // Lock the invite row for the lifetime of this transaction.
      const lockedRows = await tx.$queryRaw<LockedInvite[]>`
        SELECT "id", "groupId", "status", "expiresAt", "maxUses", "usedCount"
        FROM "Invite"
        WHERE "code" = ${code}
        FOR UPDATE
      `;
      const invite = lockedRows[0];

      if (!invite) {
        throw new JoinGroupError("CODE_INVALID", "Join code is not valid");
      }
      if (invite.status !== InviteStatus.ACTIVE) {
        throw new JoinGroupError("CODE_DISABLED", "Join code is disabled");
      }
      if (invite.expiresAt && invite.expiresAt.getTime() <= Date.now()) {
        throw new JoinGroupError("CODE_EXPIRED", "Join code has expired");
      }
      if (invite.maxUses !== null && invite.usedCount >= invite.maxUses) {
        throw new JoinGroupError(
          "CODE_MAX_USES",
          "Join code has reached its usage limit",
        );
      }

      const existingMember = await tx.groupMember.findUnique({
        where: {
          groupId_userId: { groupId: invite.groupId, userId: params.userId },
        },
        select: { id: true, status: true },
      });

      if (existingMember?.status === GroupMemberStatus.BANNED) {
        throw new JoinGroupError(
          "MEMBER_BANNED",
          "You are banned from this group",
        );
      }
      // Already an active member — don't consume an invite use.
      if (existingMember?.status === GroupMemberStatus.ACTIVE) {
        return { groupId: invite.groupId, alreadyMember: true };
      }

      // Consume one invite use. Safe under the FOR UPDATE lock above.
      await tx.invite.update({
        where: { id: invite.id },
        data: { usedCount: { increment: 1 } },
      });

      // Member: revive a previously LEFT/REMOVED row rather than creating a
      // duplicate (the unique (groupId, userId) constraint would reject it).
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

      return { groupId: invite.groupId, alreadyMember: false };
    });
  } catch (err) {
    // Belt-and-suspenders: a concurrent first-join lost the unique-constraint
    // race on (groupId, userId). The other request created the membership —
    // report success without surfacing a 500.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const inv = await prisma.invite.findUnique({
        where: { code },
        select: { groupId: true },
      });
      if (inv) return { groupId: inv.groupId, alreadyMember: true };
    }
    throw err;
  }
}
