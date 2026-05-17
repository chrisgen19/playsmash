/**
 * Tiny deterministic PRNG. Used by the stacking algorithm so a given
 * `(history, seed)` always produces the same round — essential for unit
 * tests and for "regenerate" behavior in the UI to be reproducible.
 *
 * mulberry32 is fine for combinatorial tie-breaks; it is NOT cryptographically
 * secure, and that's intentional. Don't reuse this for tokens or codes.
 */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return function () {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random integer in [0, n). */
export function randInt(rng: Rng, n: number): number {
  return Math.floor(rng() * n);
}

/** Fisher–Yates shuffle, returns a new array. */
export function shuffled<T>(arr: readonly T[], rng: Rng): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
