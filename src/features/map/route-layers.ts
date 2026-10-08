import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { RouteFeatureCollection } from "@/lib/map-route";

export const ROUTE_SOURCE = "route";
/** Ids of the route layers. `HIT` is an invisible, large circle: a comfortable touch target for each vertex. */
export const ROUTE_LAYERS = {
  casing: "route-casing",
  line: "route-line",
  ends: "route-ends",
  points: "route-points",
  hit: "route-hit",
} as const;

const EDIT_ONLY = [ROUTE_LAYERS.points, ROUTE_LAYERS.hit];
const VIEW_ONLY = [ROUTE_LAYERS.ends];

/** The app accent colour (a CSS variable the user can change in the settings) for the line and markers. */
export function readAccentColor(): string {
  return (
    getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#ef4444"
  );
}

/**
 * Adds the route source and layers to the current style. Call it on every `style.load`: switching the theme
 * replaces the style and drops them.
 */
export function addRouteLayers(
  map: MapLibreMap,
  data: RouteFeatureCollection,
  editing: boolean,
): void {
  if (map.getSource(ROUTE_SOURCE)) return;
  const accent = readAccentColor();
  map.addSource(ROUTE_SOURCE, { type: "geojson", data: data as never });

  map.addLayer({
    id: ROUTE_LAYERS.casing,
    type: "line",
    source: ROUTE_SOURCE,
    filter: ["==", ["geometry-type"], "LineString"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#ffffff", "line-width": 9, "line-opacity": 0.9 },
  });
  map.addLayer({
    id: ROUTE_LAYERS.line,
    type: "line",
    source: ROUTE_SOURCE,
    filter: ["==", ["geometry-type"], "LineString"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": accent, "line-width": 5 },
  });
  // Start and end markers (view mode).
  map.addLayer({
    id: ROUTE_LAYERS.ends,
    type: "circle",
    source: ROUTE_SOURCE,
    filter: ["in", ["get", "role"], ["literal", ["start", "end"]]],
    layout: { visibility: editing ? "none" : "visible" },
    paint: {
      "circle-radius": 8,
      "circle-color": ["case", ["==", ["get", "role"], "start"], "#ffffff", accent],
      "circle-stroke-color": ["case", ["==", ["get", "role"], "start"], accent, "#ffffff"],
      "circle-stroke-width": 3,
    },
  });
  // Every vertex (edit mode); the selected one is larger and filled.
  map.addLayer({
    id: ROUTE_LAYERS.points,
    type: "circle",
    source: ROUTE_SOURCE,
    filter: ["==", ["geometry-type"], "Point"],
    layout: { visibility: editing ? "visible" : "none" },
    paint: {
      "circle-radius": ["case", ["get", "selected"], 12, 8],
      "circle-color": ["case", ["get", "selected"], accent, "#ffffff"],
      "circle-stroke-color": ["case", ["get", "selected"], "#ffffff", accent],
      "circle-stroke-width": 3,
    },
  });
  map.addLayer({
    id: ROUTE_LAYERS.hit,
    type: "circle",
    source: ROUTE_SOURCE,
    filter: ["==", ["geometry-type"], "Point"],
    layout: { visibility: editing ? "visible" : "none" },
    paint: { "circle-radius": 22, "circle-color": "#000000", "circle-opacity": 0 },
  });
}

/** Replaces the route shown on the map. A no-op while the style (and so the source) is not there yet. */
export function setRouteData(map: MapLibreMap, data: RouteFeatureCollection): void {
  const source = map.getSource(ROUTE_SOURCE) as GeoJSONSource | undefined;
  source?.setData(data as never);
}

/** Shows the vertex layers while editing, the start / end markers otherwise. */
export function setRouteEditing(map: MapLibreMap, editing: boolean): void {
  if (!map.getSource(ROUTE_SOURCE)) return;
  for (const id of EDIT_ONLY) map.setLayoutProperty(id, "visibility", editing ? "visible" : "none");
  for (const id of VIEW_ONLY) map.setLayoutProperty(id, "visibility", editing ? "none" : "visible");
}
