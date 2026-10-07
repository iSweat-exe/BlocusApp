import { FullScreenDialog } from "@/components/full-screen-dialog";
import { listAnnouncements } from "@/lib/data/announcements";
import { getSessionPermissions } from "@/server/session";
import { deleteAnnouncement } from "./actions";
import { AnnouncementForm } from "./announcement-form";

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

/** Home feed: latest announcements for everyone, plus publish/delete controls by permission. */
export async function AnnouncementFeed() {
  const [result, session] = await Promise.all([listAnnouncements(), getSessionPermissions()]);
  const can = (permission: string) => session?.permissions.includes(permission) ?? false;

  return (
    <section aria-label="Actualités" className="flex flex-col gap-4">
      {can("announcement.publish") && (
        <FullScreenDialog triggerLabel="Créer un post" title="Nouveau post">
          <AnnouncementForm />
        </FullScreenDialog>
      )}

      {!result.ok ? (
        <p role="alert" className="text-sm text-red-500">
          Impossible de charger les annonces pour le moment.
        </p>
      ) : result.value.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-foreground/20 p-6 text-center text-sm text-foreground/60">
          Aucune annonce pour le moment.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {result.value.map((announcement) => {
            const canDelete =
              can("announcement.delete") ||
              (can("announcement.publish") && announcement.author_id === session?.userId);
            return (
              <li
                key={announcement.id}
                className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4 shadow-sm"
              >
                <article>
                  <header className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-semibold leading-snug">{announcement.title}</h2>
                    <time
                      dateTime={announcement.created_at}
                      className="shrink-0 text-xs text-foreground/60"
                    >
                      {dateFormat.format(new Date(announcement.created_at))}
                    </time>
                  </header>
                  <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">
                    {announcement.body}
                  </p>
                  {canDelete && (
                    <form action={deleteAnnouncement} className="mt-3">
                      <input type="hidden" name="id" value={announcement.id} />
                      <button
                        type="submit"
                        className="-ml-1 min-h-11 px-1 text-sm text-red-500 underline"
                      >
                        Supprimer
                      </button>
                    </form>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
