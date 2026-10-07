import Link from "next/link";
import { notFound } from "next/navigation";
import { getEvent } from "@/lib/data/events";
import { getSessionPermissions } from "@/server/session";
import { deleteEvent } from "./actions";
import { EventForm } from "./event-form";
import { dayKeyOf, formatDayLong, formatTime, formatTimeRange, monthKeyOf } from "./time";

/** Detail of one event: date, time, place and full text. Readable by Guests. */
export async function EventDetail({ id }: { id: string }) {
  const [result, session] = await Promise.all([getEvent(id), getSessionPermissions()]);

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
  const has = (permission: string) => session?.permissions.includes(permission) ?? false;
  // Display only: the Server Actions re-check the permissions and Row Level Security decides.
  const canEdit = has("event.create") && event.author_id === session?.userId;
  const canDelete = has("event.delete") || canEdit;

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

      {canEdit && (
        <details className="rounded-lg border border-foreground/10">
          <summary className="cursor-pointer px-4 py-3 text-center font-medium">Modifier</summary>
          <EventForm
            mode="edit"
            defaults={{
              id: event.id,
              title: event.title,
              description: event.description,
              location: event.location,
              date: day,
              time: formatTime(event.starts_at),
              endTime: event.ends_at ? formatTime(event.ends_at) : "",
            }}
          />
        </details>
      )}

      {canDelete && (
        <details className="rounded-lg border border-red-500/30">
          <summary className="cursor-pointer px-4 py-3 text-center text-red-500">Supprimer</summary>
          <form action={deleteEvent} className="flex flex-col gap-2 p-3">
            <input type="hidden" name="id" value={event.id} />
            <p className="text-sm">Cet événement sera supprimé définitivement.</p>
            <button
              type="submit"
              className="rounded-lg bg-red-500 px-4 py-2 font-medium text-white"
            >
              Confirmer la suppression
            </button>
          </form>
        </details>
      )}
    </article>
  );
}
