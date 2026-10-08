import Image from "next/image";
import { Avatar } from "@/components/avatar";
import { FullScreenDialog } from "@/components/full-screen-dialog";
import type { MyAnnouncement } from "@/lib/data/announcements";
import { AnnouncementForm } from "./announcement-form";
import { formatAnnouncementDate } from "./date";
import { DeleteAnnouncementButton } from "./delete-announcement-button";
import { announcementImageUrl } from "./image";
import { POST_STATUS_LABELS, type PostStatus } from "./schema";

/** What a card shows; built by the feed from a public post and, for the viewer's own posts, their own row. */
export type CardPost = {
  id: string;
  title: string;
  body: string;
  /** Publication date of a public post, last change of a draft or private post. */
  date: string;
  edited: boolean;
  status: PostStatus;
  imagePath: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  /** Shown only when the author chose to (public posts). */
  author: { pseudo: string; avatarUrl: string | null } | null;
  /** The viewer's own row: gives them the edit button and fills the edit form. */
  mine: MyAnnouncement | null;
  canDelete: boolean;
};

/** One post of the feed: date, title, optional author, text, optional photo, and the author's controls. */
export function AnnouncementCard({ post, now }: { post: CardPost; now: Date }) {
  const hasControls = post.canDelete || post.mine !== null;
  return (
    <article
      className={`rounded-card border border-line px-4 pt-4 ${hasControls ? "pb-2" : "pb-4"}`}
    >
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <time dateTime={post.date}>{formatAnnouncementDate(post.date, now)}</time>
          {post.edited && <span>· modifié</span>}
          {post.status !== "public" && (
            <span className="chip chip-accent">{POST_STATUS_LABELS[post.status]}</span>
          )}
        </div>
        <h2 className="break-words text-lg font-semibold leading-snug">{post.title}</h2>
        {post.author && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Avatar pseudo={post.author.pseudo} url={post.author.avatarUrl} size="sm" decorative />
            <span className="min-w-0 truncate">Par {post.author.pseudo}</span>
          </p>
        )}
      </header>

      <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-foreground/90">
        {post.body}
      </p>

      {post.imagePath && post.imageWidth && post.imageHeight && (
        <Image
          src={announcementImageUrl(post.imagePath)}
          alt={`Photo du post « ${post.title} »`}
          width={post.imageWidth}
          height={post.imageHeight}
          unoptimized
          loading="lazy"
          className="mt-3 h-auto w-full rounded-control border border-line"
        />
      )}

      {hasControls && (
        <footer className="mt-3 flex items-center justify-end gap-1 border-t border-line pt-2">
          {post.mine && (
            <FullScreenDialog
              triggerLabel="Modifier"
              title="Modifier le post"
              triggerClassName="inline-flex min-h-tap items-center rounded-control px-3 text-sm text-muted active:bg-foreground/10 [@media(hover:hover)]:hover:text-foreground"
            >
              <AnnouncementForm post={post.mine} />
            </FullScreenDialog>
          )}
          {post.canDelete && <DeleteAnnouncementButton id={post.id} title={post.title} />}
        </footer>
      )}
    </article>
  );
}
