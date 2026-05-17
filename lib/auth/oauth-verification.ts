/**
 * Reject OAuth profiles that did not assert a verified email. We auto-link
 * OAuth identities to existing credentials accounts by email
 * (`allowDangerousEmailAccountLinking`); without this gate, an unverified
 * profile could take over the password account that owns the email.
 *
 * Google's OIDC payload uses `email_verified: true`. Other providers expose
 * the same field (Auth0, Cognito, Microsoft); add provider-specific shapes
 * here if/when we enable them.
 */
export function isVerifiedOAuthProfile(profile: unknown): boolean {
  if (!profile || typeof profile !== "object") return false;
  return (profile as { email_verified?: unknown }).email_verified === true;
}
