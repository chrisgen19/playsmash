import { describe, expect, it } from "vitest";

import { validateScore } from "@/lib/scoring/validate";

const SESSION_11_WBT = { pointsToWin: 11, winByTwo: true };
const SESSION_11_NWBT = { pointsToWin: 11, winByTwo: false };

describe("validateScore — rule enforcement", () => {
  it("accepts a clean 11-9 with winByTwo", () => {
    const r = validateScore({
      team1Score: 11,
      team2Score: 9,
      ...SESSION_11_WBT,
    });
    expect(r).toMatchObject({ ok: true, winner: "TEAM_1" });
  });

  it("accepts a clean 9-11 (team 2 wins)", () => {
    const r = validateScore({
      team1Score: 9,
      team2Score: 11,
      ...SESSION_11_WBT,
    });
    expect(r).toMatchObject({ ok: true, winner: "TEAM_2" });
  });

  it("rejects a tied score", () => {
    expect(
      validateScore({ team1Score: 10, team2Score: 10, ...SESSION_11_WBT }),
    ).toMatchObject({ ok: false, code: "TIED" });
  });

  it("rejects negative scores", () => {
    expect(
      validateScore({ team1Score: -1, team2Score: 11, ...SESSION_11_WBT }),
    ).toMatchObject({ ok: false, code: "NEGATIVE" });
  });

  it.each([
    [1.5, 11],
    [11, 9.9],
    ["abc" as unknown, 11],
    [null as unknown, 11],
    [undefined as unknown, 11],
  ])("rejects non-integer score (%p vs %p)", (a, b) => {
    expect(
      validateScore({ team1Score: a, team2Score: b, ...SESSION_11_WBT }),
    ).toMatchObject({ ok: false, code: "NOT_INTEGER" });
  });

  it("coerces numeric strings (form payloads) and validates", () => {
    expect(
      validateScore({
        team1Score: "11",
        team2Score: "9",
        ...SESSION_11_WBT,
      }),
    ).toMatchObject({ ok: true, winner: "TEAM_1" });
  });

  it("rejects a winner under pointsToWin", () => {
    expect(
      validateScore({ team1Score: 10, team2Score: 8, ...SESSION_11_WBT }),
    ).toMatchObject({ ok: false, code: "WINNER_BELOW_POINTS_TO_WIN" });
  });

  it("rejects 11-10 when winByTwo is on", () => {
    expect(
      validateScore({ team1Score: 11, team2Score: 10, ...SESSION_11_WBT }),
    ).toMatchObject({ ok: false, code: "MUST_WIN_BY_TWO" });
  });

  it("allows 11-10 when winByTwo is off", () => {
    expect(
      validateScore({ team1Score: 11, team2Score: 10, ...SESSION_11_NWBT }),
    ).toMatchObject({ ok: true, winner: "TEAM_1" });
  });

  it("allows extended games when winByTwo is on (15-13)", () => {
    expect(
      validateScore({ team1Score: 15, team2Score: 13, ...SESSION_11_WBT }),
    ).toMatchObject({ ok: true, winner: "TEAM_1" });
  });

  it("returns the validated integers in the success payload", () => {
    const r = validateScore({
      team1Score: "11",
      team2Score: "9",
      ...SESSION_11_WBT,
    });
    expect(r).toEqual(
      expect.objectContaining({
        ok: true,
        winner: "TEAM_1",
        team1Score: 11,
        team2Score: 9,
      }),
    );
  });
});
