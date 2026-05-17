import { GroupRole } from "@/lib/db/generated/enums";

export type GroupRoleValue = (typeof GroupRole)[keyof typeof GroupRole];

/**
 * Ordered from highest to lowest privilege. OWNER ⊇ ADMIN ⊇ PLAYER ⊇ VIEWER.
 * Callers passing `["ADMIN"]` to a check will accept OWNER as well.
 */
const ROLE_RANK: Record<GroupRoleValue, number> = {
  [GroupRole.OWNER]: 4,
  [GroupRole.ADMIN]: 3,
  [GroupRole.PLAYER]: 2,
  [GroupRole.VIEWER]: 1,
};

export function roleSatisfies(
  actual: GroupRoleValue,
  required: GroupRoleValue,
): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

/**
 * Picks the lowest-ranked role from `allowed` (the most permissive option)
 * and checks `actual` against it. Empty list denies everyone.
 */
export function roleSatisfiesAny(
  actual: GroupRoleValue,
  allowed: readonly GroupRoleValue[],
): boolean {
  if (allowed.length === 0) return false;
  const minRequired = allowed.reduce(
    (min, r) => (ROLE_RANK[r] < ROLE_RANK[min] ? r : min),
    allowed[0],
  );
  return roleSatisfies(actual, minRequired);
}
