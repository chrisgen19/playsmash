"use client";

import { useActionState } from "react";

import {
  changeRoleAction,
  removeMemberAction,
  type MemberActionState,
} from "@/app/groups/[groupId]/members/actions";
import { Button } from "@/components/ui/button";
// Import enums from the generated path, not the @/lib/db barrel — the barrel
// re-exports `prisma`, which pulls the pg driver (Node-only) into the client bundle.
import { GroupRole } from "@/lib/db/generated/enums";
import type { GroupRoleValue } from "@/lib/permissions/roles";

const INITIAL: MemberActionState = {};

/**
 * Per-row controls — role <select> and Remove. Both go through Server
 * Actions; the server re-checks authorization, so disabling controls here
 * is purely a UX nicety.
 */
export function MemberRowActions({
  groupId,
  memberId,
  currentRole,
  isSelf,
  actorRole,
  isOwnerRow,
}: {
  groupId: string;
  memberId: string;
  currentRole: GroupRoleValue;
  isSelf: boolean;
  actorRole: GroupRoleValue;
  isOwnerRow: boolean;
}) {
  const [changeState, changeFormAction, changePending] = useActionState(
    changeRoleAction,
    INITIAL,
  );
  const [removeState, removeFormAction, removePending] = useActionState(
    removeMemberAction,
    INITIAL,
  );

  // OWNER row: no controls — Phase 8 will add transfer-ownership.
  if (isOwnerRow) {
    return (
      <span className="text-muted-foreground text-xs italic">
        Group owner
      </span>
    );
  }

  // ADMIN row + actor is ADMIN: cannot touch.
  const isAdminRow = currentRole === GroupRole.ADMIN;
  const canTouchAdmin = actorRole === GroupRole.OWNER;
  const lockedByPolicy = isAdminRow && !canTouchAdmin;

  return (
    <div className="flex items-center justify-end gap-2">
      <form action={changeFormAction} className="flex items-center gap-2">
        <input type="hidden" name="groupId" value={groupId} />
        <input type="hidden" name="memberId" value={memberId} />
        <select
          name="role"
          defaultValue={currentRole}
          disabled={changePending || lockedByPolicy}
          className="border-input bg-background h-8 rounded-md border px-2 text-xs"
          aria-label="Change role"
        >
          <option value={GroupRole.ADMIN}>Admin</option>
          <option value={GroupRole.PLAYER}>Player</option>
          <option value={GroupRole.VIEWER}>Viewer</option>
        </select>
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={changePending || lockedByPolicy}
        >
          Save
        </Button>
      </form>

      <form action={removeFormAction}>
        <input type="hidden" name="groupId" value={groupId} />
        <input type="hidden" name="memberId" value={memberId} />
        <Button
          type="submit"
          size="sm"
          variant="destructive"
          disabled={removePending || isSelf || lockedByPolicy}
          title={isSelf ? "Use leave-group to remove yourself" : undefined}
        >
          Remove
        </Button>
      </form>

      {(changeState.error || removeState.error) && (
        <span className="text-destructive text-xs">
          {changeState.error ?? removeState.error}
        </span>
      )}
    </div>
  );
}
