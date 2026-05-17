import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Shuffle,
  Trophy,
  Users,
} from "lucide-react";

import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-[color:var(--md-sys-color-outline-variant)] bg-[color:var(--md-sys-color-surface-container)]/95 px-4 backdrop-blur-md sm:px-6">
        <Link
          href="/"
          className="md-state-layer flex items-center gap-2.5 rounded-full px-2 py-1.5 -ml-2"
        >
          <span
            aria-hidden
            className="grid size-8 place-items-center rounded-lg bg-primary text-[color:var(--md-sys-color-on-primary)] md-title-sm"
          >
            P
          </span>
          <span className="md-title-md">Playsmash</span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <Button asChild variant="text" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild variant="filled" size="sm">
            <Link href="/register">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-[color:var(--md-sys-color-surface-container-low)]"
          />
          <div
            aria-hidden
            className="absolute -top-32 -right-24 -z-10 size-[28rem] rounded-full bg-[color:var(--md-sys-color-primary-container)] opacity-60 blur-3xl"
          />
          <div
            aria-hidden
            className="absolute -bottom-40 -left-20 -z-10 size-[24rem] rounded-full bg-[color:var(--md-sys-color-tertiary-container)] opacity-50 blur-3xl"
          />

          <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-20 lg:grid-cols-12 lg:items-center lg:py-28">
            <div className="lg:col-span-7 space-y-7">
              <Badge variant="default" className="h-8 px-3">
                <CheckCircle2 className="size-3.5" />
                Free for clubs & casual courts
              </Badge>
              <h1 className="md-display-lg max-w-2xl text-foreground">
                Pickleball, organised{" "}
                <span className="text-primary">end-to-end</span>.
              </h1>
              <p className="md-body-lg text-muted-foreground max-w-xl">
                Spin up a group, invite players (or add temporary ones),
                generate fair court rotations, and keep score — all in one
                place. No spreadsheets. No arguments.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button asChild variant="filled" size="lg">
                  <Link href="/register">
                    Create your group
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outlined" size="lg">
                  <Link href="/login">I already have an account</Link>
                </Button>
              </div>
              <dl className="flex flex-wrap gap-x-10 gap-y-4 pt-6">
                <Stat figure="21" label="point games" />
                <Stat figure="4" label="courts at once" />
                <Stat figure="∞" label="fair rotations" />
              </dl>
            </div>

            <div className="lg:col-span-5">
              <div className="relative">
                <Card
                  variant="elevated"
                  className="ml-auto max-w-sm overflow-visible"
                >
                  <CardHeader>
                    <Badge variant="accent" className="w-fit">
                      <Trophy className="size-3.5" />
                      Live leaderboard
                    </Badge>
                    <CardTitle>Friday Night Mixer</CardTitle>
                    <CardDescription>Court 2 · Match 14</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <LeaderRow rank={1} name="Mae & Tito" score="21" winner />
                    <LeaderRow rank={2} name="Joana & Mark" score="18" />
                    <LeaderRow rank={3} name="Ann & Pao" score="15" />
                  </CardContent>
                </Card>
                <Card
                  variant="filled"
                  size="sm"
                  className="absolute -bottom-6 -left-6 hidden w-60 sm:block"
                >
                  <CardContent className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-full bg-[color:var(--md-sys-color-primary-container)] text-[color:var(--md-sys-color-on-primary-container)]">
                      <Shuffle className="size-4" />
                    </span>
                    <div className="space-y-0.5">
                      <p className="md-title-sm">Round 4 ready</p>
                      <p className="md-body-sm text-muted-foreground">
                        Fair pairings generated
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto w-full max-w-6xl px-6 py-20">
          <div className="mb-12 max-w-2xl space-y-3">
            <p className="md-label-lg text-primary">Everything in one place</p>
            <h2 className="md-headline-lg">
              Built for the people who actually run the night.
            </h2>
            <p className="md-body-lg text-muted-foreground">
              From the first invite to the final score, Playsmash keeps
              everything in sync — across every player, every court, every
              session.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<Users className="size-5" />}
              title="Groups & roles"
              body="Invite members, manage admins, and keep your roster tidy. Add temporary players for one-off guests."
            />
            <FeatureCard
              icon={<Shuffle className="size-5" />}
              title="Fair rotations"
              body="Auto-generate balanced doubles pairings round after round. Honor sit-outs and partner history."
            />
            <FeatureCard
              icon={<Trophy className="size-5" />}
              title="Live scoring"
              body="Score from any device. Leaderboards update instantly across the whole session."
            />
            <FeatureCard
              icon={<CalendarClock className="size-5" />}
              title="Session planning"
              body="Schedule ahead, mark attendance, and reuse pairings for recurring nights."
            />
            <FeatureCard
              icon={<CheckCircle2 className="size-5" />}
              title="Player stats"
              body="Track wins, losses, partners, and streaks over time — for every player in your group."
            />
            <FeatureCard
              icon={<ArrowRight className="size-5" />}
              title="One join code"
              body="Share a six-character code and players are in. No app store dance, no friction."
            />
          </div>
        </section>

        {/* CTA banner */}
        <section className="mx-auto w-full max-w-6xl px-6 pb-24">
          <div className="overflow-hidden rounded-2xl bg-[color:var(--md-sys-color-primary-container)] px-8 py-14 text-[color:var(--md-sys-color-on-primary-container)] sm:px-14">
            <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto]">
              <div className="space-y-3">
                <p className="md-label-lg uppercase tracking-wider">
                  Ready when you are
                </p>
                <h2 className="md-headline-lg">
                  Run your next session in under 10 minutes.
                </h2>
                <p className="md-body-lg max-w-xl opacity-90">
                  Sign up, paste your roster, pick a number of courts. We
                  handle the rest.
                </p>
              </div>
              <Button asChild variant="filled" size="xl" className="w-fit">
                <Link href="/register">
                  Start free
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[color:var(--md-sys-color-outline-variant)] bg-[color:var(--md-sys-color-surface-container)] px-6 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4">
          <p className="md-body-sm text-muted-foreground">
            © {new Date().getFullYear()} Playsmash. For clubs & casual courts.
          </p>
          <div className="flex items-center gap-2">
            <Button asChild variant="text" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild variant="tonal" size="sm">
              <Link href="/register">Create account</Link>
            </Button>
          </div>
        </div>
      </footer>
    </>
  );
}

function Stat({ figure, label }: { figure: string; label: string }) {
  return (
    <div className="space-y-1">
      <dt className="md-display-sm text-foreground">{figure}</dt>
      <dd className="md-label-md text-muted-foreground uppercase tracking-wider">
        {label}
      </dd>
    </div>
  );
}

function LeaderRow({
  rank,
  name,
  score,
  winner = false,
}: {
  rank: number;
  name: string;
  score: string;
  winner?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-[color:var(--md-sys-color-surface-container)] px-3 py-2.5">
      <span
        className={`grid size-7 place-items-center rounded-full md-label-md ${
          winner
            ? "bg-primary text-[color:var(--md-sys-color-on-primary)]"
            : "bg-[color:var(--md-sys-color-surface-container-high)] text-muted-foreground"
        }`}
      >
        {rank}
      </span>
      <span className="md-body-md flex-1">{name}</span>
      <span className="md-title-md tabular-nums">{score}</span>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Card variant="outlined" className="h-full transition-shadow hover:md-elev-1">
      <CardHeader>
        <span className="grid size-10 place-items-center rounded-lg bg-[color:var(--md-sys-color-secondary-container)] text-[color:var(--md-sys-color-on-secondary-container)]">
          {icon}
        </span>
        <CardTitle className="mt-2">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}
