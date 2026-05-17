import { describe, expect, it } from "vitest";

import {
  namesLikelyMatch,
  normalizeName,
  suggestDuplicateLinks,
} from "@/lib/players/duplicate-suggestions";

describe("normalizeName", () => {
  it("lowercases, trims, and collapses whitespace", () => {
    expect(normalizeName("  Bob   Smith ")).toBe("bob smith");
    expect(normalizeName("RILEY")).toBe("riley");
  });
});

describe("namesLikelyMatch", () => {
  it("matches identical names regardless of case/spacing", () => {
    expect(namesLikelyMatch("Bob Smith", "  bob   smith ")).toBe(true);
  });

  it("matches when one name contains the other", () => {
    expect(namesLikelyMatch("Bob", "Bob Smith")).toBe(true);
    expect(namesLikelyMatch("Riley Rally", "Riley")).toBe(true);
  });

  it("does not match unrelated names", () => {
    expect(namesLikelyMatch("Bob", "Patricia")).toBe(false);
  });

  it("ignores a 1-char side so a stray initial doesn't match everyone", () => {
    expect(namesLikelyMatch("B", "Bob Smith")).toBe(false);
  });

  it("returns false for empty input", () => {
    expect(namesLikelyMatch("", "Bob")).toBe(false);
    expect(namesLikelyMatch("Bob", "   ")).toBe(false);
  });
});

describe("suggestDuplicateLinks", () => {
  it("pairs temp players with name-matching users", () => {
    const temps = [
      { id: "t1", displayName: "Guest Sam" },
      { id: "t2", displayName: "Jordan" },
      { id: "t3", displayName: "Nobody" },
    ];
    const users = [
      { userId: "u1", displayName: "Sam" },
      { userId: "u2", displayName: "Jordan Lee" },
    ];
    const suggestions = suggestDuplicateLinks(temps, users);
    expect(suggestions).toEqual([
      {
        tempPlayerId: "t1",
        tempDisplayName: "Guest Sam",
        userId: "u1",
        userDisplayName: "Sam",
      },
      {
        tempPlayerId: "t2",
        tempDisplayName: "Jordan",
        userId: "u2",
        userDisplayName: "Jordan Lee",
      },
    ]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(
      suggestDuplicateLinks(
        [{ id: "t1", displayName: "Alpha" }],
        [{ userId: "u1", displayName: "Omega" }],
      ),
    ).toEqual([]);
  });

  it("can emit multiple suggestions for the same temp player", () => {
    const suggestions = suggestDuplicateLinks(
      [{ id: "t1", displayName: "Sam" }],
      [
        { userId: "u1", displayName: "Sam Carter" },
        { userId: "u2", displayName: "Samuel Sam" },
      ],
    );
    expect(suggestions).toHaveLength(2);
  });
});
