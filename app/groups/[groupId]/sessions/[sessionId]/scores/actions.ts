"use server";

import { revalidatePath } from "next/cache";

import { GroupRole } from "@/lib/db";
import {
  ForbiddenError,
  NotFoundError,
} from "@/lib/permissions/errors";
import { requireGroupRole } from "@/lib/permissions/group";
import {
  MatchActionError,
  ScoreValidationError,
  cancelMatch,
  completeMatch,
  editMatchScore,
  startMatch,
} from "@/lib/scoring/matches";
import {
  matchIdSchema,
  matchScoreSchema,
} from "@/lib/validations/scoring";

const OWNERS_AND_ADMINS = [GroupRole.OWNER, GroupRole.ADMIN] as const;

export type ScoreActionState = { error?: string; success?: string };

const MATCH_MSG: Record<MatchActionError["code"], string> = {
  NOT_QUEUED: "This match can no longer be started.",
  NOT_ACTIVE: "This match isn't active.",
  NOT_COMPLETED: "Only a completed match can have its score edited.",
  ALREADY_COMPLETED: "This match is already completed.",
  ALREADY_CANCELLED: "This match is already cancelled.",
};

function toMessage(err: unknown): string {
  if (err instanceof MatchActionError) return MATCH_MSG[err.code];
  if (err instanceof ScoreValidationError) return err.message;
  if (err instanceof ForbiddenError) return err.message;
  if (err instanceof NotFoundError) return err.message;
  return "Something went wrong.";
}

function revalidateScores(groupId: string, sessionId: string): void {
  revalidatePath(`/groups/${groupId}/sessions/${sessionId}/scores`);
  revalidatePath(`/groups/${groupId}/sessions/${sessionId}/stacking`);
  revalidatePath(`/groups/${groupId}/sessions/${sessionId}`);
}

export async function startMatchAction(
  _prev: ScoreActionState,
  formData: FormData,
): Promise<ScoreActionState> {
  const groupId = String(formData.get("groupId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");
  if (!groupId || !sessionId) return { error: "Missing groupId/sessionId" };

  try {
    const { userId } = await requireGroupRole(groupId, OWNERS_AND_ADMINS);
    const parsed = matchIdSchema.safeParse({ matchId: formData.get("matchId") });
    if (!parsed.success) return { error: "Invalid match" };

    await startMatch({
      groupId,
      actorUserId: userId,
      matchId: parsed.data.matchId,
    });
    revalidateScores(groupId, sessionId);
    return { success: "Match started." };
  } catch (err) {
    return { error: toMessage(err) };
  }
}

export async function cancelMatchAction(
  _prev: ScoreActionState,
  formData: FormData,
): Promise<ScoreActionState> {
  const groupId = String(formData.get("groupId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");
  if (!groupId || !sessionId) return { error: "Missing groupId/sessionId" };

  try {
    const { userId } = await requireGroupRole(groupId, OWNERS_AND_ADMINS);
    const parsed = matchIdSchema.safeParse({ matchId: formData.get("matchId") });
    if (!parsed.success) return { error: "Invalid match" };

    await cancelMatch({
      groupId,
      actorUserId: userId,
      matchId: parsed.data.matchId,
    });
    revalidateScores(groupId, sessionId);
    return { success: "Match cancelled." };
  } catch (err) {
    return { error: toMessage(err) };
  }
}

export async function completeMatchAction(
  _prev: ScoreActionState,
  formData: FormData,
): Promise<ScoreActionState> {
  const groupId = String(formData.get("groupId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");
  if (!groupId || !sessionId) return { error: "Missing groupId/sessionId" };

  try {
    const { userId } = await requireGroupRole(groupId, OWNERS_AND_ADMINS);
    const parsed = matchScoreSchema.safeParse({
      matchId: formData.get("matchId"),
      team1Score: formData.get("team1Score"),
      team2Score: formData.get("team2Score"),
    });
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      return {
        error:
          flat.team1Score?.[0] ??
          flat.team2Score?.[0] ??
          "Check the scores and try again.",
      };
    }

    await completeMatch({
      groupId,
      actorUserId: userId,
      matchId: parsed.data.matchId,
      team1Score: parsed.data.team1Score,
      team2Score: parsed.data.team2Score,
    });
    revalidateScores(groupId, sessionId);
    return { success: "Score recorded." };
  } catch (err) {
    return { error: toMessage(err) };
  }
}

export async function editMatchScoreAction(
  _prev: ScoreActionState,
  formData: FormData,
): Promise<ScoreActionState> {
  const groupId = String(formData.get("groupId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");
  if (!groupId || !sessionId) return { error: "Missing groupId/sessionId" };

  try {
    const { userId } = await requireGroupRole(groupId, OWNERS_AND_ADMINS);
    const parsed = matchScoreSchema.safeParse({
      matchId: formData.get("matchId"),
      team1Score: formData.get("team1Score"),
      team2Score: formData.get("team2Score"),
    });
    if (!parsed.success) return { error: "Check the scores and try again." };

    await editMatchScore({
      groupId,
      actorUserId: userId,
      matchId: parsed.data.matchId,
      team1Score: parsed.data.team1Score,
      team2Score: parsed.data.team2Score,
    });
    revalidateScores(groupId, sessionId);
    return { success: "Score updated." };
  } catch (err) {
    return { error: toMessage(err) };
  }
}
