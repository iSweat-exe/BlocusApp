import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { CalendarIcon, ClockIcon, PinIcon } from "@/components/icons";
import { ReactionBar } from "@/features/announcements/reaction-bar";
import { buildReactionState } from "@/features/announcements/reactions";
import { getEvent } from "@/lib/data/events";
import { listEventReactionTotals, listMyEventReactions } from "@/lib/data/reactions";
import { getSessionPermissions } from "@/server/session";
import { deleteEvent } from "./actions";
import { EventBackLink } from "./event-back-link";
import { EventForm } from "./event-form";
import { FinishToggle } from "./finish-toggle";
import {
  dayKeyOf,
  formatDayLong,
  formatDuration,
  formatTime,
  formatTimeRange,
  isInProgress,
  monthKeyOf,
  relativeDayLabel,
} from "./time";

/** One line of the facts card: an icon tile, a small label and the value. */
function Fact({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3.5 px-4 py-3.5">
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-control bg-accent/15 text-accent"
      >
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-medium text-muted">{label}</dt>
        <dd className="font-semibold break-words">{children}</dd>
      </div>
    </div>
  );
}

/**
 * Page of one event, made to be read on a phone: where it stands (today, in progress, over), the title, then three
 * facts (day, time with its length, place), the description and the reactions. People who may manage it get their
 * controls last, under their own heading. Readable by Guests; the controls are display only: the Server Actions
 * re-check the permissions and Row Level Security decides.
 */
export async function EventDetail({ id }: { id: string }) {
  const [result, session] = await Promise.all([getEvent(id), getSessionPermissions()]);

  if (!result.ok) {
    return (
      <div className="flex flex-col gap-4">
        <EventBackLink />
        <p role="alert" className="alert alert-error">
          Impossible de charger cet événement pour le moment.
        </p>
      </div>
    );
  }
  if (!result.value) notFound();

  const event = result.value;
  // After the session read above, so it runs at request time (the totals are shared through the data cache).
  const [totals, mine] = await Promise.all([
    listEventReactionTotals([event.id]),
    session ? listMyEventReactions(session.userId, [event.id]) : Promise.resolve(null),
  ]);
  // A failed read only hides the reactions, never the event.
  const reactions = totals.ok
    ? buildReactionState(totals.value[event.id], mine?.ok ? (mine.value[event.id] ?? []) : [])
    : null;

  const now = new Date();
  const day = dayKeyOf(new Date(event.starts_at));
  const finished = event.finished_at !== null;
  const inProgress = !finished && isInProgress(event.starts_at, event.ends_at, now.getTime());
  const relative = relativeDayLabel(day, dayKeyOf(now));
  const duration = formatDuration(event.starts_at, event.ends_at);

  const has = (permission: string) => session?.permissions.includes(permission) ?? false;
  const canEdit = has("event.create") && event.author_id === session?.userId;
  const canFinish = has("event.finish");
  const canDelete = has("event.delete") || canEdit;
  const canManage = canFinish || canEdit || canDelete;

  return (
    <article className="flex animate-fade-in flex-col gap-section">
      <EventBackLink href={`/calendar?month=${monthKeyOf(day)}&day=${day}`} />

      <header className="flex flex-col gap-3">
        {(finished || inProgress || relative) && (
          <div className="flex flex-wrap items-center gap-2">
            {finished ? (
              <span className="chip">Terminé</span>
            ) : inProgress ? (
              <span className="chip chip-accent">En cours</span>
            ) : (
              <span className="chip chip-accent">{relative}</span>
            )}
          </div>
        )}
        <h1 className={`page-title break-words ${finished ? "text-muted" : ""}`}>{event.title}</h1>
      </header>

      <dl className="card divide-y divide-line overflow-hidden">
        <Fact icon={<CalendarIcon className="size-5" />} label="Date">
          <span className="block first-letter:uppercase">{formatDayLong(event.starts_at)}</span>
        </Fact>
        <Fact icon={<ClockIcon className="size-5" />} label="Horaire">
          <span className="tabular-nums">{formatTimeRange(event.starts_at, event.ends_at)}</span>
          {duration && (
            <span className="ml-2 text-sm font-medium text-muted tabular-nums">· {duration}</span>
          )}
        </Fact>
        {event.location && (
          <Fact icon={<PinIcon className="size-5" />} label="Lieu">
            {event.location}
          </Fact>
        )}
      </dl>

      <section aria-labelledby="event-description" className="flex flex-col gap-2">
        <h2 id="event-description" className="section-title">
          Description
        </h2>
        {event.description ? (
          <p className="card px-4 py-3.5 leading-relaxed break-words whitespace-pre-wrap text-foreground/90">
            {event.description}
          </p>
        ) : (
          <p className="card px-4 py-3.5 text-sm text-muted">Pas de description.</p>
        )}
      </section>

      {reactions && (
        <ReactionBar
          kind="event"
          targetId={event.id}
          state={reactions}
          canReact={session !== null}
          className=""
        />
      )}

      {canManage && (
        <section aria-labelledby="event-manage" className="flex flex-col gap-3">
          <h2 id="event-manage" className="section-title">
            Gérer l&apos;événement
          </h2>

          {canFinish && <FinishToggle id={event.id} finished={finished} />}

          {canEdit && finished && (
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="btn btn-outline opacity-50"
            >
              Modifier (événement terminé)
            </button>
          )}

          {canEdit && !finished && (
            <details className="card">
              <summary className="flex min-h-control cursor-pointer items-center justify-center px-4 font-medium">
                Modifier
              </summary>
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
            <details className="rounded-card border border-danger/30">
              <summary className="flex min-h-control cursor-pointer items-center justify-center px-4 font-medium text-danger">
                Supprimer
              </summary>
              <form action={deleteEvent} className="flex flex-col gap-3 p-4">
                <input type="hidden" name="id" value={event.id} />
                <p className="text-sm">Cet événement sera supprimé définitivement.</p>
                <button type="submit" className="btn btn-danger">
                  Confirmer la suppression
                </button>
              </form>
            </details>
          )}
        </section>
      )}
    </article>
  );
}
