import Link from "next/link";
import { listAuditLogs } from "@/lib/data/audit";
import { listPermissions } from "@/lib/data/permissions";
import { getPseudos, listRoles } from "@/lib/data/profiles";
import { AUDIT_ACTIONS, describeAuditEntry, formatAuditDate, type JournalParams } from "./audit";
import { permissionLabel } from "./permission-rules";

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
      <p role="alert" className="text-sm text-red-500">
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
        <select
          name="action"
          defaultValue={params.action ?? ""}
          aria-label="Type d'action"
          className="min-w-0 flex-1 rounded border border-foreground/20 bg-background px-3 py-2"
        >
          <option value="">Toutes les actions</option>
          {Object.entries(AUDIT_ACTIONS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded bg-foreground/10 px-4 py-2 text-sm font-medium">
          Filtrer
        </button>
      </form>

      {page.value.entries.length === 0 ? (
        <p className="text-sm text-foreground/60">Aucune entrée.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {page.value.entries.map((entry) => (
            <li key={entry.id} className="rounded-lg border border-foreground/10 p-3">
              <p className="text-sm">{describeAuditEntry(entry, names)}</p>
              <time dateTime={entry.created_at} className="text-xs text-foreground/60">
                {formatAuditDate(entry.created_at)}
              </time>
            </li>
          ))}
        </ol>
      )}

      <nav aria-label="Pagination du journal" className="flex justify-between text-sm">
        {params.before ? (
          <Link href={journalHref(params.action)} prefetch={false} className="underline">
            ← Plus récentes
          </Link>
        ) : (
          <span />
        )}
        {page.value.nextCursor && (
          <Link
            href={journalHref(params.action, page.value.nextCursor)}
            prefetch={false}
            className="underline"
          >
            Plus anciennes →
          </Link>
        )}
      </nav>
    </div>
  );
}
