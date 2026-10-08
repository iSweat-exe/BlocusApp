/** A map position as `[longitude, latitude]` (GeoJSON order). */
export type LngLat = [number, number];

/** Same bound as the database (`is_valid_route`). */
export const MAX_ROUTE_POINTS = 500;

/** Coordinates are rounded to 6 decimals (about 11 cm): plenty, and it keeps the stored route small. */
const round = (value: number) => Math.round(value * 1e6) / 1e6;

function isPoint(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1]) &&
    Math.abs(value[0]) <= 180 &&
    Math.abs(value[1]) <= 90
  );
}

/**
 * Validates a route coming from anywhere (a Server Action argument, the database) and returns clean, rounded
 * points, or `null`. A route is empty (no route) or has 2 to {@link MAX_ROUTE_POINTS} valid points, the same
 * rule as the database function `is_valid_route`.
 */
export function parseRoutePoints(value: unknown): LngLat[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length !== 0 && (value.length < 2 || value.length > MAX_ROUTE_POINTS)) return null;
  const points: LngLat[] = [];
  for (const item of value) {
    if (!isPoint(item)) return null;
    points.push([round(item[0]), round(item[1])]);
  }
  return points;
}

/** Whether two routes are the same line. */
export function samePoints(a: readonly LngLat[], b: readonly LngLat[]): boolean {
  return (
    a.length === b.length && a.every((point, i) => point[0] === b[i]?.[0] && point[1] === b[i]?.[1])
  );
}

/** Bounding box `[[west, south], [east, north]]` of the points, or `null` when there are none. */
export function routeBounds(points: readonly LngLat[]): [LngLat, LngLat] | null {
  if (points.length === 0) return null;
  let [west, south] = points[0] as LngLat;
  let [east, north] = [west, south];
  for (const [lng, lat] of points) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return [
    [west, south],
    [east, north],
  ];
}

/** Minimal GeoJSON types (the `geojson` package types are not a direct dependency). */
export type RouteFeatureCollection = {
  type: "FeatureCollection";
  features: Array<
    | {
        type: "Feature";
        properties: Record<string, never>;
        geometry: { type: "LineString"; coordinates: LngLat[] };
      }
    | {
        type: "Feature";
        properties: { index: number; role: "start" | "end" | "vertex"; selected: boolean };
        geometry: { type: "Point"; coordinates: LngLat };
      }
  >;
};

/**
 * GeoJSON of a route for the map: the line (when it has 2+ points) and one point per vertex, flagged
 * `start` / `end` / `vertex` and `selected`.
 */
export function routeToGeoJSON(
  points: readonly LngLat[],
  selected: number | null = null,
): RouteFeatureCollection {
  const features: RouteFeatureCollection["features"] = [];
  if (points.length >= 2) {
    features.push({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: points.map((point) => [...point] as LngLat) },
    });
  }
  points.forEach((point, index) => {
    features.push({
      type: "Feature",
      properties: {
        index,
        role: index === 0 ? "start" : index === points.length - 1 ? "end" : "vertex",
        selected: index === selected,
      },
      geometry: { type: "Point", coordinates: [...point] as LngLat },
    });
  });
  return { type: "FeatureCollection", features };
}
