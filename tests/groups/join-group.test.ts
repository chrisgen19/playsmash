import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  GroupMemberStatus,
  InviteStatus,
  PlayerStatus,
} from "@/lib/db/generated/enums";

/** Stand-in for Prisma's PrismaClientKnownRequestError used by the P2002 path. */
class FakeKnownRequestError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "PrismaClientKnownRequestError";
  }
}

const { prismaMock, txMocks } = vi.hoisted(() => {
  const txMocks = {
    $queryRaw: vi.fn(),
    invite: { update: vi.fn() },
    group: { findUnique: vi.fn() },
    groupMember: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    playerProfile: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    activityLog: { create: vi.fn() },
  };
  const prismaMock = {
    invite: { findUnique: vi.fn() },
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
  return {
    ...enums,
    prisma: prismaMock,
    Prisma: { PrismaClientKnownRequestError: FakeKnownRequestError },
  };
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
    // The locking SELECT ... FOR UPDATE returns the invite row.
    txMocks.$queryRaw.mockResolvedValue([baseInvite]);
    // The group's archived-status re-check defaults to an active group.
    txMocks.group.findUnique.mockResolvedValue({ status: "ACTIVE" });
    txMocks.groupMember.findUnique.mockResolvedValue(null);
    txMocks.playerProfile.findUnique.mockResolvedValue(null);
  });

  it("locks the invite row with SELECT ... FOR UPDATE inside the transaction", async () => {
    await joinGroupByCode({
      userId: "u_1",
      userName: "Alice",
      userEmail: "alice@x.com",
      code: "abc123",
    });
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    // The raw query is a tagged template — first arg is the SQL string parts.
    const sql = (txMocks.$queryRaw.mock.calls[0][0] as string[]).join("?");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain('"Invite"');
  });

  it("creates a PLAYER member + linked profile + activity log", async () => {
    const result = await joinGroupByCode({
      userId: "u_1",
      userName: "Alice",
      userEmail: "alice@x.com",
      code: "abc123",
    });
    expect(result).toEqual({ groupId: "g_1", alreadyMember: false });
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

  it("is idempotent when user is already ACTIVE — no invite use consumed", async () => {
    txMocks.groupMember.findUnique.mockResolvedValue({
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
    expect(txMocks.invite.update).not.toHaveBeenCalled();
    expect(txMocks.groupMember.create).not.toHaveBeenCalled();
  });

  it("revives a LEFT member instead of creating a new row", async () => {
    txMocks.groupMember.findUnique.mockResolvedValue({
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
    txMocks.groupMember.findUnique.mockResolvedValue({
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
    expect(txMocks.invite.update).not.toHaveBeenCalled();
  });

  it("rejects joining an archived group even with a live invite", async () => {
    txMocks.group.findUnique.mockResolvedValue({ status: "ARCHIVED" });
    await expect(
      joinGroupByCode({
        userId: "u_1",
        userName: "A",
        userEmail: "a@x.com",
        code: "ABC123",
      }),
    ).rejects.toMatchObject({ code: "GROUP_ARCHIVED" });
    expect(txMocks.invite.update).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: "unknown code",
      rows: [] as unknown[],
      code: "CODE_INVALID",
    },
    {
      label: "disabled invite",
      rows: [{ ...baseInvite, status: InviteStatus.DISABLED }],
      code: "CODE_DISABLED",
    },
    {
      label: "expired invite",
      rows: [{ ...baseInvite, expiresAt: new Date(Date.now() - 1_000) }],
      code: "CODE_EXPIRED",
    },
    {
      label: "max uses reached",
      rows: [{ ...baseInvite, maxUses: 1, usedCount: 1 }],
      code: "CODE_MAX_USES",
    },
  ])("rejects with $code when $label", async ({ rows, code }) => {
    txMocks.$queryRaw.mockResolvedValue(rows);
    await expect(
      joinGroupByCode({
        userId: "u_1",
        userName: "A",
        userEmail: "a@x.com",
        code: "ABC123",
      }),
    ).rejects.toMatchObject({ code });
    expect(txMocks.invite.update).not.toHaveBeenCalled();
  });

  it("revives a REMOVED player profile instead of creating a duplicate", async () => {
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

  it("treats a P2002 unique-conflict (concurrent first-join) as already-member", async () => {
    // Simulate the lost race: member.create throws the unique-constraint error.
    txMocks.groupMember.create.mockRejectedValue(
      new FakeKnownRequestError("P2002"),
    );
    prismaMock.invite.findUnique.mockResolvedValue({ groupId: "g_1" });

    const result = await joinGroupByCode({
      userId: "u_1",
      userName: "Alice",
      userEmail: "alice@x.com",
      code: "ABC123",
    });
    expect(result).toEqual({ groupId: "g_1", alreadyMember: true });
  });
});
