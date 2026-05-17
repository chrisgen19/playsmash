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
    <div className="space-y-7">
      <header className="space-y-2">
        <p className="md-label-lg text-primary">Welcome back</p>
        <h1 className="md-headline-md text-foreground">Sign in to Playsmash</h1>
        <p className="md-body-md text-muted-foreground">
          New here?{" "}
          <Link
            href="/register"
            className="text-primary underline underline-offset-4"
          >
            Create an account
          </Link>
          .
        </p>
      </header>

      <form action={formAction} className="space-y-4">
        {callbackUrl && (
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email" className="md-label-md">
            Email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="md-label-md">
            Password
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        {state.error && (
          <p
            className="md-body-sm rounded-md bg-[color:var(--md-sys-color-error-container)] px-3 py-2 text-[color:var(--md-sys-color-on-error-container)]"
            role="alert"
          >
            {state.error}
          </p>
        )}

        <Button
          type="submit"
          variant="filled"
          size="lg"
          disabled={pending}
          className="w-full"
        >
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {showGoogle && (
        <>
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="md-label-md text-muted-foreground">OR</span>
            <Separator className="flex-1" />
          </div>
          <form action={signInWithGoogleAction}>
            {callbackUrl && (
              <input type="hidden" name="callbackUrl" value={callbackUrl} />
            )}
            <Button
              type="submit"
              variant="outlined"
              size="lg"
              className="w-full"
            >
              Continue with Google
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
