import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  GroupMemberStatus,
  PlayerStatus,
} from "@/lib/db/generated/enums";

const { prismaMock, txMocks } = vi.hoisted(() => {
  const txMocks = {
    playerProfile: { create: vi.fn(), update: vi.fn() },
    activityLog: { create: vi.fn() },
  };
  const prismaMock = {
    playerProfile: { findUnique: vi.fn() },
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

const {
  createTempPlayer,
  setPlayerStatus,
  linkTempPlayerToUser,
  PlayerActionError,
} = await import("@/lib/players/players");
const { NotFoundError } = await import("@/lib/permissions/errors");

describe("createTempPlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMocks.playerProfile.create.mockResolvedValue({ id: "pp_1" });
  });

  it("creates a player with userId=null and status TEMPORARY", async () => {
    await createTempPlayer({
      groupId: "g_1",
      actorUserId: "u_admin",
      displayName: "Temp Bob",
      skillLevel: 3.5,
    });
    expect(txMocks.playerProfile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        groupId: "g_1",
        userId: null,
        displayName: "Temp Bob",
        skillLevel: 3.5,
        status: PlayerStatus.TEMPORARY,
      }),
    });
    expect(txMocks.activityLog.create).toHaveBeenCalled();
  });
});

describe("setPlayerStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects players from another group", async () => {
    prismaMock.playerProfile.findUnique.mockResolvedValue({
      id: "pp_1",
      groupId: "g_OTHER",
      status: PlayerStatus.ACTIVE,
    });
    await expect(
      setPlayerStatus({
        groupId: "g_1",
        actorUserId: "u_admin",
        playerId: "pp_1",
        status: PlayerStatus.INACTIVE,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("no-ops when status is unchanged", async () => {
    prismaMock.playerProfile.findUnique.mockResolvedValue({
      id: "pp_1",
      groupId: "g_1",
      status: PlayerStatus.ACTIVE,
    });
    await setPlayerStatus({
      groupId: "g_1",
      actorUserId: "u_admin",
      playerId: "pp_1",
      status: PlayerStatus.ACTIVE,
    });
    expect(txMocks.playerProfile.update).not.toHaveBeenCalled();
  });

  it("updates status and logs", async () => {
    prismaMock.playerProfile.findUnique.mockResolvedValue({
      id: "pp_1",
      groupId: "g_1",
      status: PlayerStatus.ACTIVE,
      userId: null,
    });
    await setPlayerStatus({
      groupId: "g_1",
      actorUserId: "u_admin",
      playerId: "pp_1",
      status: PlayerStatus.REMOVED,
    });
    expect(txMocks.playerProfile.update).toHaveBeenCalledWith({
      where: { id: "pp_1" },
      data: { status: PlayerStatus.REMOVED },
    });
    expect(txMocks.activityLog.create).toHaveBeenCalled();
  });

  it("rejects setting a user-linked player to TEMPORARY", async () => {
    prismaMock.playerProfile.findUnique.mockResolvedValue({
      id: "pp_linked",
      groupId: "g_1",
      status: PlayerStatus.ACTIVE,
      userId: "u_bob",
    });
    await expect(
      setPlayerStatus({
        groupId: "g_1",
        actorUserId: "u_admin",
        playerId: "pp_linked",
        status: PlayerStatus.TEMPORARY,
      }),
    ).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
    expect(txMocks.playerProfile.update).not.toHaveBeenCalled();
  });
});

describe("linkTempPlayerToUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("attaches userId to a temporary profile and marks it ACTIVE", async () => {
    prismaMock.playerProfile.findUnique
      .mockResolvedValueOnce({
        id: "pp_temp",
        groupId: "g_1",
        userId: null,
        displayName: "Temp Bob",
      })
      .mockResolvedValueOnce(null); // conflict lookup
    prismaMock.groupMember.findUnique.mockResolvedValue({
      status: GroupMemberStatus.ACTIVE,
    });

    await linkTempPlayerToUser({
      groupId: "g_1",
      actorUserId: "u_admin",
      playerId: "pp_temp",
      targetUserId: "u_bob",
    });

    expect(txMocks.playerProfile.update).toHaveBeenCalledWith({
      where: { id: "pp_temp" },
      data: { userId: "u_bob", status: PlayerStatus.ACTIVE },
    });
  });

  it("refuses when player is already linked", async () => {
    prismaMock.playerProfile.findUnique.mockResolvedValue({
      id: "pp_temp",
      groupId: "g_1",
      userId: "u_other",
      displayName: "Bob",
    });
    await expect(
      linkTempPlayerToUser({
        groupId: "g_1",
        actorUserId: "u_admin",
        playerId: "pp_temp",
        targetUserId: "u_bob",
      }),
    ).rejects.toMatchObject({ code: "ALREADY_LINKED" });
    expect(PlayerActionError).toBeDefined();
  });

  it("refuses when target user isn't an active member", async () => {
    prismaMock.playerProfile.findUnique.mockResolvedValue({
      id: "pp_temp",
      groupId: "g_1",
      userId: null,
      displayName: "Bob",
    });
    prismaMock.groupMember.findUnique.mockResolvedValue(null);
    await expect(
      linkTempPlayerToUser({
        groupId: "g_1",
        actorUserId: "u_admin",
        playerId: "pp_temp",
        targetUserId: "u_bob",
      }),
    ).rejects.toMatchObject({ code: "TARGET_USER_NOT_IN_GROUP" });
  });

  it("refuses when target user already has a profile in the group", async () => {
    prismaMock.playerProfile.findUnique
      .mockResolvedValueOnce({
        id: "pp_temp",
        groupId: "g_1",
        userId: null,
        displayName: "Bob",
      })
      .mockResolvedValueOnce({ id: "pp_conflict" });
    prismaMock.groupMember.findUnique.mockResolvedValue({
      status: GroupMemberStatus.ACTIVE,
    });
    await expect(
      linkTempPlayerToUser({
        groupId: "g_1",
        actorUserId: "u_admin",
        playerId: "pp_temp",
        targetUserId: "u_bob",
      }),
    ).rejects.toMatchObject({ code: "TARGET_USER_ALREADY_HAS_PROFILE" });
  });
});
