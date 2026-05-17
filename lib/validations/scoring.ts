import { z } from "zod";

export const matchScoreSchema = z.object({
  matchId: z.string().min(1),
  team1Score: z.coerce
    .number()
    .int({ message: "Scores must be whole numbers" })
    .min(0, { message: "Scores can't be negative" }),
  team2Score: z.coerce
    .number()
    .int({ message: "Scores must be whole numbers" })
    .min(0, { message: "Scores can't be negative" }),
});

export type MatchScoreInput = z.infer<typeof matchScoreSchema>;

export const matchIdSchema = z.object({ matchId: z.string().min(1) });
