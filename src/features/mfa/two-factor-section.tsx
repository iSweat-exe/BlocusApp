import { canAccessAdmin } from "@/features/admin/access";
import { getSessionPermissions } from "@/server/session";
import { getMfaState } from "./state";
import { TotpDisable } from "./totp-disable";
import { TotpEnrollment } from "./totp-enrollment";

/**
 * "Sécurité" group of the settings, for the people who hold an administration permission: enroll an authenticator
 * app (TOTP), or see that it is on and remove it. Enrolling never depends on a permission, so a person who the
 * database holds back at AAL1 can always get here. Reads cookies: wrap in Suspense.
 */
export async function TwoFactorSection() {
  const [session, mfa] = await Promise.all([getSessionPermissions(), getMfaState()]);
  if (!session || !mfa || !canAccessAdmin(session.permissions)) return null;

  const enabled = mfa.verifiedFactorId !== null;
  return (
    <section aria-labelledby="two-factor-title" className="flex flex-col gap-2">
      <h2 id="two-factor-title" className="section-title">
        Sécurité
      </h2>
      <div className="card flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">Double authentification</p>
            <p className="text-xs text-muted">
              {enabled
                ? "Activée : un code de ton application est demandé pour l'administration."
                : mfa.required
                  ? "Obligatoire pour les administrateurs : active-la pour retrouver tes droits."
                  : "Protège l'administration avec un code à six chiffres."}
            </p>
          </div>
          {enabled && (
            <span className="chip chip-accent shrink-0">
              <span className="sr-only">Statut : </span>Activée
            </span>
          )}
        </div>
        {enabled ? <TotpDisable /> : <TotpEnrollment />}
      </div>
    </section>
  );
}
