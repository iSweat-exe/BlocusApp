import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { MapPosition } from "@/lib/data/map-positions";
import { readAccentColor } from "./route-layers";

export const POSITION_SOURCE = "position";
export const POSITION_LAYERS = { halo: "position-halo", dot: "position-dot" } as const;

type PositionCollection = {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    properties: Record<string, never>;
    geometry: { type: "Point"; coordinates: [number, number] };
  }[];
};

/** GeoJSON of the current position (empty when none was declared). */
export function positionToGeoJSON(
  position: Pick<MapPosition, "lng" | "lat"> | null,
): PositionCollection {
  return {
    type: "FeatureCollection",
    features: position
      ? [
          {
            type: "Feature",
            properties: {},
            geometry: { type: "Point", coordinates: [position.lng, position.lat] },
          },
        ]
      : [],
  };
}

/** Adds the position marker to the current style. Call it on every `style.load`. */
export function addPositionLayers(map: MapLibreMap, data: PositionCollection): void {
  if (map.getSource(POSITION_SOURCE)) return;
  const accent = readAccentColor();
  map.addSource(POSITION_SOURCE, { type: "geojson", data: data as never });
  map.addLayer({
    id: POSITION_LAYERS.halo,
    type: "circle",
    source: POSITION_SOURCE,
    paint: { "circle-radius": 22, "circle-color": accent, "circle-opacity": 0.25 },
  });
  map.addLayer({
    id: POSITION_LAYERS.dot,
    type: "circle",
    source: POSITION_SOURCE,
    paint: {
      "circle-radius": 10,
      "circle-color": accent,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 3,
    },
  });
}

/** Moves the marker. A no-op while the style (and so the source) is not there yet. */
export function setPositionData(map: MapLibreMap, data: PositionCollection): void {
  (map.getSource(POSITION_SOURCE) as GeoJSONSource | undefined)?.setData(data as never);
}
