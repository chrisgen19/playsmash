import { z } from "zod";

import { PlayerStatus } from "@/lib/db";

export const createTempPlayerSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, { message: "Name is required" })
    .max(80, { message: "Name is too long" }),
  skillLevel: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === "") return undefined;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : undefined;
    })
    .refine((v) => v === undefined || (v >= 0 && v <= 10), {
      message: "Skill must be between 0 and 10",
    }),
});

export type CreateTempPlayerInput = z.infer<typeof createTempPlayerSchema>;

export const editPlayerSchema = z.object({
  playerId: z.string().min(1),
  displayName: z
    .string()
    .trim()
    .min(1, { message: "Name is required" })
    .max(80),
  skillLevel: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === "") return undefined;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : undefined;
    })
    .refine((v) => v === undefined || (v >= 0 && v <= 10), {
      message: "Skill must be between 0 and 10",
    }),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

export type EditPlayerInput = z.infer<typeof editPlayerSchema>;

// TEMPORARY is deliberately excluded — it means "account-less profile" and
// is only ever set at creation time (createTempPlayer). Allowing it here
// would let a linked player (userId != null) be flipped to TEMPORARY,
// an inconsistent state. The service layer enforces the same rule.
export const setPlayerStatusSchema = z.object({
  playerId: z.string().min(1),
  status: z.enum([
    PlayerStatus.ACTIVE,
    PlayerStatus.INACTIVE,
    PlayerStatus.REMOVED,
  ]),
});

export const linkTempPlayerSchema = z.object({
  playerId: z.string().min(1),
  targetUserId: z.string().min(1),
});
