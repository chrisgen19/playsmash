// Crockford base32 minus characters that are easy to misread on a phone.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1
const DEFAULT_LENGTH = 6;
const MAX_ATTEMPTS = 8;

/** Random join code, e.g. "K7P2QH". Length defaults to 6. */
export function generateJoinCode(length = DEFAULT_LENGTH): string {
  if (length < 4 || length > 16) {
    throw new RangeError("Join code length must be between 4 and 16");
  }
  const bytes = new Uint8Array(length);
  // crypto is globally available on Node 20+ and the edge runtime.
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/**
 * Generate a unique join code by retrying on collision. `exists` is the
 * collision check (a DB lookup at call sites; injectable here for testing).
 */
export async function generateUniqueJoinCode(
  exists: (code: string) => Promise<boolean>,
  length = DEFAULT_LENGTH,
): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateJoinCode(length);
    if (!(await exists(code))) return code;
  }
  throw new Error(
    `Could not generate a unique join code after ${MAX_ATTEMPTS} attempts`,
  );
}
