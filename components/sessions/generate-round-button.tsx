"use client";

import { useActionState } from "react";

import {
  generateRoundAction,
  type StackingActionState,
} from "@/app/groups/[groupId]/sessions/[sessionId]/stacking/actions";
import { Button } from "@/components/ui/button";

const INITIAL: StackingActionState = {};

export function GenerateRoundButton({
  groupId,
  sessionId,
  hasOpenRound,
}: {
  groupId: string;
  sessionId: string;
  hasOpenRound: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    generateRoundAction,
    INITIAL,
  );

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <input type="hidden" name="groupId" value={groupId} />
        <input type="hidden" name="sessionId" value={sessionId} />
        <Button type="submit" disabled={pending || hasOpenRound}>
          {pending ? "Generating…" : "Generate next round"}
        </Button>
      </form>
      {state.error && (
        <p className="text-destructive text-xs" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-muted-foreground text-xs">{state.success}</p>
      )}
    </div>
  );
}
