"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import {
  JoinGroupError,
  joinGroupByCode,
} from "@/lib/groups/join-group";
import { joinGroupSchema } from "@/lib/validations/group";

export type JoinGroupState = {
  fieldErrors?: { code?: string };
  error?: string;
};

const MESSAGE: Record<JoinGroupError["code"], string> = {
  CODE_INVALID: "Join code is not valid.",
  CODE_DISABLED: "This join code has been disabled.",
  CODE_EXPIRED: "This join code has expired.",
  CODE_MAX_USES: "This join code has reached its usage limit.",
  MEMBER_BANNED: "You can't join this group.",
  GROUP_ARCHIVED: "This group is archived.",
};

export async function joinGroupAction(
  _prevState: JoinGroupState,
  formData: FormData,
): Promise<JoinGroupState> {
  const user = await requireUser();

  const parsed = joinGroupSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) {
    return {
      fieldErrors: {
        code: parsed.error.flatten().fieldErrors.code?.[0] ?? "Invalid code",
      },
    };
  }

  try {
    const { groupId } = await joinGroupByCode({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      code: parsed.data.code,
    });
    redirect(`/groups/${groupId}`);
  } catch (err) {
    if (err instanceof JoinGroupError) {
      return { fieldErrors: { code: MESSAGE[err.code] } };
    }
    throw err;
  }
}
