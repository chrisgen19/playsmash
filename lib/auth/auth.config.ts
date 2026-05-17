import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Edge-safe Auth.js config. Anything that touches Prisma or Node-only APIs
 * (bcrypt, the pg driver) lives in `auth.ts`, not here. Imported by `proxy.ts`.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  providers: [
    // Credentials provider is registered in auth.ts (it needs Prisma + bcrypt).
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
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
