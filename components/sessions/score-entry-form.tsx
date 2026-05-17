"use client";

import { useActionState } from "react";

import {
  completeMatchAction,
  type ScoreActionState,
} from "@/app/groups/[groupId]/sessions/[sessionId]/scores/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL: ScoreActionState = {};

export function ScoreEntryForm({
  groupId,
  sessionId,
  matchId,
  pointsToWin,
}: {
  groupId: string;
  sessionId: string;
  matchId: string;
  pointsToWin: number;
}) {
  const [state, formAction, pending] = useActionState(
    completeMatchAction,
    INITIAL,
  );

  return (
    <form
      action={formAction}
      className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]"
    >
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="matchId" value={matchId} />
      <div className="space-y-1">
        <Label htmlFor={`t1-${matchId}`} className="text-xs">
          Team 1
        </Label>
        <Input
          id={`t1-${matchId}`}
          name="team1Score"
          type="number"
          min={0}
          max={99}
          required
          placeholder={String(pointsToWin)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`t2-${matchId}`} className="text-xs">
          Team 2
        </Label>
        <Input
          id={`t2-${matchId}`}
          name="team2Score"
          type="number"
          min={0}
          max={99}
          required
          placeholder={String(pointsToWin)}
        />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Record"}
      </Button>
      {state.error && (
        <p className="text-destructive col-span-full text-xs" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
