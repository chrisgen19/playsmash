import { beforeEach, describe, expect, it, vi } from "vitest";

import { GroupRole, GroupMemberStatus, PlayerStatus } from "@/lib/db/generated/enums";

const { prismaMock, txMocks } = vi.hoisted(() => {
  const txMocks = {
    groupMember: { update: vi.fn() },
    playerProfile: { updateMany: vi.fn() },
    activityLog: { create: vi.fn() },
  };
  const prismaMock = {
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

const { changeMemberRole, removeMember, MemberActionError } = await import(
  "@/lib/groups/members"
);
const { ForbiddenError, NotFoundError } = await import(
  "@/lib/permissions/errors"
);

const activeMember = (overrides: Partial<{ id: string; userId: string; role: string; status: string; groupId: string }> = {}) => ({
  id: "m_1",
  userId: "u_target",
  role: GroupRole.PLAYER,
  status: GroupMemberStatus.ACTIVE,
  groupId: "g_1",
  ...overrides,
});

describe("changeMemberRole", () => {
  beforeEach(() => vi.clearAllMocks());

  it("promotes a PLAYER to ADMIN when actor is OWNER", async () => {
    prismaMock.groupMember.findUnique.mockResolvedValue(activeMember());
    await changeMemberRole({
      groupId: "g_1",
      actorUserId: "u_owner",
      actorRole: GroupRole.OWNER,
      targetMemberId: "m_1",
      newRole: GroupRole.ADMIN,
    });
    expect(txMocks.groupMember.update).toHaveBeenCalledWith({
      where: { id: "m_1" },
      data: { role: GroupRole.ADMIN },
    });
  });

  it("rejects promotion to OWNER (use transfer-ownership)", async () => {
    await expect(
      changeMemberRole({
        groupId: "g_1",
        actorUserId: "u_owner",
        actorRole: GroupRole.OWNER,
        targetMemberId: "m_1",
        newRole: GroupRole.OWNER,
      }),
    ).rejects.toBeInstanceOf(MemberActionError);
  });

  it("rejects demoting the OWNER", async () => {
    prismaMock.groupMember.findUnique.mockResolvedValue(
      activeMember({ role: GroupRole.OWNER }),
    );
    await expect(
      changeMemberRole({
        groupId: "g_1",
        actorUserId: "u_owner",
        actorRole: GroupRole.OWNER,
        targetMemberId: "m_1",
        newRole: GroupRole.ADMIN,
      }),
    ).rejects.toMatchObject({ code: "CANNOT_DEMOTE_OWNER" });
  });

  it("ADMIN cannot demote another ADMIN", async () => {
    prismaMock.groupMember.findUnique.mockResolvedValue(
      activeMember({ role: GroupRole.ADMIN }),
    );
    await expect(
      changeMemberRole({
        groupId: "g_1",
        actorUserId: "u_admin",
        actorRole: GroupRole.ADMIN,
        targetMemberId: "m_1",
        newRole: GroupRole.PLAYER,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("OWNER can demote an ADMIN", async () => {
    prismaMock.groupMember.findUnique.mockResolvedValue(
      activeMember({ role: GroupRole.ADMIN }),
    );
    await changeMemberRole({
      groupId: "g_1",
      actorUserId: "u_owner",
      actorRole: GroupRole.OWNER,
      targetMemberId: "m_1",
      newRole: GroupRole.PLAYER,
    });
    expect(txMocks.groupMember.update).toHaveBeenCalled();
  });

  it("rejects when target member is in another group", async () => {
    prismaMock.groupMember.findUnique.mockResolvedValue(
      activeMember({ groupId: "g_OTHER" }),
    );
    await expect(
      changeMemberRole({
        groupId: "g_1",
        actorUserId: "u_owner",
        actorRole: GroupRole.OWNER,
        targetMemberId: "m_1",
        newRole: GroupRole.ADMIN,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("is a no-op when role doesn't change", async () => {
    prismaMock.groupMember.findUnique.mockResolvedValue(
      activeMember({ role: GroupRole.PLAYER }),
    );
    await changeMemberRole({
      groupId: "g_1",
      actorUserId: "u_owner",
      actorRole: GroupRole.OWNER,
      targetMemberId: "m_1",
      newRole: GroupRole.PLAYER,
    });
    expect(txMocks.groupMember.update).not.toHaveBeenCalled();
  });
});

describe("removeMember", () => {
  beforeEach(() => vi.clearAllMocks());

  it("soft-removes a PLAYER and deactivates their player profile", async () => {
    prismaMock.groupMember.findUnique.mockResolvedValue(activeMember());
    await removeMember({
      groupId: "g_1",
      actorUserId: "u_owner",
      actorRole: GroupRole.OWNER,
      targetMemberId: "m_1",
    });
    expect(txMocks.groupMember.update).toHaveBeenCalledWith({
      where: { id: "m_1" },
      data: { status: GroupMemberStatus.REMOVED },
    });
    expect(txMocks.playerProfile.updateMany).toHaveBeenCalledWith({
      where: {
        groupId: "g_1",
        userId: "u_target",
        status: { not: PlayerStatus.REMOVED },
      },
      data: { status: PlayerStatus.INACTIVE },
    });
  });

  it("rejects removing the OWNER", async () => {
    prismaMock.groupMember.findUnique.mockResolvedValue(
      activeMember({ role: GroupRole.OWNER }),
    );
    await expect(
      removeMember({
        groupId: "g_1",
        actorUserId: "u_owner",
        actorRole: GroupRole.OWNER,
        targetMemberId: "m_1",
      }),
    ).rejects.toMatchObject({ code: "CANNOT_REMOVE_OWNER" });
  });

  it("ADMIN cannot remove another ADMIN", async () => {
    prismaMock.groupMember.findUnique.mockResolvedValue(
      activeMember({ role: GroupRole.ADMIN }),
    );
    await expect(
      removeMember({
        groupId: "g_1",
        actorUserId: "u_admin",
        actorRole: GroupRole.ADMIN,
        targetMemberId: "m_1",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects self-removal (use leave-group)", async () => {
    prismaMock.groupMember.findUnique.mockResolvedValue(
      activeMember({ userId: "u_owner" }),
    );
    await expect(
      removeMember({
        groupId: "g_1",
        actorUserId: "u_owner",
        actorRole: GroupRole.OWNER,
        targetMemberId: "m_1",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
