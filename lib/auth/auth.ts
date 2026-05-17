import { PrismaAdapter } from "@auth/prisma-adapter";
import type { PrismaClient as AdapterPrismaClient } from "@prisma/client/extension";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { prisma } from "@/lib/db/prisma";
import { loginSchema } from "@/lib/validations/auth";

import { authConfig } from "./auth.config";
import { verifyPassword } from "./password";

const googleProvider =
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
    ? [
        Google({
          clientId: process.env.AUTH_GOOGLE_ID,
          clientSecret: process.env.AUTH_GOOGLE_SECRET,
          allowDangerousEmailAccountLinking: true,
        }),
      ]
    : [];

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // PrismaAdapter persists OAuth User+Account+VerificationToken rows.
  // Credentials sign-ins don't touch the adapter — they get their User row
  // from the explicit `registerAction`, so they coexist safely.
  // The cast bridges Prisma 7's project-local generated client to the
  // legacy client shape the adapter is typed against.
  adapter: PrismaAdapter(prisma as unknown as AdapterPrismaClient),
  providers: [
    ...googleProvider,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = loginSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            passwordHash: true,
          },
        });
        if (!user?.passwordHash) return null;

        const ok = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
});
