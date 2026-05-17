import { z } from "zod";

import { GroupRole } from "@/lib/db";

export const changeRoleSchema = z.object({
  memberId: z.string().min(1),
  // Owner promotion handled by Phase 8 transfer-ownership flow, not here.
  role: z.enum([GroupRole.ADMIN, GroupRole.PLAYER, GroupRole.VIEWER]),
});

export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;
