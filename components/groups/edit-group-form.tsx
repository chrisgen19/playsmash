"use client";

import { useActionState } from "react";

import {
  editGroupAction,
  type GroupSettingsState,
} from "@/app/groups/[groupId]/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL: GroupSettingsState = {};

export function EditGroupForm({
  groupId,
  name,
  description,
  visibility,
}: {
  groupId: string;
  name: string;
  description: string | null;
  visibility: string;
}) {
  const [state, formAction, pending] = useActionState(
    editGroupAction,
    INITIAL,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="groupId" value={groupId} />
      <div className="space-y-2">
        <Label htmlFor="name">Group name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={name}
          required
          minLength={2}
          maxLength={80}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Input
          id="description"
          name="description"
          defaultValue={description ?? ""}
          maxLength={500}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="visibility">Visibility</Label>
        <select
          id="visibility"
          name="visibility"
          defaultValue={visibility}
          className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
        >
          <option value="PRIVATE">Private — invite-only, hidden</option>
          <option value="INVITE_ONLY">Invite-only — sharable join code</option>
          <option value="PUBLIC">Public — anyone can request to join</option>
        </select>
      </div>
      {state.error && (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-muted-foreground text-sm">{state.success}</p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
