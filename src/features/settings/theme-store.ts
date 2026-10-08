import { normalizeTheme, THEME_COLORS, THEME_STORAGE_KEY, type Theme } from "./theme";

const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null; // blocked (private mode, disabled site data)
  }
}

/** Forces the theme on the page (or follows the system with `"system"`) and aligns the browser bar. */
function apply(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);

  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    // Remember the original (media-based) tag so "system" can restore it without a reload.
    meta.dataset.systemMedia ??= meta.getAttribute("media") ?? "";
    meta.dataset.systemColor ??= meta.getAttribute("content") ?? "";
    if (theme === "system") {
      meta.setAttribute("content", meta.dataset.systemColor);
      if (meta.dataset.systemMedia) meta.setAttribute("media", meta.dataset.systemMedia);
    } else {
      meta.setAttribute("content", THEME_COLORS[theme]);
      meta.removeAttribute("media");
    }
  }
}

/** Saved theme of this device (`"system"` when none). */
export function readTheme(): Theme {
  return normalizeTheme(storage()?.getItem(THEME_STORAGE_KEY));
}

/** Server snapshot for `useSyncExternalStore`: there is no storage on the server. */
export const readServerTheme = (): Theme => "system";

/** Saves and applies a theme. */
export function writeTheme(theme: Theme): void {
  try {
    if (theme === "system") storage()?.removeItem(THEME_STORAGE_KEY);
    else storage()?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Quota or blocked storage: the theme still applies until the page is closed.
  }
  apply(theme);
  for (const listener of listeners) listener();
}

/** Subscribes to theme changes (this tab and other tabs). */
export function subscribeToTheme(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) {
      apply(readTheme());
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}
