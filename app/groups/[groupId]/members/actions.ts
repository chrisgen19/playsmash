"use server";

import { revalidatePath } from "next/cache";

import { GroupRole } from "@/lib/db";
import {
  MemberActionError,
  changeMemberRole,
  removeMember,
} from "@/lib/groups/members";
import {
  JoinRequestError,
  approveJoinRequest,
  rejectJoinRequest,
} from "@/lib/groups/join-requests";
import {
  ForbiddenError,
  NotFoundError,
} from "@/lib/permissions/errors";
import { requireGroupRole } from "@/lib/permissions/group";
import { changeRoleSchema } from "@/lib/validations/members";

const OWNERS_AND_ADMINS = [GroupRole.OWNER, GroupRole.ADMIN] as const;

export type MemberActionState = { error?: string };

const MEMBER_ERROR_MESSAGE: Record<MemberActionError["code"], string> = {
  CANNOT_DEMOTE_OWNER: "The group owner cannot be demoted.",
  CANNOT_REMOVE_OWNER: "The group owner cannot be removed.",
  CANNOT_PROMOTE_TO_OWNER:
    "Owner role can only be assigned via transfer-ownership.",
  INVALID_ROLE_CHANGE: "That member cannot have their role changed right now.",
};

const JOIN_REQUEST_MESSAGE: Record<JoinRequestError["code"], string> = {
  NOT_PUBLIC: "This group isn't accepting join requests.",
  GROUP_ARCHIVED: "This group is archived.",
  ALREADY_MEMBER: "That user is already a member.",
  ALREADY_PENDING: "A request is already pending.",
  BANNED: "That user is banned from this group.",
  REQUEST_NOT_PENDING: "This request is no longer pending.",
};

function toMessage(err: unknown): string {
  if (err instanceof MemberActionError) return MEMBER_ERROR_MESSAGE[err.code];
  if (err instanceof JoinRequestError) return JOIN_REQUEST_MESSAGE[err.code];
  if (err instanceof ForbiddenError) return err.message;
  if (err instanceof NotFoundError) return err.message;
  return "Something went wrong.";
}

export async function changeRoleAction(
  _prev: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const groupId = String(formData.get("groupId") ?? "");
  if (!groupId) return { error: "Missing groupId" };

  const { userId, role: actorRole } = await requireGroupRole(
    groupId,
    OWNERS_AND_ADMINS,
  );

  const parsed = changeRoleSchema.safeParse({
    memberId: formData.get("memberId"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: "Invalid role selection" };

  try {
    await changeMemberRole({
      groupId,
      actorUserId: userId,
      actorRole,
      targetMemberId: parsed.data.memberId,
      newRole: parsed.data.role,
    });
  } catch (err) {
    return { error: toMessage(err) };
  }

  revalidatePath(`/groups/${groupId}/members`);
  return {};
}

export async function removeMemberAction(
  _prev: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const groupId = String(formData.get("groupId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  if (!groupId || !memberId) return { error: "Missing groupId or memberId" };

  const { userId, role: actorRole } = await requireGroupRole(
    groupId,
    OWNERS_AND_ADMINS,
  );

  try {
    await removeMember({
      groupId,
      actorUserId: userId,
      actorRole,
      targetMemberId: memberId,
    });
  } catch (err) {
    return { error: toMessage(err) };
  }

  revalidatePath(`/groups/${groupId}/members`);
  revalidatePath(`/groups/${groupId}/players`);
  return {};
}

export async function approveJoinRequestAction(
  _prev: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const groupId = String(formData.get("groupId") ?? "");
  const requestId = String(formData.get("requestId") ?? "");
  if (!groupId || !requestId) return { error: "Missing groupId or requestId" };

  const { userId } = await requireGroupRole(groupId, OWNERS_AND_ADMINS);

  try {
    await approveJoinRequest({ groupId, actorUserId: userId, requestId });
  } catch (err) {
    return { error: toMessage(err) };
  }

  revalidatePath(`/groups/${groupId}/members`);
  revalidatePath(`/groups/${groupId}/players`);
  return {};
}

export async function rejectJoinRequestAction(
  _prev: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const groupId = String(formData.get("groupId") ?? "");
  const requestId = String(formData.get("requestId") ?? "");
  if (!groupId || !requestId) return { error: "Missing groupId or requestId" };

  const { userId } = await requireGroupRole(groupId, OWNERS_AND_ADMINS);

  try {
    await rejectJoinRequest({ groupId, actorUserId: userId, requestId });
  } catch (err) {
    return { error: toMessage(err) };
  }

  revalidatePath(`/groups/${groupId}/members`);
  return {};
}
