"use client";

import { useActionState, useState } from "react";

import {
  setAttendanceAction,
  type SessionActionState,
} from "@/app/groups/[groupId]/sessions/actions";
import { Button } from "@/components/ui/button";

const INITIAL: SessionActionState = {};

type SelectablePlayer = { id: string; displayName: string };

/**
 * Collapsed by default — expands to a checkbox list of all group players
 * with the currently-attending set pre-checked. Only usable while the
 * session is PLANNED (the parent decides whether to render this).
 */
export function EditAttendanceForm({
  groupId,
  sessionId,
  groupPlayers,
  attendingIds,
}: {
  groupId: string;
  sessionId: string;
  groupPlayers: SelectablePlayer[];
  attendingIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    setAttendanceAction,
    INITIAL,
  );
  const attending = new Set(attendingIds);

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Edit players
      </Button>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <div className="grid max-h-60 gap-1 overflow-y-auto sm:grid-cols-2">
        {groupPlayers.map((p) => (
          <label
            key={p.id}
            className="hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
          >
            <input
              type="checkbox"
              name="playerIds"
              value={p.id}
              defaultChecked={attending.has(p.id)}
              className="size-4"
            />
            {p.displayName}
          </label>
        ))}
      </div>
      {state.error && (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save players"}
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
      </div>
    </form>
  );
}
