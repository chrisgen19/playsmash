import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  GroupMemberStatus,
  InviteStatus,
  PlayerStatus,
} from "@/lib/db/generated/enums";

const { prismaMock, txMocks } = vi.hoisted(() => {
  const txMocks = {
    invite: { update: vi.fn() },
    groupMember: { update: vi.fn(), create: vi.fn() },
    playerProfile: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    activityLog: { create: vi.fn() },
  };
  const prismaMock = {
    invite: { findUnique: vi.fn() },
    groupMember: { findUnique: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: typeof txMocks) => unknown) =>
      fn(txMocks),
    ),
  };
  return { prismaMock, txMocks };
});

vi.mock("@/lib/db", async () => {
  const enums = await vi.importActual<
    typeof import("@/lib/db/generated/enums")
  >("@/lib/db/generated/enums");
  return { ...enums, prisma: prismaMock, Prisma: {} };
});

const { joinGroupByCode, JoinGroupError } = await import(
  "@/lib/groups/join-group"
);

describe("joinGroupByCode", () => {
  const baseInvite = {
    id: "inv_1",
    groupId: "g_1",
    status: InviteStatus.ACTIVE,
    expiresAt: null,
    maxUses: null,
    usedCount: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.invite.findUnique.mockResolvedValue(baseInvite);
    prismaMock.groupMember.findUnique.mockResolvedValue(null);
    txMocks.playerProfile.findUnique.mockResolvedValue(null);
  });

  it("creates a PLAYER member + linked profile + activity log", async () => {
    const result = await joinGroupByCode({
      userId: "u_1",
      userName: "Alice",
      userEmail: "alice@x.com",
      code: "abc123",
    });
    expect(result).toEqual({ groupId: "g_1", alreadyMember: false });
    expect(prismaMock.invite.findUnique).toHaveBeenCalledWith({
      where: { code: "ABC123" },
      select: expect.any(Object),
    });
    expect(txMocks.invite.update).toHaveBeenCalledWith({
      where: { id: "inv_1" },
      data: { usedCount: { increment: 1 } },
    });
    expect(txMocks.groupMember.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        groupId: "g_1",
        userId: "u_1",
        role: "PLAYER",
        status: GroupMemberStatus.ACTIVE,
      }),
    });
    expect(txMocks.playerProfile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        groupId: "g_1",
        userId: "u_1",
        displayName: "Alice",
      }),
    });
    expect(txMocks.activityLog.create).toHaveBeenCalled();
  });

  it("is idempotent when user is already ACTIVE", async () => {
    prismaMock.groupMember.findUnique.mockResolvedValue({
      id: "m_1",
      status: GroupMemberStatus.ACTIVE,
    });
    const result = await joinGroupByCode({
      userId: "u_1",
      userName: "Alice",
      userEmail: "alice@x.com",
      code: "ABC123",
    });
    expect(result).toEqual({ groupId: "g_1", alreadyMember: true });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("revives a LEFT member instead of creating a new row", async () => {
    prismaMock.groupMember.findUnique.mockResolvedValue({
      id: "m_left",
      status: GroupMemberStatus.LEFT,
    });
    await joinGroupByCode({
      userId: "u_1",
      userName: "Alice",
      userEmail: "alice@x.com",
      code: "ABC123",
    });
    expect(txMocks.groupMember.update).toHaveBeenCalledWith({
      where: { id: "m_left" },
      data: expect.objectContaining({
        role: "PLAYER",
        status: GroupMemberStatus.ACTIVE,
      }),
    });
    expect(txMocks.groupMember.create).not.toHaveBeenCalled();
  });

  it("rejects a BANNED user", async () => {
    prismaMock.groupMember.findUnique.mockResolvedValue({
      id: "m_b",
      status: GroupMemberStatus.BANNED,
    });
    await expect(
      joinGroupByCode({
        userId: "u_1",
        userName: "A",
        userEmail: "a@x.com",
        code: "ABC123",
      }),
    ).rejects.toBeInstanceOf(JoinGroupError);
  });

  it.each([
    {
      label: "unknown code",
      invite: null,
      code: "CODE_INVALID",
    },
    {
      label: "disabled invite",
      invite: { ...baseInvite, status: InviteStatus.DISABLED },
      code: "CODE_DISABLED",
    },
    {
      label: "expired invite",
      invite: {
        ...baseInvite,
        expiresAt: new Date(Date.now() - 1_000),
      },
      code: "CODE_EXPIRED",
    },
    {
      label: "max uses reached",
      invite: { ...baseInvite, maxUses: 1, usedCount: 1 },
      code: "CODE_MAX_USES",
    },
  ])("rejects with $code when $label", async ({ invite, code }) => {
    prismaMock.invite.findUnique.mockResolvedValue(invite);
    await expect(
      joinGroupByCode({
        userId: "u_1",
        userName: "A",
        userEmail: "a@x.com",
        code: "ABC123",
      }),
    ).rejects.toMatchObject({ code });
  });

  it("revives a REMOVED player profile instead of erroring on the unique constraint", async () => {
    txMocks.playerProfile.findUnique.mockResolvedValue({
      id: "pp_1",
      status: PlayerStatus.REMOVED,
    });
    await joinGroupByCode({
      userId: "u_1",
      userName: "Alice",
      userEmail: "alice@x.com",
      code: "ABC123",
    });
    expect(txMocks.playerProfile.update).toHaveBeenCalledWith({
      where: { id: "pp_1" },
      data: { status: PlayerStatus.ACTIVE },
    });
    expect(txMocks.playerProfile.create).not.toHaveBeenCalled();
  });
});
