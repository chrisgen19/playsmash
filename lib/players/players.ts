import {
  prisma,
  PlayerStatus,
  GroupMemberStatus,
  type PlayerProfile,
} from "@/lib/db";
import { ActivityAction, logActivity } from "@/lib/activity/log";
import { NotFoundError } from "@/lib/permissions/errors";

export class PlayerActionError extends Error {
  constructor(
    public readonly code:
      | "ALREADY_LINKED"
      | "DUPLICATE_TEMP_NAME_RESERVED"
      | "TARGET_USER_NOT_IN_GROUP"
      | "TARGET_USER_ALREADY_HAS_PROFILE"
      | "INVALID_STATUS_TRANSITION",
    message: string,
  ) {
    super(message);
    this.name = "PlayerActionError";
  }
}

export type CreateTempPlayerInput = {
  groupId: string;
  actorUserId: string;
  displayName: string;
  skillLevel?: number;
};

/**
 * Create a temporary PlayerProfile (userId is null, status TEMPORARY).
 * No uniqueness on displayName for temp players — admins can have two
 * "Bob"s and disambiguate later when one of them registers.
 */
export async function createTempPlayer(
  input: CreateTempPlayerInput,
): Promise<PlayerProfile> {
  return prisma.$transaction(async (tx) => {
    const player = await tx.playerProfile.create({
      data: {
        groupId: input.groupId,
        userId: null,
        displayName: input.displayName,
        skillLevel: input.skillLevel,
        status: PlayerStatus.TEMPORARY,
        createdByUserId: input.actorUserId,
      },
    });
    await logActivity(
      {
        groupId: input.groupId,
        userId: input.actorUserId,
        action: ActivityAction.PLAYER_CREATED_TEMP,
        targetType: "PlayerProfile",
        targetId: player.id,
        newValue: {
          displayName: input.displayName,
          skillLevel: input.skillLevel ?? null,
        },
      },
      tx,
    );
    return player;
  });
}

export type EditPlayerInput = {
  groupId: string;
  actorUserId: string;
  playerId: string;
  displayName?: string;
  skillLevel?: number | null;
  notes?: string | null;
};

export async function editPlayer(input: EditPlayerInput): Promise<void> {
  const current = await prisma.playerProfile.findUnique({
    where: { id: input.playerId },
    select: {
      id: true,
      groupId: true,
      displayName: true,
      skillLevel: true,
      notes: true,
    },
  });
  if (!current || current.groupId !== input.groupId) {
    throw new NotFoundError("Player not found in this group");
  }

  const updates: {
    displayName?: string;
    skillLevel?: number | null;
    notes?: string | null;
  } = {};
  if (input.displayName !== undefined) updates.displayName = input.displayName;
  if (input.skillLevel !== undefined) updates.skillLevel = input.skillLevel;
  if (input.notes !== undefined) updates.notes = input.notes;
  if (Object.keys(updates).length === 0) return;

  await prisma.$transaction(async (tx) => {
    await tx.playerProfile.update({ where: { id: current.id }, data: updates });
    await logActivity(
      {
        groupId: input.groupId,
        userId: input.actorUserId,
        action: ActivityAction.PLAYER_UPDATED,
        targetType: "PlayerProfile",
        targetId: current.id,
        oldValue: {
          displayName: current.displayName,
          skillLevel: current.skillLevel,
          notes: current.notes,
        },
        // updates is a plain JSON object — safe to cast for the activity log.
        newValue: updates as Record<string, string | number | null>,
      },
      tx,
    );
  });
}

export async function setPlayerStatus(params: {
  groupId: string;
  actorUserId: string;
  playerId: string;
  status: PlayerStatus;
}): Promise<void> {
  const current = await prisma.playerProfile.findUnique({
    where: { id: params.playerId },
    select: { id: true, groupId: true, status: true, userId: true },
  });
  if (!current || current.groupId !== params.groupId) {
    throw new NotFoundError("Player not found in this group");
  }
  // TEMPORARY means "account-less profile". A profile linked to a user can
  // never be temporary — guard here so the rule holds even if a caller
  // bypasses the Zod schema.
  if (params.status === PlayerStatus.TEMPORARY && current.userId !== null) {
    throw new PlayerActionError(
      "INVALID_STATUS_TRANSITION",
      "A player linked to a user account cannot be set TEMPORARY",
    );
  }
  if (current.status === params.status) return;

  await prisma.$transaction(async (tx) => {
    await tx.playerProfile.update({
      where: { id: current.id },
      data: { status: params.status },
    });
    await logActivity(
      {
        groupId: params.groupId,
        userId: params.actorUserId,
        action:
          params.status === PlayerStatus.REMOVED
            ? ActivityAction.PLAYER_REMOVED
            : ActivityAction.PLAYER_STATUS_CHANGED,
        targetType: "PlayerProfile",
        targetId: current.id,
        oldValue: { status: current.status },
        newValue: { status: params.status },
      },
      tx,
    );
  });
}

/**
 * Take a temporary PlayerProfile and attach it to an existing User who is
 * already a member of the same group. Used after a temp player creates an
 * account and joins — keeps match history attached to the original profile.
 *
 * Rules:
 *   - Target player must be temporary (userId === null).
 *   - Target user must be an ACTIVE member of the same group.
 *   - Target user must NOT already have a different PlayerProfile in this group
 *     (the (groupId, userId) unique constraint would refuse anyway, but we
 *     surface a clearer error).
 */
export async function linkTempPlayerToUser(params: {
  groupId: string;
  actorUserId: string;
  playerId: string;
  targetUserId: string;
}): Promise<void> {
  const player = await prisma.playerProfile.findUnique({
    where: { id: params.playerId },
    select: { id: true, groupId: true, userId: true, displayName: true },
  });
  if (!player || player.groupId !== params.groupId) {
    throw new NotFoundError("Player not found in this group");
  }
  if (player.userId !== null) {
    throw new PlayerActionError(
      "ALREADY_LINKED",
      "This player is already linked to an account",
    );
  }

  const member = await prisma.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId: params.groupId,
        userId: params.targetUserId,
      },
    },
    select: { status: true },
  });
  if (!member || member.status !== GroupMemberStatus.ACTIVE) {
    throw new PlayerActionError(
      "TARGET_USER_NOT_IN_GROUP",
      "Target user is not an active member of this group",
    );
  }

  const conflict = await prisma.playerProfile.findUnique({
    where: {
      groupId_userId: {
        groupId: params.groupId,
        userId: params.targetUserId,
      },
    },
    select: { id: true },
  });
  if (conflict) {
    throw new PlayerActionError(
      "TARGET_USER_ALREADY_HAS_PROFILE",
      "That user already has a player profile in this group — merge in Phase 8",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.playerProfile.update({
      where: { id: player.id },
      data: { userId: params.targetUserId, status: PlayerStatus.ACTIVE },
    });
    await logActivity(
      {
        groupId: params.groupId,
        userId: params.actorUserId,
        action: ActivityAction.PLAYER_LINKED_TO_USER,
        targetType: "PlayerProfile",
        targetId: player.id,
        oldValue: { userId: null, displayName: player.displayName },
        newValue: { userId: params.targetUserId },
      },
      tx,
    );
  });
}
