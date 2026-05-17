"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_REFRESH_MS = 8_000;

export function LiveSessionRefresh({
  enabled,
  intervalMs = DEFAULT_REFRESH_MS,
}: {
  enabled: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!enabled) return;

    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      startTransition(() => {
        router.refresh();
      });
    };

    const intervalId = window.setInterval(refresh, intervalMs);
    window.addEventListener("focus", refresh);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refresh);
    };
  }, [enabled, intervalMs, router]);

  if (!enabled) return null;

  return (
    <div
      className="text-muted-foreground flex items-center gap-1.5 text-xs"
      aria-live="polite"
    >
      <RefreshCw
        className={isPending ? "size-3 animate-spin" : "size-3"}
        aria-hidden="true"
      />
      <span>Live</span>
    </div>
  );
}
