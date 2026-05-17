import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  GroupMemberStatus,
  GroupRole,
  GroupStatus,
} from "@/lib/db/generated/enums";

const { prismaMock, txMocks } = vi.hoisted(() => {
  const txMocks = {
    $queryRaw: vi.fn(),
    group: { update: vi.fn(), findUniqueOrThrow: vi.fn() },
    groupMember: { findUnique: vi.fn(), update: vi.fn() },
    activityLog: { create: vi.fn() },
  };
  const prismaMock = {
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
    txMocks.$queryRaw.mockResolvedValue([{ status: GroupStatus.ACTIVE }]);
    txMocks.group.findUniqueOrThrow.mockResolvedValue({
      id: "g_1",
      name: "Old",
      description: null,
      visibility: "INVITE_ONLY",
    });
  });

  it("locks the group row, updates fields, and logs the change", async () => {
    await editGroup({
      groupId: "g_1",
      actorUserId: "u_owner",
      input: { name: "New Name", description: "hi", visibility: "PUBLIC" },
    });
    const sql = (txMocks.$queryRaw.mock.calls[0]?.[0] as string[]).join("?");
    expect(sql).toContain("FOR UPDATE");
    expect(txMocks.group.update).toHaveBeenCalledWith({
      where: { id: "g_1" },
      data: { name: "New Name", description: "hi", visibility: "PUBLIC" },
    });
    expect(txMocks.activityLog.create).toHaveBeenCalled();
  });

  it("rejects editing an archived group (checked under the lock)", async () => {
    txMocks.$queryRaw.mockResolvedValue([{ status: GroupStatus.ARCHIVED }]);
    await expect(
      editGroup({
        groupId: "g_1",
        actorUserId: "u_owner",
        input: { name: "x", description: undefined, visibility: "PUBLIC" },
      }),
    ).rejects.toMatchObject({ code: "GROUP_ARCHIVED" });
    expect(txMocks.group.update).not.toHaveBeenCalled();
  });

  it("throws NotFound when the group is gone", async () => {
    txMocks.$queryRaw.mockResolvedValue([]);
    await expect(
      editGroup({
        groupId: "g_1",
        actorUserId: "u_owner",
        input: { name: "x", description: undefined, visibility: "PUBLIC" },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
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
  const activeTarget = {
    id: "m_target",
    groupId: "g_1",
    userId: "u_target",
    role: GroupRole.ADMIN,
    status: GroupMemberStatus.ACTIVE,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    txMocks.$queryRaw.mockResolvedValue([{ status: GroupStatus.ACTIVE }]);
    // groupMember.findUnique is called twice inside the tx: target, then
    // the current owner.
    txMocks.groupMember.findUnique
      .mockResolvedValueOnce(activeTarget)
      .mockResolvedValueOnce({ id: "m_owner", role: GroupRole.OWNER });
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

  it("rejects an archived group under the lock", async () => {
    txMocks.$queryRaw.mockResolvedValue([{ status: GroupStatus.ARCHIVED }]);
    await expect(
      transferOwnership({
        groupId: "g_1",
        currentOwnerUserId: "u_owner",
        targetMemberId: "m_target",
      }),
    ).rejects.toMatchObject({ code: "GROUP_ARCHIVED" });
  });

  it("rejects a target from another group", async () => {
    txMocks.groupMember.findUnique.mockReset();
    txMocks.groupMember.findUnique.mockResolvedValueOnce({
      ...activeTarget,
      groupId: "g_OTHER",
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
    txMocks.groupMember.findUnique.mockReset();
    txMocks.groupMember.findUnique.mockResolvedValueOnce({
      ...activeTarget,
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
    txMocks.groupMember.findUnique.mockReset();
    txMocks.groupMember.findUnique.mockResolvedValueOnce({
      ...activeTarget,
      role: GroupRole.OWNER,
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
    txMocks.groupMember.findUnique.mockReset();
    txMocks.groupMember.findUnique
      .mockResolvedValueOnce(activeTarget)
      .mockResolvedValueOnce({ id: "m_owner", role: GroupRole.ADMIN });
    await expect(
      transferOwnership({
        groupId: "g_1",
        currentOwnerUserId: "u_owner",
        targetMemberId: "m_target",
      }),
    ).rejects.toBeInstanceOf(ManageGroupError);
  });
});
