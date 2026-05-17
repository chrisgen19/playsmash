import { z } from "zod";

import { ScoringType } from "@/lib/db";

export const createSessionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Session name must be at least 2 characters" })
    .max(120),
  // Date-only or datetime-local string from the form; coerced to a Date.
  date: z.coerce.date({ message: "Pick a valid date" }),
  location: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  numberOfCourts: z.coerce
    .number()
    .int({ message: "Courts must be a whole number" })
    .min(1, { message: "At least 1 court" })
    .max(20, { message: "At most 20 courts" }),
  scoringType: z
    .enum([ScoringType.RALLY, ScoringType.SIDE_OUT, ScoringType.CUSTOM])
    .default(ScoringType.RALLY),
  pointsToWin: z.coerce
    .number()
    .int()
    .min(1, { message: "Points to win must be at least 1" })
    .max(99)
    .default(11),
  winByTwo: z.coerce.boolean().default(true),
  // PlayerProfile ids selected as available for this session.
  playerIds: z.array(z.string().min(1)).default([]),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;

export const setAttendanceSchema = z.object({
  sessionId: z.string().min(1),
  playerIds: z.array(z.string().min(1)).default([]),
});

export type SetAttendanceInput = z.infer<typeof setAttendanceSchema>;
