import { cacheLife, cacheTag } from "next/cache";
import type { Database } from "@/lib/database.types";
import { err, ok, type Result } from "@/lib/result";
import { createPublicClient } from "@/lib/supabase/public";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

/** An event as listed in the month grid and the day list (no long text). */
export type EventSummary = Pick<
  EventRow,
  "id" | "title" | "location" | "starts_at" | "ends_at" | "finished_at"
>;
/** A full event, for the detail page. */
export type EventDetail = EventRow;

/** Upper bound of events fetched for one month view. */
export const EVENTS_PER_VIEW = 500;

const message = (cause: unknown) => (cause instanceof Error ? cause.message : "unknown error");

// Events are public (RLS lets `anon` read them), so every read below is cached once for everybody for 30 s
// ("feed" profile). Creating, editing, finishing or deleting an event calls `updateTag("events")`. Failures
// are thrown inside the cached functions, never returned: an error must not be cached.

async function fetchEventsBetween(fromIso: string, toIso: string): Promise<EventSummary[]> {
  "use cache";
  cacheLife("feed");
  cacheTag("events");

  const { data, error } = await createPublicClient()
    .from("events")
    .select("id, title, location, starts_at, ends_at, finished_at")
    .gte("starts_at", fromIso)
    .lt("starts_at", toIso)
    .order("starts_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(EVENTS_PER_VIEW);
  if (error) throw new Error(error.message);
  return data;
}

async function fetchEvent(id: string): Promise<EventDetail | null> {
  "use cache";
  cacheLife("feed");
  cacheTag("events");

  const { data, error } = await createPublicClient()
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function fetchImminentEvents(sinceIso: string, minutes: number): Promise<EventSummary[]> {
  "use cache";
  cacheLife("feed");
  cacheTag("events");

  const { data, error } = await createPublicClient()
    .from("events")
    .select("id, title, location, starts_at, ends_at, finished_at")
    .gt("starts_at", sinceIso)
    .lte("starts_at", new Date(new Date(sinceIso).getTime() + minutes * 60_000).toISOString())
    // A finished event is never "imminent".
    .is("finished_at", null)
    .order("starts_at", { ascending: true })
    .limit(10);
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Lists the events starting in `[from, to)`, soonest first. Readable by Guests, shared through the data cache.
 * @param from - Inclusive lower bound.
 * @param to - Exclusive upper bound.
 */
export async function listEventsBetween(
  from: Date,
  to: Date,
): Promise<Result<EventSummary[], "load_failed">> {
  try {
    return ok(await fetchEventsBetween(from.toISOString(), to.toISOString()));
  } catch (cause) {
    return err("load_failed", message(cause));
  }
}

/**
 * Reads one event by id (shared through the data cache).
 * @returns The event, or `null` when it does not exist.
 */
export async function getEvent(id: string): Promise<Result<EventDetail | null, "load_failed">> {
  try {
    return ok(await fetchEvent(id));
  } catch (cause) {
    return err("load_failed", message(cause));
  }
}

/**
 * Lists the open (not finished) events that start within the next `minutes` minutes, soonest first.
 * Used by the home banner. The window is anchored to the start of the current minute so that all visitors of
 * the same minute share one cached read; the banner itself hides events that have already started.
 * @param now - Current time (the caller reads the clock after `connection()`).
 * @param minutes - Size of the window.
 */
export async function listImminentEvents(
  now: Date,
  minutes: number,
): Promise<Result<EventSummary[], "load_failed">> {
  try {
    const minuteStart = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
    return ok(await fetchImminentEvents(minuteStart.toISOString(), minutes));
  } catch (cause) {
    return err("load_failed", message(cause));
  }
}
