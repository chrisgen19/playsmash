"use server";

import { revalidatePath } from "next/cache";

import { GroupRole } from "@/lib/db";
import {
  GenerateRoundError,
  generateNextRound,
} from "@/lib/sessions/generate-round";
import {
  ForbiddenError,
  NotFoundError,
} from "@/lib/permissions/errors";
import { requireGroupRole } from "@/lib/permissions/group";

const OWNERS_AND_ADMINS = [GroupRole.OWNER, GroupRole.ADMIN] as const;

export type StackingActionState = { error?: string; success?: string };

const MSG: Record<GenerateRoundError["code"], string> = {
  SESSION_NOT_ACTIVE: "Start the session before generating a round.",
  ROUND_IN_PROGRESS: "Finish the current round before generating a new one.",
  NOT_ENOUGH_PLAYERS: "Need at least 4 available players.",
};

function toMessage(err: unknown): string {
  if (err instanceof GenerateRoundError) return MSG[err.code];
  if (err instanceof ForbiddenError) return err.message;
  if (err instanceof NotFoundError) return err.message;
  return "Could not generate a round.";
}

export async function generateRoundAction(
  _prev: StackingActionState,
  formData: FormData,
): Promise<StackingActionState> {
  const groupId = String(formData.get("groupId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");
  if (!groupId || !sessionId) return { error: "Missing groupId or sessionId" };

  // requireGroupRole lives inside the try so a ForbiddenError flows through
  // toMessage and returns a structured StackingActionState error instead of
  // escaping as an uncaught exception (which would surface as a 500).
  try {
    const { userId } = await requireGroupRole(groupId, OWNERS_AND_ADMINS);
    const r = await generateNextRound({
      groupId,
      actorUserId: userId,
      sessionId,
    });
    revalidatePath(`/groups/${groupId}/sessions/${sessionId}/stacking`);
    revalidatePath(`/groups/${groupId}/sessions/${sessionId}`);
    return {
      success: `Round ${r.roundNumber} ready (${r.matchesCreated} match${
        r.matchesCreated === 1 ? "" : "es"
      }, ${r.restingCount} resting).`,
    };
  } catch (err) {
    return { error: toMessage(err) };
  }
}
