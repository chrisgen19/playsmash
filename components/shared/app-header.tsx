import Link from "next/link";

import { SignOutButton } from "./sign-out-button";

export function AppHeader({ userEmail }: { userEmail?: string | null }) {
  return (
    <header className="border-border/60 sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 px-6 py-3 backdrop-blur">
      <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
        Playsmash
      </Link>
      <div className="flex items-center gap-3">
        {userEmail && (
          <span className="text-muted-foreground hidden text-xs sm:inline">
            {userEmail}
          </span>
        )}
        <SignOutButton />
      </div>
    </header>
  );
}
