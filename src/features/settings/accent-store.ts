import { ACCENT_STORAGE_KEY, accentVars, normalizeHex } from "./accent";

const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null; // blocked (private mode, disabled site data)
  }
}

/** Applies (or clears, with `null`) the accent on the page. */
function apply(hex: string | null): void {
  const style = document.documentElement.style;
  if (!hex) {
    for (const name of ["--accent", "--accent-strong", "--accent-ink"]) style.removeProperty(name);
    return;
  }
  const vars = accentVars(hex);
  style.setProperty("--accent", vars.accent);
  style.setProperty("--accent-strong", vars.strong);
  style.setProperty("--accent-ink", vars.ink);
}

/** Saved accent of this device, or `null` for the default. */
export function readAccent(): string | null {
  return normalizeHex(storage()?.getItem(ACCENT_STORAGE_KEY));
}

/** Server snapshot for `useSyncExternalStore`: there is no storage on the server. */
export const readServerAccent = (): string | null => null;

/** Saves and applies an accent (`null` restores the default). Invalid colors are ignored. */
export function writeAccent(hex: string | null): void {
  const value = hex === null ? null : normalizeHex(hex);
  if (hex !== null && !value) return;
  try {
    if (value) storage()?.setItem(ACCENT_STORAGE_KEY, value);
    else storage()?.removeItem(ACCENT_STORAGE_KEY);
  } catch {
    // Quota or blocked storage: the accent still applies until the page is closed.
  }
  apply(value);
  for (const listener of listeners) listener();
}

/** Subscribes to accent changes (this tab and other tabs). */
export function subscribeToAccent(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === ACCENT_STORAGE_KEY || event.key === null) {
      apply(readAccent());
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}
