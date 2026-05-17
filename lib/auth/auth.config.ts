import type { NextAuthConfig } from "next-auth";

import { isVerifiedOAuthProfile } from "./oauth-verification";

/**
 * Edge-safe Auth.js config — used by `proxy.ts` (Next 16 middleware).
 *
 * Providers and the Prisma adapter live in `auth.ts` because they touch
 * Node-only APIs (bcrypt, the pg driver, the OAuth User upsert path).
 * Keeping this file provider-free guarantees the edge bundle never imports
 * Prisma and that OAuth users get persisted via the adapter when they
 * sign in through the full server-side handler.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    signIn({ account, profile }) {
      if (account?.provider === "google") {
        return isVerifiedOAuthProfile(profile);
      }
      return true;
    },
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const path = request.nextUrl.pathname;
      const isProtected =
        path.startsWith("/dashboard") || path.startsWith("/groups");
      if (isProtected && !isLoggedIn) {
        const signIn = new URL("/login", request.nextUrl);
        signIn.searchParams.set("callbackUrl", path + request.nextUrl.search);
        return Response.redirect(signIn);
      }
      return true;
    },
    jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.id === "string") {
        session.user.id = token.id;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
