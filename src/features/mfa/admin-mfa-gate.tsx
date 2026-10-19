import type { ReactNode } from "react";
import { getMfaState } from "./state";
import { TotpChallenge } from "./totp-challenge";
import { TotpEnrollment } from "./totp-enrollment";

/**
 * Wraps the admin area. When the rule is on and the database holds this session back (an administrator role that
 * did not give the second factor), the sections are replaced by the screen that gets the person through: the code
 * of their app, or the enrollment when they have none yet. Otherwise it renders the sections as they are. The
 * database refuses the actions anyway; this is the explanation. Reads cookies: wrap in Suspense.
 */
export async function AdminMfaGate({ children }: { children: ReactNode }) {
  const mfa = await getMfaState();
  if (!mfa?.blocked) return <>{children}</>;

  return (
    <section aria-labelledby="mfa-gate-title" className="card flex flex-col gap-4 p-4">
      <header className="flex flex-col gap-1">
        <h2 id="mfa-gate-title" className="text-lg font-bold tracking-tight">
          Double authentification requise
        </h2>
        <p className="text-sm text-muted">
          {mfa.verifiedFactorId
            ? "Entre le code de ton application d'authentification pour ouvrir l'administration."
            : "L'administration exige une double authentification. Active-la avec une application d'authentification."}
        </p>
      </header>
      {mfa.verifiedFactorId ? <TotpChallenge /> : <TotpEnrollment />}
    </section>
  );
}
