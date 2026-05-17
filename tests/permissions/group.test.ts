import { describe, expect, it } from "vitest";

import { GroupRole } from "@/lib/db/generated/enums";
import { roleSatisfies, roleSatisfiesAny } from "@/lib/permissions/roles";

describe("roleSatisfies — strict hierarchy", () => {
  it("OWNER satisfies every required role", () => {
    expect(roleSatisfies(GroupRole.OWNER, GroupRole.OWNER)).toBe(true);
    expect(roleSatisfies(GroupRole.OWNER, GroupRole.ADMIN)).toBe(true);
    expect(roleSatisfies(GroupRole.OWNER, GroupRole.PLAYER)).toBe(true);
    expect(roleSatisfies(GroupRole.OWNER, GroupRole.VIEWER)).toBe(true);
  });

  it("ADMIN satisfies ADMIN and below but not OWNER", () => {
    expect(roleSatisfies(GroupRole.ADMIN, GroupRole.OWNER)).toBe(false);
    expect(roleSatisfies(GroupRole.ADMIN, GroupRole.ADMIN)).toBe(true);
    expect(roleSatisfies(GroupRole.ADMIN, GroupRole.PLAYER)).toBe(true);
    expect(roleSatisfies(GroupRole.ADMIN, GroupRole.VIEWER)).toBe(true);
  });

  it("PLAYER satisfies PLAYER and VIEWER only", () => {
    expect(roleSatisfies(GroupRole.PLAYER, GroupRole.OWNER)).toBe(false);
    expect(roleSatisfies(GroupRole.PLAYER, GroupRole.ADMIN)).toBe(false);
    expect(roleSatisfies(GroupRole.PLAYER, GroupRole.PLAYER)).toBe(true);
    expect(roleSatisfies(GroupRole.PLAYER, GroupRole.VIEWER)).toBe(true);
  });

  it("VIEWER only satisfies VIEWER", () => {
    expect(roleSatisfies(GroupRole.VIEWER, GroupRole.VIEWER)).toBe(true);
    expect(roleSatisfies(GroupRole.VIEWER, GroupRole.PLAYER)).toBe(false);
  });
});

describe("roleSatisfiesAny — picks the lowest bar from the allowed set", () => {
  it("PLAYER passes when [PLAYER, ADMIN] is allowed (PLAYER is the floor)", () => {
    expect(
      roleSatisfiesAny(GroupRole.PLAYER, [
        GroupRole.PLAYER,
        GroupRole.ADMIN,
      ]),
    ).toBe(true);
  });

  it("PLAYER fails when only [ADMIN, OWNER] is allowed", () => {
    expect(
      roleSatisfiesAny(GroupRole.PLAYER, [
        GroupRole.ADMIN,
        GroupRole.OWNER,
      ]),
    ).toBe(false);
  });

  it("ADMIN passes a [ADMIN, OWNER] gate", () => {
    expect(
      roleSatisfiesAny(GroupRole.ADMIN, [
        GroupRole.ADMIN,
        GroupRole.OWNER,
      ]),
    ).toBe(true);
  });

  it("OWNER always passes", () => {
    expect(
      roleSatisfiesAny(GroupRole.OWNER, [
        GroupRole.ADMIN,
        GroupRole.OWNER,
      ]),
    ).toBe(true);
    expect(roleSatisfiesAny(GroupRole.OWNER, [GroupRole.VIEWER])).toBe(true);
  });

  it("empty allowed list denies everyone", () => {
    expect(roleSatisfiesAny(GroupRole.OWNER, [])).toBe(false);
  });
});
