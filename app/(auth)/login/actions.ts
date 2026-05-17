"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/lib/auth/auth";
import { safeCallbackUrl } from "@/lib/auth/safe-callback-url";

export type LoginState = {
  error?: string;
};

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const callbackUrl = safeCallbackUrl(
    formData.get("callbackUrl") as string | null,
  );
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: callbackUrl,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.type === "CredentialsSignin") {
        return { error: "Invalid email or password." };
      }
      return { error: "Could not sign in. Please try again." };
    }
    throw err; // NEXT_REDIRECT — let Next handle it
  }
  return {};
}

export async function signInWithGoogleAction(formData: FormData) {
  const callbackUrl = safeCallbackUrl(
    formData.get("callbackUrl") as string | null,
  );
  await signIn("google", { redirectTo: callbackUrl });
}
