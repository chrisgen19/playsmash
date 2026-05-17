"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { GroupRole } from "@/lib/db";
import { ForbiddenError, NotFoundError } from "@/lib/permissions/errors";
import { requireGroupRole } from "@/lib/permissions/group";
import {
  SessionActionError,
  createSession,
  setSessionAttendance,
  startSession,
} from "@/lib/sessions/sessions";
import {
  createSessionSchema,
  setAttendanceSchema,
} from "@/lib/validations/sessions";

const OWNERS_AND_ADMINS = [GroupRole.OWNER, GroupRole.ADMIN] as const;

export type SessionActionState = { error?: string };

const SESSION_MSG: Record<SessionActionError["code"], string> = {
  NOT_PLANNED: "This session can no longer be edited.",
  PLAYERS_OUTSIDE_GROUP: "A selected player is not part of this group.",
  NO_PLAYERS: "Add at least one player before starting.",
};

function toMessage(err: unknown): string {
  if (err instanceof SessionActionError) return SESSION_MSG[err.code];
  if (err instanceof ForbiddenError) return err.message;
  if (err instanceof NotFoundError) return err.message;
  return "Something went wrong.";
}

export async function createSessionAction(
  _prev: SessionActionState,
  formData: FormData,
): Promise<SessionActionState> {
  const groupId = String(formData.get("groupId") ?? "");
  if (!groupId) return { error: "Missing groupId" };

  const { userId } = await requireGroupRole(groupId, OWNERS_AND_ADMINS);

  const parsed = createSessionSchema.safeParse({
    name: formData.get("name"),
    date: formData.get("date"),
    location: formData.get("location"),
    numberOfCourts: formData.get("numberOfCourts"),
    scoringType: formData.get("scoringType"),
    pointsToWin: formData.get("pointsToWin"),
    winByTwo: formData.get("winByTwo") === "on",
    playerIds: formData.getAll("playerIds").map(String),
  });
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    return {
      error:
        flat.name?.[0] ??
        flat.date?.[0] ??
        flat.numberOfCourts?.[0] ??
        flat.pointsToWin?.[0] ??
        "Check the form and try again.",
    };
  }

  let sessionId: string;
  try {
    const session = await createSession({
      groupId,
      actorUserId: userId,
      input: parsed.data,
    });
    sessionId = session.id;
  } catch (err) {
    return { error: toMessage(err) };
  }

  revalidatePath(`/groups/${groupId}/sessions`);
  redirect(`/groups/${groupId}/sessions/${sessionId}`);
}

export async function setAttendanceAction(
  _prev: SessionActionState,
  formData: FormData,
): Promise<SessionActionState> {
  const groupId = String(formData.get("groupId") ?? "");
  if (!groupId) return { error: "Missing groupId" };

  const { userId } = await requireGroupRole(groupId, OWNERS_AND_ADMINS);

  const parsed = setAttendanceSchema.safeParse({
    sessionId: formData.get("sessionId"),
    playerIds: formData.getAll("playerIds").map(String),
  });
  if (!parsed.success) return { error: "Invalid selection" };

  try {
    await setSessionAttendance({
      groupId,
      actorUserId: userId,
      sessionId: parsed.data.sessionId,
      playerIds: parsed.data.playerIds,
    });
  } catch (err) {
    return { error: toMessage(err) };
  }

  revalidatePath(`/groups/${groupId}/sessions/${parsed.data.sessionId}`);
  return {};
}

export async function startSessionAction(
  _prev: SessionActionState,
  formData: FormData,
): Promise<SessionActionState> {
  const groupId = String(formData.get("groupId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");
  if (!groupId || !sessionId) return { error: "Missing groupId or sessionId" };

  const { userId } = await requireGroupRole(groupId, OWNERS_AND_ADMINS);

  try {
    await startSession({ groupId, actorUserId: userId, sessionId });
  } catch (err) {
    return { error: toMessage(err) };
  }

  revalidatePath(`/groups/${groupId}/sessions/${sessionId}`);
  revalidatePath(`/groups/${groupId}/sessions/${sessionId}/stacking`);
  revalidatePath(`/groups/${groupId}/sessions/${sessionId}/scores`);
  return {};
}
