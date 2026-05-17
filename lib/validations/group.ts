import { z } from "zod";

import { GroupVisibility } from "@/lib/db";

export const createGroupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Group name must be at least 2 characters" })
    .max(80),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  visibility: z
    .enum([
      GroupVisibility.PRIVATE,
      GroupVisibility.INVITE_ONLY,
      GroupVisibility.PUBLIC,
    ])
    .default(GroupVisibility.INVITE_ONLY),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const joinGroupSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(4, { message: "Join code is required" })
    .max(16),
});

export type JoinGroupInput = z.infer<typeof joinGroupSchema>;
