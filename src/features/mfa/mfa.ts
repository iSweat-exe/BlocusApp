/** The authenticator apps (Google Authenticator, Aegis, 1Password…) show a code of six digits. */
export const TOTP_CODE_LENGTH = 6;

/** Removes the spaces people type or paste into the code field (« 123 456 »). */
export function normalizeCode(input: unknown): string {
  return typeof input === "string" ? input.replace(/\s+/g, "") : "";
}

/** Whether `input` is a code of six digits once normalized. */
export function isValidCode(input: unknown): boolean {
  return /^\d{6}$/.test(normalizeCode(input));
}

/** The secret in groups of four, easier to read and to type when the QR code cannot be scanned. */
export function formatSecret(secret: string): string {
  return (secret.match(/.{1,4}/g) ?? []).join(" ");
}

/**
 * Where a session stands: `aal2` once the second factor was given, `aal1` otherwise (the JWT `aal` claim; a token
 * without it counts as `aal1`).
 */
export function assuranceLevelOf(claim: unknown): "aal1" | "aal2" {
  return claim === "aal2" ? "aal2" : "aal1";
}

/** What the interface knows about the second factor of the signed-in person. */
export type MfaState = {
  aal: "aal1" | "aal2";
  /** Id of their verified authenticator, or `null` when they have none. */
  verifiedFactorId: string | null;
  /** Whether the administrators' rule is on (the database switch). */
  required: boolean;
  /** Whether the database holds this very session back: the rule is on, an administrator role, not AAL2. */
  blocked: boolean;
};
