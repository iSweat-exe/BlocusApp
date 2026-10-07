import { connection } from "next/server";
import { listImminentEvents } from "@/lib/data/events";
import { IMMINENT_WINDOW_MINUTES } from "./imminent";
import { ImminentBanner } from "./imminent-banner";
import { formatTimeRange } from "./time";

/** Events starting within the next 30 minutes, for the top of the home page. Renders nothing otherwise. */
export async function ImminentEvents() {
  // The result depends on the current time: render at request time, not in a prerender.
  await connection();
  const now = new Date();
  const result = await listImminentEvents(now, IMMINENT_WINDOW_MINUTES);
  if (!result.ok || result.value.length === 0) return null;

  return (
    <ImminentBanner
      serverNow={now.getTime()}
      events={result.value.map((event) => ({
        id: event.id,
        title: event.title,
        location: event.location,
        startsAt: event.starts_at,
        time: formatTimeRange(event.starts_at, event.ends_at),
      }))}
    />
  );
}
