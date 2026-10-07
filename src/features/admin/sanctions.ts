/** Ban duration choices offered by the form. */
export const DURATION_PRESETS = ["1h", "24h", "7d", "30d", "permanent", "custom"] as const;
export type DurationPreset = (typeof DURATION_PRESETS)[number];

export const DURATION_LABELS: Record<DurationPreset, string> = {
  "1h": "1 heure",
  "24h": "24 heures",
  "7d": "7 jours",
  "30d": "30 jours",
  permanent: "Permanent",
  custom: "Date personnalisée…",
};

const HOUR = 60 * 60 * 1000;
const PRESET_MS: Partial<Record<DurationPreset, number>> = {
  "1h": HOUR,
  "24h": 24 * HOUR,
  "7d": 7 * 24 * HOUR,
  "30d": 30 * 24 * HOUR,
};

/** A custom expiry further than this is refused: use "Permanent" instead. */
export const MAX_CUSTOM_DAYS = 365 * 5;
export const REASON_MAX = 500;

/** A validated ban request; `expiresAt` is `null` for a permanent ban. */
export type BanInput = { reason: string; expiresAt: Date | null };
export type BanFieldErrors = { reason?: string; duration?: string };

/**
 * Validates the raw ban form values. Runs on the server, with the server clock.
 * @param raw - Untrusted values; `customExpiresAt` is an ISO date-time built by the browser.
 * @param now - Current time (injected for tests).
 */
export function parseBanInput(
  raw: { reason: unknown; duration: unknown; customExpiresAt: unknown },
  now: Date,
): { ok: true; value: BanInput } | { ok: false; fieldErrors: BanFieldErrors } {
  const fieldErrors: BanFieldErrors = {};
  const reason = typeof raw.reason === "string" ? raw.reason.trim() : "";
  if (reason.length === 0) fieldErrors.reason = "Le motif est obligatoire.";
  else if (reason.length > REASON_MAX) {
    fieldErrors.reason = `Le motif ne peut pas dépasser ${REASON_MAX} caractères.`;
  }

  const duration = DURATION_PRESETS.find((preset) => preset === raw.duration);
  let expiresAt: Date | null = null;
  if (!duration) {
    fieldErrors.duration = "Choisis une durée.";
  } else if (duration === "custom") {
    const parsed = typeof raw.customExpiresAt === "string" ? new Date(raw.customExpiresAt) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) {
      fieldErrors.duration = "Indique une date d'expiration valide.";
    } else if (parsed.getTime() <= now.getTime()) {
      fieldErrors.duration = "La date d'expiration doit être dans le futur.";
    } else if (parsed.getTime() - now.getTime() > MAX_CUSTOM_DAYS * 24 * HOUR) {
      fieldErrors.duration = "Au-delà de 5 ans, choisis « Permanent ».";
    } else {
      expiresAt = parsed;
    }
  } else if (duration !== "permanent") {
    expiresAt = new Date(now.getTime() + (PRESET_MS[duration] ?? 0));
  }

  return Object.keys(fieldErrors).length > 0
    ? { ok: false, fieldErrors }
    : { ok: true, value: { reason, expiresAt } };
}

/** A row of `moderation_actions` as needed by the UI. */
export type SanctionView = {
  id: string;
  kind: string;
  reason: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
};

/** Active = not lifted and not expired (same rule as `is_banned()` in the database). */
export function isSanctionActive(sanction: SanctionView, now: Date): boolean {
  if (sanction.revoked_at) return false;
  return sanction.expires_at === null || new Date(sanction.expires_at).getTime() > now.getTime();
}
