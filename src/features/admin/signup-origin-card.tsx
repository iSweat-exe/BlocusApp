import { countryFlag, countryName } from "@/lib/country";
import type { SignupOrigin } from "@/lib/data/signup-origins";
import type { Result } from "@/lib/result";

/** `Lyon, France`: the most precise place known, then the country. `null` when nothing is known. */
export function originLabel(origin: SignupOrigin): string | null {
  const place = origin.city ?? origin.region;
  const country = origin.country ? countryName(origin.country) : null;
  const parts = [place, country].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(", ") : null;
}

/** Where the account was created from, for admins holding `user.origin.view` (the caller checks it). */
export function SignupOriginCard({
  origin,
}: {
  origin: Result<SignupOrigin | null, "load_failed">;
}) {
  const known = origin.ok && origin.value ? origin.value : null;
  const label = known ? originLabel(known) : null;

  return (
    <section aria-labelledby="origin-title" className="card flex flex-col gap-1 p-4">
      <h3 id="origin-title" className="font-semibold">
        Origine de l&apos;inscription
      </h3>
      {!origin.ok ? (
        <p role="alert" className="text-sm text-danger">
          Impossible de charger l&apos;origine pour le moment.
        </p>
      ) : known && label ? (
        <>
          <p className="flex items-center gap-2">
            {known.country && (
              <span aria-hidden="true" className="text-xl leading-none">
                {countryFlag(known.country)}
              </span>
            )}
            <span className="font-medium">{label}</span>
          </p>
          {known.city && known.region && (
            <p className="text-sm text-muted">Région : {known.region}</p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted">
          Inconnue : compte créé avant le suivi, ou lieu non communiqué.
        </p>
      )}
      <p className="text-xs text-faint">
        Lieu approximatif déduit de l&apos;adresse IP à l&apos;inscription. L&apos;adresse elle-même
        n&apos;est pas conservée.
      </p>
    </section>
  );
}
