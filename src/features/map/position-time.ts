const clock = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});
const dayAndClock = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

/** `il y a 5 min`, `il y a 2 h`, `il y a 3 j` (and `à l'instant` under a minute). */
export function formatAgo(iso: string, now: number): string {
  const minutes = Math.floor((now - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.floor(hours / 24)} j`;
}

/** `14:32` for today's declarations, `8 oct., 14:32` for older ones (Europe/Paris). */
export function formatDeclared(iso: string, now: number): string {
  const date = new Date(iso);
  const sameDay =
    new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(date) ===
    new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(now);
  return (sameDay ? clock : dayAndClock).format(date);
}

/** A position older than this is flagged as possibly out of date. */
export const STALE_AFTER_MS = 3 * 60 * 60 * 1000;
