"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createGroupAction,
  type CreateGroupState,
} from "@/app/groups/new/actions";

const INITIAL_STATE: CreateGroupState = {};

export function CreateGroupForm() {
  const [state, formAction, pending] = useActionState(
    createGroupAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">Group name</Label>
        <Input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={80}
          placeholder="Tuesday Pickleball"
        />
        {state.fieldErrors?.name && (
          <p className="text-destructive text-sm">{state.fieldErrors.name}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Input
          id="description"
          name="description"
          maxLength={500}
          placeholder="Weekly drop-in at the community center"
        />
        {state.fieldErrors?.description && (
          <p className="text-destructive text-sm">
            {state.fieldErrors.description}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="visibility">Visibility</Label>
        <select
          id="visibility"
          name="visibility"
          defaultValue="INVITE_ONLY"
          className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <option value="PRIVATE">Private — invite-only, hidden</option>
          <option value="INVITE_ONLY">Invite-only — sharable join code</option>
          <option value="PUBLIC">Public — anyone with link can request</option>
        </select>
        {state.fieldErrors?.visibility && (
          <p className="text-destructive text-sm">
            {state.fieldErrors.visibility}
          </p>
        )}
      </div>

      {state.error && (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating…" : "Create group"}
      </Button>
    </form>
  );
}
