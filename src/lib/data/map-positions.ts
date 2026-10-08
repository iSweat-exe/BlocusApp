import { cacheLife, cacheTag } from "next/cache";
import { err, ok, type Result } from "@/lib/result";
import { createPublicClient } from "@/lib/supabase/public";

/** A position declared by a manager, as the client shows it (no author: who declared it is not public). */
export type MapPosition = {
  id: string;
  lng: number;
  lat: number;
  label: string;
  /** ISO time of the declaration. */
  declaredAt: string;
  /** ISO time of the removal, or `null` while the position stands. */
  removedAt: string | null;
};

/** The same, with the author id, for server code only (never sent to the browser). */
export type StoredMapPosition = MapPosition & { authorId: string | null };

/** The current position plus the most recent ones before it, newest first. */
export const POSITIONS_SHOWN = 20;

const message = (cause: unknown) => (cause instanceof Error ? cause.message : "unknown error");

// Declared positions are public (RLS lets `anon` read them), so the read is cached once for everybody for 30 s
// ("live" profile: the position of a demonstration must stay fresh) and invalidated by `updateTag("map-positions")` on every declaration. Failures are thrown
// inside the cached function, never returned: an error must not be cached.
async function fetchPositions(): Promise<StoredMapPosition[]> {
  "use cache";
  cacheLife("live");
  cacheTag("map-positions");

  const { data, error } = await createPublicClient()
    .from("map_positions")
    .select("id, lng, lat, label, declared_at, author_id, removed_at")
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
    removedAt: row.removed_at,
    authorId: row.author_id,
  }));
}

/**
 * Lists the latest declared positions, newest first. The first one is the current position, unless it was removed
 * (then the map shows none: an older declaration never comes back). Readable by Guests, shared through the data
 * cache. Call `connection()` first (see docs/performance.md).
 */
export async function getMapPositions(): Promise<Result<StoredMapPosition[], "load_failed">> {
  try {
    return ok(await fetchPositions());
  } catch (cause) {
    return err("load_failed", message(cause));
  }
}
