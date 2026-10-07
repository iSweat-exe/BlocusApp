/** Permissions that open the admin area (each section then checks its own permission). */
export const ADMIN_AREA_PERMISSIONS = [
  "role.assign",
  "user.ban",
  "user.mute",
  "permission.manage",
  "audit.read",
] as const;

/** Whether at least one of the given permissions is held. For display: the database enforces. */
export function hasAnyPermission(held: readonly string[], wanted: readonly string[]): boolean {
  return wanted.some((permission) => held.includes(permission));
}

/** Whether the user may enter the admin area. */
export function canAccessAdmin(held: readonly string[]): boolean {
  return hasAnyPermission(held, ADMIN_AREA_PERMISSIONS);
}
