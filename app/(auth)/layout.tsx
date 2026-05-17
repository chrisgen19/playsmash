import Link from "next/link";

import { ThemeToggle } from "@/components/shared/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="grid flex-1 grid-cols-1 md:grid-cols-2">
      {/* Editorial panel */}
      <aside className="relative hidden md:flex flex-col justify-between bg-foreground text-background p-10 lg:p-14">
        <Link
          href="/"
          className="font-display text-base tracking-tight inline-flex items-center gap-2"
        >
          <span aria-hidden className="inline-block size-2 bg-accent rounded-[1px]" />
          Playsmash
        </Link>
        <div className="space-y-6">
          <p className="eyebrow text-background/70 inline-flex items-center gap-2">
            <span aria-hidden className="inline-block size-1.5 bg-accent" />
            For clubs &amp; casual courts
          </p>
          <p className="font-display text-4xl leading-[1.05] tracking-tight lg:text-5xl">
            Fair rotations.{" "}
            <em className="text-accent not-italic">Clean</em> scoresheets.
            Players happy.
          </p>
          <div className="flex items-baseline gap-6 border-t border-background/15 pt-6">
            <div>
              <p className="numeric text-3xl">21</p>
              <p className="eyebrow text-background/60 mt-1">Point games</p>
            </div>
            <div>
              <p className="numeric text-3xl">∞</p>
              <p className="eyebrow text-background/60 mt-1">Rotations</p>
            </div>
          </div>
        </div>
        <p className="eyebrow text-background/50">Issue No. 01</p>
      </aside>

      {/* Form column */}
      <section className="flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 md:px-10">
          <Link
            href="/"
            className="font-display text-sm tracking-tight inline-flex items-center gap-2 md:hidden"
          >
            <span aria-hidden className="inline-block size-2 bg-accent rounded-[1px]" />
            Playsmash
          </Link>
          <span className="hidden md:inline" />
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-10 md:px-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </section>
    </main>
  );
}
