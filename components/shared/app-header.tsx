import Link from "next/link";

import { ThemeToggle } from "./theme-toggle";
import { SignOutButton } from "./sign-out-button";

export function AppHeader({ userEmail }: { userEmail?: string | null }) {
  return (
    <header className="border-border/60 sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 px-6 py-4 backdrop-blur">
      <Link
        href="/dashboard"
        className="font-display text-base tracking-tight inline-flex items-center gap-2"
      >
        <span aria-hidden className="inline-block size-2 bg-accent rounded-[1px]" />
        Playsmash
      </Link>
      <div className="flex items-center gap-2">
        {userEmail && (
          <span className="text-muted-foreground hidden text-xs sm:inline">
            {userEmail}
          </span>
        )}
        <ThemeToggle />
        <SignOutButton />
      </div>
    </header>
  );
}
