/** Actions written to the audit log, with the label shown in the filter. */
export const AUDIT_ACTIONS: Record<string, string> = {
  "role.assigned": "Changements de rôle",
  "role_permission.granted": "Permissions de rôle accordées",
  "role_permission.revoked": "Permissions de rôle retirées",
  "user_permission.granted": "Permissions accordées à un utilisateur",
  "user_permission.denied": "Permissions refusées à un utilisateur",
  "user_permission.cleared": "Overrides réinitialisés",
  "event.finished": "Événements terminés",
  "event.reopened": "Événements rouverts",
  "user.banned": "Bans",
  "sanction.revoked": "Sanctions levées",
};

/** An audit log row as needed by the UI. */
export type AuditEntryView = {
  id: number;
  actor_id: string | null;
  action: string;
  target_id: string | null;
  details: unknown;
  created_at: string;
};

/** Display names resolved by the caller (pseudos by user id, role and permission labels by key). */
export type AuditNames = {
  users: Map<string, string>;
  roles: Map<string, string>;
  permissions: (key: string) => string;
};

/** Validated query-string parameters of the journal page. */
export type JournalParams = { action: string | null; before: number | null };

/** Reads the `action` and `before` parameters, ignoring anything invalid. */
export function parseJournalParams(raw: { action?: unknown; before?: unknown }): JournalParams {
  const action = typeof raw.action === "string" && raw.action in AUDIT_ACTIONS ? raw.action : null;
  const before =
    typeof raw.before === "string" && /^[1-9][0-9]{0,15}$/.test(raw.before)
      ? Number(raw.before)
      : null;
  return { action, before };
}

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

/** Formats an ISO date for the journal (Europe/Paris). */
export function formatAuditDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

function detail(details: unknown, key: string): string | undefined {
  if (typeof details !== "object" || details === null) return undefined;
  const value = (details as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

function userName(id: string | null, names: AuditNames): string {
  if (!id) return "Système";
  return names.users.get(id) ?? `compte supprimé (${id.slice(0, 8)})`;
}

/** One-sentence description of an audit entry, in French. Unknown actions are shown as-is. */
export function describeAuditEntry(entry: AuditEntryView, names: AuditNames): string {
  const actor = userName(entry.actor_id, names);
  const target = userName(entry.target_id, names);
  const role = (key: string | undefined) => (key ? (names.roles.get(key) ?? key) : "?");
  const permission = (key: string | undefined) => (key ? names.permissions(key) : "?");

  switch (entry.action) {
    case "role.assigned":
      return `${actor} a changé le rôle de ${target} : ${role(detail(entry.details, "from"))} → ${role(detail(entry.details, "to"))}.`;
    case "role_permission.granted":
      return `${actor} a accordé « ${permission(detail(entry.details, "permission"))} » au rôle ${role(detail(entry.details, "role"))}.`;
    case "role_permission.revoked":
      return `${actor} a retiré « ${permission(detail(entry.details, "permission"))} » au rôle ${role(detail(entry.details, "role"))}.`;
    case "user_permission.granted":
      return `${actor} a accordé « ${permission(detail(entry.details, "permission"))} » à ${target}.`;
    case "user_permission.denied":
      return `${actor} a refusé « ${permission(detail(entry.details, "permission"))} » à ${target}.`;
    case "user_permission.cleared":
      return `${actor} a réinitialisé « ${permission(detail(entry.details, "permission"))} » pour ${target}.`;
    case "user.banned": {
      const until = detail(entry.details, "expires_at");
      const duration = until ? `jusqu'au ${formatAuditDate(until)}` : "définitivement";
      return `${actor} a banni ${target} ${duration} — motif : ${detail(entry.details, "reason") ?? "non précisé"}.`;
    }
    case "event.finished":
      return `${actor} a marqué l'événement « ${detail(entry.details, "title") ?? "?"} » comme terminé.`;
    case "event.reopened":
      return `${actor} a rouvert l'événement « ${detail(entry.details, "title") ?? "?"} ».`;
    case "sanction.revoked":
      return `${actor} a levé une sanction de ${target}.`;
    default:
      return `${actor} : ${entry.action}${entry.target_id ? ` (${target})` : ""}.`;
  }
}
