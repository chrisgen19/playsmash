import Link from "next/link";

import { SignOutButton } from "./sign-out-button";
import { ThemeToggle } from "./theme-toggle";

/**
 * MD3 center-aligned top app bar. Surface-container tint, 64px tall.
 * Used as the global header on authenticated routes.
 */
export function TopAppBar({
  userEmail,
  title,
}: {
  userEmail?: string | null;
  title?: string;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-[color:var(--md-sys-color-outline-variant)] bg-[color:var(--md-sys-color-surface-container)]/95 px-4 backdrop-blur-md sm:px-6">
      <Link
        href="/dashboard"
        className="md-state-layer flex items-center gap-2.5 rounded-full px-2 py-1.5 -ml-2"
      >
        <Logo />
        <span className="md-title-md hidden sm:inline">Playsmash</span>
      </Link>

      {title && (
        <>
          <span
            aria-hidden
            className="hidden h-6 w-px bg-[color:var(--md-sys-color-outline-variant)] sm:inline-block"
          />
          <span className="md-title-md hidden text-muted-foreground sm:inline">
            {title}
          </span>
        </>
      )}

      <div className="ml-auto flex items-center gap-1">
        {userEmail && (
          <span className="md-label-md text-muted-foreground mr-2 hidden md:inline">
            {userEmail}
          </span>
        )}
        <ThemeToggle />
        <SignOutButton />
      </div>
    </header>
  );
}

function Logo() {
  return (
    <span
      aria-hidden
      className="grid size-8 place-items-center rounded-lg bg-primary text-[color:var(--md-sys-color-on-primary)] md-title-sm"
    >
      P
    </span>
  );
}
