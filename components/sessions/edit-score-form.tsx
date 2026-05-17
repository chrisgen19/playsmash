"use client";

import { useActionState, useState } from "react";

import {
  editMatchScoreAction,
  type ScoreActionState,
} from "@/app/groups/[groupId]/sessions/[sessionId]/scores/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL: ScoreActionState = {};

export function EditScoreForm({
  groupId,
  sessionId,
  matchId,
  team1Score,
  team2Score,
}: {
  groupId: string;
  sessionId: string;
  matchId: string;
  team1Score: number;
  team2Score: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    editMatchScoreAction,
    INITIAL,
  );

  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
      >
        Edit
      </Button>
    );
  }

  return (
    <form
      action={formAction}
      className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto_auto]"
    >
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="matchId" value={matchId} />
      <div className="space-y-1">
        <Label htmlFor={`et1-${matchId}`} className="text-xs">
          Team 1
        </Label>
        <Input
          id={`et1-${matchId}`}
          name="team1Score"
          type="number"
          min={0}
          max={99}
          defaultValue={team1Score}
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`et2-${matchId}`} className="text-xs">
          Team 2
        </Label>
        <Input
          id={`et2-${matchId}`}
          name="team2Score"
          type="number"
          min={0}
          max={99}
          defaultValue={team2Score}
          required
        />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        Save
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setOpen(false)}
        disabled={pending}
      >
        Cancel
      </Button>
      {state.error && (
        <p className="text-destructive col-span-full text-xs" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
