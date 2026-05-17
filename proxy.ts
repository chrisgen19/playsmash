// Next.js 16 renamed `middleware.ts` to `proxy.ts`; same execution model.
// We run only the edge-safe auth config here so Prisma/bcrypt never load
// on the edge runtime.
import NextAuth from "next-auth";

import { authConfig } from "@/lib/auth/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // Skip Next internals and static assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
