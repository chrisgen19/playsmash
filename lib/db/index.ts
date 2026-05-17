// Single import surface for Prisma client + enums + model types.
// Use `@/lib/db` everywhere instead of pointing at the generated folder.

export { prisma } from "./prisma";
export {
  GroupVisibility,
  GroupRole,
  GroupMemberStatus,
  PlayerStatus,
  InviteStatus,
  JoinRequestStatus,
} from "./generated/enums";
export { Prisma } from "./generated/client";
export type {
  User,
  Group,
  GroupMember,
  PlayerProfile,
  Invite,
  JoinRequest,
  ActivityLog,
} from "./generated/client";
