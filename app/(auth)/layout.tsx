import Link from "next/link";

import { ThemeToggle } from "@/components/shared/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[color:var(--md-sys-color-outline-variant)] bg-[color:var(--md-sys-color-surface-container)]/95 px-4 backdrop-blur-md sm:px-6">
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
        <ThemeToggle />
      </header>

      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-12">
        <div
          aria-hidden
          className="absolute -top-32 left-1/2 -z-10 size-[36rem] -translate-x-1/2 rounded-full bg-[color:var(--md-sys-color-primary-container)] opacity-50 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute bottom-0 right-0 -z-10 size-[22rem] translate-x-1/3 translate-y-1/3 rounded-full bg-[color:var(--md-sys-color-tertiary-container)] opacity-50 blur-3xl"
        />

        <div className="w-full max-w-md">
          <div className="md-elev-2 rounded-2xl bg-[color:var(--md-sys-color-surface-container-lowest)] p-8 sm:p-10">
            {children}
          </div>
          <p className="md-body-sm text-muted-foreground mt-6 text-center">
            By continuing you agree to fair play, fair rotations, and fewer
            spreadsheets.
          </p>
        </div>
      </main>
    </>
  );
}
