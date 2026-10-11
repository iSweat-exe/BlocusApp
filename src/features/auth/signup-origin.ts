import { createServiceClient } from "@/lib/supabase/service";

/** Coarse location of a sign-up. Each part is optional: the hosting platform does not always know it. */
export type SignupOrigin = {
  /** ISO 3166-1 alpha-2 code in capitals, e.g. `FR`. */
  country: string | null;
  region: string | null;
  city: string | null;
};

/** An account older than this is not a sign-up any more (the database allows 15 minutes). */
const NEW_ACCOUNT_WINDOW_MS = 10 * 60_000;

/** Trims a header value and drops control characters; `null` when nothing is left or it is too long. */
function cleanText(value: string | null, maxLength: number): string | null {
  if (!value) return null;
  const text = [...value]
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code > 31 && code !== 127;
    })
    .join("")
    .trim();
  return text && text.length <= maxLength ? text : null;
}

/** The city header is URL-encoded by the platform (`S%C3%A3o%20Paulo`). */
function decodeCity(value: string | null): string | null {
  if (!value) return null;
  try {
    return cleanText(decodeURIComponent(value), 96);
  } catch {
    return null;
  }
}

/**
 * Reads the location Vercel adds to every request (`x-vercel-ip-*`). The platform derives it from the IP
 * address, which is never read or stored here. The headers are absent outside Vercel (local development).
 * @returns The origin, or `null` when no part of it is usable.
 */
export function signupOriginFromHeaders(headers: Headers): SignupOrigin | null {
  const rawCountry = cleanText(headers.get("x-vercel-ip-country"), 2);
  const country = rawCountry && /^[A-Za-z]{2}$/.test(rawCountry) ? rawCountry.toUpperCase() : null;
  const region = cleanText(headers.get("x-vercel-ip-country-region"), 64);
  const city = decodeCity(headers.get("x-vercel-ip-city"));
  return country || region || city ? { country, region, city } : null;
}

/**
 * Stores where a user signed up from, once, right after the account is created. Does nothing for an account
 * that already existed, and never throws: a failure here must not break the sign-in.
 *
 * Uses the service role, because the value must not be chosen by the client: it comes from a request header
 * that only the server can trust, and `record_signup_origin()` accepts the service role only.
 * @param user - The user returned by the code exchange.
 * @param headers - Headers of the OAuth callback request.
 */
export async function recordSignupOrigin(
  user: { id: string; created_at: string } | null | undefined,
  headers: Headers,
): Promise<void> {
  if (!user) return;
  const createdAt = Date.parse(user.created_at);
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > NEW_ACCOUNT_WINDOW_MS) return;

  const origin = signupOriginFromHeaders(headers);
  if (!origin) return;

  try {
    const { error } = await createServiceClient().rpc("record_signup_origin", {
      p_user_id: user.id,
      p_country: origin.country ?? undefined,
      p_region: origin.region ?? undefined,
      p_city: origin.city ?? undefined,
    });
    // Reason only: the location itself is personal data and stays out of the logs.
    if (error) console.error("Sign-up origin not recorded:", error.code ?? error.message);
  } catch (cause) {
    console.error(
      "Sign-up origin not recorded:",
      cause instanceof Error ? cause.message : "unknown",
    );
  }
}
