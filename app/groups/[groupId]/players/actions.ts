"use server";

import { revalidatePath } from "next/cache";

import { GroupRole, PlayerStatus } from "@/lib/db";
import {
  PlayerActionError,
  createTempPlayer,
  editPlayer,
  linkTempPlayerToUser,
  setPlayerStatus,
} from "@/lib/players/players";
import {
  ForbiddenError,
  NotFoundError,
} from "@/lib/permissions/errors";
import { requireGroupRole } from "@/lib/permissions/group";
import {
  createTempPlayerSchema,
  editPlayerSchema,
  linkTempPlayerSchema,
  setPlayerStatusSchema,
} from "@/lib/validations/players";

const OWNERS_AND_ADMINS = [GroupRole.OWNER, GroupRole.ADMIN] as const;

export type PlayerActionState = { error?: string; success?: string };

const PLAYER_MSG: Record<PlayerActionError["code"], string> = {
  ALREADY_LINKED: "This player is already linked to a user.",
  DUPLICATE_TEMP_NAME_RESERVED: "Name already in use.",
  TARGET_USER_NOT_IN_GROUP: "Target user is not an active member.",
  TARGET_USER_ALREADY_HAS_PROFILE:
    "That user already has a player profile in this group.",
  INVALID_STATUS_TRANSITION:
    "A linked player cannot be made temporary.",
};

function toMessage(err: unknown): string {
  if (err instanceof PlayerActionError) return PLAYER_MSG[err.code];
  if (err instanceof ForbiddenError) return err.message;
  if (err instanceof NotFoundError) return err.message;
  return "Something went wrong.";
}

export async function createTempPlayerAction(
  _prev: PlayerActionState,
  formData: FormData,
): Promise<PlayerActionState> {
  const groupId = String(formData.get("groupId") ?? "");
  if (!groupId) return { error: "Missing groupId" };

  const { userId } = await requireGroupRole(groupId, OWNERS_AND_ADMINS);

  const parsed = createTempPlayerSchema.safeParse({
    displayName: formData.get("displayName"),
    skillLevel: formData.get("skillLevel"),
  });
  if (!parsed.success) {
    return {
      error:
        parsed.error.flatten().fieldErrors.displayName?.[0] ??
        parsed.error.flatten().fieldErrors.skillLevel?.[0] ??
        "Invalid input",
    };
  }

  try {
    await createTempPlayer({
      groupId,
      actorUserId: userId,
      displayName: parsed.data.displayName,
      skillLevel: parsed.data.skillLevel,
    });
  } catch (err) {
    return { error: toMessage(err) };
  }

  revalidatePath(`/groups/${groupId}/players`);
  return { success: "Temporary player added." };
}

export async function editPlayerAction(
  _prev: PlayerActionState,
  formData: FormData,
): Promise<PlayerActionState> {
  const groupId = String(formData.get("groupId") ?? "");
  if (!groupId) return { error: "Missing groupId" };

  const { userId } = await requireGroupRole(groupId, OWNERS_AND_ADMINS);

  const parsed = editPlayerSchema.safeParse({
    playerId: formData.get("playerId"),
    displayName: formData.get("displayName"),
    skillLevel: formData.get("skillLevel"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { error: "Invalid input" };

  try {
    await editPlayer({
      groupId,
      actorUserId: userId,
      playerId: parsed.data.playerId,
      displayName: parsed.data.displayName,
      skillLevel: parsed.data.skillLevel ?? null,
      notes: parsed.data.notes ?? null,
    });
  } catch (err) {
    return { error: toMessage(err) };
  }

  revalidatePath(`/groups/${groupId}/players`);
  return { success: "Saved." };
}

export async function setPlayerStatusAction(formData: FormData) {
  const groupId = String(formData.get("groupId") ?? "");
  if (!groupId) throw new Error("Missing groupId");

  const { userId } = await requireGroupRole(groupId, OWNERS_AND_ADMINS);

  const parsed = setPlayerStatusSchema.safeParse({
    playerId: formData.get("playerId"),
    status: formData.get("status"),
  });
  if (!parsed.success) throw new Error("Invalid status payload");

  await setPlayerStatus({
    groupId,
    actorUserId: userId,
    playerId: parsed.data.playerId,
    status: parsed.data.status as PlayerStatus,
  });

  revalidatePath(`/groups/${groupId}/players`);
}

export async function linkTempPlayerAction(
  _prev: PlayerActionState,
  formData: FormData,
): Promise<PlayerActionState> {
  const groupId = String(formData.get("groupId") ?? "");
  if (!groupId) return { error: "Missing groupId" };

  const { userId } = await requireGroupRole(groupId, OWNERS_AND_ADMINS);

  const parsed = linkTempPlayerSchema.safeParse({
    playerId: formData.get("playerId"),
    targetUserId: formData.get("targetUserId"),
  });
  if (!parsed.success) return { error: "Pick a user to link" };

  try {
    await linkTempPlayerToUser({
      groupId,
      actorUserId: userId,
      playerId: parsed.data.playerId,
      targetUserId: parsed.data.targetUserId,
    });
  } catch (err) {
    return { error: toMessage(err) };
  }

  revalidatePath(`/groups/${groupId}/players`);
  return { success: "Linked." };
}
