import {
  prisma,
  GroupRole,
  GroupMemberStatus,
  PlayerStatus,
  InviteStatus,
  type Group,
} from "@/lib/db";
import { ActivityAction, logActivity } from "@/lib/activity/log";
import type { CreateGroupInput } from "@/lib/validations/group";

import { generateUniqueJoinCode } from "./join-code";

export type CreatedGroup = {
  group: Group;
  joinCode: string;
};

/**
 * Flow 1 (create group) — atomic.
 *
 * Creates:
 *   1. Group (with a unique join code)
 *   2. GroupMember(role=OWNER, status=ACTIVE) for the creator
 *   3. PlayerProfile linked to the creator (so they can play immediately)
 *   4. Invite carrying the same join code (so admins can manage/regenerate it later)
 *
 * Wrapped in a Prisma transaction so partial failures don't leave orphan rows.
 * `displayName` for the player profile is the user's `name` or, if missing,
 * the email local-part.
 */
export async function createGroupForOwner(params: {
  ownerUserId: string;
  ownerName?: string | null;
  ownerEmail: string;
  input: CreateGroupInput;
}): Promise<CreatedGroup> {
  const { ownerUserId, ownerName, ownerEmail, input } = params;

  const joinCode = await generateUniqueJoinCode(async (code) => {
    const hit = await prisma.group.findUnique({
      where: { joinCode: code },
      select: { id: true },
    });
    return hit !== null;
  });

  const displayName =
    ownerName?.trim() || ownerEmail.split("@")[0] || "Player";

  const group = await prisma.$transaction(async (tx) => {
    const createdGroup = await tx.group.create({
      data: {
        name: input.name,
        description: input.description,
        visibility: input.visibility,
        joinCode,
        createdByUserId: ownerUserId,
      },
    });

    await tx.groupMember.create({
      data: {
        groupId: createdGroup.id,
        userId: ownerUserId,
        role: GroupRole.OWNER,
        status: GroupMemberStatus.ACTIVE,
      },
    });

    await tx.playerProfile.create({
      data: {
        groupId: createdGroup.id,
        userId: ownerUserId,
        displayName,
        status: PlayerStatus.ACTIVE,
        createdByUserId: ownerUserId,
      },
    });

    await tx.invite.create({
      data: {
        groupId: createdGroup.id,
        code: joinCode,
        createdByUserId: ownerUserId,
        status: InviteStatus.ACTIVE,
      },
    });

    await logActivity(
      {
        groupId: createdGroup.id,
        userId: ownerUserId,
        action: ActivityAction.GROUP_CREATED,
        targetType: "Group",
        targetId: createdGroup.id,
        newValue: { name: input.name, visibility: input.visibility },
      },
      tx,
    );

    return createdGroup;
  });

  return { group, joinCode };
}
