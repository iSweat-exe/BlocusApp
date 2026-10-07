import { listRolePermissions, listPermissions } from "@/lib/data/permissions";
import { listRoles } from "@/lib/data/profiles";
import type { SessionPermissions } from "@/server/session";
import { rankOf } from "./hierarchy";
import { canEditRolePermission, permissionLabel } from "./permission-rules";
import { RolePermissionToggle } from "./permission-forms";

/** Role x permission matrix, one card per role (mobile-first). Editable within the hierarchy. */
export async function RoleMatrix({ session }: { session: SessionPermissions }) {
  const [roles, permissions, links] = await Promise.all([
    listRoles(),
    listPermissions(),
    listRolePermissions(),
  ]);

  if (!roles.ok || !permissions.ok || !links.ok) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400"
      >
        Impossible de charger les permissions pour le moment.
      </p>
    );
  }

  const callerRank = rankOf(roles.value, session.role);
  const granted = new Set(links.value.map((link) => `${link.role}:${link.permission}`));
  // Highest roles first: the most powerful ones are the most important to review.
  const orderedRoles = [...roles.value].sort((a, b) => b.rank - a.rank);

  return (
    <div className="flex flex-col gap-4">
      {orderedRoles.map((role) => (
        <section
          key={role.key}
          aria-labelledby={`role-${role.key}`}
          className="flex flex-col gap-2 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4"
        >
          <h2 id={`role-${role.key}`} className="font-semibold">
            {role.label}
          </h2>
          {role.key === "super_admin" && (
            <p className="text-xs text-foreground/60">
              Toutes les permissions, non modifiable (verrou en base de données).
            </p>
          )}
          <ul className="divide-y divide-foreground/10">
            {permissions.value.map((permission) => {
              const has =
                role.key === "super_admin" || granted.has(`${role.key}:${permission.key}`);
              const editable =
                role.key !== "super_admin" &&
                canEditRolePermission({
                  callerRank,
                  roleRank: role.rank,
                  currentlyGranted: has,
                  callerHolds: session.permissions.includes(permission.key),
                });
              return (
                <li key={permission.key} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm">
                      {permissionLabel(permission.key, permission.description)}
                    </p>
                    <p className="font-mono text-xs text-foreground/60">{permission.key}</p>
                  </div>
                  {editable ? (
                    <RolePermissionToggle
                      role={role.key}
                      permission={permission.key}
                      currentlyGranted={has}
                    />
                  ) : (
                    <span
                      className={`shrink-0 text-sm ${has ? "text-green-600" : "text-foreground/40"}`}
                    >
                      {has ? "Accordée" : "Non accordée"}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
