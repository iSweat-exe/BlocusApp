import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { canAccessAdmin } from "@/features/admin/access";
import { getProfile, listRoles } from "@/lib/data/profiles";
import type { SessionPermissions } from "@/server/session";

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeZone: "Europe/Paris",
});

const PROVIDER_LABELS: Record<string, string> = { discord: "Discord", google: "Google" };

/** One row of a grouped list (label on the left, value on the right), like a mobile settings screen. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-control items-center justify-between gap-4 px-4 py-3">
      <dt className="shrink-0 text-sm text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-right text-sm font-medium">{children}</dd>
    </div>
  );
}

const CARD = "card overflow-hidden";

/** The signed-in user's profile: identity, role, permissions and account details. */
export async function ProfileView({ session }: { session: SessionPermissions }) {
  const [profile, roles] = await Promise.all([getProfile(session.userId), listRoles()]);

  if (!profile.ok) {
    return (
      <p role="alert" className="alert alert-error">
        Impossible de charger ton profil pour le moment.
      </p>
    );
  }
  if (!profile.value) {
    return <p className="text-sm text-muted">Profil introuvable.</p>;
  }

  const { pseudo, avatar_url, role, created_at, id } = profile.value;
  const roleLabel =
    (roles.ok ? roles.value.find((item) => item.key === role)?.label : null) ?? role;
  const providers = session.providers.map((name) => PROVIDER_LABELS[name] ?? name);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col items-center gap-3 text-center">
        <Avatar pseudo={pseudo} url={avatar_url} size="xl" ring />
        <div className="flex min-w-0 max-w-full flex-col items-center gap-2">
          <p className="max-w-full truncate text-xl font-semibold tracking-tight">{pseudo}</p>
          <span className="chip chip-accent text-sm">{roleLabel}</span>
        </div>
      </header>

      <section aria-labelledby="account-title" className="flex flex-col gap-2">
        <h2 id="account-title" className="section-title">
          Compte
        </h2>
        <dl className={`${CARD} divide-y divide-foreground/10`}>
          {session.email && <Row label="E-mail">{session.email}</Row>}
          {providers.length > 0 && (
            <Row label={providers.length > 1 ? "Connexions" : "Connexion via"}>
              {providers.join(", ")}
            </Row>
          )}
          <Row label="Membre depuis">{dateFormat.format(new Date(created_at))}</Row>
          <Row label="Identifiant">
            <code className="break-all font-mono text-xs">{id}</code>
          </Row>
        </dl>
      </section>

      <section aria-labelledby="permissions-title" className="flex flex-col gap-2">
        <h2 id="permissions-title" className="section-title">
          Tes permissions
        </h2>
        <div className={`${CARD} p-4`}>
          {session.permissions.length === 0 ? (
            <p className="text-sm text-muted">
              Aucune permission particulière : tu peux consulter l&apos;application.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {session.permissions.map((permission) => (
                <li
                  key={permission}
                  className="rounded-full border border-line-strong px-3 py-1 font-mono text-xs"
                >
                  {permission}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {canAccessAdmin(session.permissions) && (
        <Link
          href="/admin"
          className="card-link flex min-h-control items-center justify-between px-4 py-3 text-sm font-medium"
        >
          Administration
          <span aria-hidden="true" className="text-faint">
            ›
          </span>
        </Link>
      )}

      <form action="/auth/logout" method="post">
        <button type="submit" className="btn btn-danger w-full">
          Déconnexion
        </button>
      </form>
    </div>
  );
}
