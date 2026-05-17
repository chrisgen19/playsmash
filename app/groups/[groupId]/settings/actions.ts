"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { GroupRole } from "@/lib/db";
import { regenerateJoinCode } from "@/lib/groups/regenerate-join-code";
import {
  ManageGroupError,
  archiveGroup,
  editGroup,
  transferOwnership,
} from "@/lib/groups/manage-group";
import {
  ForbiddenError,
  NotFoundError,
} from "@/lib/permissions/errors";
import { getGroupRole, requireGroupRole } from "@/lib/permissions/group";
import { editGroupSchema } from "@/lib/validations/group";

const OWNERS_AND_ADMINS = [GroupRole.OWNER, GroupRole.ADMIN] as const;
const OWNER_ONLY = [GroupRole.OWNER] as const;

export type GroupSettingsState = { error?: string; success?: string };

const MANAGE_MSG: Record<ManageGroupError["code"], string> = {
  ALREADY_ARCHIVED: "This group is already archived.",
  TARGET_NOT_MEMBER: "That member can't receive ownership.",
  TARGET_ALREADY_OWNER: "That member is already the owner.",
  GROUP_ARCHIVED: "This group is archived.",
};

function toMessage(err: unknown): string {
  if (err instanceof ManageGroupError) return MANAGE_MSG[err.code];
  if (err instanceof ForbiddenError) return err.message;
  if (err instanceof NotFoundError) return err.message;
  return "Something went wrong.";
}

export async function regenerateJoinCodeAction(formData: FormData) {
  const groupId = String(formData.get("groupId") ?? "");
  if (!groupId) throw new Error("Missing groupId");

  const { userId } = await requireGroupRole(groupId, OWNERS_AND_ADMINS);
  await regenerateJoinCode({ groupId, actorUserId: userId });

  revalidatePath(`/groups/${groupId}`, "layout");
  revalidatePath("/dashboard");
}

export async function editGroupAction(
  _prev: GroupSettingsState,
  formData: FormData,
): Promise<GroupSettingsState> {
  const groupId = String(formData.get("groupId") ?? "");
  if (!groupId) return { error: "Missing groupId" };

  try {
    const { userId } = await requireGroupRole(groupId, OWNERS_AND_ADMINS);
    const parsed = editGroupSchema.safeParse({
      name: formData.get("name"),
      description: formData.get("description"),
      visibility: formData.get("visibility"),
    });
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      return {
        error: flat.name?.[0] ?? flat.visibility?.[0] ?? "Check the form.",
      };
    }
    await editGroup({ groupId, actorUserId: userId, input: parsed.data });
  } catch (err) {
    return { error: toMessage(err) };
  }

  revalidatePath(`/groups/${groupId}`, "layout");
  revalidatePath("/dashboard");
  return { success: "Group updated." };
}

export async function transferOwnershipAction(
  _prev: GroupSettingsState,
  formData: FormData,
): Promise<GroupSettingsState> {
  const groupId = String(formData.get("groupId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  if (!groupId || !memberId) return { error: "Missing groupId or memberId" };

  try {
    const { userId } = await requireGroupRole(groupId, OWNER_ONLY);
    await transferOwnership({
      groupId,
      currentOwnerUserId: userId,
      targetMemberId: memberId,
    });
  } catch (err) {
    return { error: toMessage(err) };
  }

  revalidatePath(`/groups/${groupId}`, "layout");
  return { success: "Ownership transferred." };
}

export async function archiveGroupAction(formData: FormData) {
  const groupId = String(formData.get("groupId") ?? "");
  if (!groupId) throw new Error("Missing groupId");

  // archiveGroup is OWNER-only; getGroupRole confirms before we act so a
  // non-owner just bounces to the group page.
  const { userId } = await requireGroupRole(groupId, OWNER_ONLY);
  const role = await getGroupRole(userId, groupId);
  if (role !== GroupRole.OWNER) redirect(`/groups/${groupId}`);

  await archiveGroup({ groupId, actorUserId: userId });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
