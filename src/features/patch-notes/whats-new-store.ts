/**
 * The date of the newest patch note this device has been shown (`YYYY-MM-DD`), stored on the device like the
 * onboarding. Dates compare as strings. Bump the version to show the current entry again to everybody.
 */
export const WHATS_NEW_STORAGE_KEY = "blocus.whatsnew.v1";

/** Read result when the storage cannot be used: the screen stays closed (never nag on every page). */
export const WHATS_NEW_BLOCKED = "blocked";

const listeners = new Set<() => void>();
/** Set when the date could not be saved: the screen stays closed until the page is reloaded. */
let closedForNow = false;

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null; // blocked (private mode, disabled site data)
  }
}

/** The last date shown, `null` on a device that never saw one, or `WHATS_NEW_BLOCKED`. */
export function readWhatsNewSeen(): string | null {
  const store = storage();
  if (closedForNow || store === null) return WHATS_NEW_BLOCKED;
  return store.getItem(WHATS_NEW_STORAGE_KEY);
}

/** Server snapshot for `useSyncExternalStore`: nothing is rendered on the server. */
export const readServerWhatsNewSeen = (): string | null => WHATS_NEW_BLOCKED;

/** Remembers that the entry of this date was shown, and closes the screen. */
export function markWhatsNewSeen(date: string): void {
  try {
    storage()?.setItem(WHATS_NEW_STORAGE_KEY, date);
  } catch {
    // Quota or blocked storage: `closedForNow` keeps it closed for this page view.
    closedForNow = true;
  }
  for (const listener of listeners) listener();
}

/** Subscribes to changes (this tab and other tabs). */
export function subscribeToWhatsNew(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === WHATS_NEW_STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}
