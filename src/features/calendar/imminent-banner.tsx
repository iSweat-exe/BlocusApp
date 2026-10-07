"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  addDismissed,
  countdownLabel,
  DISMISSED_STORAGE_KEY,
  isImminent,
  parseDismissed,
} from "./imminent";

/** What the banner needs about an event (serialisable, so the server can pass it down). */
export type ImminentEvent = {
  id: string;
  title: string;
  location: string;
  startsAt: string;
  time: string;
};

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null; // blocked (private mode, disabled site data)
  }
}

// The dismissed ids live in localStorage: read them as an external store (empty on the server) so the
// first render matches the server and the stored value is applied right after hydration.
function subscribeToStorage(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}
const readStoredDismissed = (): string | null => storage()?.getItem(DISMISSED_STORAGE_KEY) ?? null;
const readServerDismissed = (): string | null => null;

/**
 * Banner for events that start soon, shown at the very top of the home page. The user can close each
 * one (remembered on this device) and tap it for the details. It counts down and disappears when the
 * event starts. `serverNow` keeps the first render identical on the server and the client.
 */
export function ImminentBanner({
  events,
  serverNow,
}: {
  events: ImminentEvent[];
  serverNow: number;
}) {
  const [now, setNow] = useState(serverNow);
  // Ids closed during this visit: covers storage that cannot be written (private mode).
  const [closedNow, setClosedNow] = useState<string[]>([]);
  const stored = useSyncExternalStore(subscribeToStorage, readStoredDismissed, readServerDismissed);
  const dismissed = useMemo(() => [...parseDismissed(stored), ...closedNow], [stored, closedNow]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const visible = events.filter(
    (event) => !dismissed.includes(event.id) && isImminent(event.startsAt, now),
  );
  if (visible.length === 0) return null;

  return (
    <section aria-label="Événements imminents" className="flex flex-col gap-2">
      {visible.map((event) => (
        <div
          key={event.id}
          className="flex items-stretch gap-2 rounded-xl bg-red-500 p-1 pl-4 text-white shadow-lg"
        >
          <Link href={`/calendar/${event.id}`} className="flex min-w-0 flex-1 flex-col py-3">
            <span className="text-xs font-semibold uppercase tracking-wide">
              Bientôt · {countdownLabel(event.startsAt, now)}
            </span>
            <span className="truncate text-lg font-bold">{event.title}</span>
            <span className="truncate text-sm opacity-90">
              {event.time}
              {event.location ? ` · ${event.location}` : ""}
            </span>
          </Link>
          <button
            type="button"
            aria-label={`Fermer l'annonce de ${event.title}`}
            onClick={() => {
              addDismissed(storage(), event.id);
              setClosedNow((ids) => [...ids, event.id]);
            }}
            className="self-start rounded-lg px-3 py-2 text-xl leading-none"
          >
            ×
          </button>
        </div>
      ))}
    </section>
  );
}
