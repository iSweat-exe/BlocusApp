"use client";

import { useSyncExternalStore } from "react";
import {
  readActiveEvent,
  readEventSwitchedOff,
  readServerActiveEvent,
  readServerEventSwitchedOff,
  setEventEnabled,
  subscribeToEvent,
} from "./event-store";

/**
 * Switch of the running event, in the settings: the event palette changes the colors of the whole app, so it can
 * always be turned off (and back on). Only shown while an event runs, or after it was switched off on this device.
 */
export function EventToggle() {
  const active = useSyncExternalStore(subscribeToEvent, readActiveEvent, readServerActiveEvent);
  const switchedOff = useSyncExternalStore(
    subscribeToEvent,
    readEventSwitchedOff,
    readServerEventSwitchedOff,
  );
  if (active === null && !switchedOff) return null;

  const enabled = active !== null;
  return (
    <section aria-labelledby="event-title" className="flex flex-col gap-2">
      <h2 id="event-title" className="section-title">
        Événement
      </h2>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => setEventEnabled("halloween", !enabled)}
        className="card-link flex min-h-control items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium">Thème Halloween</span>
          <span className="block text-xs text-muted">Fantômes, bonbons et couleurs de saison.</span>
        </span>
        <span
          aria-hidden="true"
          className={`flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-[background-color] ${
            enabled ? "bg-accent" : "bg-foreground/20"
          }`}
        >
          <span
            className={`size-6 rounded-full bg-white shadow-sm transition-[translate] ${
              enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </span>
      </button>
    </section>
  );
}
