"use server";

import { refresh, updateTag } from "next/cache";
import { PUBLIC_DATA_TAGS } from "@/lib/data/cache-tags";

// Shared data is expired at most this often per server instance, however many people press the button.
const MIN_EXPIRY_GAP_MS = 10_000;

let lastExpiry = 0;

/**
 * Manual refresh ("Actualiser"): expires the shared public data so that the next render reads fresh rows, then
 * re-renders the current page. The shared cache keeps data for up to 2 minutes (see `cacheLife.feed` in
 * `next.config.ts`), which is what keeps the free quotas safe; this is the escape hatch for someone who wants
 * the latest now. Public data only, so no session is needed. Expiring is limited to once per 10 s per
 * instance, so pressing the button repeatedly cannot turn into a database read per press; a press inside that
 * window still re-renders the page from the data refreshed a moment ago.
 */
export async function refreshPublicData(): Promise<void> {
  const now = Date.now();
  if (now - lastExpiry >= MIN_EXPIRY_GAP_MS) {
    lastExpiry = now;
    for (const tag of PUBLIC_DATA_TAGS) updateTag(tag);
  } else {
    refresh();
  }
}
