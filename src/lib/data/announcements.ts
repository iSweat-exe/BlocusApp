import { cacheLife, cacheTag } from "next/cache";
import type { Database } from "@/lib/database.types";
import { err, ok, type Result } from "@/lib/result";
import { createPublicClient } from "@/lib/supabase/public";
import { requestCookies } from "@/lib/supabase/request-cookies";
import { createClient } from "@/lib/supabase/server";

/**
 * A public post of the home feed. The author fields are filled only when the author chose to show their name
 * (the `announcement_feed` view hides them otherwise).
 */
export type Announcement = {
  id: string;
  title: string;
  body: string;
  published_at: string;
  edited_at: string | null;
  image_path: string | null;
  image_width: number | null;
  image_height: number | null;
  author_id: string | null;
  author_pseudo: string | null;
  author_avatar_url: string | null;
};

/** One of the signed-in user's own posts, whatever its visibility (drafts and private posts included). */
export type MyAnnouncement = Pick<
  Database["public"]["Tables"]["announcements"]["Row"],
  | "id"
  | "title"
  | "body"
  | "status"
  | "show_author"
  | "image_path"
  | "image_width"
  | "image_height"
  | "published_at"
  | "edited_at"
  | "updated_at"
>;

/** Default number of announcements read (the home page asks for its own limit, 10 to 51). */
export const FEED_PAGE_SIZE = 10;

/** Number of own posts read for the "my posts" section. */
export const MY_POSTS_LIMIT = 50;

/**
 * Reads the latest public posts once for everybody: the result is the same for every visitor (the feed view is
 * readable by `anon`), so it is cached and shared for 2 min ("feed" profile). Creating, editing or deleting calls
 * `updateTag("announcements")`, so the author sees the change immediately; the others get it within 2 min, or at
 * once with the "Actualiser" button.
 * A failure is thrown, never returned: an error must not be cached.
 */
async function fetchAnnouncements(limit: number): Promise<Announcement[]> {
  "use cache";
  cacheLife("feed");
  cacheTag("announcements");

  const { data, error } = await createPublicClient()
    .from("announcement_feed")
    .select(
      "id, title, body, published_at, edited_at, image_path, image_width, image_height, author_id, author_pseudo, author_avatar_url",
    )
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  // The view types every column as nullable; the columns below never are for a public post.
  return data.map((row) => ({
    ...row,
    id: row.id!,
    title: row.title!,
    body: row.body!,
    published_at: row.published_at!,
  }));
}

/**
 * Lists the latest public posts, newest first. Readable by Guests and shared through the data cache.
 * @param limit - Maximum number of posts to return.
 */
export async function listAnnouncements(
  limit = FEED_PAGE_SIZE,
): Promise<Result<Announcement[], "load_failed">> {
  try {
    return ok(await fetchAnnouncements(limit));
  } catch (cause) {
    return err("load_failed", cause instanceof Error ? cause.message : "unknown error");
  }
}

/**
 * Lists the signed-in user's own posts, most recently changed first. Not cached: it depends on who asks (Row
 * Level Security only returns the caller's own rows, plus public ones for moderators, hence the filter).
 * @param userId - The caller's id.
 */
export async function listMyAnnouncements(
  userId: string,
): Promise<Result<MyAnnouncement[], "load_failed">> {
  try {
    const supabase = createClient(await requestCookies());
    const { data, error } = await supabase
      .from("announcements")
      .select(
        "id, title, body, status, show_author, image_path, image_width, image_height, published_at, edited_at, updated_at",
      )
      .eq("author_id", userId)
      .order("updated_at", { ascending: false })
      .limit(MY_POSTS_LIMIT);
    return error ? err("load_failed", error.message) : ok(data);
  } catch (cause) {
    return err("load_failed", cause instanceof Error ? cause.message : "unknown error");
  }
}
