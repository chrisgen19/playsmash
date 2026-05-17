import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/client";

// Prisma 7 requires a driver adapter at runtime; the `url` lives in prisma.config.ts
// for the CLI/Migrate, and here for the runtime client.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Add it to .env (see .env.example).",
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
