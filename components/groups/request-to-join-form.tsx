"use client";

import { useActionState } from "react";

import {
  requestToJoinAction,
  type RequestToJoinState,
} from "@/app/request/actions";
import { Button } from "@/components/ui/button";

const INITIAL: RequestToJoinState = {};

export function RequestToJoinForm({ groupId }: { groupId: string }) {
  const [state, formAction, pending] = useActionState(
    requestToJoinAction,
    INITIAL,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="groupId" value={groupId} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Sending…" : "Request to join"}
      </Button>
      {state.error && (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
