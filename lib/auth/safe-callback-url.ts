/**
 * Restrict an untrusted `callbackUrl` to a same-origin path. Anything else
 * (absolute URLs, protocol-relative `//evil.com`, `javascript:` URIs, empty)
 * is collapsed to the fallback so /login?callbackUrl=https://attacker.example
 * can't redirect the user off-site.
 */
export function safeCallbackUrl(
  candidate: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (typeof candidate !== "string") return fallback;
  // Must start with a single "/" — `//host` is protocol-relative and counts
  // as an external URL to the browser. Reject anything else.
  if (!candidate.startsWith("/")) return fallback;
  if (candidate.startsWith("//")) return fallback;
  if (candidate.startsWith("/\\")) return fallback; // edge-case path normalization
  return candidate;
}
