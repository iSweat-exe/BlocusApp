import Link from "next/link";
import { connection } from "next/server";
import { EmptyState } from "@/components/empty-state";
import { CalendarIcon, ChevronRightIcon } from "@/components/icons";
import { listEventsBetween } from "@/lib/data/events";
import {
  addDays,
  dayKeyOf,
  formatDayLong,
  formatTimeRange,
  relativeDayLabel,
  zonedToUtc,
} from "./time";

/** How far ahead the panel looks, and how many events it lists. */
const DAYS_AHEAD = 7;
const MAX_SHOWN = 5;
/** An event without an end is taken to last this long when deciding whether it is over. */
const DEFAULT_LENGTH_MS = 60 * 60_000;

/** The events still to come (or under way) in the next days: not finished, not over. */
export function upcomingOf<
  T extends { starts_at: string; ends_at: string | null; finished_at: string | null },
>(events: readonly T[], now: number): T[] {
  return events.filter((event) => {
    if (event.finished_at !== null) return false;
    const end = event.ends_at
      ? new Date(event.ends_at).getTime()
      : new Date(event.starts_at).getTime() + DEFAULT_LENGTH_MS;
    return end > now;
  });
}

/**
 * The panel on the side of the home page on a desktop: what is coming up in the next seven days, soonest first, each
 * a link to its page, and a way to the calendar. The read is aligned on whole days (Paris time), so it is shared
 * through the data cache like the calendar's. Readable by Guests.
 */
export async function UpcomingEvents() {
  // The list depends on the current time: render at request time, not in a prerender.
  await connection();
  const now = new Date();
  const today = dayKeyOf(now);
  const result = await listEventsBetween(zonedToUtc(today), zonedToUtc(addDays(today, DAYS_AHEAD)));
  if (!result.ok) return null;

  const upcoming = upcomingOf(result.value, now.getTime()).slice(0, MAX_SHOWN);

  return (
    <section aria-labelledby="upcoming-title" className="flex flex-col gap-3">
      <h2 id="upcoming-title" className="section-title">
        À venir cette semaine
      </h2>

      {upcoming.length === 0 ? (
        <EmptyState compact icon={<CalendarIcon className="size-5" />} title="Rien de prévu">
          Aucun événement dans les sept prochains jours.
        </EmptyState>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {upcoming.map((event) => {
            const day = dayKeyOf(new Date(event.starts_at));
            return (
              <li key={event.id}>
                <Link
                  href={`/calendar/${event.id}`}
                  prefetch={false}
                  className="flex min-h-control flex-col gap-0.5 px-4 py-3 transition-colors [@media(hover:hover)]:hover:bg-foreground/5 active:bg-foreground/10"
                >
                  <span className="text-xs font-medium text-accent tabular-nums">
                    {relativeDayLabel(day, today) ?? formatDayLong(event.starts_at)}
                    {" · "}
                    {formatTimeRange(event.starts_at, event.ends_at)}
                  </span>
                  <span className="font-semibold break-words">{event.title}</span>
                  {event.location && <span className="text-sm text-muted">{event.location}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Link
        href="/calendar"
        prefetch={false}
        className="inline-flex min-h-tap items-center gap-1 self-start rounded-control px-1 text-sm font-medium text-muted transition-colors [@media(hover:hover)]:hover:text-foreground"
      >
        Voir le calendrier
        <ChevronRightIcon className="size-4" />
      </Link>
    </section>
  );
}
