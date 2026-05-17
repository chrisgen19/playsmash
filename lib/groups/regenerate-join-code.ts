import { prisma, InviteStatus } from "@/lib/db";
import { ActivityAction, logActivity } from "@/lib/activity/log";

import { generateUniqueJoinCode } from "./join-code";

/**
 * Generate a new unique join code, point the Group at it, and disable the
 * previous Invite row. All within a single transaction.
 *
 * Authorization MUST be checked by the caller (OWNER or ADMIN). This service
 * trusts that `actorUserId` is allowed to act on `groupId`.
 */
export async function regenerateJoinCode(params: {
  groupId: string;
  actorUserId: string;
}): Promise<{ joinCode: string }> {
  const newCode = await generateUniqueJoinCode(async (code) => {
    const hit = await prisma.group.findUnique({
      where: { joinCode: code },
      select: { id: true },
    });
    return hit !== null;
  });

  await prisma.$transaction(async (tx) => {
    const group = await tx.group.findUniqueOrThrow({
      where: { id: params.groupId },
      select: { joinCode: true },
    });
    const oldCode = group.joinCode;

    // Disable every active invite row carrying the old code (there should be
    // at most one, but `updateMany` keeps the contract honest).
    await tx.invite.updateMany({
      where: { groupId: params.groupId, code: oldCode },
      data: { status: InviteStatus.DISABLED },
    });

    await tx.group.update({
      where: { id: params.groupId },
      data: { joinCode: newCode },
    });

    const newInvite = await tx.invite.create({
      data: {
        groupId: params.groupId,
        code: newCode,
        createdByUserId: params.actorUserId,
        status: InviteStatus.ACTIVE,
      },
    });

    await logActivity(
      {
        groupId: params.groupId,
        userId: params.actorUserId,
        action: ActivityAction.GROUP_JOIN_CODE_REGENERATED,
        targetType: "Invite",
        targetId: newInvite.id,
        oldValue: { code: oldCode },
        newValue: { code: newCode },
      },
      tx,
    );
  });

  return { joinCode: newCode };
}
