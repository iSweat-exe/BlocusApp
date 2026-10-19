import { cache } from "react";
import { requestCookies } from "@/lib/supabase/request-cookies";
import { createClient } from "@/lib/supabase/server";
import { assuranceLevelOf, type MfaState } from "./mfa";

/**
 * Reads where the signed-in person stands with the second factor, or `null` for a Guest. The assurance level comes
 * from the signed JWT, the rule and the "held back" verdict from the database (`admin_mfa_required()` and
 * `mfa_blocked()`, so the interface shows the second factor screen exactly when the database would refuse), the
 * authenticator from Auth. Shared by the settings and the admin area for one request (`React.cache`).
 * A failed read says "not required": the database is the one that enforces, the interface only explains.
 */
export const getMfaState = cache(async (): Promise<MfaState | null> => {
  const supabase = createClient(await requestCookies());
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return null;

  const [factors, required, blocked] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.rpc("admin_mfa_required"),
    supabase.rpc("mfa_blocked"),
  ]);
  const verified = factors.data?.totp.find((factor) => factor.status === "verified");
  return {
    aal: assuranceLevelOf(data.claims.aal),
    verifiedFactorId: verified?.id ?? null,
    required: required.data === true,
    blocked: blocked.data === true,
  };
});
