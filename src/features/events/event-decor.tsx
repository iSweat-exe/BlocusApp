"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import { readActiveEvent, readServerActiveEvent, subscribeToEvent } from "./event-store";

// The drawings and the pointer reactions are only fetched on the day of the event (or in a preview): everybody
// else, the rest of the year, downloads this small switch and nothing more. The decoration is drawn on the client
// only, once the boot script has set `data-event`.
const HalloweenDecor = dynamic(() => import("./halloween-decor").then((m) => m.HalloweenDecor), {
  ssr: false,
});

/**
 * Mounts the decoration of the running event, if any, and loads its code only then. Follows the event live: it
 * appears or goes away when the switch in the settings is used, without a reload.
 */
export function EventDecor() {
  const event = useSyncExternalStore(subscribeToEvent, readActiveEvent, readServerActiveEvent);
  return event === "halloween" ? <HalloweenDecor /> : null;
}
