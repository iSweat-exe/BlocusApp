/** Maximum lengths, mirrored by the CHECK constraints of the `announcements` table. */
export const TITLE_MAX = 120;
export const BODY_MAX = 5000;

/** A validated announcement ready to be stored. */
export type AnnouncementInput = { title: string; body: string };

/** Per-field error messages (French, shown in the UI). */
export type AnnouncementFieldErrors = { title?: string; body?: string };

/**
 * Validates the raw values of the publish form. Never trust the client: runs on the server.
 * @param raw - Untrusted `title` and `body` values (any type, e.g. `FormData` entries).
 * @returns The trimmed input, or one error message per invalid field.
 */
export function validateAnnouncementInput(raw: {
  title: unknown;
  body: unknown;
}): { ok: true; value: AnnouncementInput } | { ok: false; fieldErrors: AnnouncementFieldErrors } {
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const body = typeof raw.body === "string" ? raw.body.trim() : "";
  const fieldErrors: AnnouncementFieldErrors = {};

  if (title.length === 0) fieldErrors.title = "Le titre est obligatoire.";
  else if (title.length > TITLE_MAX) {
    fieldErrors.title = `Le titre ne peut pas dépasser ${TITLE_MAX} caractères.`;
  }

  if (body.length === 0) fieldErrors.body = "Le message est obligatoire.";
  else if (body.length > BODY_MAX) {
    fieldErrors.body = `Le message ne peut pas dépasser ${BODY_MAX} caractères.`;
  }

  return Object.keys(fieldErrors).length > 0
    ? { ok: false, fieldErrors }
    : { ok: true, value: { title, body } };
}
