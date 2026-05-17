import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  MatchStatus,
  PlaySessionStatus,
  SessionPlayerStatus,
} from "@/lib/db/generated/enums";

const { prismaMock, txMocks } = vi.hoisted(() => {
  const txMocks = {
    $queryRaw: vi.fn(),
    match: { count: vi.fn(), create: vi.fn(), findMany: vi.fn() },
    sessionPlayer: { findMany: vi.fn(), updateMany: vi.fn() },
    court: { update: vi.fn() },
    activityLog: { create: vi.fn() },
  };
  const prismaMock = {
    playSession: { findUnique: vi.fn() },
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

const { generateNextRound, GenerateRoundError } = await import(
  "@/lib/sessions/generate-round"
);
const { NotFoundError } = await import("@/lib/permissions/errors");

const activeSessionMeta = {
  id: "ses_1",
  groupId: "g_1",
  status: PlaySessionStatus.ACTIVE,
  numberOfCourts: 1,
  courts: [{ id: "c_1", courtNumber: 1 }],
};

function setupPlayers(n: number) {
  txMocks.sessionPlayer.findMany.mockResolvedValue(
    Array.from({ length: n }, (_, i) => ({
      id: `sp_${i + 1}`,
      playerProfileId: `p_${i + 1}`,
      checkInOrder: i + 1,
    })),
  );
}

describe("generateNextRound — DB invariants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.playSession.findUnique.mockResolvedValue(activeSessionMeta);
    txMocks.$queryRaw.mockResolvedValue([
      { status: PlaySessionStatus.ACTIVE },
    ]);
    txMocks.match.count.mockResolvedValue(0);
    txMocks.match.findMany.mockResolvedValue([]);
    setupPlayers(4);
  });

  it("rejects a session in another group (pre-tx)", async () => {
    prismaMock.playSession.findUnique.mockResolvedValue({
      ...activeSessionMeta,
      groupId: "g_OTHER",
    });
    await expect(
      generateNextRound({
        groupId: "g_1",
        actorUserId: "u_admin",
        sessionId: "ses_1",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a non-ACTIVE session (pre-tx fast-fail)", async () => {
    prismaMock.playSession.findUnique.mockResolvedValue({
      ...activeSessionMeta,
      status: PlaySessionStatus.PLANNED,
    });
    await expect(
      generateNextRound({
        groupId: "g_1",
        actorUserId: "u_admin",
        sessionId: "ses_1",
      }),
    ).rejects.toMatchObject({ code: "SESSION_NOT_ACTIVE" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("locks the session row with SELECT ... FOR UPDATE", async () => {
    await generateNextRound({
      groupId: "g_1",
      actorUserId: "u_admin",
      sessionId: "ses_1",
    });
    const sql = (txMocks.$queryRaw.mock.calls[0]?.[0] as string[]).join("?");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain('"PlaySession"');
  });

  it("aborts inside the lock if a concurrent call already created the round", async () => {
    // Pre-tx open-match count is 0, but inside the lock a concurrent call
    // has already written the new round — open-match count is now > 0.
    txMocks.match.count.mockResolvedValue(4);
    await expect(
      generateNextRound({
        groupId: "g_1",
        actorUserId: "u_admin",
        sessionId: "ses_1",
      }),
    ).rejects.toMatchObject({ code: "ROUND_IN_PROGRESS" });
    expect(txMocks.match.create).not.toHaveBeenCalled();
    expect(txMocks.sessionPlayer.updateMany).not.toHaveBeenCalled();
  });

  it("aborts inside the lock if the session is no longer ACTIVE", async () => {
    // Concurrent transition (e.g. an admin cancelled the session) — the
    // locked read sees a non-ACTIVE status that the pre-tx read missed.
    txMocks.$queryRaw.mockResolvedValue([
      { status: PlaySessionStatus.CANCELLED },
    ]);
    await expect(
      generateNextRound({
        groupId: "g_1",
        actorUserId: "u_admin",
        sessionId: "ses_1",
      }),
    ).rejects.toMatchObject({ code: "SESSION_NOT_ACTIVE" });
    expect(txMocks.match.create).not.toHaveBeenCalled();
  });

  it("refuses to generate when fewer than 4 players are available", async () => {
    setupPlayers(3);
    await expect(
      generateNextRound({
        groupId: "g_1",
        actorUserId: "u_admin",
        sessionId: "ses_1",
      }),
    ).rejects.toMatchObject({ code: "NOT_ENOUGH_PLAYERS" });
    expect(txMocks.match.create).not.toHaveBeenCalled();
  });

  it("creates 1 match per court and flips player statuses to PLAYING", async () => {
    const result = await generateNextRound({
      groupId: "g_1",
      actorUserId: "u_admin",
      sessionId: "ses_1",
    });
    expect(result.matchesCreated).toBe(1);
    expect(result.restingCount).toBe(0);
    expect(txMocks.match.create).toHaveBeenCalledTimes(1);
    expect(txMocks.match.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sessionId: "ses_1",
        courtId: "c_1",
        roundNumber: 1,
        status: MatchStatus.QUEUED,
      }),
    });
    expect(txMocks.sessionPlayer.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: SessionPlayerStatus.PLAYING },
      }),
    );
    expect(txMocks.activityLog.create).toHaveBeenCalled();
    expect(GenerateRoundError).toBeDefined();
  });
});
