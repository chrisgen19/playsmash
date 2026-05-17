"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  joinGroupAction,
  type JoinGroupState,
} from "@/app/join/actions";

const INITIAL_STATE: JoinGroupState = {};

export function JoinGroupForm({
  defaultCode,
  compact,
}: {
  defaultCode?: string;
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    joinGroupAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction} className={compact ? "flex gap-2" : "space-y-3"}>
      <div className={compact ? "flex-1" : "space-y-2"}>
        {!compact && <Label htmlFor="join-code">Join code</Label>}
        <Input
          id="join-code"
          name="code"
          required
          defaultValue={defaultCode}
          maxLength={16}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="font-mono uppercase tracking-widest"
          placeholder="ABCDEF"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Joining…" : compact ? "Join" : "Join group"}
      </Button>
      {state.fieldErrors?.code && (
        <p className="text-destructive col-span-2 text-sm" role="alert">
          {state.fieldErrors.code}
        </p>
      )}
    </form>
  );
}
