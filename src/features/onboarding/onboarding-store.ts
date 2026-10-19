/**
 * Whether the onboarding was finished (or skipped) on this device. Stored on the device, like the theme: the
 * install and notification steps are per device, so a new phone sees it again. Bump the version to show a new
 * onboarding to everyone.
 */
export const ONBOARDING_STORAGE_KEY = "blocus.onboarding.v1";

const listeners = new Set<() => void>();
/** Set when the choice could not be saved: the onboarding stays closed until the page is reloaded. */
let closedForNow = false;

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null; // blocked (private mode, disabled site data)
  }
}

/** Whether the onboarding is done. With blocked storage it counts as done: never nag on every page. */
export function readOnboardingDone(): boolean {
  const store = storage();
  return closedForNow || store === null || store.getItem(ONBOARDING_STORAGE_KEY) !== null;
}

/** Server snapshot for `useSyncExternalStore`: nothing is rendered on the server. */
export const readServerOnboardingDone = (): boolean => true;

/** Remembers that the onboarding is done and closes it. */
export function markOnboardingDone(): void {
  try {
    storage()?.setItem(ONBOARDING_STORAGE_KEY, new Date().toISOString());
  } catch {
    // Quota or blocked storage: `closedForNow` keeps it closed for this page view.
    closedForNow = true;
  }
  for (const listener of listeners) listener();
}

/** Subscribes to changes (this tab and other tabs). */
export function subscribeToOnboarding(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === ONBOARDING_STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}
