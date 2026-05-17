"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Horizontal tab strip rendered in the group layout. Hides Settings for
 * non-admins (server-side authorization is still the source of truth — the
 * settings page itself redirects unauthorized users; this is just a UX hide).
 */
export function GroupTabs({
  groupId,
  showSettings,
}: {
  groupId: string;
  showSettings: boolean;
}) {
  const pathname = usePathname();
  const base = `/groups/${groupId}`;
  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/sessions`, label: "Sessions" },
    { href: `${base}/members`, label: "Members" },
    { href: `${base}/players`, label: "Players" },
    { href: `${base}/stats`, label: "Stats" },
    // Activity + Settings are admin-only — gated server-side too.
    ...(showSettings
      ? [
          { href: `${base}/activity`, label: "Activity" },
          { href: `${base}/settings`, label: "Settings" },
        ]
      : []),
  ];

  return (
    <nav className="sticky top-16 z-10 border-b border-[color:var(--md-sys-color-outline-variant)] bg-[color:var(--md-sys-color-surface-container)]/95 backdrop-blur">
      <ul className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
        {tabs.map((t) => {
          const active =
            t.href === base
              ? pathname === base
              : pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <li key={t.href} className="shrink-0">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "md-state-layer md-label-lg relative inline-flex h-12 items-center px-4 transition-colors",
                  "after:absolute after:bottom-0 after:left-2 after:right-2 after:h-[3px] after:rounded-t-md after:bg-primary after:transition-opacity",
                  active
                    ? "text-primary after:opacity-100"
                    : "text-muted-foreground hover:text-foreground after:opacity-0",
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
