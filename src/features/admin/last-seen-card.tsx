import type { Result } from "@/lib/result";
import { lastSeenStatus } from "./last-seen";

/**
 * Last activity of a user on the admin user page: « En ligne », or « Hors ligne » with how long ago. Only for
 * holders of `user.activity.view` (the caller checks it; the database refuses everyone else).
 */
export function LastSeen({
  lastSeen,
  now = new Date(),
}: {
  lastSeen: Result<string | null, "load_failed">;
  now?: Date;
}) {
  if (!lastSeen.ok) {
    return (
      <p role="alert" className="text-sm text-danger">
        Impossible de charger la dernière activité pour le moment.
      </p>
    );
  }
  const status = lastSeenStatus(lastSeen.value, now);

  return (
    <p className="flex items-center gap-2 text-sm" aria-label="Dernière activité">
      <span
        aria-hidden="true"
        className={`size-2.5 shrink-0 rounded-full ${status.state === "online" ? "bg-success" : "bg-faint"}`}
      />
      {status.state === "online" ? (
        <span className="font-medium">En ligne</span>
      ) : status.state === "offline" ? (
        <span className="text-muted">Hors ligne · {status.agoLabel}</span>
      ) : (
        <span className="text-muted">Hors ligne · dernière activité inconnue</span>
      )}
    </p>
  );
}
