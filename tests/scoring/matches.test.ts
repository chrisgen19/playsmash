import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CourtStatus,
  MatchStatus,
  SessionPlayerStatus,
  WinningTeam,
} from "@/lib/db/generated/enums";

const { prismaMock, txMocks } = vi.hoisted(() => {
  const txMocks = {
    $queryRaw: vi.fn(),
    match: { update: vi.fn() },
    court: { update: vi.fn() },
    sessionPlayer: { updateMany: vi.fn() },
    activityLog: { create: vi.fn() },
  };
  const prismaMock = {
    match: { findUnique: vi.fn() },
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
  startMatch,
  completeMatch,
  cancelMatch,
  editMatchScore,
  MatchActionError,
  ScoreValidationError,
} = await import("@/lib/scoring/matches");
const { NotFoundError } = await import("@/lib/permissions/errors");

const baseMatch = {
  id: "m_1",
  sessionId: "ses_1",
  courtId: "c_1",
  status: MatchStatus.QUEUED,
  team1Player1Id: "p1",
  team1Player2Id: "p2",
  team2Player1Id: "p3",
  team2Player2Id: "p4",
  team1Score: null as number | null,
  team2Score: null as number | null,
  session: { groupId: "g_1", pointsToWin: 11, winByTwo: true },
};

describe("startMatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.match.findUnique.mockResolvedValue(baseMatch);
    txMocks.$queryRaw.mockResolvedValue([{ status: MatchStatus.QUEUED }]);
  });

  it("flips QUEUED → ACTIVE under a row lock", async () => {
    await startMatch({
      groupId: "g_1",
      actorUserId: "u_admin",
      matchId: "m_1",
    });
    const sql = (txMocks.$queryRaw.mock.calls[0]?.[0] as string[]).join("?");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain('"Match"');
    expect(txMocks.match.update).toHaveBeenCalledWith({
      where: { id: "m_1" },
      data: expect.objectContaining({ status: MatchStatus.ACTIVE }),
    });
    expect(txMocks.activityLog.create).toHaveBeenCalled();
  });

  it("rejects a match from another group (tenant isolation)", async () => {
    prismaMock.match.findUnique.mockResolvedValue({
      ...baseMatch,
      session: { ...baseMatch.session, groupId: "g_OTHER" },
    });
    await expect(
      startMatch({
        groupId: "g_1",
        actorUserId: "u_admin",
        matchId: "m_1",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("aborts inside the lock when status is no longer QUEUED (race)", async () => {
    // Pre-tx read still says QUEUED; the locked read sees ACTIVE — someone
    // beat us to startMatch on the same row.
    txMocks.$queryRaw.mockResolvedValue([{ status: MatchStatus.ACTIVE }]);
    await expect(
      startMatch({
        groupId: "g_1",
        actorUserId: "u_admin",
        matchId: "m_1",
      }),
    ).rejects.toMatchObject({ code: "NOT_QUEUED" });
    expect(txMocks.match.update).not.toHaveBeenCalled();
  });
});

describe("completeMatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.match.findUnique.mockResolvedValue({
      ...baseMatch,
      status: MatchStatus.ACTIVE,
    });
    txMocks.$queryRaw.mockResolvedValue([{ status: MatchStatus.ACTIVE }]);
  });

  it("records the winner, frees the court, flips players to WAITING", async () => {
    const r = await completeMatch({
      groupId: "g_1",
      actorUserId: "u_admin",
      matchId: "m_1",
      team1Score: 11,
      team2Score: 9,
    });
    expect(r.winner).toBe(WinningTeam.TEAM_1);
    expect(txMocks.match.update).toHaveBeenCalledWith({
      where: { id: "m_1" },
      data: expect.objectContaining({
        status: MatchStatus.COMPLETED,
        team1Score: 11,
        team2Score: 9,
        winningTeam: WinningTeam.TEAM_1,
      }),
    });
    expect(txMocks.court.update).toHaveBeenCalledWith({
      where: { id: "c_1" },
      data: { status: CourtStatus.AVAILABLE },
    });
    expect(txMocks.sessionPlayer.updateMany).toHaveBeenCalledWith({
      where: {
        sessionId: "ses_1",
        playerProfileId: { in: ["p1", "p2", "p3", "p4"] },
      },
      data: { status: SessionPlayerStatus.WAITING },
    });
  });

  it("surfaces a validator error without writing", async () => {
    await expect(
      completeMatch({
        groupId: "g_1",
        actorUserId: "u_admin",
        matchId: "m_1",
        team1Score: 10,
        team2Score: 8,
      }),
    ).rejects.toBeInstanceOf(ScoreValidationError);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("aborts inside the lock when status is no longer ACTIVE (race)", async () => {
    txMocks.$queryRaw.mockResolvedValue([{ status: MatchStatus.COMPLETED }]);
    await expect(
      completeMatch({
        groupId: "g_1",
        actorUserId: "u_admin",
        matchId: "m_1",
        team1Score: 11,
        team2Score: 9,
      }),
    ).rejects.toMatchObject({ code: "NOT_ACTIVE" });
    expect(txMocks.match.update).not.toHaveBeenCalled();
  });

  it("works without a court (no court.update call)", async () => {
    prismaMock.match.findUnique.mockResolvedValue({
      ...baseMatch,
      status: MatchStatus.ACTIVE,
      courtId: null,
    });
    await completeMatch({
      groupId: "g_1",
      actorUserId: "u_admin",
      matchId: "m_1",
      team1Score: 11,
      team2Score: 9,
    });
    expect(txMocks.court.update).not.toHaveBeenCalled();
  });
});

describe("cancelMatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.match.findUnique.mockResolvedValue(baseMatch);
    txMocks.$queryRaw.mockResolvedValue([{ status: MatchStatus.QUEUED }]);
  });

  it("cancels a queued match, frees court + players", async () => {
    await cancelMatch({
      groupId: "g_1",
      actorUserId: "u_admin",
      matchId: "m_1",
    });
    expect(txMocks.match.update).toHaveBeenCalledWith({
      where: { id: "m_1" },
      data: expect.objectContaining({ status: MatchStatus.CANCELLED }),
    });
    expect(txMocks.court.update).toHaveBeenCalled();
    expect(txMocks.sessionPlayer.updateMany).toHaveBeenCalled();
  });

  it("rejects a completed match", async () => {
    txMocks.$queryRaw.mockResolvedValue([{ status: MatchStatus.COMPLETED }]);
    await expect(
      cancelMatch({
        groupId: "g_1",
        actorUserId: "u_admin",
        matchId: "m_1",
      }),
    ).rejects.toMatchObject({ code: "ALREADY_COMPLETED" });
  });

  it("rejects an already-cancelled match", async () => {
    txMocks.$queryRaw.mockResolvedValue([{ status: MatchStatus.CANCELLED }]);
    await expect(
      cancelMatch({
        groupId: "g_1",
        actorUserId: "u_admin",
        matchId: "m_1",
      }),
    ).rejects.toMatchObject({ code: "ALREADY_CANCELLED" });
  });
});

describe("editMatchScore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.match.findUnique.mockResolvedValue({
      ...baseMatch,
      status: MatchStatus.COMPLETED,
      team1Score: 11,
      team2Score: 9,
    });
    txMocks.$queryRaw.mockResolvedValue([{ status: MatchStatus.COMPLETED }]);
  });

  it("updates the score and logs old → new", async () => {
    await editMatchScore({
      groupId: "g_1",
      actorUserId: "u_admin",
      matchId: "m_1",
      team1Score: 9,
      team2Score: 11,
    });
    expect(txMocks.match.update).toHaveBeenCalledWith({
      where: { id: "m_1" },
      data: expect.objectContaining({
        team1Score: 9,
        team2Score: 11,
        winningTeam: WinningTeam.TEAM_2,
      }),
    });
    expect(txMocks.activityLog.create).toHaveBeenCalled();
    expect(MatchActionError).toBeDefined();
  });

  it("is a no-op when score is unchanged", async () => {
    await editMatchScore({
      groupId: "g_1",
      actorUserId: "u_admin",
      matchId: "m_1",
      team1Score: 11,
      team2Score: 9,
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("refuses to edit a non-COMPLETED match (pre-tx)", async () => {
    prismaMock.match.findUnique.mockResolvedValue({
      ...baseMatch,
      status: MatchStatus.ACTIVE,
    });
    await expect(
      editMatchScore({
        groupId: "g_1",
        actorUserId: "u_admin",
        matchId: "m_1",
        team1Score: 11,
        team2Score: 9,
      }),
    ).rejects.toMatchObject({ code: "NOT_COMPLETED" });
  });

  it("validates the new score against the session rules", async () => {
    await expect(
      editMatchScore({
        groupId: "g_1",
        actorUserId: "u_admin",
        matchId: "m_1",
        team1Score: 10,
        team2Score: 8,
      }),
    ).rejects.toBeInstanceOf(ScoreValidationError);
  });
});
