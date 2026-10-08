import { useSyncExternalStore } from "react";
import type { MapTheme } from "./map-config";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Subscribes to what decides the theme: the `data-theme` override on <html> and the system preference. */
function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => {
    media.removeEventListener("change", onChange);
    observer.disconnect();
  };
}

function readTheme(): MapTheme {
  const forced = document.documentElement.getAttribute("data-theme");
  if (forced === "light" || forced === "dark") return forced;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

/** The theme the app currently shows (forced in the settings, or the system's), live. */
export function useMapTheme(): MapTheme {
  // The map only renders on the client (dynamic import without SSR): the server value is never used.
  return useSyncExternalStore(subscribe, readTheme, () => "light");
}
