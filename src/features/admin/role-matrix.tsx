import Link from "next/link";
import { CheckIcon, LockIcon } from "@/components/icons";
import { listRolePermissions, listPermissions } from "@/lib/data/permissions";
import { listRoles } from "@/lib/data/profiles";
import type { SessionPermissions } from "@/server/session";
import { RolePermissionSwitch } from "./permission-forms";
import { RoleSelector } from "./role-selector";
import {
  buildRoleMatrixModel,
  type PermissionRow,
  type RoleMatrixModel,
  type RoleStatus,
} from "./role-matrix-model";

const STATUS: Record<RoleStatus, { label: string; className: string; locked: boolean }> = {
  editable: { label: "Modifiable", className: "bg-success/15 text-success", locked: false },
  readonly: { label: "Lecture seule", className: "bg-foreground/10 text-muted", locked: true },
  locked: { label: "Verrouillé", className: "bg-foreground/10 text-muted", locked: true },
};

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;

/** Right side of a row: a switch when the caller may flip it, else what the role holds. */
function RowControl({
  row,
  roleKey,
  roleLabel,
}: {
  row: PermissionRow;
  roleKey: string;
  roleLabel: string;
}) {
  if (row.editable) {
    return (
      <RolePermissionSwitch
        role={roleKey}
        permission={row.key}
        currentlyGranted={row.granted}
        label={`${row.label} (${roleLabel})`}
      />
    );
  }
  return row.granted ? (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-success">
      <CheckIcon className="h-4 w-4" />
      Accordée
    </span>
  ) : (
    <span className="shrink-0 text-sm text-faint">Non accordée</span>
  );
}

/** The page, from a model: pure, so it renders the same with any data. */
export function RoleMatrixView({
  model,
  canReadJournal = false,
}: {
  model: RoleMatrixModel;
  canReadJournal?: boolean;
}) {
  const { selected } = model;
  const status = STATUS[selected.status];
  const percent =
    selected.total > 0 ? Math.round((selected.grantedCount / selected.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-section">
      <RoleSelector roles={model.roles} selectedKey={selected.key} />

      <section aria-labelledby="role-title" className="card flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id="role-title" className="truncate text-xl font-extrabold tracking-tight">
              {selected.label}
            </h3>
            <p className="text-sm text-muted">
              <span className="font-semibold tabular-nums text-foreground">
                {selected.grantedCount}
              </span>{" "}
              sur {plural(selected.total, "permission")}
            </p>
          </div>
          <span className={`chip shrink-0 gap-1.5 ${status.className}`}>
            {status.locked && <LockIcon className="h-3.5 w-3.5" />}
            {status.label}
          </span>
        </div>
        <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
          <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
        </div>
        <p className="text-xs text-muted">{selected.note}</p>
      </section>

      {selected.sections.length === 0 && (
        <p className="text-sm text-muted">Aucune permission dans le catalogue.</p>
      )}

      {selected.sections.map((section) => (
        <section
          key={section.id}
          aria-labelledby={`group-${section.id}`}
          className="flex flex-col gap-2"
        >
          <div className="flex items-baseline justify-between">
            <h4 id={`group-${section.id}`} className="section-title">
              {section.label}
            </h4>
            <span className="px-1 text-xs tabular-nums text-faint">
              {section.grantedCount}/{section.rows.length}
            </span>
          </div>
          <ul className="card divide-y divide-line overflow-hidden">
            {section.rows.map((row) => (
              <li key={row.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{row.label}</p>
                  <p className="truncate font-mono text-xs text-faint">{row.key}</p>
                  {row.hint && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                      <LockIcon className="h-3 w-3 shrink-0" />
                      {row.hint}
                    </p>
                  )}
                </div>
                <RowControl row={row} roleKey={selected.key} roleLabel={selected.label} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="px-1 text-xs text-faint">
        Chaque modification est enregistrée dans le journal d&apos;audit
        {canReadJournal && (
          <>
            {" · "}
            <Link
              href="/admin/journal"
              prefetch={false}
              className="font-medium text-muted underline underline-offset-2"
            >
              Voir le journal
            </Link>
          </>
        )}
        .
      </p>
    </div>
  );
}

/** Role x permission screen: one role at a time, permissions grouped, editable within the hierarchy. */
export async function RoleMatrix({
  session,
  requestedRole,
}: {
  session: SessionPermissions;
  requestedRole?: string;
}) {
  const [roles, permissions, links] = await Promise.all([
    listRoles(),
    listPermissions(),
    listRolePermissions(),
  ]);

  if (!roles.ok || !permissions.ok || !links.ok) {
    return (
      <p role="alert" className="alert alert-error">
        Impossible de charger les permissions pour le moment.
      </p>
    );
  }

  const model = buildRoleMatrixModel({
    roles: roles.value,
    permissions: permissions.value.map((permission) => ({
      key: permission.key,
      description: permission.description,
    })),
    held: new Set(links.value.map((link) => `${link.role}:${link.permission}`)),
    caller: { role: session.role, permissions: session.permissions },
    requestedRole,
  });

  if (!model) {
    return (
      <p role="alert" className="alert alert-error">
        Aucun rôle n&apos;est défini.
      </p>
    );
  }

  return (
    <RoleMatrixView model={model} canReadJournal={session.permissions.includes("audit.read")} />
  );
}
