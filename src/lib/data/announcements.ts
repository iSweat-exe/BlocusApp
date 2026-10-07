import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { err, ok, type Result } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";

/** A row of the home feed. */
export type Announcement = Pick<
  Database["public"]["Tables"]["announcements"]["Row"],
  "id" | "author_id" | "title" | "body" | "created_at"
>;

/** Number of announcements shown on the home page (pagination comes with the cache step 1.6). */
export const FEED_PAGE_SIZE = 20;

/**
 * Lists the latest announcements, newest first. Readable by Guests (RLS allows `anon`).
 * @param limit - Maximum number of announcements to return.
 */
export async function listAnnouncements(
  limit = FEED_PAGE_SIZE,
): Promise<Result<Announcement[], "load_failed">> {
  try {
    const supabase = createClient(await cookies());
    const { data, error } = await supabase
      .from("announcements")
      .select("id, author_id, title, body, created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit);
    return error ? err("load_failed", error.message) : ok(data);
  } catch (cause) {
    return err("load_failed", cause instanceof Error ? cause.message : "unknown error");
  }
}
