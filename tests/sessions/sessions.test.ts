import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PlaySessionStatus,
  ScoringType,
  SessionPlayerStatus,
} from "@/lib/db/generated/enums";

const { prismaMock, txMocks } = vi.hoisted(() => {
  const txMocks = {
    playSession: { create: vi.fn(), update: vi.fn() },
    court: { createMany: vi.fn() },
    sessionPlayer: { createMany: vi.fn(), deleteMany: vi.fn() },
    activityLog: { create: vi.fn() },
  };
  const prismaMock = {
    playerProfile: { findMany: vi.fn() },
    playSession: { findUnique: vi.fn() },
    sessionPlayer: { findMany: vi.fn(), count: vi.fn() },
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
  createSession,
  setSessionAttendance,
  startSession,
  SessionActionError,
} = await import("@/lib/sessions/sessions");
const { NotFoundError } = await import("@/lib/permissions/errors");

const baseInput = {
  name: "Tuesday drop-in",
  date: new Date("2026-06-01T18:00:00Z"),
  location: undefined,
  numberOfCourts: 2,
  scoringType: ScoringType.RALLY,
  pointsToWin: 11,
  winByTwo: true,
  playerIds: [] as string[],
};

describe("createSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMocks.playSession.create.mockResolvedValue({ id: "ses_1" });
  });

  it("creates the session + one Court per numberOfCourts", async () => {
    prismaMock.playerProfile.findMany.mockResolvedValue([]);
    await createSession({
      groupId: "g_1",
      actorUserId: "u_admin",
      input: { ...baseInput, numberOfCourts: 3 },
    });
    expect(txMocks.playSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        groupId: "g_1",
        status: PlaySessionStatus.PLANNED,
        numberOfCourts: 3,
      }),
    });
    expect(txMocks.court.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ name: "Court 1", courtNumber: 1 }),
        expect.objectContaining({ name: "Court 2", courtNumber: 2 }),
        expect.objectContaining({ name: "Court 3", courtNumber: 3 }),
      ],
    });
    expect(txMocks.activityLog.create).toHaveBeenCalled();
  });

  it("creates SessionPlayers with sequential checkInOrder", async () => {
    prismaMock.playerProfile.findMany.mockResolvedValue([
      { id: "p_1" },
      { id: "p_2" },
    ]);
    await createSession({
      groupId: "g_1",
      actorUserId: "u_admin",
      input: { ...baseInput, playerIds: ["p_1", "p_2"] },
    });
    expect(txMocks.sessionPlayer.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          playerProfileId: "p_1",
          checkInOrder: 1,
          status: SessionPlayerStatus.AVAILABLE,
        }),
        expect.objectContaining({
          playerProfileId: "p_2",
          checkInOrder: 2,
        }),
      ],
    });
  });

  it("rejects players that don't belong to the group", async () => {
    // Only one of the two requested ids resolves within the group.
    prismaMock.playerProfile.findMany.mockResolvedValue([{ id: "p_1" }]);
    await expect(
      createSession({
        groupId: "g_1",
        actorUserId: "u_admin",
        input: { ...baseInput, playerIds: ["p_1", "p_foreign"] },
      }),
    ).rejects.toMatchObject({ code: "PLAYERS_OUTSIDE_GROUP" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe("setSessionAttendance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.playSession.findUnique.mockResolvedValue({
      id: "ses_1",
      groupId: "g_1",
      status: PlaySessionStatus.PLANNED,
    });
  });

  it("adds new players and removes deselected ones", async () => {
    prismaMock.playerProfile.findMany.mockResolvedValue([
      { id: "p_1" },
      { id: "p_3" },
    ]);
    prismaMock.sessionPlayer.findMany.mockResolvedValue([
      { id: "sp_1", playerProfileId: "p_1", checkInOrder: 1 },
      { id: "sp_2", playerProfileId: "p_2", checkInOrder: 2 },
    ]);
    await setSessionAttendance({
      groupId: "g_1",
      actorUserId: "u_admin",
      sessionId: "ses_1",
      playerIds: ["p_1", "p_3"],
    });
    expect(txMocks.sessionPlayer.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["sp_2"] } },
    });
    expect(txMocks.sessionPlayer.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ playerProfileId: "p_3", checkInOrder: 3 }),
      ],
    });
  });

  it("refuses to edit a non-PLANNED session", async () => {
    prismaMock.playSession.findUnique.mockResolvedValue({
      id: "ses_1",
      groupId: "g_1",
      status: PlaySessionStatus.ACTIVE,
    });
    await expect(
      setSessionAttendance({
        groupId: "g_1",
        actorUserId: "u_admin",
        sessionId: "ses_1",
        playerIds: ["p_1"],
      }),
    ).rejects.toMatchObject({ code: "NOT_PLANNED" });
  });

  it("rejects a session from another group", async () => {
    prismaMock.playSession.findUnique.mockResolvedValue({
      id: "ses_1",
      groupId: "g_OTHER",
      status: PlaySessionStatus.PLANNED,
    });
    await expect(
      setSessionAttendance({
        groupId: "g_1",
        actorUserId: "u_admin",
        sessionId: "ses_1",
        playerIds: [],
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("startSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.playSession.findUnique.mockResolvedValue({
      id: "ses_1",
      groupId: "g_1",
      status: PlaySessionStatus.PLANNED,
    });
  });

  it("moves a planned session with players to ACTIVE", async () => {
    prismaMock.sessionPlayer.count.mockResolvedValue(4);
    await startSession({
      groupId: "g_1",
      actorUserId: "u_admin",
      sessionId: "ses_1",
    });
    expect(txMocks.playSession.update).toHaveBeenCalledWith({
      where: { id: "ses_1" },
      data: { status: PlaySessionStatus.ACTIVE },
    });
  });

  it("refuses to start a session with no players", async () => {
    prismaMock.sessionPlayer.count.mockResolvedValue(0);
    await expect(
      startSession({
        groupId: "g_1",
        actorUserId: "u_admin",
        sessionId: "ses_1",
      }),
    ).rejects.toMatchObject({ code: "NO_PLAYERS" });
  });

  it("refuses to start a non-PLANNED session", async () => {
    prismaMock.playSession.findUnique.mockResolvedValue({
      id: "ses_1",
      groupId: "g_1",
      status: PlaySessionStatus.COMPLETED,
    });
    await expect(
      startSession({
        groupId: "g_1",
        actorUserId: "u_admin",
        sessionId: "ses_1",
      }),
    ).rejects.toMatchObject({ code: "NOT_PLANNED" });
    expect(SessionActionError).toBeDefined();
  });
});
