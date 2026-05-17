"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import {
  JoinRequestError,
  requestToJoin,
} from "@/lib/groups/join-requests";
import { NotFoundError } from "@/lib/permissions/errors";

export type RequestToJoinState = { error?: string };

const MSG: Record<JoinRequestError["code"], string> = {
  NOT_PUBLIC: "This group isn't accepting join requests.",
  GROUP_ARCHIVED: "This group is archived.",
  ALREADY_MEMBER: "You're already a member of this group.",
  ALREADY_PENDING: "Your request is already pending — hang tight.",
  BANNED: "You can't join this group.",
  MEMBER_BANNED: "You can't join this group.",
  REQUEST_NOT_PENDING: "That request is no longer pending.",
};

export async function requestToJoinAction(
  _prev: RequestToJoinState,
  formData: FormData,
): Promise<RequestToJoinState> {
  const user = await requireUser();
  const groupId = String(formData.get("groupId") ?? "");
  if (!groupId) return { error: "Missing groupId" };

  try {
    await requestToJoin({ groupId, userId: user.id });
  } catch (err) {
    if (err instanceof JoinRequestError) {
      if (err.code === "ALREADY_MEMBER") redirect(`/groups/${groupId}`);
      return { error: MSG[err.code] };
    }
    if (err instanceof NotFoundError) return { error: err.message };
    throw err;
  }

  redirect(`/request/${groupId}?sent=1`);
}
