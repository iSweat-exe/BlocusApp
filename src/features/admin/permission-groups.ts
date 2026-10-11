/**
 * Display groups of the permission catalogue, in display order. A permission belongs to the group of the
 * prefix of its key (`event.create` -> `event`); a new prefix lands in "Autres" until it is added here.
 */
const GROUPS = [
  { id: "announcement", label: "Annonces", prefixes: ["announcement"] },
  { id: "calendar", label: "Calendrier", prefixes: ["event"] },
  { id: "map", label: "Carte", prefixes: ["map"] },
  { id: "moderation", label: "Modération", prefixes: ["user"] },
  {
    id: "administration",
    label: "Administration",
    prefixes: ["role", "permission", "audit", "monitoring", "statistics"],
  },
] as const;

const OTHER_GROUP = { id: "other", label: "Autres" } as const;

/** A group of permissions, ready to display. */
export type PermissionGroup<T> = { id: string; label: string; items: T[] };

/** Splits permissions into display groups (empty groups are left out, items keep their order). */
export function groupPermissions<T extends { key: string }>(items: T[]): PermissionGroup<T>[] {
  const known = GROUPS.map((group) => ({ id: group.id, label: group.label, items: [] as T[] }));
  const other: PermissionGroup<T> = { ...OTHER_GROUP, items: [] };

  for (const item of items) {
    const prefix = item.key.split(".")[0] ?? "";
    const index = GROUPS.findIndex((group) =>
      (group.prefixes as readonly string[]).includes(prefix),
    );
    (index === -1 ? other : known[index]!).items.push(item);
  }
  return [...known, other].filter((group) => group.items.length > 0);
}
