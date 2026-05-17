import { Prisma, prisma } from "@/lib/db";

/**
 * Stable enum of all activity actions written anywhere in the app.
 * Adding a new entry here is the contract — UI/filters can rely on it.
 * Format: "<targetType>.<verb>".
 */
export const ActivityAction = {
  // group lifecycle
  GROUP_CREATED: "group.created",
  GROUP_JOIN_CODE_REGENERATED: "group.join_code_regenerated",
  // members
  MEMBER_JOINED: "member.joined",
  MEMBER_ROLE_CHANGED: "member.role_changed",
  MEMBER_REMOVED: "member.removed",
  // players
  PLAYER_CREATED_TEMP: "player.created_temp",
  PLAYER_UPDATED: "player.updated",
  PLAYER_STATUS_CHANGED: "player.status_changed",
  PLAYER_LINKED_TO_USER: "player.linked_to_user",
  PLAYER_REMOVED: "player.removed",
  // invites
  INVITE_DISABLED: "invite.disabled",
} as const;

export type ActivityActionValue =
  (typeof ActivityAction)[keyof typeof ActivityAction];

export type ActivityTargetType =
  | "Group"
  | "GroupMember"
  | "PlayerProfile"
  | "Invite";

export type LogActivityInput = {
  groupId: string;
  userId: string | null;
  action: ActivityActionValue;
  targetType: ActivityTargetType;
  targetId: string;
  oldValue?: Prisma.InputJsonValue | null;
  newValue?: Prisma.InputJsonValue | null;
};

/**
 * Minimal contract the writer actually uses — lets transaction `tx` objects
 * and unit-test stubs satisfy this without typing every Prisma delegate
 * method. The real prisma client + interactive-tx client both fit.
 */
type ActivityLogWriter = {
  activityLog: {
    create: (args: {
      data: {
        groupId: string;
        userId: string | null;
        action: string;
        targetType: string;
        targetId: string;
        oldValue?: Prisma.InputJsonValue;
        newValue?: Prisma.InputJsonValue;
      };
    }) => Promise<unknown>;
  };
};

/**
 * Write a single ActivityLog row. Pass a `tx` when calling from inside a
 * Prisma `$transaction` so the log lives or dies with the surrounding writes.
 */
export async function logActivity(
  input: LogActivityInput,
  tx: ActivityLogWriter = prisma,
): Promise<void> {
  await tx.activityLog.create({
    data: {
      groupId: input.groupId,
      userId: input.userId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      oldValue: input.oldValue ?? undefined,
      newValue: input.newValue ?? undefined,
    },
  });
}
