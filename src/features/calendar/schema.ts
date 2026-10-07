import { parseDayKey, zonedToUtc } from "./time";

export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 5000;
export const LOCATION_MAX = 200;
/** Same tolerance as the `check_event_start` trigger in the database. */
const PAST_TOLERANCE_MS = 5 * 60 * 1000;

/** A validated event ready to be stored. */
export type EventInput = {
  title: string;
  description: string;
  location: string;
  startsAt: Date;
  endsAt: Date | null;
};

/** Per-field error messages (French, shown in the form). */
export type EventFieldErrors = {
  title?: string;
  description?: string;
  location?: string;
  date?: string;
  time?: string;
  endTime?: string;
};

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Validates the raw event form values (all untrusted). Wall-clock date and times are read in the event
 * time zone and converted to UTC instants.
 * @param raw - Form values; `endTime` is optional and refers to the same day as the start.
 * @param now - Current time (injected for tests).
 * @param checkPast - Refuse a start in the past (creation). Editing the text of an event that already
 *   started passes `false`; the database trigger still refuses moving it into the past.
 */
export function parseEventInput(
  raw: {
    title: unknown;
    description: unknown;
    location: unknown;
    date: unknown;
    time: unknown;
    endTime: unknown;
  },
  now: Date,
  checkPast: boolean,
): { ok: true; value: EventInput } | { ok: false; fieldErrors: EventFieldErrors } {
  const fieldErrors: EventFieldErrors = {};
  const title = text(raw.title);
  const description = text(raw.description);
  const location = text(raw.location);

  if (title.length === 0) fieldErrors.title = "Le titre est obligatoire.";
  else if (title.length > TITLE_MAX) {
    fieldErrors.title = `Le titre ne peut pas dépasser ${TITLE_MAX} caractères.`;
  }
  if (description.length > DESCRIPTION_MAX) {
    fieldErrors.description = `Le texte ne peut pas dépasser ${DESCRIPTION_MAX} caractères.`;
  }
  if (location.length > LOCATION_MAX) {
    fieldErrors.location = `Le lieu ne peut pas dépasser ${LOCATION_MAX} caractères.`;
  }

  const date = parseDayKey(raw.date) ? (raw.date as string) : null;
  if (!date) fieldErrors.date = "Choisis une date valide.";

  const startMatch = TIME.exec(text(raw.time));
  if (!startMatch) fieldErrors.time = "Indique l'heure de début (HH:MM).";

  let startsAt: Date | null = null;
  if (date && startMatch) {
    startsAt = zonedToUtc(date, Number(startMatch[1]), Number(startMatch[2]));
    if (checkPast && startsAt.getTime() < now.getTime() - PAST_TOLERANCE_MS) {
      fieldErrors.time = "L'événement ne peut pas commencer dans le passé.";
    }
  }

  let endsAt: Date | null = null;
  const endText = text(raw.endTime);
  if (endText) {
    const endMatch = TIME.exec(endText);
    if (!endMatch) fieldErrors.endTime = "Indique l'heure de fin (HH:MM).";
    else if (date && startsAt) {
      endsAt = zonedToUtc(date, Number(endMatch[1]), Number(endMatch[2]));
      if (endsAt.getTime() <= startsAt.getTime()) {
        fieldErrors.endTime = "L'heure de fin doit être après le début.";
      }
    }
  }

  return Object.keys(fieldErrors).length > 0 || !startsAt
    ? { ok: false, fieldErrors }
    : { ok: true, value: { title, description, location, startsAt, endsAt } };
}
