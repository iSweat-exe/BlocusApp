import Link from "next/link";
import { AdminMfaToggle } from "./admin-mfa-toggle";
import { getMfaState } from "./state";
import { TotpChallenge } from "./totp-challenge";

/**
 * Admin > Sécurité: the switch that makes the second factor mandatory for the administrator roles. The switch only
 * works from a session that passed the second factor (the database checks it), so the person who turns it on is
 * enrolled themselves and cannot lock everybody out by mistake. Reads cookies: wrap in Suspense.
 */
export async function SecurityPanel() {
  const mfa = await getMfaState();
  if (!mfa) return null;

  const enrolled = mfa.verifiedFactorId !== null;
  const verified = mfa.aal === "aal2";

  return (
    <div className="card flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold">Double authentification des administrateurs</h3>
        <p className="text-sm text-muted">
          Quand elle est obligatoire, un administrateur (ou super administrateur) dont la session
          n&apos;a pas donné son code garde seulement les droits d&apos;un utilisateur : la base de
          données refuse ses actions d&apos;administration, même appelées directement. Chacun doit
          d&apos;abord activer la double authentification dans{" "}
          <Link href="/settings" prefetch={false} className="font-medium text-accent">
            Réglages
          </Link>
          .
        </p>
      </div>

      <p className="text-sm">
        État :{" "}
        <strong className={mfa.required ? "text-success" : "text-warning"}>
          {mfa.required ? "obligatoire" : "facultative"}
        </strong>
      </p>

      {verified ? (
        <AdminMfaToggle required={mfa.required} />
      ) : enrolled ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            Entre ton code pour pouvoir changer ce réglage : il n&apos;est modifiable que depuis une
            session qui a donné la double authentification.
          </p>
          <TotpChallenge />
        </div>
      ) : (
        <p role="note" className="alert border-warning/40 bg-warning/10 text-sm">
          Active d&apos;abord ta propre double authentification dans{" "}
          <Link href="/settings" prefetch={false} className="font-medium underline">
            Réglages
          </Link>
          , puis reviens ici : tu ne peux pas la rendre obligatoire sans l&apos;avoir toi-même.
        </p>
      )}
    </div>
  );
}
