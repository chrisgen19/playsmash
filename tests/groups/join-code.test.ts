import { describe, expect, it } from "vitest";

import {
  generateJoinCode,
  generateUniqueJoinCode,
} from "@/lib/groups/join-code";

describe("generateJoinCode", () => {
  it("returns a 6-char code by default", () => {
    const code = generateJoinCode();
    expect(code).toHaveLength(6);
  });

  it("uses only unambiguous Crockford-like chars (no I/O/0/1)", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateJoinCode(10);
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
    }
  });

  it("honours the requested length", () => {
    expect(generateJoinCode(4)).toHaveLength(4);
    expect(generateJoinCode(12)).toHaveLength(12);
  });

  it("rejects lengths outside [4, 16]", () => {
    expect(() => generateJoinCode(3)).toThrow();
    expect(() => generateJoinCode(17)).toThrow();
  });

  it("produces different codes across calls", () => {
    const codes = new Set(
      Array.from({ length: 50 }, () => generateJoinCode(8)),
    );
    // 32^8 keyspace — 50 calls should never collide in practice.
    expect(codes.size).toBe(50);
  });
});

describe("generateUniqueJoinCode", () => {
  it("returns the first code when the collision check says it's free", async () => {
    const exists = async () => false;
    const code = await generateUniqueJoinCode(exists);
    expect(code).toHaveLength(6);
  });

  it("retries on collisions", async () => {
    let calls = 0;
    const exists = async () => {
      calls += 1;
      return calls < 3; // first two attempts collide
    };
    const code = await generateUniqueJoinCode(exists);
    expect(code).toHaveLength(6);
    expect(calls).toBe(3);
  });

  it("gives up after too many collisions", async () => {
    const exists = async () => true; // every code "exists"
    await expect(generateUniqueJoinCode(exists)).rejects.toThrow(
      /unique join code/i,
    );
  });
});
