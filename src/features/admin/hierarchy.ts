/** A role of the hierarchy, as stored in the `roles` table. */
export type RoleInfo = { key: string; label: string; rank: number };

/** Returns the rank of a role key, or `undefined` when unknown. */
export function rankOf(roles: RoleInfo[], key: string | null): number | undefined {
  return roles.find((role) => role.key === key)?.rank;
}

/**
 * Whether the caller may change the role of a target user. Mirrors `assign_role()` in the database
 * (which stays authoritative): never yourself, and only users ranking strictly below you.
 */
export function canManageUser(
  callerRank: number | undefined,
  targetRank: number | undefined,
  isSelf: boolean,
): boolean {
  if (isSelf || callerRank === undefined || targetRank === undefined) return false;
  return targetRank < callerRank;
}

/** Roles the caller may grant: strictly below their own rank, lowest first. */
export function assignableRoles(roles: RoleInfo[], callerRank: number | undefined): RoleInfo[] {
  if (callerRank === undefined) return [];
  return roles.filter((role) => role.rank < callerRank).sort((a, b) => a.rank - b.rank);
}
