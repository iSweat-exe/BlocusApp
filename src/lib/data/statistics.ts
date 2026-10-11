import { err, ok, type Result } from "@/lib/result";
import { requestCookies } from "@/lib/supabase/request-cookies";
import { createClient } from "@/lib/supabase/server";

/** Headline figures of the application (all read in one call). */
export type StatsOverview = {
  usersTotal: number;
  signups24h: number;
  signups7d: number;
  signups30d: number;
  active24h: number;
  active7d: number;
  active30d: number;
  /** Users with a ban in force right now. */
  bannedNow: number;
  postsPublic: number;
  eventsTotal: number;
  eventsUpcoming: number;
  /** Declared map positions that were not removed. */
  positionsActive: number;
  /** ISO date of the first hour activity was measured, `null` while nothing was. */
  trackingSince: string | null;
};

/** One whole UTC hour of the activity series. */
export type ActivityHour = {
  /** ISO date of the start of the hour. */
  hour: string;
  /** Distinct signed-in users seen in this hour. */
  activeUsers: number;
  /** Accounts created in this hour. */
  signups: number;
  /** `false` before activity was measured: `activeUsers` is then unknown, not zero. */
  tracked: boolean;
};

/** A count for one value of a distribution (a role key, a provider, a country code). */
export type Count = { key: string; total: number };

/** Distributions of the accounts. `unknown` is a regular key (accounts without provider or country). */
export type StatsBreakdown = { roles: Count[]; providers: Count[]; countries: Count[] };

/** Longest window the activity series can cover (30 days of hours), the maximum of `stats_activity()`. */
export const MAX_ACTIVITY_HOURS = 720;

function failure(cause: unknown) {
  return err("load_failed", cause instanceof Error ? cause.message : "unknown error");
}

/** Headline figures. Needs `statistics.view`: anyone else gets `load_failed` (the database refuses). */
export async function getStatsOverview(): Promise<Result<StatsOverview, "load_failed">> {
  try {
    const supabase = createClient(await requestCookies());
    const { data, error } = await supabase.rpc("stats_overview");
    const row = data?.[0];
    if (error || !row) return err("load_failed", error?.message);
    return ok({
      usersTotal: row.users_total,
      signups24h: row.signups_24h,
      signups7d: row.signups_7d,
      signups30d: row.signups_30d,
      active24h: row.active_24h,
      active7d: row.active_7d,
      active30d: row.active_30d,
      bannedNow: row.banned_now,
      postsPublic: row.posts_public,
      eventsTotal: row.events_total,
      eventsUpcoming: row.events_upcoming,
      positionsActive: row.positions_active,
      trackingSince: row.tracking_since,
    });
  } catch (cause) {
    return failure(cause);
  }
}

/**
 * Activity and sign-ups per hour over the last `hours` hours (1 to 720), oldest first, the current hour last.
 * Needs `statistics.view`.
 */
export async function getStatsActivity(
  hours: number = MAX_ACTIVITY_HOURS,
): Promise<Result<ActivityHour[], "load_failed">> {
  try {
    const supabase = createClient(await requestCookies());
    const { data, error } = await supabase.rpc("stats_activity", { p_hours: hours });
    if (error || !data) return err("load_failed", error?.message);
    return ok(
      data.map((row) => ({
        hour: row.hour,
        activeUsers: row.active_users,
        signups: row.signups,
        tracked: row.tracked,
      })),
    );
  } catch (cause) {
    return failure(cause);
  }
}

/** Accounts per role, per sign-up provider and per sign-up country. Needs `statistics.view`. */
export async function getStatsBreakdown(): Promise<Result<StatsBreakdown, "load_failed">> {
  try {
    const supabase = createClient(await requestCookies());
    const { data, error } = await supabase.rpc("stats_breakdown");
    if (error || !data) return err("load_failed", error?.message);
    const pick = (kind: string): Count[] =>
      data.filter((row) => row.kind === kind).map((row) => ({ key: row.key, total: row.total }));
    return ok({ roles: pick("role"), providers: pick("provider"), countries: pick("country") });
  } catch (cause) {
    return failure(cause);
  }
}
