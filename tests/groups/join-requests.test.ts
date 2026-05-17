import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  GroupMemberStatus,
  GroupStatus,
  GroupVisibility,
  JoinRequestStatus,
} from "@/lib/db/generated/enums";

/** Stand-in for Prisma's known-request error — requestToJoin catches P2002. */
class FakeKnownRequestError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "PrismaClientKnownRequestError";
  }
}

const { prismaMock, txMocks } = vi.hoisted(() => {
  const txMocks = {
    $queryRaw: vi.fn(),
    group: { findUnique: vi.fn() },
    groupMember: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    joinRequest: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    playerProfile: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    activityLog: { create: vi.fn() },
  };
  const prismaMock = {
    joinRequest: { findUnique: vi.fn() },
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

const {
  requestToJoin,
  approveJoinRequest,
  rejectJoinRequest,
  JoinRequestError,
} = await import("@/lib/groups/join-requests");
const { NotFoundError } = await import("@/lib/permissions/errors");

const publicGroup = {
  visibility: GroupVisibility.PUBLIC,
  status: GroupStatus.ACTIVE,
};

describe("requestToJoin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // All checks now run inside the tx via the tx mocks.
    txMocks.group.findUnique.mockResolvedValue(publicGroup);
    txMocks.groupMember.findUnique.mockResolvedValue(null);
    txMocks.joinRequest.findUnique.mockResolvedValue(null);
    txMocks.joinRequest.create.mockResolvedValue({ id: "jr_new" });
    txMocks.joinRequest.update.mockResolvedValue({ id: "jr_existing" });
  });

  it("creates a pending request for a public group", async () => {
    await requestToJoin({ groupId: "g_1", userId: "u_1" });
    expect(txMocks.joinRequest.create).toHaveBeenCalledWith({
      data: {
        groupId: "g_1",
        userId: "u_1",
        status: JoinRequestStatus.PENDING,
      },
      select: { id: true },
    });
    // Activity log targets the JoinRequest id, not the user id.
    expect(txMocks.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        targetType: "JoinRequest",
        targetId: "jr_new",
      }),
    });
  });

  it("revives a prior rejected request rather than duplicating", async () => {
    txMocks.joinRequest.findUnique.mockResolvedValue({
      id: "jr_existing",
      status: JoinRequestStatus.REJECTED,
    });
    await requestToJoin({ groupId: "g_1", userId: "u_1" });
    expect(txMocks.joinRequest.update).toHaveBeenCalledWith({
      where: { id: "jr_existing" },
      data: { status: JoinRequestStatus.PENDING },
      select: { id: true },
    });
    expect(txMocks.joinRequest.create).not.toHaveBeenCalled();
  });

  it("rejects a non-public group", async () => {
    txMocks.group.findUnique.mockResolvedValue({
      ...publicGroup,
      visibility: GroupVisibility.INVITE_ONLY,
    });
    await expect(
      requestToJoin({ groupId: "g_1", userId: "u_1" }),
    ).rejects.toMatchObject({ code: "NOT_PUBLIC" });
  });

  it("rejects an archived group", async () => {
    txMocks.group.findUnique.mockResolvedValue({
      ...publicGroup,
      status: GroupStatus.ARCHIVED,
    });
    await expect(
      requestToJoin({ groupId: "g_1", userId: "u_1" }),
    ).rejects.toMatchObject({ code: "GROUP_ARCHIVED" });
  });

  it("rejects when already an active member", async () => {
    txMocks.groupMember.findUnique.mockResolvedValue({
      status: GroupMemberStatus.ACTIVE,
    });
    await expect(
      requestToJoin({ groupId: "g_1", userId: "u_1" }),
    ).rejects.toMatchObject({ code: "ALREADY_MEMBER" });
  });

  it("rejects a banned user", async () => {
    txMocks.groupMember.findUnique.mockResolvedValue({
      status: GroupMemberStatus.BANNED,
    });
    await expect(
      requestToJoin({ groupId: "g_1", userId: "u_1" }),
    ).rejects.toMatchObject({ code: "BANNED" });
  });

  it("rejects when a request is already pending", async () => {
    txMocks.joinRequest.findUnique.mockResolvedValue({
      id: "jr_existing",
      status: JoinRequestStatus.PENDING,
    });
    await expect(
      requestToJoin({ groupId: "g_1", userId: "u_1" }),
    ).rejects.toMatchObject({ code: "ALREADY_PENDING" });
  });
});

describe("approveJoinRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.joinRequest.findUnique.mockResolvedValue({ groupId: "g_1" });
    txMocks.$queryRaw.mockResolvedValue([
      { status: JoinRequestStatus.PENDING },
    ]);
    txMocks.group.findUnique.mockResolvedValue({
      status: GroupStatus.ACTIVE,
    });
    txMocks.joinRequest.findUniqueOrThrow.mockResolvedValue({
      userId: "u_1",
      user: { name: "Pat Player", email: "pat@x.com" },
    });
    txMocks.groupMember.findUnique.mockResolvedValue(null);
    txMocks.playerProfile.findUnique.mockResolvedValue(null);
  });

  it("creates a PLAYER membership + profile + flips the request", async () => {
    await approveJoinRequest({
      groupId: "g_1",
      actorUserId: "u_admin",
      requestId: "jr_1",
    });
    expect(txMocks.joinRequest.update).toHaveBeenCalledWith({
      where: { id: "jr_1" },
      data: { status: JoinRequestStatus.APPROVED },
    });
    expect(txMocks.groupMember.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        groupId: "g_1",
        userId: "u_1",
        role: "PLAYER",
        status: GroupMemberStatus.ACTIVE,
      }),
    });
    expect(txMocks.playerProfile.create).toHaveBeenCalled();
  });

  it("rejects approval when the user was BANNED after requesting (cannot silently unban)", async () => {
    txMocks.groupMember.findUnique.mockResolvedValue({
      id: "m_1",
      role: "PLAYER",
      status: GroupMemberStatus.BANNED,
    });
    await expect(
      approveJoinRequest({
        groupId: "g_1",
        actorUserId: "u_admin",
        requestId: "jr_1",
      }),
    ).rejects.toMatchObject({ code: "MEMBER_BANNED" });
    // No membership/profile/request writes happen before the throw.
    expect(txMocks.joinRequest.update).not.toHaveBeenCalled();
    expect(txMocks.groupMember.update).not.toHaveBeenCalled();
    expect(txMocks.groupMember.create).not.toHaveBeenCalled();
  });

  it("is idempotent when the user is already ACTIVE — flips request, no membership write", async () => {
    txMocks.groupMember.findUnique.mockResolvedValue({
      id: "m_1",
      role: "ADMIN", // an admin who's already in the group
      status: GroupMemberStatus.ACTIVE,
    });
    txMocks.playerProfile.findUnique.mockResolvedValue({
      id: "pp_1",
      status: "ACTIVE",
    });
    await approveJoinRequest({
      groupId: "g_1",
      actorUserId: "u_admin",
      requestId: "jr_1",
    });
    expect(txMocks.joinRequest.update).toHaveBeenCalledWith({
      where: { id: "jr_1" },
      data: { status: JoinRequestStatus.APPROVED },
    });
    // The existing ADMIN must NOT be silently demoted to PLAYER or "re-joined".
    expect(txMocks.groupMember.update).not.toHaveBeenCalled();
    expect(txMocks.groupMember.create).not.toHaveBeenCalled();
  });

  it("revives a LEFT/REMOVED member as PLAYER on approval", async () => {
    txMocks.groupMember.findUnique.mockResolvedValue({
      id: "m_left",
      role: "PLAYER",
      status: GroupMemberStatus.LEFT,
    });
    await approveJoinRequest({
      groupId: "g_1",
      actorUserId: "u_admin",
      requestId: "jr_1",
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

  it("locks the request row with SELECT ... FOR UPDATE", async () => {
    await approveJoinRequest({
      groupId: "g_1",
      actorUserId: "u_admin",
      requestId: "jr_1",
    });
    const sql = (txMocks.$queryRaw.mock.calls[0]?.[0] as string[]).join("?");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain('"JoinRequest"');
  });

  it("rejects a request from another group (pre-tx)", async () => {
    prismaMock.joinRequest.findUnique.mockResolvedValue({
      groupId: "g_OTHER",
    });
    await expect(
      approveJoinRequest({
        groupId: "g_1",
        actorUserId: "u_admin",
        requestId: "jr_1",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("aborts when the request is no longer pending under the lock (race)", async () => {
    txMocks.$queryRaw.mockResolvedValue([
      { status: JoinRequestStatus.APPROVED },
    ]);
    await expect(
      approveJoinRequest({
        groupId: "g_1",
        actorUserId: "u_admin",
        requestId: "jr_1",
      }),
    ).rejects.toMatchObject({ code: "REQUEST_NOT_PENDING" });
    expect(txMocks.joinRequest.update).not.toHaveBeenCalled();
  });

  it("aborts when the group is archived (re-checked in-tx)", async () => {
    txMocks.group.findUnique.mockResolvedValue({
      status: GroupStatus.ARCHIVED,
    });
    await expect(
      approveJoinRequest({
        groupId: "g_1",
        actorUserId: "u_admin",
        requestId: "jr_1",
      }),
    ).rejects.toMatchObject({ code: "GROUP_ARCHIVED" });
  });
});

describe("rejectJoinRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.joinRequest.findUnique.mockResolvedValue({ groupId: "g_1" });
    txMocks.$queryRaw.mockResolvedValue([
      { status: JoinRequestStatus.PENDING },
    ]);
    txMocks.joinRequest.findUniqueOrThrow.mockResolvedValue({ userId: "u_1" });
  });

  it("flips a pending request to REJECTED", async () => {
    await rejectJoinRequest({
      groupId: "g_1",
      actorUserId: "u_admin",
      requestId: "jr_1",
    });
    expect(txMocks.joinRequest.update).toHaveBeenCalledWith({
      where: { id: "jr_1" },
      data: { status: JoinRequestStatus.REJECTED },
    });
    expect(JoinRequestError).toBeDefined();
  });

  it("aborts a non-pending request under the lock", async () => {
    txMocks.$queryRaw.mockResolvedValue([
      { status: JoinRequestStatus.REJECTED },
    ]);
    await expect(
      rejectJoinRequest({
        groupId: "g_1",
        actorUserId: "u_admin",
        requestId: "jr_1",
      }),
    ).rejects.toMatchObject({ code: "REQUEST_NOT_PENDING" });
  });

  it("rejects a request from another group (pre-tx)", async () => {
    prismaMock.joinRequest.findUnique.mockResolvedValue({
      groupId: "g_OTHER",
    });
    await expect(
      rejectJoinRequest({
        groupId: "g_1",
        actorUserId: "u_admin",
        requestId: "jr_1",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
