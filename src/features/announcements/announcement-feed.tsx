import Link from "next/link";
import { connection } from "next/server";
import { FullScreenDialog } from "@/components/full-screen-dialog";
import {
  type Announcement,
  listAnnouncements,
  listMyAnnouncements,
  type MyAnnouncement,
} from "@/lib/data/announcements";
import { getSessionPermissions } from "@/server/session";
import { AnnouncementCard, type CardPost } from "./announcement-card";
import { AnnouncementForm } from "./announcement-form";
import { FEED_MAX, FEED_STEP } from "./feed-limit";
import type { PostStatus } from "./schema";

/** A public post as a card; `mine` is the viewer's own row of that post, if it is theirs. */
function publicCard(
  post: Announcement,
  mine: MyAnnouncement | undefined,
  canDeleteAny: boolean,
): CardPost {
  return {
    id: post.id,
    title: post.title,
    body: post.body,
    date: post.published_at,
    edited: post.edited_at !== null,
    status: "public",
    imagePath: post.image_path,
    imageWidth: post.image_width,
    imageHeight: post.image_height,
    author: post.author_pseudo
      ? { pseudo: post.author_pseudo, avatarUrl: post.author_avatar_url }
      : null,
    mine: mine ?? null,
    canDelete: canDeleteAny || mine !== undefined,
  };
}

/** One of the viewer's own drafts or private posts as a card. */
function ownCard(post: MyAnnouncement): CardPost {
  return {
    id: post.id,
    title: post.title,
    body: post.body,
    date: post.updated_at,
    edited: false,
    status: post.status as PostStatus,
    imagePath: post.image_path,
    imageWidth: post.image_width,
    imageHeight: post.image_height,
    author: null,
    mine: post,
    canDelete: true,
  };
}

/**
 * Home feed: latest public posts for everyone. Publishers also get a "create" button, their drafts and private
 * posts (visible to them only) and an edit button on their own posts; moderators a delete button on any post.
 */
export async function AnnouncementFeed({ limit }: { limit: number }) {
  // The shared cache holds data that does not depend on the request, so Next.js would run it while building the
  // page (stale announcements baked into the shell, and a failing build when the database is unreachable).
  // Reading at request time keeps the data fresh: it is still cached for 2 min across visitors.
  await connection();
  const session = await getSessionPermissions();
  const can = (permission: string) => session?.permissions.includes(permission) ?? false;
  const canPublish = session !== null && can("announcement.publish");
  const [result, own] = await Promise.all([
    listAnnouncements(limit + 1),
    canPublish ? listMyAnnouncements(session.userId) : Promise.resolve(null),
  ]);
  // Read after the data above, so the clock is only used at request time.
  const now = new Date();
  const myPosts = own?.ok ? own.value : [];
  const mineById = new Map(myPosts.map((post) => [post.id, post]));
  const myPrivatePosts = myPosts.filter((post) => post.status !== "public");
  // One extra row is requested to know whether there is more to show.
  const announcements = result.ok ? result.value.slice(0, limit) : [];
  const hasMore = result.ok && result.value.length > limit;
  const canDeleteAny = can("announcement.delete");

  return (
    <section aria-label="Actualités" className="flex flex-col gap-4">
      {canPublish && (
        <FullScreenDialog triggerLabel="Créer un post" title="Nouveau post">
          <AnnouncementForm />
        </FullScreenDialog>
      )}
      {own && !own.ok && (
        <p role="alert" className="alert alert-error">
          Impossible de charger tes brouillons pour le moment.
        </p>
      )}

      {myPrivatePosts.length > 0 && (
        <section aria-labelledby="my-posts-title" className="flex flex-col gap-3">
          <h2 id="my-posts-title" className="section-title">
            Mes brouillons et posts privés
          </h2>
          <ul className="flex flex-col gap-3">
            {myPrivatePosts.map((post) => (
              <li key={post.id}>
                <AnnouncementCard post={ownCard(post)} now={now} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {!result.ok ? (
        <p role="alert" className="alert alert-error">
          Impossible de charger les annonces pour le moment.
        </p>
      ) : announcements.length === 0 ? (
        <p className="rounded-card border border-dashed border-line-strong p-6 text-center text-sm text-muted">
          Aucune annonce pour le moment.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {announcements.map((announcement) => (
            <li key={announcement.id}>
              <AnnouncementCard
                post={publicCard(announcement, mineById.get(announcement.id), canDeleteAny)}
                now={now}
              />
            </li>
          ))}
        </ul>
      )}

      {hasMore &&
        (limit < FEED_MAX ? (
          <Link
            href={`/?n=${limit + FEED_STEP}`}
            prefetch={false}
            scroll={false}
            className="btn btn-outline text-sm"
          >
            Voir plus d&apos;annonces
          </Link>
        ) : (
          <p className="text-center text-xs text-muted">
            Seules les {FEED_MAX} annonces les plus récentes sont affichées.
          </p>
        ))}
    </section>
  );
}
