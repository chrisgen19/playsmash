"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/lib/auth/auth";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import { registerSchema } from "@/lib/validations/auth";

export type RegisterState = {
  fieldErrors?: Partial<
    Record<"firstName" | "lastName" | "email" | "password", string>
  >;
  error?: string;
};

export async function registerAction(
  _prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    return {
      fieldErrors: {
        firstName: flat.firstName?.[0],
        lastName: flat.lastName?.[0],
        email: flat.email?.[0],
        password: flat.password?.[0],
      },
    };
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });
  if (existing) {
    return {
      fieldErrors: { email: "An account with that email already exists" },
    };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.user.create({
    data: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      // Keep `name` in sync — Auth.js + session.user.name read from here.
      name: `${parsed.data.firstName} ${parsed.data.lastName}`,
      email: parsed.data.email,
      passwordHash,
    },
  });

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
  } catch (err) {
    // AuthError = credential rejection. Anything else (notably NEXT_REDIRECT
    // thrown after a successful sign-in) must bubble up so Next can redirect.
    if (err instanceof AuthError) {
      return { error: "Account created — please sign in to continue." };
    }
    throw err;
  }

  return {};
}
