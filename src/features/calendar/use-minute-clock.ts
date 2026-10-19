import { useSyncExternalStore } from "react";

const MINUTE_MS = 60_000;

/** The current minute, as a timestamp: stable for the whole minute, so React only re-renders when it changes. */
const readMinute = () => Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS;

/** Checks the clock a few times a minute: the minute is never more than 15 s late. */
function subscribe(onChange: () => void): () => void {
  const timer = window.setInterval(onChange, 15_000);
  return () => window.clearInterval(timer);
}

/**
 * The current minute (a timestamp), or `null` on the server and during hydration, so that what the server drew and
 * what the browser draws first are the same. Updates by itself every minute.
 */
export function useMinuteClock(): number | null {
  return useSyncExternalStore(subscribe, readMinute, () => null);
}
