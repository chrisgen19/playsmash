"use client";

import { useActionState } from "react";

import {
  startSessionAction,
  type SessionActionState,
} from "@/app/groups/[groupId]/sessions/actions";
import { Button } from "@/components/ui/button";

const INITIAL: SessionActionState = {};

export function StartSessionButton({
  groupId,
  sessionId,
  disabled,
}: {
  groupId: string;
  sessionId: string;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    startSessionAction,
    INITIAL,
  );

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <input type="hidden" name="groupId" value={groupId} />
        <input type="hidden" name="sessionId" value={sessionId} />
        <Button type="submit" disabled={disabled || pending}>
          {pending ? "Starting…" : "Start session"}
        </Button>
      </form>
      {state.error && (
        <p className="text-destructive text-xs" role="alert">
          {state.error}
        </p>
      )}
    </div>
  );
}
