import { describe, expect, it } from "vitest";

import { safeCallbackUrl } from "@/lib/auth/safe-callback-url";

describe("safeCallbackUrl — only same-origin paths allowed", () => {
  it("returns the fallback for nullish or wrong-type input", () => {
    expect(safeCallbackUrl(null)).toBe("/dashboard");
    expect(safeCallbackUrl(undefined)).toBe("/dashboard");
    // @ts-expect-error - intentional: simulating untrusted runtime input
    expect(safeCallbackUrl(42)).toBe("/dashboard");
  });

  it("allows normal same-origin paths", () => {
    expect(safeCallbackUrl("/dashboard")).toBe("/dashboard");
    expect(safeCallbackUrl("/groups/abc")).toBe("/groups/abc");
    expect(safeCallbackUrl("/groups/abc?tab=members")).toBe(
      "/groups/abc?tab=members",
    );
  });

  it("blocks absolute http(s) URLs", () => {
    expect(safeCallbackUrl("https://attacker.example")).toBe("/dashboard");
    expect(safeCallbackUrl("http://attacker.example/path")).toBe("/dashboard");
  });

  it("blocks protocol-relative URLs", () => {
    expect(safeCallbackUrl("//attacker.example")).toBe("/dashboard");
    expect(safeCallbackUrl("//attacker.example/path")).toBe("/dashboard");
  });

  it("blocks backslash-prefixed paths (legacy URL parsers normalize)", () => {
    expect(safeCallbackUrl("/\\attacker.example")).toBe("/dashboard");
  });

  it("blocks javascript: and data: URIs", () => {
    expect(safeCallbackUrl("javascript:alert(1)")).toBe("/dashboard");
    expect(safeCallbackUrl("data:text/html,<script>")).toBe("/dashboard");
  });

  it("blocks bare paths without leading slash", () => {
    expect(safeCallbackUrl("dashboard")).toBe("/dashboard");
    expect(safeCallbackUrl("attacker.example")).toBe("/dashboard");
  });

  it("uses a custom fallback when provided", () => {
    expect(safeCallbackUrl("https://attacker.example", "/")).toBe("/");
  });
});
