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
    { href: `${base}/members`, label: "Members" },
    { href: `${base}/players`, label: "Players" },
    ...(showSettings
      ? [{ href: `${base}/settings`, label: "Settings" }]
      : []),
  ];

  return (
    <nav className="border-border/60 mx-auto w-full max-w-4xl border-b px-6">
      <ul className="-mb-px flex gap-1">
        {tabs.map((t) => {
          const active =
            t.href === base
              ? pathname === base
              : pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={cn(
                  "inline-block border-b-2 px-3 py-2 text-sm transition-colors",
                  active
                    ? "border-foreground text-foreground"
                    : "text-muted-foreground hover:text-foreground border-transparent",
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
