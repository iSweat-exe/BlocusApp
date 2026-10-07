import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { err, ok, type Result } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";

/** A row of the audit log. */
export type AuditEntry = Pick<
  Database["public"]["Tables"]["audit_logs"]["Row"],
  "id" | "actor_id" | "action" | "target_id" | "details" | "created_at"
>;

/** Number of entries per journal page. */
export const AUDIT_PAGE_SIZE = 25;

/** One page of the journal and the cursor of the next one (`null` on the last page). */
export type AuditPage = { entries: AuditEntry[]; nextCursor: number | null };

/**
 * Reads one page of the audit log, newest first (keyset pagination on the identity `id`).
 * RLS only returns rows to holders of `audit.read`; anyone else gets an empty page.
 * @param options.action - Only entries of this action.
 * @param options.before - Cursor: only entries with a smaller id than this one.
 */
export async function listAuditLogs(
  options: { action?: string | null; before?: number | null } = {},
): Promise<Result<AuditPage, "load_failed">> {
  try {
    const supabase = createClient(await cookies());
    let query = supabase
      .from("audit_logs")
      .select("id, actor_id, action, target_id, details, created_at")
      .order("id", { ascending: false })
      // One extra row tells whether another page exists.
      .limit(AUDIT_PAGE_SIZE + 1);
    if (options.action) query = query.eq("action", options.action);
    if (options.before) query = query.lt("id", options.before);

    const { data, error } = await query;
    if (error) return err("load_failed", error.message);

    const hasMore = data.length > AUDIT_PAGE_SIZE;
    const entries = hasMore ? data.slice(0, AUDIT_PAGE_SIZE) : data;
    return ok({ entries, nextCursor: hasMore ? (entries.at(-1)?.id ?? null) : null });
  } catch (cause) {
    return err("load_failed", cause instanceof Error ? cause.message : "unknown error");
  }
}
