import { cacheLife, cacheTag } from "next/cache";
import type { Database } from "@/lib/database.types";
import { err, ok, type Result } from "@/lib/result";
import { createPublicClient } from "@/lib/supabase/public";

/** A row of the home feed. */
export type Announcement = Pick<
  Database["public"]["Tables"]["announcements"]["Row"],
  "id" | "author_id" | "title" | "body" | "created_at"
>;

/** Number of announcements shown on the home page (pagination comes with the payload PR). */
export const FEED_PAGE_SIZE = 20;

/**
 * Reads the latest announcements once for everybody: the result is the same for every visitor (RLS lets
 * `anon` read them), so it is cached and shared for 30 s ("feed" profile). Publishing or deleting calls
 * `updateTag("announcements")`, so the author sees the change immediately and others within 30 s.
 * A failure is thrown, never returned: an error must not be cached.
 */
async function fetchAnnouncements(limit: number): Promise<Announcement[]> {
  "use cache";
  cacheLife("feed");
  cacheTag("announcements");

  const { data, error } = await createPublicClient()
    .from("announcements")
    .select("id, author_id, title, body, created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Lists the latest announcements, newest first. Readable by Guests and shared through the data cache.
 * @param limit - Maximum number of announcements to return.
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
