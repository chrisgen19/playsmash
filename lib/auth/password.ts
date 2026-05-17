import bcrypt from "bcryptjs";

// Cost factor 10 is a sensible MVP default; bump to 12+ for production if
// hashing latency is acceptable on your target hardware.
const COST = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
