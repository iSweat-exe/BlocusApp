/**
 * Permissions that open the admin area (each section then checks its own permission). `user.mute` is not one of
 * them for now: muting has no backend yet, so it would only open a screen with nothing to do for a moderator, who
 * deletes and closes content right where it is shown. Add it back with the messaging.
 */
export const ADMIN_AREA_PERMISSIONS = [
  "role.assign",
  "user.ban",
  "permission.manage",
  "audit.read",
  "monitoring.view",
  "statistics.view",
] as const;

/** Whether at least one of the given permissions is held. For display: the database enforces. */
export function hasAnyPermission(held: readonly string[], wanted: readonly string[]): boolean {
  return wanted.some((permission) => held.includes(permission));
}

/** Whether the user may enter the admin area. */
export function canAccessAdmin(held: readonly string[]): boolean {
  return hasAnyPermission(held, ADMIN_AREA_PERMISSIONS);
}
