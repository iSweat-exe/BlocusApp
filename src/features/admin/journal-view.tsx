import Link from "next/link";
import { Select } from "@/components/select";
import { listAuditLogs } from "@/lib/data/audit";
import { listPermissions } from "@/lib/data/permissions";
import { getPseudos, listRoles } from "@/lib/data/profiles";
import { AUDIT_ACTIONS, describeAuditEntry, formatAuditDate, type JournalParams } from "./audit";
import { permissionLabel } from "./permission-rules";

const PAGER =
  "flex min-h-11 items-center rounded-xl bg-foreground/10 px-4 font-medium active:bg-foreground/15";

/** Builds a journal URL keeping the filter and an optional cursor. */
function journalHref(action: string | null, before?: number | null): string {
  const params = new URLSearchParams();
  if (action) params.set("action", action);
  if (before) params.set("before", String(before));
  const query = params.toString();
  return query ? `/admin/journal?${query}` : "/admin/journal";
}

/** Read-only journal of administrative actions, with an action filter and cursor pagination. */
export async function JournalView({ params }: { params: JournalParams }) {
  const [page, roles, permissions] = await Promise.all([
    listAuditLogs({ action: params.action, before: params.before }),
    listRoles(),
    listPermissions(),
  ]);

  if (!page.ok) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400"
      >
        Impossible de charger le journal pour le moment.
      </p>
    );
  }

  const ids = page.value.entries.flatMap((entry) => [entry.actor_id, entry.target_id]);
  const pseudos = await getPseudos(ids.filter((id): id is string => id !== null));
  const descriptions = new Map(
    (permissions.ok ? permissions.value : []).map((item) => [item.key, item.description]),
  );
  const names = {
    users: pseudos.ok ? pseudos.value : new Map<string, string>(),
    roles: new Map((roles.ok ? roles.value : []).map((role) => [role.key, role.label])),
    permissions: (key: string) => permissionLabel(key, descriptions.get(key)),
  };

  return (
    <div className="flex flex-col gap-4">
      <form className="flex gap-2" role="search" aria-label="Filtrer le journal">
        <Select
          name="action"
          label="Type d'action"
          defaultValue={params.action ?? ""}
          options={[
            { value: "", label: "Toutes les actions" },
            ...Object.entries(AUDIT_ACTIONS).map(([value, label]) => ({ value, label })),
          ]}
          className="min-w-0 flex-1"
        />
        <button
          type="submit"
          className="min-h-12 rounded-xl bg-foreground/10 px-5 text-sm font-medium active:bg-foreground/15"
        >
          Filtrer
        </button>
      </form>

      {page.value.entries.length === 0 ? (
        <p className="text-sm text-foreground/60">Aucune entrée.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {page.value.entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4"
            >
              <p className="text-sm">{describeAuditEntry(entry, names)}</p>
              <time dateTime={entry.created_at} className="text-xs text-foreground/60">
                {formatAuditDate(entry.created_at)}
              </time>
            </li>
          ))}
        </ol>
      )}

      <nav aria-label="Pagination du journal" className="flex justify-between gap-3 text-sm">
        {params.before ? (
          <Link href={journalHref(params.action)} prefetch={false} className={PAGER}>
            ← Plus récentes
          </Link>
        ) : (
          <span />
        )}
        {page.value.nextCursor && (
          <Link
            href={journalHref(params.action, page.value.nextCursor)}
            prefetch={false}
            className={PAGER}
          >
            Plus anciennes →
          </Link>
        )}
      </nav>
    </div>
  );
}
