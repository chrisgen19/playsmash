"use server";

import { revalidatePath } from "next/cache";

import { GroupRole } from "@/lib/db";
import { regenerateJoinCode } from "@/lib/groups/regenerate-join-code";
import { requireGroupRole } from "@/lib/permissions/group";

const OWNERS_AND_ADMINS = [GroupRole.OWNER, GroupRole.ADMIN] as const;

export async function regenerateJoinCodeAction(formData: FormData) {
  const groupId = String(formData.get("groupId") ?? "");
  if (!groupId) throw new Error("Missing groupId");

  const { userId } = await requireGroupRole(groupId, OWNERS_AND_ADMINS);
  await regenerateJoinCode({ groupId, actorUserId: userId });

  // Invalidate the group's pages so the new code shows everywhere.
  revalidatePath(`/groups/${groupId}`, "layout");
  revalidatePath("/dashboard");
}
