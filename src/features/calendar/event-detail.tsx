import Link from "next/link";
import { notFound } from "next/navigation";
import { getEvent } from "@/lib/data/events";
import { dayKeyOf, formatDayLong, formatTimeRange, monthKeyOf } from "./time";

/** Detail of one event: date, time, place and full text. Readable by Guests. */
export async function EventDetail({ id }: { id: string }) {
  const result = await getEvent(id);

  if (!result.ok) {
    return (
      <p role="alert" className="text-sm text-red-500">
        Impossible de charger cet événement pour le moment.
      </p>
    );
  }
  if (!result.value) notFound();

  const event = result.value;
  const day = dayKeyOf(new Date(event.starts_at));

  return (
    <article className="flex flex-col gap-4">
      <Link href={`/calendar?month=${monthKeyOf(day)}&day=${day}`} className="text-sm underline">
        ← Calendrier
      </Link>

      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">{event.title}</h2>
        <p className="text-sm capitalize text-foreground/60">{formatDayLong(event.starts_at)}</p>
        <p className="font-medium text-red-500">
          {formatTimeRange(event.starts_at, event.ends_at)}
        </p>
        {event.location && <p className="text-sm">{event.location}</p>}
      </header>

      {event.description ? (
        <p className="whitespace-pre-wrap text-sm">{event.description}</p>
      ) : (
        <p className="text-sm text-foreground/60">Pas de description.</p>
      )}
    </article>
  );
}
