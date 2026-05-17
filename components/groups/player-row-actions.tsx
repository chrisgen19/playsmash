"use client";

import { useActionState, useState } from "react";

import {
  editPlayerAction,
  linkTempPlayerAction,
  setPlayerStatusAction,
  type PlayerActionState,
} from "@/app/groups/[groupId]/players/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// Import enums from the generated path, not the @/lib/db barrel — the barrel
// re-exports `prisma`, which pulls the pg driver (Node-only) into the client bundle.
import { PlayerStatus } from "@/lib/db/generated/enums";

const INITIAL: PlayerActionState = {};

type Player = {
  id: string;
  displayName: string;
  skillLevel: number | null;
  notes: string | null;
  status: string;
  userId: string | null;
};

type LinkCandidate = { userId: string; label: string };

export function PlayerRowActions({
  groupId,
  player,
  linkCandidates,
}: {
  groupId: string;
  player: Player;
  linkCandidates: LinkCandidate[];
}) {
  const [editing, setEditing] = useState(false);
  const [linking, setLinking] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {!editing && !linking && (
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>

          {player.status !== PlayerStatus.REMOVED && (
            <StatusButton
              groupId={groupId}
              playerId={player.id}
              currentStatus={player.status}
            />
          )}

          {player.userId === null && linkCandidates.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setLinking(true)}
            >
              Link to user
            </Button>
          )}

          {player.status !== PlayerStatus.REMOVED && (
            <RemoveButton groupId={groupId} playerId={player.id} />
          )}
        </>
      )}

      {editing && (
        <EditForm
          groupId={groupId}
          player={player}
          onDone={() => setEditing(false)}
        />
      )}

      {linking && (
        <LinkForm
          groupId={groupId}
          playerId={player.id}
          candidates={linkCandidates}
          onDone={() => setLinking(false)}
        />
      )}
    </div>
  );
}

function StatusButton({
  groupId,
  playerId,
  currentStatus,
}: {
  groupId: string;
  playerId: string;
  currentStatus: string;
}) {
  const nextStatus =
    currentStatus === PlayerStatus.ACTIVE
      ? PlayerStatus.INACTIVE
      : PlayerStatus.ACTIVE;
  const label =
    currentStatus === PlayerStatus.ACTIVE ? "Set inactive" : "Set active";
  return (
    <form action={setPlayerStatusAction}>
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="playerId" value={playerId} />
      <input type="hidden" name="status" value={nextStatus} />
      <Button type="submit" size="sm" variant="ghost">
        {label}
      </Button>
    </form>
  );
}

function RemoveButton({
  groupId,
  playerId,
}: {
  groupId: string;
  playerId: string;
}) {
  return (
    <form action={setPlayerStatusAction}>
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="playerId" value={playerId} />
      <input type="hidden" name="status" value={PlayerStatus.REMOVED} />
      <Button type="submit" size="sm" variant="destructive">
        Remove
      </Button>
    </form>
  );
}

function EditForm({
  groupId,
  player,
  onDone,
}: {
  groupId: string;
  player: Player;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    editPlayerAction,
    INITIAL,
  );
  return (
    <form action={formAction} className="grid gap-2 sm:grid-cols-3">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="playerId" value={player.id} />
      <div>
        <Label htmlFor={`name-${player.id}`} className="text-xs">
          Name
        </Label>
        <Input
          id={`name-${player.id}`}
          name="displayName"
          defaultValue={player.displayName}
          required
          maxLength={80}
        />
      </div>
      <div>
        <Label htmlFor={`skill-${player.id}`} className="text-xs">
          Skill
        </Label>
        <Input
          id={`skill-${player.id}`}
          name="skillLevel"
          type="number"
          min={0}
          max={10}
          step={0.1}
          defaultValue={player.skillLevel ?? ""}
        />
      </div>
      <div className="flex items-end gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          Save
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onDone}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
      {state.error && (
        <p className="text-destructive col-span-full text-xs">{state.error}</p>
      )}
    </form>
  );
}

function LinkForm({
  groupId,
  playerId,
  candidates,
  onDone,
}: {
  groupId: string;
  playerId: string;
  candidates: LinkCandidate[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    linkTempPlayerAction,
    INITIAL,
  );
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="playerId" value={playerId} />
      <div>
        <Label htmlFor={`link-${playerId}`} className="text-xs">
          Link to user
        </Label>
        <select
          id={`link-${playerId}`}
          name="targetUserId"
          className="border-input bg-background h-8 rounded-md border px-2 text-xs"
          required
        >
          <option value="">Select…</option>
          {candidates.map((c) => (
            <option key={c.userId} value={c.userId}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        Link
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onDone}
        disabled={pending}
      >
        Cancel
      </Button>
      {state.error && (
        <p className="text-destructive col-span-full w-full text-xs">
          {state.error}
        </p>
      )}
    </form>
  );
}
