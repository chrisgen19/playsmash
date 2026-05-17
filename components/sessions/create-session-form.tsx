"use client";

import { useActionState } from "react";

import {
  createSessionAction,
  type SessionActionState,
} from "@/app/groups/[groupId]/sessions/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL: SessionActionState = {};

type SelectablePlayer = { id: string; displayName: string };

export function CreateSessionForm({
  groupId,
  players,
}: {
  groupId: string;
  players: SelectablePlayer[];
}) {
  const [state, formAction, pending] = useActionState(
    createSessionAction,
    INITIAL,
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="groupId" value={groupId} />

      <div className="space-y-2">
        <Label htmlFor="name">Session name</Label>
        <Input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={120}
          placeholder="Tuesday night drop-in"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="date">Date &amp; time</Label>
          <Input id="date" name="date" type="datetime-local" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Location (optional)</Label>
          <Input id="location" name="location" maxLength={200} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="numberOfCourts">Courts</Label>
          <Input
            id="numberOfCourts"
            name="numberOfCourts"
            type="number"
            min={1}
            max={20}
            defaultValue={1}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pointsToWin">Points to win</Label>
          <Input
            id="pointsToWin"
            name="pointsToWin"
            type="number"
            min={1}
            max={99}
            defaultValue={11}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="scoringType">Scoring</Label>
          <select
            id="scoringType"
            name="scoringType"
            defaultValue="RALLY"
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
          >
            <option value="RALLY">Rally</option>
            <option value="SIDE_OUT">Side-out</option>
            <option value="CUSTOM">Custom</option>
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="winByTwo"
          defaultChecked
          className="size-4"
        />
        Win by two
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          Available players ({players.length})
        </legend>
        {players.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No active players in this group yet — add some on the Players tab.
          </p>
        ) : (
          <div className="grid max-h-60 gap-1 overflow-y-auto sm:grid-cols-2">
            {players.map((p) => (
              <label
                key={p.id}
                className="hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
              >
                <input
                  type="checkbox"
                  name="playerIds"
                  value={p.id}
                  defaultChecked
                  className="size-4"
                />
                {p.displayName}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      {state.error && (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating…" : "Create session"}
      </Button>
    </form>
  );
}
