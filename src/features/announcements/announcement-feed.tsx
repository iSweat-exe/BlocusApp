import { connection } from "next/server";
import { FullScreenDialog } from "@/components/full-screen-dialog";
import { listAnnouncements } from "@/lib/data/announcements";
import { getSessionPermissions } from "@/server/session";
import { AnnouncementForm } from "./announcement-form";
import { formatAnnouncementDate } from "./date";
import { DeleteAnnouncementButton } from "./delete-announcement-button";

/** Home feed: latest announcements for everyone, plus publish/delete controls by permission. */
export async function AnnouncementFeed() {
  // The shared cache holds data that does not depend on the request, so Next.js would run it while building the
  // page (stale announcements baked into the shell, and a failing build when the database is unreachable).
  // Reading at request time keeps the data fresh: it is still cached for 30 s across visitors.
  await connection();
  const [result, session] = await Promise.all([listAnnouncements(), getSessionPermissions()]);
  const can = (permission: string) => session?.permissions.includes(permission) ?? false;
  // Read after the data above, so the clock is only used at request time.
  const now = new Date();

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
              <li key={announcement.id}>
                {/* A plain card: border only, no side bar, no shadow, no badge. */}
                <article
                  className={`rounded-2xl border border-foreground/10 px-4 pt-4 ${
                    canDelete ? "pb-2" : "pb-4"
                  }`}
                >
                  <header className="flex flex-col gap-1">
                    <time dateTime={announcement.created_at} className="text-xs text-foreground/60">
                      {formatAnnouncementDate(announcement.created_at, now)}
                    </time>
                    <h2 className="break-words text-lg font-semibold leading-snug">
                      {announcement.title}
                    </h2>
                  </header>

                  <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-foreground/90">
                    {announcement.body}
                  </p>

                  {canDelete && (
                    <footer className="mt-3 flex justify-end border-t border-foreground/10 pt-2">
                      <DeleteAnnouncementButton id={announcement.id} title={announcement.title} />
                    </footer>
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
