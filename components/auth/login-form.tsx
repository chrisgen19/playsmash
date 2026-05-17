"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  loginAction,
  signInWithGoogleAction,
  type LoginState,
} from "@/app/(auth)/login/actions";

const INITIAL_STATE: LoginState = {};

export function LoginForm({
  callbackUrl,
  showGoogle,
}: {
  callbackUrl?: string;
  showGoogle: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    loginAction,
    INITIAL_STATE,
  );

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <p className="eyebrow text-muted-foreground inline-flex items-center gap-2">
          <span aria-hidden className="inline-block size-1.5 bg-accent" />
          Welcome back
        </p>
        <h1 className="font-display text-3xl tracking-tight">Sign in</h1>
        <p className="text-muted-foreground text-sm">
          New here?{" "}
          <Link href="/register" className="text-foreground underline underline-offset-4">
            Create an account
          </Link>
          .
        </p>
      </header>

      <form action={formAction} className="space-y-4">
        {callbackUrl && (
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
        )}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        {state.error && (
          <p className="text-destructive text-sm" role="alert">
            {state.error}
          </p>
        )}

        <Button type="submit" variant="accent" size="lg" disabled={pending} className="w-full">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {showGoogle && (
        <>
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-muted-foreground text-xs uppercase">or</span>
            <Separator className="flex-1" />
          </div>
          <form action={signInWithGoogleAction}>
            {callbackUrl && (
              <input type="hidden" name="callbackUrl" value={callbackUrl} />
            )}
            <Button type="submit" variant="outline" size="lg" className="w-full">
              Continue with Google
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
