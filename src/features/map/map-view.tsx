"use client";

import { Map as MapLibreMap, Marker, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useReducer, useRef, useState, useTransition } from "react";
import { PencilIcon } from "@/components/icons";
import { routeBounds, routeToGeoJSON, type LngLat } from "@/lib/map-route";
import { saveMapRoute } from "./actions";
import { DEFAULT_VIEW, LOCATE_ZOOM, MAP_STYLES } from "./map-config";
import { canSave, editorReducer, initEditor, isDirty } from "./route-editor-state";
import { addRouteLayers, setRouteData, setRouteEditing } from "./route-layers";
import { RouteToolbar, type ToolbarError } from "./route-toolbar";
import { useMapTheme } from "./use-map-theme";
import { useRouteEditing } from "./use-route-editing";

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

/** The route as the page gives it to the map. */
export type MapViewRoute = { id: string; points: LngLat[] };

type Props = {
  /** The current route, or `null` when none was drawn yet. */
  route: MapViewRoute | null;
  /** Holds `map.route.edit` (display only: the Server Action and the database re-check it). */
  canEditRoute: boolean;
};

/**
 * The map: base map, the route, route editing for those who may, and "Me localiser". Client-only (WebGL),
 * loaded on demand by `MapLoader`. "Me localiser" shows the user's own position **on this device only**: it is
 * never sent anywhere (A-127).
 */
export default function MapView({ route, canEditRoute }: Props) {
  const router = useRouter();
  const theme = useMapTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const meRef = useRef<Marker | null>(null);
  // This component only renders in the browser (dynamic import without SSR), so WebGL can be probed at once.
  const [supported] = useState(canUseWebGL);
  const [styleFailed, setStyleFailed] = useState(false);
  const failed = !supported || styleFailed;
  // Set once the style is loaded: from then on the map accepts layers and camera moves.
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const ready = map !== null;
  const [locate, setLocate] = useState<LocateState>("idle");
  // The map is created once, with the theme and route of that moment; later changes go through setStyle() /
  // setData().
  const [initialTheme] = useState(theme);
  const [initialRoute] = useState(route);

  // Route editing.
  const [editing, setEditing] = useState(false);
  const [editor, dispatch] = useReducer(editorReducer, route?.points ?? [], initEditor);
  const [baseId, setBaseId] = useState<string | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [saveError, setSaveError] = useState<ToolbarError | null>(null);
  const [saving, startSaving] = useTransition();

  const shownPoints = useMemo(
    () => (editing ? editor.points : (route?.points ?? [])),
    [editing, editor.points, route],
  );
  const shownSelected = editing ? editor.selected : null;
  const latest = useRef({ data: routeToGeoJSON(shownPoints, shownSelected), editing });
  useEffect(() => {
    latest.current = { data: routeToGeoJSON(shownPoints, shownSelected), editing };
  }, [shownPoints, shownSelected, editing]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !supported) return;
    const bounds = routeBounds(initialRoute?.points ?? []);
    const created = new MapLibreMap({
      container,
      style: MAP_STYLES[initialTheme],
      ...(bounds
        ? { bounds, fitBoundsOptions: { padding: 48, maxZoom: 17 } }
        : { center: DEFAULT_VIEW.center, zoom: DEFAULT_VIEW.zoom }),
      // Keep the attribution (a licence obligation) but folded behind a small "i" button.
      attributionControl: { compact: true },
      // Rotation by two-finger twist stays; tilting the camera has no use for a flat route map.
      pitchWithRotate: false,
      dragRotate: false,
    });
    mapRef.current = created;
    created.touchZoomRotate.disableRotation();
    // Every style load (the first one, and after a theme switch) needs the route layers again.
    created.on("style.load", () =>
      addRouteLayers(created, latest.current.data, latest.current.editing),
    );
    created.on("load", () => setMap(created));
    // A style that cannot be fetched (provider down, offline) leaves an empty map: say so.
    created.on("error", () => {
      if (!created.isStyleLoaded()) setStyleFailed(true);
    });
    return () => {
      meRef.current?.remove();
      meRef.current = null;
      created.remove();
      mapRef.current = null;
      setMap(null);
    };
  }, [supported, initialTheme, initialRoute]);

  // Follow the app theme without recreating the map (keeps the position and zoom).
  const appliedTheme = useRef(initialTheme);
  useEffect(() => {
    const instance = mapRef.current;
    if (!instance || appliedTheme.current === theme) return;
    appliedTheme.current = theme;
    instance.setStyle(MAP_STYLES[theme]);
  }, [theme]);

  // Keep the map in step with the route being shown or edited.
  useEffect(() => {
    if (!map) return;
    setRouteData(map, routeToGeoJSON(shownPoints, shownSelected));
  }, [map, shownPoints, shownSelected]);
  useEffect(() => {
    if (map) setRouteEditing(map, editing);
  }, [map, editing]);

  useRouteEditing(map, editing, dispatch);

  const startEditing = () => {
    dispatch({ type: "reset", points: route?.points ?? [] });
    setBaseId(route?.id ?? null);
    setSaveError(null);
    setConfirmingDiscard(false);
    setEditing(true);
  };
  const stopEditing = () => {
    setEditing(false);
    setConfirmingDiscard(false);
    setSaveError(null);
  };
  const save = () => {
    setSaveError(null);
    startSaving(async () => {
      const result = await saveMapRoute(editor.points, baseId);
      if (result.status === "success") {
        // The page re-renders with the new route (the action revalidates it).
        stopEditing();
      } else {
        setSaveError({ message: result.message, stale: result.code === "stale" });
      }
    });
  };
  const reload = () => {
    stopEditing();
    router.refresh();
  };
  const center = (): LngLat | null => {
    const at = map?.getCenter();
    return at ? [at.lng, at.lat] : null;
  };

  const locateMe = () => {
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

      {ready && !editing && (
        <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start justify-between gap-2">
          {canEditRoute ? (
            <button
              type="button"
              onClick={startEditing}
              className="btn btn-sm pointer-events-auto gap-2 border border-line-strong bg-background/90 shadow-lg backdrop-blur"
            >
              <PencilIcon className="h-4 w-4" />
              Modifier le tracé
            </button>
          ) : (
            <span />
          )}
          {!route && (
            <p className="chip pointer-events-auto bg-background/90 text-muted shadow backdrop-blur">
              Pas encore de tracé
            </p>
          )}
        </div>
      )}

      {editing && (
        <RouteToolbar
          pointCount={editor.points.length}
          hasSelection={editor.selected !== null}
          canUndo={editor.past.length > 0}
          canRedo={editor.future.length > 0}
          canSave={canSave(editor)}
          dirty={isDirty(editor)}
          saving={saving}
          error={saveError}
          confirmingDiscard={confirmingDiscard}
          onClose={stopEditing}
          onSave={save}
          onAdd={() => {
            const at = center();
            if (at) dispatch({ type: "add", point: at });
          }}
          onMoveHere={() => {
            const at = center();
            if (at) dispatch({ type: "moveSelectedTo", point: at });
          }}
          onDelete={() => dispatch({ type: "removeSelected" })}
          onUndo={() => dispatch({ type: "undo" })}
          onRedo={() => dispatch({ type: "redo" })}
          onConfirmDiscard={setConfirmingDiscard}
          onReload={reload}
        />
      )}

      <div
        className={`pointer-events-none absolute inset-x-3 z-10 flex flex-col items-end gap-2 ${
          editing ? "bottom-60" : "bottom-8"
        }`}
      >
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
