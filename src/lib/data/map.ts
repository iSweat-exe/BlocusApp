import { cacheLife, cacheTag } from "next/cache";
import { type LngLat, parseRoutePoints } from "@/lib/map-route";
import { err, ok, type Result } from "@/lib/result";
import { createPublicClient } from "@/lib/supabase/public";

/** The route currently shown on the map: the newest saved version. */
export type MapRoute = { id: string; points: LngLat[]; createdAt: string };

const message = (cause: unknown) => (cause instanceof Error ? cause.message : "unknown error");

// The route is public (RLS lets `anon` read it), so the read is cached once for everybody for 2 min ("feed"
// profile). Saving a route calls `updateTag("map-route")` (the editor sees the change at once, the others within
// 2 min, or at once with "Actualiser"). Failures are thrown inside the cached function, never returned: an error must not be cached.
async function fetchCurrentRoute(): Promise<MapRoute | null> {
  "use cache";
  cacheLife("feed");
  cacheTag("map-route");

  const { data, error } = await createPublicClient()
    .from("map_route_versions")
    .select("id, points, created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  // Stored data is validated by the database; re-checking keeps a bad row from breaking the page.
  const points = parseRoutePoints(data.points);
  return points ? { id: data.id, points, createdAt: data.created_at } : null;
}

/**
 * Reads the current route (shared through the data cache), or `null` when none was drawn yet.
 * Readable by Guests. Call `connection()` first (see docs/performance.md).
 */
export async function getCurrentRoute(): Promise<Result<MapRoute | null, "load_failed">> {
  try {
    return ok(await fetchCurrentRoute());
  } catch (cause) {
    return err("load_failed", message(cause));
  }
}
