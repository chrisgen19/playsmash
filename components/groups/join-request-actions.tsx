"use client";

import { useActionState } from "react";

import {
  approveJoinRequestAction,
  rejectJoinRequestAction,
  type MemberActionState,
} from "@/app/groups/[groupId]/members/actions";
import { Button } from "@/components/ui/button";

const INITIAL: MemberActionState = {};

/** Approve / Reject buttons for one pending JoinRequest row. */
export function JoinRequestActions({
  groupId,
  requestId,
}: {
  groupId: string;
  requestId: string;
}) {
  const [approveState, approveAction, approvePending] = useActionState(
    approveJoinRequestAction,
    INITIAL,
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectJoinRequestAction,
    INITIAL,
  );
  const error = approveState.error ?? rejectState.error;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <form action={approveAction}>
        <input type="hidden" name="groupId" value={groupId} />
        <input type="hidden" name="requestId" value={requestId} />
        <Button type="submit" size="sm" disabled={approvePending}>
          Approve
        </Button>
      </form>
      <form action={rejectAction}>
        <input type="hidden" name="groupId" value={groupId} />
        <input type="hidden" name="requestId" value={requestId} />
        <Button
          type="submit"
          size="sm"
          variant="ghost"
          disabled={rejectPending}
        >
          Reject
        </Button>
      </form>
      {error && (
        <p className="text-destructive w-full text-right text-xs">{error}</p>
      )}
    </div>
  );
}
