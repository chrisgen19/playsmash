/**
 * Pure name-matching helper for the duplicate temporary-player linker.
 *
 * When a real user joins a group that already has a temporary PlayerProfile
 * with a similar name (an admin typed "Bob" before Bob registered), we want
 * to suggest linking the two rather than leaving a duplicate. This module is
 * the matching logic — no DB — so it's easy to unit-test.
 */

export type TempPlayerLike = { id: string; displayName: string };
export type UserLike = { userId: string; displayName: string };

export type DuplicateSuggestion = {
  tempPlayerId: string;
  tempDisplayName: string;
  userId: string;
  userDisplayName: string;
};

/** Lowercase, trim, collapse internal whitespace. */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * True when two names are "close enough" to suggest a link:
 *   - identical after normalization, OR
 *   - one normalized name fully contains the other (e.g. "Bob" vs
 *     "Bob Smith"), provided the shorter side is at least 2 chars so a
 *     stray initial doesn't match everyone.
 */
export function namesLikelyMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na.length === 0 || nb.length === 0) return false;
  if (na === nb) return true;
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  if (short.length < 2) return false;
  return long.includes(short);
}

/**
 * For each temporary player, find users (members without a profile) whose
 * name likely matches. Returns one suggestion per matching pair.
 */
export function suggestDuplicateLinks(
  tempPlayers: readonly TempPlayerLike[],
  users: readonly UserLike[],
): DuplicateSuggestion[] {
  const suggestions: DuplicateSuggestion[] = [];
  for (const temp of tempPlayers) {
    for (const user of users) {
      if (namesLikelyMatch(temp.displayName, user.displayName)) {
        suggestions.push({
          tempPlayerId: temp.id,
          tempDisplayName: temp.displayName,
          userId: user.userId,
          userDisplayName: user.displayName,
        });
      }
    }
  }
  return suggestions;
}
