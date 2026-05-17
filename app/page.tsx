import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="mx-auto w-full max-w-xl space-y-8 text-center">
        <div className="space-y-3">
          <p className="text-muted-foreground text-sm font-medium uppercase tracking-wider">
            Playsmash
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Pickleball stacking & scoring,
            <br className="hidden sm:block" /> without the spreadsheets.
          </h1>
          <p className="text-muted-foreground mx-auto max-w-md text-base">
            Spin up a group, invite players (or add temporary ones), generate
            fair court rotations, and keep score — all in one place.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/register">Get started</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">I already have an account</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
