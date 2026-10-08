"use client";

import { Map as MapLibreMap, Marker, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_VIEW, LOCATE_ZOOM, MAP_STYLES } from "./map-config";
import { useMapTheme } from "./use-map-theme";

// MapLibre 6 runs in a module worker it normally finds next to its own file, which a bundler breaks:
// point it at the file the bundler emits.
setWorkerUrl(
  new URL(
    "../../../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs",
    import.meta.url,
  ).toString(),
);

/** WebGL is required: very old devices or a browser that blocks it cannot draw the map. */
function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

type LocateState = "idle" | "locating" | "denied" | "unavailable";

const LOCATE_MESSAGES: Record<Exclude<LocateState, "idle" | "locating">, string> = {
  denied: "Autorise la localisation dans les réglages de ton navigateur pour te voir sur la carte.",
  unavailable: "Ta position n'est pas disponible pour le moment.",
};

/**
 * The map. Client-only (WebGL) and loaded on demand by `MapLoader`, so its ~250 KB never weigh on other pages.
 * "Me localiser" shows the user's own position **on this device only**: it is never sent anywhere (A-127).
 */
export default function MapView() {
  const theme = useMapTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const meRef = useRef<Marker | null>(null);
  // This component only renders in the browser (dynamic import without SSR), so WebGL can be probed at once.
  const [supported] = useState(canUseWebGL);
  const [styleFailed, setStyleFailed] = useState(false);
  const failed = !supported || styleFailed;
  const [ready, setReady] = useState(false);
  const [locate, setLocate] = useState<LocateState>("idle");
  // The map is created once, with the theme of that moment; later changes go through setStyle().
  const [initialTheme] = useState(theme);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !supported) return;
    const map = new MapLibreMap({
      container,
      style: MAP_STYLES[initialTheme],
      center: DEFAULT_VIEW.center,
      zoom: DEFAULT_VIEW.zoom,
      // Keep the attribution (a licence obligation) but folded behind a small "i" button.
      attributionControl: { compact: true },
      // Rotation by two-finger twist stays; tilting the camera has no use for a flat route map.
      pitchWithRotate: false,
      dragRotate: false,
    });
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.on("load", () => setReady(true));
    // A style that cannot be fetched (provider down, offline) leaves an empty map: say so.
    map.on("error", () => {
      if (!map.isStyleLoaded()) setStyleFailed(true);
    });
    return () => {
      meRef.current?.remove();
      meRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [supported, initialTheme]);

  // Follow the app theme without recreating the map (keeps the position and zoom).
  const appliedTheme = useRef(initialTheme);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || appliedTheme.current === theme) return;
    appliedTheme.current = theme;
    map.setStyle(MAP_STYLES[theme]);
  }, [theme]);

  const locateMe = () => {
    const map = mapRef.current;
    if (!map || !("geolocation" in navigator)) {
      setLocate("unavailable");
      return;
    }
    setLocate("locating");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const lngLat: [number, number] = [coords.longitude, coords.latitude];
        if (!meRef.current) {
          const dot = document.createElement("div");
          dot.className = "map-me-dot";
          meRef.current = new Marker({ element: dot }).setLngLat(lngLat).addTo(map);
        } else {
          meRef.current.setLngLat(lngLat);
        }
        map.flyTo({ center: lngLat, zoom: Math.max(map.getZoom(), LOCATE_ZOOM) });
        setLocate("idle");
      },
      (error) => setLocate(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  };

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-card border border-line bg-surface">
      {/* The dark theme inverts the light basemap: see `.map-dark` in globals.css. The map itself gets
          `position: relative` from MapLibre's stylesheet, so it fills this absolutely positioned wrapper. */}
      <div className={`absolute inset-0 ${theme === "dark" ? "map-dark" : ""}`}>
        <div ref={containerRef} role="region" aria-label="Carte" className="h-full w-full" />
      </div>

      {failed && (
        <div className="absolute inset-x-3 top-3 z-10">
          <p role="alert" className="alert alert-error">
            Impossible d&apos;afficher la carte pour le moment. Vérifie ta connexion et réessaie.
          </p>
        </div>
      )}

      {!failed && !ready && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted"
        >
          Chargement de la carte…
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-3 bottom-8 z-10 flex flex-col items-end gap-2">
        {(locate === "denied" || locate === "unavailable") && (
          <p role="status" className="alert alert-error pointer-events-auto max-w-xs text-xs">
            {LOCATE_MESSAGES[locate]}
          </p>
        )}
        <button
          type="button"
          onClick={locateMe}
          disabled={!ready || locate === "locating"}
          aria-label="Me localiser"
          className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-line-strong bg-background/90 text-accent shadow-lg backdrop-blur active:bg-foreground/10 disabled:opacity-60"
        >
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
            className={locate === "locating" ? "animate-pulse" : ""}
          >
            <circle cx="12" cy="12" r="3.5" />
            <circle cx="12" cy="12" r="8" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>
      </div>
    </div>
  );
}
