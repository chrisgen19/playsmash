import { describe, expect, it } from "vitest";

import { isVerifiedOAuthProfile } from "@/lib/auth/oauth-verification";

describe("isVerifiedOAuthProfile", () => {
  it("accepts profiles with email_verified === true", () => {
    expect(
      isVerifiedOAuthProfile({
        email: "alice@example.com",
        email_verified: true,
      }),
    ).toBe(true);
  });

  it("rejects profiles with email_verified === false", () => {
    expect(
      isVerifiedOAuthProfile({
        email: "alice@example.com",
        email_verified: false,
      }),
    ).toBe(false);
  });

  it("rejects profiles missing email_verified entirely", () => {
    expect(isVerifiedOAuthProfile({ email: "alice@example.com" })).toBe(false);
  });

  it("rejects truthy-but-not-true sentinels (no string 'true' acceptance)", () => {
    expect(
      isVerifiedOAuthProfile({ email_verified: "true" as unknown }),
    ).toBe(false);
    expect(
      isVerifiedOAuthProfile({ email_verified: 1 as unknown }),
    ).toBe(false);
  });

  it("rejects nullish or non-object input", () => {
    expect(isVerifiedOAuthProfile(null)).toBe(false);
    expect(isVerifiedOAuthProfile(undefined)).toBe(false);
    expect(isVerifiedOAuthProfile("verified")).toBe(false);
    expect(isVerifiedOAuthProfile(42)).toBe(false);
  });
});
