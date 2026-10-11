import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { ChipTabs } from "@/components/chip-tabs";
import {
  BanIcon,
  CalendarIcon,
  LockIcon,
  MapIcon,
  ShieldIcon,
  WrenchIcon,
} from "@/components/icons";
import { listAuditLogs } from "@/lib/data/audit";
import { listPermissions } from "@/lib/data/permissions";
import { getPseudos, listRoles } from "@/lib/data/profiles";
import {
  AUDIT_CATEGORIES,
  categoryOfAction,
  bindQuotationMarks,
  describeAuditEntryParts,
  formatAuditDate,
  formatAuditTime,
  groupAuditByDay,
  type AuditEntryView,
  type AuditNames,
  type JournalParams,
} from "./audit";
import { permissionLabel } from "./permission-rules";

/** Icon and colors of each family of actions: the eye finds the kind of an entry before reading it. */
const CATEGORY_STYLE: Record<
  string,
  { Icon: ComponentType<SVGProps<SVGSVGElement>>; className: string }
> = {
  roles: { Icon: ShieldIcon, className: "bg-accent/15 text-accent" },
  permissions: { Icon: LockIcon, className: "bg-warning/15 text-warning" },
  sanctions: { Icon: BanIcon, className: "bg-danger/15 text-danger" },
  calendar: { Icon: CalendarIcon, className: "bg-success/15 text-success" },
  map: { Icon: MapIcon, className: "bg-foreground/10 text-muted" },
  other: { Icon: WrenchIcon, className: "bg-foreground/10 text-muted" },
};

const categoryLabel = (id: string) =>
  AUDIT_CATEGORIES.find((category) => category.id === id)?.label ?? "Autre";

/** Builds a journal URL keeping the family and an optional cursor. */
function journalHref(category: string | null, before?: number | null): string {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (before) params.set("before", String(before));
  const query = params.toString();
  return query ? `/admin/journal?${query}` : "/admin/journal";
}

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;

/** The page, from loaded data: pure, so it renders the same with any entries. */
export function JournalFeed({
  entries,
  names,
  params,
  nextCursor,
  now,
}: {
  entries: AuditEntryView[];
  names: AuditNames;
  params: JournalParams;
  nextCursor: number | null;
  now?: Date;
}) {
  const days = groupAuditByDay(entries, now);

  return (
    <div className="flex flex-col gap-section">
      <ChipTabs
        label="Catégories d'actions"
        activeKey={params.category ?? "all"}
        tabs={[
          { key: "all", label: "Tout", href: journalHref(null) },
          ...AUDIT_CATEGORIES.map((category) => ({
            key: category.id,
            label: category.label,
            href: journalHref(category.id),
          })),
        ]}
      />

      {entries.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
          <span
            aria-hidden="true"
            className="grid size-12 place-items-center rounded-full bg-foreground/10 text-muted"
          >
            <ShieldIcon className="size-6" />
          </span>
          <div>
            <p className="font-semibold">
              {params.category ? "Aucune action de ce type" : "Aucune action enregistrée"}
            </p>
            <p className="mt-1 text-sm text-muted">
              {params.before
                ? "Il n'y a pas d'entrées plus anciennes."
                : params.category
                  ? `Rien dans la catégorie « ${categoryLabel(params.category)} » pour le moment.`
                  : "Les changements de rôle, de permissions et les sanctions apparaîtront ici."}
            </p>
          </div>
          {(params.category || params.before) && (
            <Link href={journalHref(null)} prefetch={false} className="btn btn-outline btn-sm">
              Voir toutes les actions
            </Link>
          )}
        </div>
      ) : (
        <>
          <p className="px-1 text-xs tabular-nums text-faint">
            {plural(entries.length, "entrée")}
            {params.category && ` · ${categoryLabel(params.category)}`}
            {params.before && " · plus anciennes"}
          </p>

          {days.map((day) => (
            <section
              key={day.key}
              aria-labelledby={`day-${day.key}`}
              className="flex flex-col gap-2"
            >
              <h3 id={`day-${day.key}`} className="section-title">
                {day.label}
              </h3>
              <ol className="card divide-y divide-line overflow-hidden">
                {day.entries.map((entry) => {
                  const category = categoryOfAction(entry.action);
                  const { Icon, className } = CATEGORY_STYLE[category] ?? CATEGORY_STYLE.other!;
                  return (
                    <li key={entry.id} className="flex gap-3 px-4 py-3">
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-full ${className}`}
                      >
                        <Icon className="size-[18px]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-snug text-muted">
                          {describeAuditEntryParts(entry, names).map((part, index) =>
                            part.strong ? (
                              <strong key={index} className="font-semibold text-foreground">
                                {part.text}
                              </strong>
                            ) : (
                              bindQuotationMarks(part.text)
                            ),
                          )}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-faint">
                          <time
                            dateTime={entry.created_at}
                            title={formatAuditDate(entry.created_at)}
                            className="tabular-nums"
                          >
                            {formatAuditTime(entry.created_at)}
                          </time>
                          <span aria-hidden="true">·</span>
                          {categoryLabel(category)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </>
      )}

      {(nextCursor || params.before) && (
        <nav aria-label="Pagination du journal" className="flex flex-col gap-2">
          {nextCursor && (
            <Link
              href={journalHref(params.category, nextCursor)}
              prefetch={false}
              className="btn btn-outline w-full"
            >
              Voir les entrées plus anciennes
            </Link>
          )}
          {params.before && entries.length > 0 && (
            <Link
              href={journalHref(params.category)}
              prefetch={false}
              className="btn btn-secondary w-full"
            >
              Revenir aux plus récentes
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

/** Read-only journal of administrative actions, with a filter by family and cursor pagination. */
export async function JournalView({ params }: { params: JournalParams }) {
  const actions = AUDIT_CATEGORIES.find((category) => category.id === params.category)?.actions;
  const [page, roles, permissions] = await Promise.all([
    listAuditLogs({ actions, before: params.before }),
    listRoles(),
    listPermissions(),
  ]);

  if (!page.ok) {
    return (
      <p role="alert" className="alert alert-error">
        Impossible de charger le journal pour le moment.
      </p>
    );
  }

  const ids = page.value.entries.flatMap((entry) => [entry.actor_id, entry.target_id]);
  const pseudos = await getPseudos(ids.filter((id): id is string => id !== null));
  const descriptions = new Map(
    (permissions.ok ? permissions.value : []).map((item) => [item.key, item.description]),
  );
  const names: AuditNames = {
    users: pseudos.ok ? pseudos.value : new Map<string, string>(),
    roles: new Map((roles.ok ? roles.value : []).map((role) => [role.key, role.label])),
    permissions: (key: string) => permissionLabel(key, descriptions.get(key)),
  };

  return (
    <JournalFeed
      entries={page.value.entries}
      names={names}
      params={params}
      nextCursor={page.value.nextCursor}
    />
  );
}
