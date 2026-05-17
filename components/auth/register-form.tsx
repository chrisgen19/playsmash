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
    <form action={formAction} className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Create your account</h1>
        <p className="text-muted-foreground text-sm">
          Already have one?{" "}
          <Link href="/login" className="text-foreground underline">
            Sign in
          </Link>
          .
        </p>
      </header>

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          required
          minLength={2}
        />
        {state.fieldErrors?.name && (
          <p className="text-destructive text-sm">{state.fieldErrors.name}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        {state.fieldErrors?.email && (
          <p className="text-destructive text-sm">{state.fieldErrors.email}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
        {state.fieldErrors?.password && (
          <p className="text-destructive text-sm">
            {state.fieldErrors.password}
          </p>
        )}
      </div>

      {state.error && (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
