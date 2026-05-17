// Single import surface for Prisma client + enums + model types.
// Use `@/lib/db` everywhere instead of pointing at the generated folder.

export { prisma } from "./prisma";
export {
  GroupVisibility,
  GroupStatus,
  GroupRole,
  GroupMemberStatus,
  PlayerStatus,
  InviteStatus,
  JoinRequestStatus,
  ScoringType,
  PlaySessionStatus,
  CourtStatus,
  SessionPlayerStatus,
  WinningTeam,
  MatchStatus,
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
  PlaySession,
  Court,
  SessionPlayer,
  Match,
} from "./generated/client";
