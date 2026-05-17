"use client";

import { useSyncExternalStore } from "react";

/**
 * Renders a timestamp in the viewer's local timezone.
 *
 * Server Components can't know the viewer's timezone, and `toISOString()`
 * always emits UTC — which mismatches the wall-clock time entered via a
 * `datetime-local` input. `useSyncExternalStore` gives us a hydration-safe
 * "are we on the client?" flag: the server snapshot is `false`, so the
 * server and first client render both show a deterministic UTC-ish
 * fallback; after hydration the client snapshot (`true`) upgrades to the
 * browser-local format. No effect, no hydration mismatch.
 */
const noopSubscribe = () => () => {};

export function LocalDateTime({
  iso,
  className,
}: {
  iso: string;
  className?: string;
}) {
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  const text = isClient
    ? new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : iso.slice(0, 16).replace("T", " ");

  return (
    <time dateTime={iso} className={className}>
      {text}
    </time>
  );
}
