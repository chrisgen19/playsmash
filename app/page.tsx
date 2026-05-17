import Link from "next/link";
import { redirect } from "next/navigation";

import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <>
      <header className="flex items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="font-display text-base tracking-tight inline-flex items-center gap-2"
        >
          <span aria-hidden className="inline-block size-2 bg-accent rounded-[1px]" />
          Playsmash
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </header>

      <main className="flex flex-1 items-center px-6 py-16 sm:py-24">
        <div className="mx-auto w-full max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-8 space-y-8">
              <p className="eyebrow text-muted-foreground inline-flex items-center gap-2">
                <span aria-hidden className="inline-block size-1.5 bg-accent" />
                Issue No. 01 — Pickleball, organised
              </p>
              <h1 className="font-display text-5xl leading-[0.95] tracking-tight sm:text-7xl lg:text-[5.5rem]">
                Stacking &amp;{" "}
                <em className="text-accent not-italic">scoring</em>,
                <br className="hidden sm:block" /> without the spreadsheets.
              </h1>
              <p className="text-muted-foreground max-w-prose text-lg">
                Spin up a group, invite players (or add temporary ones),
                generate fair court rotations, and keep score — all in one
                place.
              </p>
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <Button asChild variant="accent" size="xl">
                  <Link href="/register">Get started — it&apos;s free</Link>
                </Button>
                <Button asChild variant="outline" size="xl">
                  <Link href="/login">I already have an account</Link>
                </Button>
              </div>
            </div>

            <aside className="lg:col-span-4">
              <div className="grid grid-cols-3 lg:grid-cols-1 lg:grid-rows-3 gap-px bg-border/70 border border-border/70">
                <Stat figure="21" label="Point games" />
                <Stat figure="4" label="Courts handled" />
                <Stat figure="∞" label="Fair rotations" />
              </div>
            </aside>
          </div>

          <footer className="mt-24 flex flex-wrap items-center justify-between gap-4 border-t border-border/70 pt-6 text-xs">
            <p className="text-muted-foreground">
              © {new Date().getFullYear()} Playsmash · Built for clubs &amp; casual courts.
            </p>
            <p className="eyebrow text-muted-foreground">
              v1 — Editorial release
            </p>
          </footer>
        </div>
      </main>
    </>
  );
}

function Stat({ figure, label }: { figure: string; label: string }) {
  return (
    <div className="bg-background px-5 py-6 flex flex-col justify-between gap-3">
      <span className="numeric text-5xl text-foreground leading-none">
        {figure}
      </span>
      <span className="eyebrow text-muted-foreground">{label}</span>
    </div>
  );
}
