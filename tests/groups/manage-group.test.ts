import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  GroupMemberStatus,
  GroupRole,
  GroupStatus,
} from "@/lib/db/generated/enums";

const { prismaMock, txMocks } = vi.hoisted(() => {
  const txMocks = {
    $queryRaw: vi.fn(),
    group: { update: vi.fn() },
    groupMember: { findUnique: vi.fn(), update: vi.fn() },
    activityLog: { create: vi.fn() },
  };
  const prismaMock = {
    group: { findUnique: vi.fn() },
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

const { editGroup, archiveGroup, transferOwnership, ManageGroupError } =
  await import("@/lib/groups/manage-group");
const { NotFoundError } = await import("@/lib/permissions/errors");

describe("editGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.group.findUnique.mockResolvedValue({
      id: "g_1",
      name: "Old",
      description: null,
      visibility: "INVITE_ONLY",
      status: GroupStatus.ACTIVE,
    });
  });

  it("updates fields and logs the change", async () => {
    await editGroup({
      groupId: "g_1",
      actorUserId: "u_owner",
      input: { name: "New Name", description: "hi", visibility: "PUBLIC" },
    });
    expect(txMocks.group.update).toHaveBeenCalledWith({
      where: { id: "g_1" },
      data: { name: "New Name", description: "hi", visibility: "PUBLIC" },
    });
    expect(txMocks.activityLog.create).toHaveBeenCalled();
  });

  it("rejects editing an archived group", async () => {
    prismaMock.group.findUnique.mockResolvedValue({
      id: "g_1",
      name: "Old",
      description: null,
      visibility: "INVITE_ONLY",
      status: GroupStatus.ARCHIVED,
    });
    await expect(
      editGroup({
        groupId: "g_1",
        actorUserId: "u_owner",
        input: { name: "x", description: undefined, visibility: "PUBLIC" },
      }),
    ).rejects.toMatchObject({ code: "GROUP_ARCHIVED" });
  });
});

describe("archiveGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMocks.$queryRaw.mockResolvedValue([{ status: GroupStatus.ACTIVE }]);
  });

  it("sets status ARCHIVED under a row lock", async () => {
    await archiveGroup({ groupId: "g_1", actorUserId: "u_owner" });
    const sql = (txMocks.$queryRaw.mock.calls[0]?.[0] as string[]).join("?");
    expect(sql).toContain("FOR UPDATE");
    expect(txMocks.group.update).toHaveBeenCalledWith({
      where: { id: "g_1" },
      data: expect.objectContaining({ status: GroupStatus.ARCHIVED }),
    });
  });

  it("rejects an already-archived group", async () => {
    txMocks.$queryRaw.mockResolvedValue([{ status: GroupStatus.ARCHIVED }]);
    await expect(
      archiveGroup({ groupId: "g_1", actorUserId: "u_owner" }),
    ).rejects.toMatchObject({ code: "ALREADY_ARCHIVED" });
  });

  it("throws NotFound when the group is gone", async () => {
    txMocks.$queryRaw.mockResolvedValue([]);
    await expect(
      archiveGroup({ groupId: "g_1", actorUserId: "u_owner" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("transferOwnership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMocks.$queryRaw.mockResolvedValue([{ status: GroupStatus.ACTIVE }]);
    // Target member (the new owner).
    prismaMock.groupMember.findUnique.mockResolvedValue({
      id: "m_target",
      groupId: "g_1",
      userId: "u_target",
      role: GroupRole.ADMIN,
      status: GroupMemberStatus.ACTIVE,
    });
    // Current owner lookup inside the tx.
    txMocks.groupMember.findUnique.mockResolvedValue({
      id: "m_owner",
      role: GroupRole.OWNER,
    });
  });

  it("demotes the owner to ADMIN and promotes the target to OWNER", async () => {
    await transferOwnership({
      groupId: "g_1",
      currentOwnerUserId: "u_owner",
      targetMemberId: "m_target",
    });
    expect(txMocks.groupMember.update).toHaveBeenCalledWith({
      where: { id: "m_owner" },
      data: { role: GroupRole.ADMIN },
    });
    expect(txMocks.groupMember.update).toHaveBeenCalledWith({
      where: { id: "m_target" },
      data: { role: GroupRole.OWNER },
    });
    expect(txMocks.group.update).toHaveBeenCalledWith({
      where: { id: "g_1" },
      data: { createdByUserId: "u_target" },
    });
  });

  it("rejects a target from another group", async () => {
    prismaMock.groupMember.findUnique.mockResolvedValue({
      id: "m_target",
      groupId: "g_OTHER",
      userId: "u_target",
      role: GroupRole.ADMIN,
      status: GroupMemberStatus.ACTIVE,
    });
    await expect(
      transferOwnership({
        groupId: "g_1",
        currentOwnerUserId: "u_owner",
        targetMemberId: "m_target",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects a non-active target", async () => {
    prismaMock.groupMember.findUnique.mockResolvedValue({
      id: "m_target",
      groupId: "g_1",
      userId: "u_target",
      role: GroupRole.PLAYER,
      status: GroupMemberStatus.REMOVED,
    });
    await expect(
      transferOwnership({
        groupId: "g_1",
        currentOwnerUserId: "u_owner",
        targetMemberId: "m_target",
      }),
    ).rejects.toMatchObject({ code: "TARGET_NOT_MEMBER" });
  });

  it("rejects transferring to the current owner", async () => {
    prismaMock.groupMember.findUnique.mockResolvedValue({
      id: "m_target",
      groupId: "g_1",
      userId: "u_target",
      role: GroupRole.OWNER,
      status: GroupMemberStatus.ACTIVE,
    });
    await expect(
      transferOwnership({
        groupId: "g_1",
        currentOwnerUserId: "u_owner",
        targetMemberId: "m_target",
      }),
    ).rejects.toMatchObject({ code: "TARGET_ALREADY_OWNER" });
  });

  it("aborts if the actor is no longer owner inside the lock (race)", async () => {
    txMocks.groupMember.findUnique.mockResolvedValue({
      id: "m_owner",
      role: GroupRole.ADMIN, // someone already transferred away
    });
    await expect(
      transferOwnership({
        groupId: "g_1",
        currentOwnerUserId: "u_owner",
        targetMemberId: "m_target",
      }),
    ).rejects.toBeInstanceOf(ManageGroupError);
  });
});
