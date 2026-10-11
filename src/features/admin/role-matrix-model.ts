import type { RoleInfo } from "./hierarchy";
import { groupPermissions } from "./permission-groups";
import { canEditRolePermission, permissionLabel } from "./permission-rules";
import { roleDescription } from "./role-descriptions";

/** The role that holds every permission and cannot be edited (locked in the database). */
export const SUPER_ADMIN_ROLE = "super_admin";

/** What the caller can do with the displayed role. */
export type RoleStatus = "editable" | "readonly" | "locked";

/** A role of the selector, with the number of permissions it holds. */
export type RoleOverview = { key: string; label: string; grantedCount: number };

/** One permission of the displayed role. */
export type PermissionRow = {
  key: string;
  label: string;
  granted: boolean;
  /** The caller may flip it (a switch is shown); otherwise it is only displayed. */
  editable: boolean;
  /** Why an otherwise editable role cannot grant this permission. */
  hint?: string;
};

/** A group of permission rows. */
export type PermissionSection = {
  id: string;
  label: string;
  rows: PermissionRow[];
  grantedCount: number;
};

/** Everything the page shows: the selector and the displayed role with its grouped permissions. */
export type RoleMatrixModel = {
  roles: RoleOverview[];
  selected: {
    key: string;
    label: string;
    /** What the role is for, `null` for a role this version does not know. */
    description: string | null;
    status: RoleStatus;
    note: string;
    grantedCount: number;
    total: number;
    sections: PermissionSection[];
  };
};

const NOTES: Record<RoleStatus, string> = {
  locked: "Toutes les permissions, non modifiable (verrou en base de données).",
  readonly: "Rôle au niveau du tien ou au-dessus : tu peux le consulter, pas le modifier.",
  editable: "Tu peux modifier ce rôle, mais tu n'accordes que les permissions que tu possèdes.",
};

const NOT_HELD_HINT = "Tu ne possèdes pas cette permission.";

/**
 * Role shown when none is requested: the highest role below the caller's (the one they are most likely to
 * edit), else the caller's own role, else the highest one.
 */
export function defaultRoleKey(roles: RoleInfo[], callerRank: number | undefined): string | null {
  const byRankDesc = [...roles].sort((a, b) => b.rank - a.rank);
  const below = byRankDesc.find((role) => callerRank !== undefined && role.rank < callerRank);
  const own = byRankDesc.find((role) => role.rank === callerRank);
  return (below ?? own ?? byRankDesc[0])?.key ?? null;
}

/** Builds the model of the page. Pure: the database stays authoritative, this only mirrors its rules. */
export function buildRoleMatrixModel(input: {
  roles: RoleInfo[];
  permissions: { key: string; description?: string }[];
  /** `role:permission` pairs held through `role_permissions` (`super_admin` is implicit). */
  held: ReadonlySet<string>;
  caller: { role: string | null; permissions: readonly string[] };
  requestedRole?: string | null;
}): RoleMatrixModel | null {
  const { roles, permissions, held, caller } = input;
  const callerRank = roles.find((role) => role.key === caller.role)?.rank;
  const holds = (role: string, permission: string) =>
    role === SUPER_ADMIN_ROLE || held.has(`${role}:${permission}`);

  const ordered = [...roles].sort((a, b) => b.rank - a.rank);
  const requested = ordered.find((role) => role.key === input.requestedRole);
  const selectedRole =
    requested ?? ordered.find((role) => role.key === defaultRoleKey(roles, callerRank));
  if (!selectedRole) return null;

  const locked = selectedRole.key === SUPER_ADMIN_ROLE;
  const roleEditable = !locked && callerRank !== undefined && selectedRole.rank < callerRank;
  const status: RoleStatus = locked ? "locked" : roleEditable ? "editable" : "readonly";

  const sections = groupPermissions(permissions).map((group): PermissionSection => {
    const rows = group.items.map((permission): PermissionRow => {
      const granted = holds(selectedRole.key, permission.key);
      const callerHolds = caller.permissions.includes(permission.key);
      const editable =
        !locked &&
        canEditRolePermission({
          callerRank,
          roleRank: selectedRole.rank,
          currentlyGranted: granted,
          callerHolds,
        });
      const blockedByEscalation = roleEditable && !granted && !callerHolds;
      return {
        key: permission.key,
        label: permissionLabel(permission.key, permission.description),
        granted,
        editable,
        ...(blockedByEscalation ? { hint: NOT_HELD_HINT } : {}),
      };
    });
    return {
      id: group.id,
      label: group.label,
      rows,
      grantedCount: rows.filter((row) => row.granted).length,
    };
  });

  const total = permissions.length;
  return {
    roles: ordered.map((role) => ({
      key: role.key,
      label: role.label,
      grantedCount: permissions.filter((permission) => holds(role.key, permission.key)).length,
    })),
    selected: {
      key: selectedRole.key,
      label: selectedRole.label,
      description: roleDescription(selectedRole.key),
      status,
      note: NOTES[status],
      grantedCount: sections.reduce((sum, section) => sum + section.grantedCount, 0),
      total,
      sections,
    },
  };
}
