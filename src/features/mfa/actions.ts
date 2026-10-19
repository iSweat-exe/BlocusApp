"use server";

import { requestCookies } from "@/lib/supabase/request-cookies";
import { createClient } from "@/lib/supabase/server";
import { logActionError } from "@/server/log-action-error";
import { isValidCode, normalizeCode } from "./mfa";

/** Outcome of a second factor action. */
export type MfaResult = { ok: true } | { ok: false; message: string };

/** What the enrollment screen needs: the QR code (an SVG data URI) and the secret to type when it cannot scan. */
export type EnrollmentResult =
  { ok: true; factorId: string; qrCode: string; secret: string } | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGN_IN = "Connecte-toi pour continuer.";
const WRONG_CODE = "Code incorrect ou expiré. Vérifie l'heure de ton téléphone et réessaie.";
const FAILED = "L'opération a échoué. Réessaie.";

type AuthError = { code?: string; message: string; status?: number };

/** Turns an Auth error into what the person is told; unexpected ones are logged (reason only, never a code). */
function refusal(action: string, error: AuthError): MfaResult & { ok: false } {
  if (error.code === "mfa_verification_failed" || error.code === "mfa_challenge_expired") {
    return { ok: false, message: WRONG_CODE };
  }
  if (error.status === 429 || error.code === "over_request_rate_limit") {
    return { ok: false, message: "Trop d'essais. Patiente un instant avant de réessayer." };
  }
  if (
    error.code === "mfa_totp_enroll_not_enabled" ||
    error.code === "mfa_totp_verify_not_enabled"
  ) {
    return {
      ok: false,
      message: "La double authentification n'est pas activée sur le serveur d'authentification.",
    };
  }
  logActionError(action, { code: error.code, message: error.message });
  return { ok: false, message: FAILED };
}

/** Gives the code for one authenticator: a challenge, then the verification (which also raises the session to AAL2). */
async function verifyFactor(factorId: string, code: string, action: string): Promise<MfaResult> {
  const supabase = createClient(await requestCookies());
  const challenge = await supabase.auth.mfa.challenge({ factorId });
  if (challenge.error) return refusal(action, challenge.error);

  const verified = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.data.id,
    code,
  });
  return verified.error ? refusal(action, verified.error) : { ok: true };
}

/**
 * Starts the enrollment of an authenticator app: removes the abandoned attempts (an unverified factor would pile
 * up), then asks Auth for a new TOTP secret. Not confirmed until {@link confirmTotpEnrollment} gets a valid code.
 * Refused when the person already has a verified authenticator.
 */
export async function startTotpEnrollment(): Promise<EnrollmentResult> {
  const supabase = createClient(await requestCookies());
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { ok: false, message: SIGN_IN };

  const factors = await supabase.auth.mfa.listFactors();
  if (factors.error) return refusal("startTotpEnrollment", factors.error);
  if (factors.data.totp.some((factor) => factor.status === "verified")) {
    return { ok: false, message: "La double authentification est déjà activée." };
  }
  for (const factor of factors.data.all) {
    if (factor.factor_type === "totp" && factor.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: "BLOCUS",
    friendlyName: "Application d'authentification",
  });
  if (error) return refusal("startTotpEnrollment", error);
  return { ok: true, factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

/** Confirms an enrollment with the first code of the new authenticator: from then on the factor is verified. */
export async function confirmTotpEnrollment(factorId: unknown, code: unknown): Promise<MfaResult> {
  if (typeof factorId !== "string" || !UUID.test(factorId) || !isValidCode(code)) {
    return { ok: false, message: "Entre le code à six chiffres de ton application." };
  }
  return verifyFactor(factorId, normalizeCode(code), "confirmTotpEnrollment");
}

/** Gives the code of the person's verified authenticator for this session (AAL1 to AAL2). */
export async function verifyTotpCode(code: unknown): Promise<MfaResult> {
  if (!isValidCode(code)) {
    return { ok: false, message: "Entre le code à six chiffres de ton application." };
  }
  const supabase = createClient(await requestCookies());
  const factors = await supabase.auth.mfa.listFactors();
  if (factors.error) return refusal("verifyTotpCode", factors.error);
  const factor = factors.data.totp.find((item) => item.status === "verified");
  if (!factor)
    return { ok: false, message: "Aucune application d'authentification n'est enregistrée." };
  return verifyFactor(factor.id, normalizeCode(code), "verifyTotpCode");
}

/** Removes the authenticator. The current code is asked first: a stolen session alone cannot do it. */
export async function disableTotp(code: unknown): Promise<MfaResult> {
  const verified = await verifyTotpCode(code);
  if (!verified.ok) return verified;

  const supabase = createClient(await requestCookies());
  const factors = await supabase.auth.mfa.listFactors();
  if (factors.error) return refusal("disableTotp", factors.error);
  for (const factor of factors.data.all) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (error) return refusal("disableTotp", error);
  }
  return { ok: true };
}

/**
 * Turns the administrators' second factor rule on or off (super administrators, from a session that passed the
 * second factor: `set_admin_mfa_required()` checks both in the database).
 */
export async function setAdminMfaRequired(required: unknown): Promise<MfaResult> {
  if (typeof required !== "boolean") return { ok: false, message: "Demande invalide." };

  const supabase = createClient(await requestCookies());
  const { error } = await supabase.rpc("set_admin_mfa_required", { p_required: required });
  if (error) {
    if (error.message === "mfa_required") {
      return { ok: false, message: "Valide d'abord ton code de double authentification." };
    }
    if (error.code === "42501") {
      return { ok: false, message: "Seul un super administrateur peut changer ce réglage." };
    }
    logActionError("setAdminMfaRequired", error);
    return { ok: false, message: FAILED };
  }
  return { ok: true };
}
