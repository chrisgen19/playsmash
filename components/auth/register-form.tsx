"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  registerAction,
  type RegisterState,
} from "@/app/(auth)/register/actions";

const INITIAL_STATE: RegisterState = {};

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(
    registerAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction} className="space-y-7">
      <header className="space-y-2">
        <p className="md-label-lg text-primary">Get started</p>
        <h1 className="md-headline-md text-foreground">Create your account</h1>
        <p className="md-body-md text-muted-foreground">
          Already have one?{" "}
          <Link
            href="/login"
            className="text-primary underline underline-offset-4"
          >
            Sign in
          </Link>
          .
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="firstName" className="md-label-md">
            First name
          </Label>
          <Input
            id="firstName"
            name="firstName"
            autoComplete="given-name"
            required
            maxLength={40}
          />
          {state.fieldErrors?.firstName && (
            <p className="md-body-sm text-[color:var(--md-sys-color-error)]">
              {state.fieldErrors.firstName}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="lastName" className="md-label-md">
            Last name
          </Label>
          <Input
            id="lastName"
            name="lastName"
            autoComplete="family-name"
            required
            maxLength={40}
          />
          {state.fieldErrors?.lastName && (
            <p className="md-body-sm text-[color:var(--md-sys-color-error)]">
              {state.fieldErrors.lastName}
            </p>
          )}
        </div>
      </div>

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
        {state.fieldErrors?.email && (
          <p className="md-body-sm text-[color:var(--md-sys-color-error)]">
            {state.fieldErrors.email}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password" className="md-label-md">
          Password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
        {state.fieldErrors?.password && (
          <p className="md-body-sm text-[color:var(--md-sys-color-error)]">
            {state.fieldErrors.password}
          </p>
        )}
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
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
