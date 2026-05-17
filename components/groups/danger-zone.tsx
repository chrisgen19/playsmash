"use client";

import { useActionState, useState } from "react";

import {
  archiveGroupAction,
  transferOwnershipAction,
  type GroupSettingsState,
} from "@/app/groups/[groupId]/settings/actions";
import { Button } from "@/components/ui/button";

const INITIAL: GroupSettingsState = {};

type TransferCandidate = { memberId: string; label: string };

/**
 * OWNER-only destructive actions: transfer ownership and archive the group.
 * Both gate behind an inline confirm step so a stray click can't fire them.
 */
export function DangerZone({
  groupId,
  candidates,
}: {
  groupId: string;
  candidates: TransferCandidate[];
}) {
  return (
    <div className="space-y-6">
      <TransferOwnership groupId={groupId} candidates={candidates} />
      <ArchiveGroup groupId={groupId} />
    </div>
  );
}

function TransferOwnership({
  groupId,
  candidates,
}: {
  groupId: string;
  candidates: TransferCandidate[];
}) {
  const [state, formAction, pending] = useActionState(
    transferOwnershipAction,
    INITIAL,
  );
  const [confirming, setConfirming] = useState(false);

  if (candidates.length === 0) {
    return (
      <div>
        <p className="text-sm font-medium">Transfer ownership</p>
        <p className="text-muted-foreground text-sm">
          No other active members to transfer to.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="groupId" value={groupId} />
      <p className="text-sm font-medium">Transfer ownership</p>
      <p className="text-muted-foreground text-sm">
        You become an admin; the chosen member becomes the owner.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          name="memberId"
          required
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        >
          <option value="">Select a member…</option>
          {candidates.map((c) => (
            <option key={c.memberId} value={c.memberId}>
              {c.label}
            </option>
          ))}
        </select>
        {confirming ? (
          <>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Transferring…" : "Confirm transfer"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => setConfirming(true)}
          >
            Transfer…
          </Button>
        )}
      </div>
      {state.error && (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

function ArchiveGroup({ groupId }: { groupId: string }) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="border-destructive/30 space-y-2 rounded-lg border p-3">
      <p className="text-sm font-medium">Archive group</p>
      <p className="text-muted-foreground text-sm">
        The group drops off everyone&apos;s dashboard and stops accepting
        changes. History is kept — this is reversible only via the database.
      </p>
      {confirming ? (
        <form action={archiveGroupAction} className="flex items-center gap-2">
          <input type="hidden" name="groupId" value={groupId} />
          <Button type="submit" variant="destructive">
            Confirm archive
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setConfirming(false)}
          >
            Cancel
          </Button>
        </form>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => setConfirming(true)}
        >
          Archive group…
        </Button>
      )}
    </div>
  );
}
