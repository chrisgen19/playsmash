"use client";

import { useActionState } from "react";

import {
  linkTempPlayerAction,
  type PlayerActionState,
} from "@/app/groups/[groupId]/players/actions";
import { Button } from "@/components/ui/button";
import type { DuplicateSuggestion } from "@/lib/players/duplicate-suggestions";

const INITIAL: PlayerActionState = {};

/**
 * Renders the likely-duplicate suggestions as one-click link rows. Each row
 * posts to the same linkTempPlayerAction the manual flow uses.
 */
export function SuggestedLinks({
  groupId,
  suggestions,
}: {
  groupId: string;
  suggestions: DuplicateSuggestion[];
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className="divide-border/60 divide-y">
      {suggestions.map((s) => (
        <SuggestionRow
          key={`${s.tempPlayerId}:${s.userId}`}
          groupId={groupId}
          suggestion={s}
        />
      ))}
    </div>
  );
}

function SuggestionRow({
  groupId,
  suggestion,
}: {
  groupId: string;
  suggestion: DuplicateSuggestion;
}) {
  const [state, formAction, pending] = useActionState(
    linkTempPlayerAction,
    INITIAL,
  );

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-center justify-between gap-3 py-3"
    >
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="playerId" value={suggestion.tempPlayerId} />
      <input type="hidden" name="targetUserId" value={suggestion.userId} />
      <p className="text-sm">
        Temporary <span className="font-medium">{suggestion.tempDisplayName}</span>{" "}
        looks like member{" "}
        <span className="font-medium">{suggestion.userDisplayName}</span>
        {state.error && (
          <span className="text-destructive ml-2 text-xs">{state.error}</span>
        )}
        {state.success && (
          <span className="text-muted-foreground ml-2 text-xs">Linked.</span>
        )}
      </p>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Linking…" : "Link them"}
      </Button>
    </form>
  );
}
