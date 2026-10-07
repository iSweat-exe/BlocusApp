import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { err, ok, type Result } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

/** An event as listed in the month grid and the day list (no long text). */
export type EventSummary = Pick<EventRow, "id" | "title" | "location" | "starts_at" | "ends_at">;
/** A full event, for the detail page. */
export type EventDetail = EventRow;

/** Upper bound of events fetched for one month view. */
export const EVENTS_PER_VIEW = 500;

/**
 * Lists the events starting in `[from, to)`, soonest first. Readable by Guests (RLS allows `anon`).
 * @param from - Inclusive lower bound.
 * @param to - Exclusive upper bound.
 */
export async function listEventsBetween(
  from: Date,
  to: Date,
): Promise<Result<EventSummary[], "load_failed">> {
  try {
    const supabase = createClient(await cookies());
    const { data, error } = await supabase
      .from("events")
      .select("id, title, location, starts_at, ends_at")
      .gte("starts_at", from.toISOString())
      .lt("starts_at", to.toISOString())
      .order("starts_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(EVENTS_PER_VIEW);
    return error ? err("load_failed", error.message) : ok(data);
  } catch (cause) {
    return err("load_failed", cause instanceof Error ? cause.message : "unknown error");
  }
}

/**
 * Reads one event by id.
 * @returns The event, or `null` when it does not exist.
 */
export async function getEvent(id: string): Promise<Result<EventDetail | null, "load_failed">> {
  try {
    const supabase = createClient(await cookies());
    const { data, error } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
    return error ? err("load_failed", error.message) : ok(data);
  } catch (cause) {
    return err("load_failed", cause instanceof Error ? cause.message : "unknown error");
  }
}

/**
 * Lists the events that start within the next `minutes` minutes (not yet started), soonest first.
 * Used by the home banner; readable by Guests (RLS allows `anon`).
 * @param now - Current time (the caller reads the clock after `connection()`).
 * @param minutes - Size of the window.
 */
export async function listImminentEvents(
  now: Date,
  minutes: number,
): Promise<Result<EventSummary[], "load_failed">> {
  try {
    const supabase = createClient(await cookies());
    const { data, error } = await supabase
      .from("events")
      .select("id, title, location, starts_at, ends_at")
      .gt("starts_at", now.toISOString())
      .lte("starts_at", new Date(now.getTime() + minutes * 60_000).toISOString())
      .order("starts_at", { ascending: true })
      .limit(3);
    return error ? err("load_failed", error.message) : ok(data);
  } catch (cause) {
    return err("load_failed", cause instanceof Error ? cause.message : "unknown error");
  }
}
