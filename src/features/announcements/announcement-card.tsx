import Image from "next/image";
import { Avatar } from "@/components/avatar";
import { FullScreenDialog } from "@/components/full-screen-dialog";
import type { MyAnnouncement } from "@/lib/data/announcements";
import { AnnouncementForm } from "./announcement-form";
import { formatAnnouncementDate } from "./date";
import { DeleteAnnouncementButton } from "./delete-announcement-button";
import { announcementImageUrl } from "./image";
import { ReactionBar } from "./reaction-bar";
import type { ReactionState } from "./reactions";
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
  /** Emoji reactions of a public post; `null` for drafts and private posts, which cannot be reacted to. */
  reactions: ReactionState | null;
  /** Signed-in viewers can react; Guests only see the totals. */
  canReact: boolean;
};

/**
 * One post of the feed: a byline (the author, when they chose to be shown, then the date), the title, the text, an
 * optional photo, and the author's controls. The author sits in the byline like on the social networks: a small
 * picture and the pseudo ahead of the date, instead of a line of its own between the title and the text.
 */
export function AnnouncementCard({ post, now }: { post: CardPost; now: Date }) {
  const hasControls = post.canDelete || post.mine !== null;
  return (
    <article
      className={`rounded-card border border-line px-4 pt-4 ${hasControls ? "pb-2" : "pb-4"}`}
    >
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-xs text-muted">
          {post.author && (
            <>
              <span className="flex min-w-0 items-center gap-1.5">
                <Avatar
                  pseudo={post.author.pseudo}
                  url={post.author.avatarUrl}
                  size="xs"
                  decorative
                />
                <span className="min-w-0 truncate font-semibold text-foreground">
                  <span className="sr-only">Par </span>
                  {post.author.pseudo}
                </span>
              </span>
              <span aria-hidden="true" className="shrink-0">
                ·
              </span>
            </>
          )}
          <time dateTime={post.date} className="shrink-0 whitespace-nowrap">
            {formatAnnouncementDate(post.date, now)}
          </time>
          {post.edited && <span className="shrink-0 whitespace-nowrap">· modifié</span>}
          {post.status !== "public" && (
            <span className="chip chip-accent ml-1 shrink-0">
              {POST_STATUS_LABELS[post.status]}
            </span>
          )}
        </div>
        <h2 className="break-words text-lg font-semibold leading-snug">{post.title}</h2>
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
          className="mt-3 h-auto w-full rounded-control img-outline"
        />
      )}

      {post.reactions && (
        <ReactionBar
          kind="post"
          targetId={post.id}
          state={post.reactions}
          canReact={post.canReact}
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
