/** Colors of a role: the higher the role, the stronger the badge, so a list can be scanned. */
const TONES: Record<string, string> = {
  super_admin: "bg-accent text-accent-ink",
  admin: "bg-accent/15 text-accent",
  developer: "bg-foreground/15 text-foreground",
  moderator: "bg-warning/15 text-warning",
  manager: "bg-success/15 text-success",
  editor: "bg-success/10 text-success",
  relay: "bg-foreground/10 text-foreground",
};

/** Classes of the badge of a role; a role this version does not know yet is neutral. */
export function roleTone(roleKey: string): string {
  return TONES[roleKey] ?? "bg-foreground/10 text-muted";
}

/** A role as a small badge. */
export function RoleBadge({
  roleKey,
  label,
  className = "",
}: {
  roleKey: string;
  label: string;
  className?: string;
}) {
  return <span className={`chip ${roleTone(roleKey)} ${className}`}>{label}</span>;
}
