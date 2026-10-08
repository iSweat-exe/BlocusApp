import { cacheLife, cacheTag } from "next/cache";
import { err, ok, type Result } from "@/lib/result";
import { createPublicClient } from "@/lib/supabase/public";

/** A position declared by a manager. */
export type MapPosition = {
  id: string;
  lng: number;
  lat: number;
  label: string;
  /** ISO time of the declaration. */
  declaredAt: string;
};

/** The current position plus the most recent ones before it, newest first. */
export const POSITIONS_SHOWN = 20;

const message = (cause: unknown) => (cause instanceof Error ? cause.message : "unknown error");

// Declared positions are public (RLS lets `anon` read them), so the read is cached once for everybody for 30 s
// ("feed" profile) and invalidated by `updateTag("map-positions")` on every declaration. Failures are thrown
// inside the cached function, never returned: an error must not be cached.
async function fetchPositions(): Promise<MapPosition[]> {
  "use cache";
  cacheLife("feed");
  cacheTag("map-positions");

  const { data, error } = await createPublicClient()
    .from("map_positions")
    .select("id, lng, lat, label, declared_at")
    .order("declared_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(POSITIONS_SHOWN);
  if (error) throw new Error(error.message);
  return data.map((row) => ({
    id: row.id,
    lng: row.lng,
    lat: row.lat,
    label: row.label,
    declaredAt: row.declared_at,
  }));
}

/**
 * Lists the latest declared positions, newest first (the first one is the current position). Readable by
 * Guests, shared through the data cache. Call `connection()` first (see docs/performance.md).
 */
export async function getMapPositions(): Promise<Result<MapPosition[], "load_failed">> {
  try {
    return ok(await fetchPositions());
  } catch (cause) {
    return err("load_failed", message(cause));
  }
}
