/** The word a person types to confirm the deletion of their account (a tap alone is too easy to make by mistake). */
export const DELETE_CONFIRMATION = "SUPPRIMER";

/** Whether what was typed confirms the deletion: the word, in any case, without the spaces around it. */
export function isDeleteConfirmed(value: unknown): boolean {
  return typeof value === "string" && value.trim().toUpperCase() === DELETE_CONFIRMATION;
}

/** Name of the downloaded export, with the day it was made (`blocus-mes-donnees-2026-10-19.json`). */
export function exportFileName(now: Date = new Date()): string {
  return `blocus-mes-donnees-${now.toISOString().slice(0, 10)}.json`;
}

/** Bucket of the post photos; each file lives under `<author id>/`. */
export const ANNOUNCEMENT_IMAGES_BUCKET = "announcement-images";

/** The part of the Storage API used to remove the photos of an account (injected for tests). */
export type ImageStorage = {
  list: (
    path: string,
    options: { limit: number },
  ) => Promise<{ data: { name: string }[] | null; error: { message: string } | null }>;
  remove: (paths: string[]) => Promise<{ error: { message: string } | null }>;
};

/** A person never has more than a few photos; the bound only protects against a loop that cannot end. */
const MAX_ROUNDS = 20;
const PAGE_SIZE = 100;

/**
 * Removes every post photo of a user from the bucket. Each round lists what is left under their folder and
 * removes it, until the folder is empty.
 * @throws When Storage answers with an error: the account must then not be deleted, or the photos would stay
 * behind with nobody able to ask for their removal.
 */
export async function removeUserImages(storage: ImageStorage, userId: string): Promise<void> {
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const { data, error } = await storage.list(userId, { limit: PAGE_SIZE });
    if (error) throw new Error(`list failed: ${error.message}`);
    if (!data || data.length === 0) return;

    const removed = await storage.remove(data.map((file) => `${userId}/${file.name}`));
    if (removed.error) throw new Error(`remove failed: ${removed.error.message}`);
  }
}
