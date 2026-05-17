import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  GroupMemberStatus,
  GroupStatus,
  GroupVisibility,
  JoinRequestStatus,
} from "@/lib/db/generated/enums";

const { prismaMock, txMocks } = vi.hoisted(() => {
  const txMocks = {
    joinRequest: { create: vi.fn(), update: vi.fn() },
    groupMember: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    playerProfile: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    activityLog: { create: vi.fn() },
  };
  const prismaMock = {
    group: { findUnique: vi.fn() },
    groupMember: { findUnique: vi.fn() },
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
  return { ...enums, prisma: prismaMock, Prisma: {} };
});

const {
  requestToJoin,
  approveJoinRequest,
  rejectJoinRequest,
  JoinRequestError,
} = await import("@/lib/groups/join-requests");
const { NotFoundError } = await import("@/lib/permissions/errors");

const publicGroup = {
  id: "g_1",
  visibility: GroupVisibility.PUBLIC,
  status: GroupStatus.ACTIVE,
};

describe("requestToJoin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.group.findUnique.mockResolvedValue(publicGroup);
    prismaMock.groupMember.findUnique.mockResolvedValue(null);
    prismaMock.joinRequest.findUnique.mockResolvedValue(null);
  });

  it("creates a pending request for a public group", async () => {
    await requestToJoin({ groupId: "g_1", userId: "u_1" });
    expect(txMocks.joinRequest.create).toHaveBeenCalledWith({
      data: {
        groupId: "g_1",
        userId: "u_1",
        status: JoinRequestStatus.PENDING,
      },
    });
  });

  it("revives a prior rejected request rather than duplicating", async () => {
    prismaMock.joinRequest.findUnique.mockResolvedValue({
      id: "jr_1",
      status: JoinRequestStatus.REJECTED,
    });
    await requestToJoin({ groupId: "g_1", userId: "u_1" });
    expect(txMocks.joinRequest.update).toHaveBeenCalledWith({
      where: { id: "jr_1" },
      data: { status: JoinRequestStatus.PENDING },
    });
    expect(txMocks.joinRequest.create).not.toHaveBeenCalled();
  });

  it("rejects a non-public group", async () => {
    prismaMock.group.findUnique.mockResolvedValue({
      ...publicGroup,
      visibility: GroupVisibility.INVITE_ONLY,
    });
    await expect(
      requestToJoin({ groupId: "g_1", userId: "u_1" }),
    ).rejects.toMatchObject({ code: "NOT_PUBLIC" });
  });

  it("rejects an archived group", async () => {
    prismaMock.group.findUnique.mockResolvedValue({
      ...publicGroup,
      status: GroupStatus.ARCHIVED,
    });
    await expect(
      requestToJoin({ groupId: "g_1", userId: "u_1" }),
    ).rejects.toMatchObject({ code: "GROUP_ARCHIVED" });
  });

  it("rejects when already an active member", async () => {
    prismaMock.groupMember.findUnique.mockResolvedValue({
      status: GroupMemberStatus.ACTIVE,
    });
    await expect(
      requestToJoin({ groupId: "g_1", userId: "u_1" }),
    ).rejects.toMatchObject({ code: "ALREADY_MEMBER" });
  });

  it("rejects a banned user", async () => {
    prismaMock.groupMember.findUnique.mockResolvedValue({
      status: GroupMemberStatus.BANNED,
    });
    await expect(
      requestToJoin({ groupId: "g_1", userId: "u_1" }),
    ).rejects.toMatchObject({ code: "BANNED" });
  });

  it("rejects when a request is already pending", async () => {
    prismaMock.joinRequest.findUnique.mockResolvedValue({
      id: "jr_1",
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
    prismaMock.joinRequest.findUnique.mockResolvedValue({
      id: "jr_1",
      groupId: "g_1",
      userId: "u_1",
      status: JoinRequestStatus.PENDING,
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

  it("rejects a request from another group", async () => {
    prismaMock.joinRequest.findUnique.mockResolvedValue({
      id: "jr_1",
      groupId: "g_OTHER",
      userId: "u_1",
      status: JoinRequestStatus.PENDING,
      user: { name: "Pat", email: "pat@x.com" },
    });
    await expect(
      approveJoinRequest({
        groupId: "g_1",
        actorUserId: "u_admin",
        requestId: "jr_1",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects a non-pending request", async () => {
    prismaMock.joinRequest.findUnique.mockResolvedValue({
      id: "jr_1",
      groupId: "g_1",
      userId: "u_1",
      status: JoinRequestStatus.APPROVED,
      user: { name: "Pat", email: "pat@x.com" },
    });
    await expect(
      approveJoinRequest({
        groupId: "g_1",
        actorUserId: "u_admin",
        requestId: "jr_1",
      }),
    ).rejects.toMatchObject({ code: "REQUEST_NOT_PENDING" });
  });
});

describe("rejectJoinRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.joinRequest.findUnique.mockResolvedValue({
      id: "jr_1",
      groupId: "g_1",
      userId: "u_1",
      status: JoinRequestStatus.PENDING,
    });
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

  it("rejects a non-pending request", async () => {
    prismaMock.joinRequest.findUnique.mockResolvedValue({
      id: "jr_1",
      groupId: "g_1",
      userId: "u_1",
      status: JoinRequestStatus.REJECTED,
    });
    await expect(
      rejectJoinRequest({
        groupId: "g_1",
        actorUserId: "u_admin",
        requestId: "jr_1",
      }),
    ).rejects.toMatchObject({ code: "REQUEST_NOT_PENDING" });
  });
});
