/** Actions written to the audit log, with a label. */
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
  "map.route_saved": "Tracé de la carte modifié",
  "map.position_declared": "Positions déclarées",
  "map.position_removed": "Positions retirées",
  "security.admin_mfa": "Double authentification des administrateurs",
};

/** Families of actions, the filter of the journal. Every known action belongs to exactly one. */
export const AUDIT_CATEGORIES = [
  { id: "roles", label: "Rôles", actions: ["role.assigned"] },
  {
    id: "permissions",
    label: "Permissions",
    actions: [
      "role_permission.granted",
      "role_permission.revoked",
      "user_permission.granted",
      "user_permission.denied",
      "user_permission.cleared",
    ],
  },
  { id: "sanctions", label: "Sanctions", actions: ["user.banned", "sanction.revoked"] },
  { id: "calendar", label: "Calendrier", actions: ["event.finished", "event.reopened"] },
  {
    id: "map",
    label: "Carte",
    actions: ["map.route_saved", "map.position_declared", "map.position_removed"],
  },
  { id: "security", label: "Sécurité", actions: ["security.admin_mfa"] },
] as const;

/** Id of the family of an action; `other` for an action this version does not know yet. */
export function categoryOfAction(action: string): string {
  return (
    AUDIT_CATEGORIES.find((category) => (category.actions as readonly string[]).includes(action))
      ?.id ?? "other"
  );
}

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
export type JournalParams = { category: string | null; before: number | null };

/**
 * Reads the `category` and `before` parameters, ignoring anything invalid. The former `action` parameter (one
 * action, from the old filter) still works: it opens the family of that action.
 */
export function parseJournalParams(raw: {
  category?: unknown;
  action?: unknown;
  before?: unknown;
}): JournalParams {
  const known = (id: unknown): id is string =>
    typeof id === "string" && AUDIT_CATEGORIES.some((category) => category.id === id);
  const legacy =
    typeof raw.action === "string" && raw.action in AUDIT_ACTIONS
      ? categoryOfAction(raw.action)
      : null;
  const category = known(raw.category) ? raw.category : legacy;
  const before =
    typeof raw.before === "string" && /^[1-9][0-9]{0,15}$/.test(raw.before)
      ? Number(raw.before)
      : null;
  return { category, before };
}

const TIME_ZONE = "Europe/Paris";

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: TIME_ZONE,
});
const timeFormat = new Intl.DateTimeFormat("fr-FR", { timeStyle: "short", timeZone: TIME_ZONE });
const dayFormat = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: TIME_ZONE,
});
const dayYearFormat = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: TIME_ZONE,
});
// `en-CA` writes `2026-10-07`: a sortable key of the calendar day in Paris.
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: TIME_ZONE,
});

/** Formats an ISO date for the journal (Europe/Paris). */
export function formatAuditDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

/** Time of day of an entry (`23:24`, Europe/Paris): the day is the heading of its group. */
export function formatAuditTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

/** Calendar day of an instant in Paris, as `2026-10-07`. */
export function auditDayKey(iso: string): string {
  return dayKeyFormat.format(new Date(iso));
}

/** « Aujourd'hui », « Hier », then the weekday and date (with the year when it is not the current one). */
export function formatAuditDay(iso: string, now: Date = new Date()): string {
  const key = auditDayKey(iso);
  const today = auditDayKey(now.toISOString());
  if (key === today) return "Aujourd'hui";
  // Calendar arithmetic on the key, not "24 hours ago": a day can last 23 or 25 hours when the clocks change.
  const [year = 1970, month = 1, day = 1] = today.split("-").map(Number);
  const yesterday = new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
  if (key === yesterday) return "Hier";
  return (key.slice(0, 4) === today.slice(0, 4) ? dayFormat : dayYearFormat).format(new Date(iso));
}

/** Entries of one calendar day, in the order received (newest first). */
export type AuditDay<T> = { key: string; label: string; entries: T[] };

/** Groups entries (newest first) by calendar day in Paris, for the headings of the journal. */
export function groupAuditByDay<T extends { created_at: string }>(
  entries: T[],
  now: Date = new Date(),
): AuditDay<T>[] {
  const days: AuditDay<T>[] = [];
  for (const entry of entries) {
    const key = auditDayKey(entry.created_at);
    const last = days.at(-1);
    if (last?.key === key) last.entries.push(entry);
    else days.push({ key, label: formatAuditDay(entry.created_at, now), entries: [entry] });
  }
  return days;
}

/** A piece of a sentence; `strong` ones are names (people, roles, permissions, events) to stand out. */
export type SentencePart = { text: string; strong?: boolean };

const strong = (text: string): SentencePart => ({ text, strong: true });

/** Template tag: text and interpolated values (plain or `strong`) become the parts of a sentence. */
function sentence(
  strings: TemplateStringsArray,
  ...values: (string | SentencePart)[]
): SentencePart[] {
  const parts: SentencePart[] = [];
  strings.forEach((text, index) => {
    if (text) parts.push({ text });
    const value = values[index];
    if (value !== undefined) parts.push(typeof value === "string" ? { text: value } : value);
  });
  return parts;
}

function detail(details: unknown, key: string): string | undefined {
  if (typeof details !== "object" || details === null) return undefined;
  const value = (details as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

function detailNumber(details: unknown, key: string): number | undefined {
  if (typeof details !== "object" || details === null) return undefined;
  const value = (details as Record<string, unknown>)[key];
  return typeof value === "number" ? value : undefined;
}

function userName(id: string | null, names: AuditNames): string {
  if (!id) return "Système";
  return names.users.get(id) ?? `compte supprimé (${id.slice(0, 8)})`;
}

/** One-sentence description of an audit entry, in French, as parts: the names are marked `strong`. */
export function describeAuditEntryParts(entry: AuditEntryView, names: AuditNames): SentencePart[] {
  const actor = strong(userName(entry.actor_id, names));
  const target = strong(userName(entry.target_id, names));
  const role = (key: string | undefined) => strong(key ? (names.roles.get(key) ?? key) : "?");
  const permission = (key: string | undefined) => strong(key ? names.permissions(key) : "?");
  const title = strong(detail(entry.details, "title") ?? "?");

  switch (entry.action) {
    case "role.assigned":
      return sentence`${actor} a changé le rôle de ${target} : ${role(detail(entry.details, "from"))} → ${role(detail(entry.details, "to"))}.`;
    case "role_permission.granted":
      return sentence`${actor} a accordé « ${permission(detail(entry.details, "permission"))} » au rôle ${role(detail(entry.details, "role"))}.`;
    case "role_permission.revoked":
      return sentence`${actor} a retiré « ${permission(detail(entry.details, "permission"))} » au rôle ${role(detail(entry.details, "role"))}.`;
    case "user_permission.granted":
      return sentence`${actor} a accordé « ${permission(detail(entry.details, "permission"))} » à ${target}.`;
    case "user_permission.denied":
      return sentence`${actor} a refusé « ${permission(detail(entry.details, "permission"))} » à ${target}.`;
    case "user_permission.cleared":
      return sentence`${actor} a réinitialisé « ${permission(detail(entry.details, "permission"))} » pour ${target}.`;
    case "user.banned": {
      const until = detail(entry.details, "expires_at");
      const duration = until ? `jusqu'au ${formatAuditDate(until)}` : "définitivement";
      return sentence`${actor} a banni ${target} ${duration} — motif : ${detail(entry.details, "reason") ?? "non précisé"}.`;
    }
    case "event.finished":
      return sentence`${actor} a marqué l'événement « ${title} » comme terminé.`;
    case "event.reopened":
      return sentence`${actor} a rouvert l'événement « ${title} ».`;
    case "map.route_saved":
      return sentence`${actor} a modifié le tracé de la carte (${String(detailNumber(entry.details, "points") ?? "?")} points).`;
    case "map.position_declared": {
      const label = detail(entry.details, "label");
      return sentence`${actor} a déclaré la position de la manifestation${label ? ` : ${label}` : ""}.`;
    }
    case "map.position_removed": {
      const label = detail(entry.details, "label");
      const own =
        typeof entry.details === "object" &&
        entry.details !== null &&
        (entry.details as Record<string, unknown>).own === true;
      return sentence`${actor} a retiré ${own ? "sa" : "une"} position de la manifestation${label ? ` (${label})` : ""}.`;
    }
    case "sanction.revoked":
      return sentence`${actor} a levé une sanction de ${target}.`;
    case "security.admin_mfa": {
      const required =
        typeof entry.details === "object" &&
        entry.details !== null &&
        (entry.details as Record<string, unknown>).required === true;
      return sentence`${actor} a ${required ? "rendu obligatoire" : "rendu facultative"} la double authentification des administrateurs.`;
    }
    default:
      return entry.target_id
        ? sentence`${actor} : ${entry.action} (${target}).`
        : sentence`${actor} : ${entry.action}.`;
  }
}

/**
 * Ties the French quotation marks to the word they surround with a non-breaking space, so a line never ends
 * on `«` nor starts with `»`. Applied to each part of a sentence, since a mark and its space can be split
 * between two parts.
 */
export function bindQuotationMarks(text: string): string {
  return text.replace(/« $/, "« ").replace(/^ »/, " »");
}

/** One-sentence description of an audit entry, in French. Unknown actions are shown as-is. */
export function describeAuditEntry(entry: AuditEntryView, names: AuditNames): string {
  return describeAuditEntryParts(entry, names)
    .map((part) => part.text)
    .join("");
}
