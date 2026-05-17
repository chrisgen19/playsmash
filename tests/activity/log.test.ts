import { beforeEach, describe, expect, it, vi } from "vitest";

const { activityLogCreate } = vi.hoisted(() => ({
  activityLogCreate: vi.fn(),
}));

vi.mock("@/lib/db", async () => {
  const enums = await vi.importActual<
    typeof import("@/lib/db/generated/enums")
  >("@/lib/db/generated/enums");
  return {
    ...enums,
    prisma: { activityLog: { create: activityLogCreate } },
    Prisma: {},
  };
});

const { logActivity, ActivityAction } = await import("@/lib/activity/log");

describe("logActivity", () => {
  beforeEach(() => vi.clearAllMocks());

  it("writes a single row with the supplied payload", async () => {
    activityLogCreate.mockResolvedValue({});
    await logActivity({
      groupId: "g_1",
      userId: "u_1",
      action: ActivityAction.MEMBER_JOINED,
      targetType: "GroupMember",
      targetId: "m_1",
      newValue: { role: "PLAYER" },
    });
    expect(activityLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        groupId: "g_1",
        userId: "u_1",
        action: "member.joined",
        targetType: "GroupMember",
        targetId: "m_1",
        newValue: { role: "PLAYER" },
      }),
    });
  });

  it("uses a passed-in tx instead of the global prisma", async () => {
    const txCreate = vi.fn().mockResolvedValue({});
    await logActivity(
      {
        groupId: "g_1",
        userId: null,
        action: ActivityAction.GROUP_CREATED,
        targetType: "Group",
        targetId: "g_1",
      },
      // Minimal writer shape — matches the ActivityLogWriter contract.
      { activityLog: { create: txCreate } } as Parameters<
        typeof logActivity
      >[1],
    );
    expect(txCreate).toHaveBeenCalledOnce();
    expect(activityLogCreate).not.toHaveBeenCalled();
  });
});
