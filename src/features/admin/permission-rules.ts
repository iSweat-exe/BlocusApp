/** French labels of the permissions of the catalogue (the database descriptions are in English). */
const PERMISSION_LABELS: Record<string, string> = {
  "announcement.publish": "Publier des annonces",
  "announcement.delete": "Supprimer des annonces",
  "map.route.edit": "Modifier le tracé de la carte",
  "map.position.declare": "Déclarer la position de la manifestation",
  "user.mute": "Rendre muet un utilisateur",
  "user.ban": "Bannir un utilisateur",
  "role.assign": "Attribuer des rôles",
  "audit.read": "Consulter le journal d'audit",
  "permission.manage": "Gérer les permissions",
  "event.create": "Créer des événements",
  "event.delete": "Supprimer des événements",
  "event.finish": "Marquer des événements comme terminés",
};

/** Label shown for a permission, falling back to its description, then its key. */
export function permissionLabel(key: string, description?: string): string {
  return PERMISSION_LABELS[key] ?? description ?? key;
}

/** Per-user override, as stored in `permission_overrides`. */
export type OverrideEffect = "grant" | "deny";

/** Narrows a stored `effect` value to a known override, or `null`. */
export function toOverride(effect: string | null | undefined): OverrideEffect | null {
  return effect === "grant" || effect === "deny" ? effect : null;
}

/** Result of combining a role permission with a per-user override (deny wins). */
export type EffectiveState = {
  allowed: boolean;
  source: "role" | "grant" | "deny" | "none";
};

/** Same rule as `effective_permissions()` in the database, used to display the outcome. */
export function effectiveState(roleHas: boolean, override: OverrideEffect | null): EffectiveState {
  if (override === "deny") return { allowed: false, source: "deny" };
  if (override === "grant") return { allowed: true, source: "grant" };
  return roleHas ? { allowed: true, source: "role" } : { allowed: false, source: "none" };
}

/**
 * Whether the caller may flip a role permission. Mirrors `set_role_permission()`: the role must rank
 * strictly below the caller, and granting requires holding the permission (no escalation).
 */
export function canEditRolePermission(input: {
  callerRank: number | undefined;
  roleRank: number;
  currentlyGranted: boolean;
  callerHolds: boolean;
}): boolean {
  if (input.callerRank === undefined || input.roleRank >= input.callerRank) return false;
  return input.currentlyGranted ? true : input.callerHolds;
}

/** Whether the caller may grant an override: only permissions they hold themselves. */
export function canGrantOverride(callerHolds: boolean): boolean {
  return callerHolds;
}
