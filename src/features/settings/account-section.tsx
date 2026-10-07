import Link from "next/link";
import { getSessionPermissions } from "@/server/session";

const ROW = "flex min-h-control items-center justify-between gap-4 px-4 py-3 text-sm font-medium";

/** "Compte" group of the settings: a shortcut to the profile, or to the login for Guests. Reads cookies. */
export async function AccountSection() {
  const session = await getSessionPermissions();
  return (
    <section aria-labelledby="account-title" className="flex flex-col gap-2">
      <h2 id="account-title" className="section-title">
        Compte
      </h2>
      <div className="card overflow-hidden">
        <Link
          href={session ? "/profil" : "/login"}
          prefetch={false}
          className={`${ROW} active:bg-foreground/10`}
        >
          {session ? "Mon profil" : "Se connecter"}
          <span aria-hidden="true" className="text-faint">
            ›
          </span>
        </Link>
      </div>
    </section>
  );
}
