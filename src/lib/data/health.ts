import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { err, ok, type Result } from "@/lib/result";
import { createPublicClient } from "@/lib/supabase/public";

/** Any Supabase client of this app: the user's (page) or the service role's (cron). */
export type AppClient = SupabaseClient<Database>;

/** Counters read in the database. */
export type HealthStats = { usersTotal: number; usersActive: number; dbSizeBytes: number };

/** A row of the history. */
export type HealthSnapshot = Database["public"]["Tables"]["health_snapshots"]["Row"];

/** What gets stored in a snapshot (`null` = the measure could not be taken). */
export type SnapshotInput = {
  score: number;
  dbMs: number | null;
  authMs: number | null;
  stats: HealthStats | null;
  vercelState: string | null;
  source: "page" | "cron";
};

/** Maximum time given to a probe before the service is considered down. */
const PROBE_TIMEOUT_MS = 4000;

/** Milliseconds a probe took, or `null` when it failed or timed out. */
async function timed(probe: () => Promise<boolean>): Promise<number | null> {
  const start = performance.now();
  try {
    return (await probe()) ? Math.round(performance.now() - start) : null;
  } catch {
    return null;
  }
}

/** Round trip of a tiny public read (API gateway + database), in ms. */
export function pingDatabase(): Promise<number | null> {
  return timed(async () => {
    const { error } = await createPublicClient()
      .from("events")
      .select("id")
      .limit(1)
      .abortSignal(AbortSignal.timeout(PROBE_TIMEOUT_MS));
    return !error;
  });
}

/** Round trip of the Supabase Auth health endpoint, in ms. */
export function pingAuth(): Promise<number | null> {
  return timed(async () => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return response.ok;
  });
}

/** Registered users, recently active users and database size (needs `monitoring.view` or the service role). */
export async function readHealthStats(
  client: AppClient,
): Promise<Result<HealthStats, "load_failed">> {
  try {
    const { data, error } = await client.rpc("health_stats");
    const row = data?.[0];
    if (error || !row) return err("load_failed", error?.message);
    return ok({
      usersTotal: row.users_total,
      usersActive: row.users_active,
      dbSizeBytes: row.db_size_bytes,
    });
  } catch (cause) {
    return err("load_failed", cause instanceof Error ? cause.message : "unknown error");
  }
}

/**
 * Stores a snapshot in the history. The database keeps at most one every 10 minutes and trims rows older than
 * 30 days itself.
 * @returns `true` when a row was written, `false` when it was skipped (too soon).
 */
export async function recordHealthSnapshot(
  client: AppClient,
  input: SnapshotInput,
): Promise<Result<boolean, "record_failed">> {
  try {
    const { data, error } = await client.rpc("record_health_snapshot", {
      p_score: input.score,
      p_db_ms: input.dbMs ?? undefined,
      p_auth_ms: input.authMs ?? undefined,
      p_db_size_bytes: input.stats?.dbSizeBytes,
      p_users_total: input.stats?.usersTotal,
      p_users_active: input.stats?.usersActive,
      p_vercel_state: input.vercelState ?? undefined,
      p_source: input.source,
    });
    return error ? err("record_failed", error.message) : ok(data !== null);
  } catch (cause) {
    return err("record_failed", cause instanceof Error ? cause.message : "unknown error");
  }
}

/** Number of snapshots shown in the history (about two days at one every 15 minutes). */
export const HISTORY_SIZE = 200;

/** Latest snapshots, oldest first (RLS: only holders of `monitoring.view` get rows). */
export async function listHealthSnapshots(
  client: AppClient,
): Promise<Result<HealthSnapshot[], "load_failed">> {
  try {
    const { data, error } = await client
      .from("health_snapshots")
      .select(
        "id, created_at, score, db_ms, auth_ms, db_size_bytes, users_total, users_active, vercel_state, source",
      )
      .order("created_at", { ascending: false })
      .limit(HISTORY_SIZE);
    return error ? err("load_failed", error.message) : ok(data.toReversed());
  } catch (cause) {
    return err("load_failed", cause instanceof Error ? cause.message : "unknown error");
  }
}
