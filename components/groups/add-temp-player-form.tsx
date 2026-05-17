"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  createTempPlayerAction,
  type PlayerActionState,
} from "@/app/groups/[groupId]/players/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL: PlayerActionState = {};

export function AddTempPlayerForm({ groupId }: { groupId: string }) {
  const [state, formAction, pending] = useActionState(
    createTempPlayerAction,
    INITIAL,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success && formRef.current) {
      formRef.current.reset();
    }
  }, [state.success]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid gap-3 sm:grid-cols-[1fr_120px_auto]"
    >
      <input type="hidden" name="groupId" value={groupId} />
      <div className="space-y-1">
        <Label htmlFor="displayName" className="text-xs">
          Display name
        </Label>
        <Input
          id="displayName"
          name="displayName"
          required
          maxLength={80}
          placeholder="Temp Bob"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="skillLevel" className="text-xs">
          Skill (0–10)
        </Label>
        <Input
          id="skillLevel"
          name="skillLevel"
          type="number"
          min={0}
          max={10}
          step={0.1}
          placeholder="—"
        />
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Adding…" : "Add temp player"}
        </Button>
      </div>
      {(state.error || state.success) && (
        <p
          className={`col-span-full text-xs ${
            state.error ? "text-destructive" : "text-muted-foreground"
          }`}
          role={state.error ? "alert" : undefined}
        >
          {state.error ?? state.success}
        </p>
      )}
    </form>
  );
}
