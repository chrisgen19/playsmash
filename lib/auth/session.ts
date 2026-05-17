import { redirect } from "next/navigation";

import { auth } from "./auth";

export type CurrentUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
};

/** Returns the current session user if signed in, otherwise null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
  };
}

/**
 * Use inside Server Components and Server Actions that require a logged-in
 * user. Redirects to /login if no session is present.
 */
export async function requireUser(
  callbackUrl?: string,
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const target = callbackUrl
      ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : "/login";
    redirect(target);
  }
  return user;
}
