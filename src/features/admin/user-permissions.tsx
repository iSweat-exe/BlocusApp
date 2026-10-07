import { listPermissions, listRolePermissions, listUserOverrides } from "@/lib/data/permissions";
import { UserOverrideControls } from "./permission-forms";
import { canGrantOverride, effectiveState, permissionLabel, toOverride } from "./permission-rules";

const SOURCE_LABELS = {
  role: "Via le rôle",
  grant: "Accordée à cet utilisateur",
  deny: "Refusée à cet utilisateur",
  none: "Non accordée",
} as const;

/**
 * Permission overrides of one user: the effective state of every permission and the controls to
 * grant, deny or reset it. Rendered only for callers who may manage this user.
 */
export async function UserPermissions({
  targetId,
  targetRole,
  callerPermissions,
}: {
  targetId: string;
  targetRole: string;
  callerPermissions: string[];
}) {
  const [permissions, links, overrides] = await Promise.all([
    listPermissions(),
    listRolePermissions(),
    listUserOverrides(targetId),
  ]);

  if (!permissions.ok || !links.ok || !overrides.ok) {
    return (
      <p role="alert" className="alert alert-error">
        Impossible de charger les permissions de cet utilisateur.
      </p>
    );
  }

  const roleHas = new Set(
    links.value.filter((link) => link.role === targetRole).map((link) => link.permission),
  );
  const overrideOf = new Map(overrides.value.map((item) => [item.permission, item.effect]));

  return (
    <section aria-labelledby="permissions-title" className="flex flex-col gap-2">
      <h3 id="permissions-title" className="font-semibold">
        Permissions
      </h3>
      <p className="text-xs text-muted">
        Un refus l&apos;emporte sur le rôle. Tu ne peux accorder qu&apos;une permission que tu
        possèdes.
      </p>
      <ul className="divide-y divide-foreground/10 card px-4">
        {permissions.value.map((permission) => {
          const override = toOverride(overrideOf.get(permission.key));
          const state = effectiveState(roleHas.has(permission.key), override);
          return (
            <li key={permission.key} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm">{permissionLabel(permission.key, permission.description)}</p>
                <p className={`text-xs ${state.allowed ? "text-success" : "text-muted"}`}>
                  {SOURCE_LABELS[state.source]}
                </p>
              </div>
              <UserOverrideControls
                target={targetId}
                permission={permission.key}
                override={override}
                canGrant={canGrantOverride(callerPermissions.includes(permission.key))}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
