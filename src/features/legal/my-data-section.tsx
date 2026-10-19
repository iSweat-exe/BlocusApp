import { getSessionPermissions } from "@/server/session";
import { DeleteAccountForm } from "./delete-account-form";

/**
 * "Mes données" group of the settings: download everything the application holds about the person, and delete the
 * account (GDPR rights of access, portability and erasure). Signed-in people only: a Guest has no data. Reads
 * cookies: wrap in Suspense.
 */
export async function MyDataSection() {
  const session = await getSessionPermissions();
  if (!session) return null;

  return (
    <section aria-labelledby="my-data-title" className="flex flex-col gap-2">
      <h2 id="my-data-title" className="section-title">
        Mes données
      </h2>
      <div className="card flex items-center justify-between gap-4 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Télécharger mes données</p>
          <p className="text-xs text-muted">
            Un fichier JSON avec tout ce que BLOCUS. garde sur toi.
          </p>
        </div>
        {/* A plain link on purpose: the browser downloads the file the route sends. */}
        <a
          href="/api/me/export"
          download
          className="btn btn-outline btn-sm shrink-0 whitespace-nowrap"
        >
          Télécharger
        </a>
      </div>
      <DeleteAccountForm />
    </section>
  );
}
