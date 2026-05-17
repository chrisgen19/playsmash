"use client";

import { useActionState } from "react";

import {
  cancelMatchAction,
  startMatchAction,
  type ScoreActionState,
} from "@/app/groups/[groupId]/sessions/[sessionId]/scores/actions";
import { Button } from "@/components/ui/button";

const INITIAL: ScoreActionState = {};

/**
 * Start / Cancel buttons shown on the stacking page next to each QUEUED
 * card and on the scores page next to each QUEUED row. Both actions go
 * through the matches service, which authorises and locks the row.
 */
export function MatchControls({
  groupId,
  sessionId,
  matchId,
  showStart,
}: {
  groupId: string;
  sessionId: string;
  matchId: string;
  showStart: boolean;
}) {
  const [startState, startFormAction, startPending] = useActionState(
    startMatchAction,
    INITIAL,
  );
  const [cancelState, cancelFormAction, cancelPending] = useActionState(
    cancelMatchAction,
    INITIAL,
  );
  const errorMessage = startState.error ?? cancelState.error;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showStart && (
        <form action={startFormAction}>
          <input type="hidden" name="groupId" value={groupId} />
          <input type="hidden" name="sessionId" value={sessionId} />
          <input type="hidden" name="matchId" value={matchId} />
          <Button type="submit" size="sm" disabled={startPending}>
            {startPending ? "Starting…" : "Start"}
          </Button>
        </form>
      )}
      <form action={cancelFormAction}>
        <input type="hidden" name="groupId" value={groupId} />
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="matchId" value={matchId} />
        <Button
          type="submit"
          size="sm"
          variant="ghost"
          disabled={cancelPending}
        >
          Cancel
        </Button>
      </form>
      {errorMessage && (
        <p className="text-destructive w-full text-xs" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
