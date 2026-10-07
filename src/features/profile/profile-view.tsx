import Image from "next/image";
import Link from "next/link";
import { canAccessAdmin } from "@/features/admin/access";
import { signOut } from "@/features/auth/actions";
import { getProfile, listRoles } from "@/lib/data/profiles";
import type { SessionPermissions } from "@/server/session";
import { initialsOf, safeAvatarUrl } from "./avatar";

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeZone: "Europe/Paris",
});

const PROVIDER_LABELS: Record<string, string> = { discord: "Discord", google: "Google" };

/** One row of a grouped list (label on the left, value on the right), like a mobile settings screen. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-3">
      <dt className="shrink-0 text-sm text-foreground/60">{label}</dt>
      <dd className="min-w-0 break-words text-right text-sm font-medium">{children}</dd>
    </div>
  );
}

const CARD = "overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.03]";

/** The signed-in user's profile: identity, role, permissions and account details. */
export async function ProfileView({ session }: { session: SessionPermissions }) {
  const [profile, roles] = await Promise.all([getProfile(session.userId), listRoles()]);

  if (!profile.ok) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400"
      >
        Impossible de charger ton profil pour le moment.
      </p>
    );
  }
  if (!profile.value) {
    return <p className="text-sm text-foreground/60">Profil introuvable.</p>;
  }

  const { pseudo, avatar_url, role, created_at, id } = profile.value;
  const avatar = safeAvatarUrl(avatar_url);
  const roleLabel =
    (roles.ok ? roles.value.find((item) => item.key === role)?.label : null) ?? role;
  const provider = session.provider
    ? (PROVIDER_LABELS[session.provider] ?? session.provider)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col items-center gap-3 text-center">
        {avatar ? (
          <Image
            src={avatar}
            alt={`Photo de profil de ${pseudo}`}
            width={96}
            height={96}
            unoptimized
            referrerPolicy="no-referrer"
            className="h-24 w-24 rounded-full object-cover ring-4 ring-foreground/10"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-24 w-24 items-center justify-center rounded-full bg-foreground/10 text-3xl font-semibold ring-4 ring-foreground/10"
          >
            {initialsOf(pseudo)}
          </div>
        )}
        <div className="flex min-w-0 max-w-full flex-col items-center gap-2">
          <p className="max-w-full truncate text-xl font-semibold tracking-tight">{pseudo}</p>
          <span className="rounded-full bg-red-500/15 px-3 py-1 text-sm font-medium text-red-600 dark:text-red-400">
            {roleLabel}
          </span>
        </div>
      </header>

      <section aria-labelledby="account-title" className="flex flex-col gap-2">
        <h2
          id="account-title"
          className="px-1 text-xs font-semibold uppercase tracking-wide text-foreground/50"
        >
          Compte
        </h2>
        <dl className={`${CARD} divide-y divide-foreground/10`}>
          {session.email && <Row label="E-mail">{session.email}</Row>}
          {provider && <Row label="Connexion via">{provider}</Row>}
          <Row label="Membre depuis">{dateFormat.format(new Date(created_at))}</Row>
          <Row label="Identifiant">
            <code className="break-all font-mono text-xs">{id}</code>
          </Row>
        </dl>
      </section>

      <section aria-labelledby="permissions-title" className="flex flex-col gap-2">
        <h2
          id="permissions-title"
          className="px-1 text-xs font-semibold uppercase tracking-wide text-foreground/50"
        >
          Tes permissions
        </h2>
        <div className={`${CARD} p-4`}>
          {session.permissions.length === 0 ? (
            <p className="text-sm text-foreground/60">
              Aucune permission particulière : tu peux consulter l&apos;application.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {session.permissions.map((permission) => (
                <li
                  key={permission}
                  className="rounded-full border border-foreground/20 px-3 py-1 font-mono text-xs"
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
          className={`${CARD} flex min-h-12 items-center justify-between px-4 py-3 text-sm font-medium active:bg-foreground/10`}
        >
          Administration
          <span aria-hidden="true" className="text-foreground/40">
            ›
          </span>
        </Link>
      )}

      <form action={signOut}>
        <button
          type="submit"
          className="min-h-12 w-full rounded-xl border border-red-500/40 px-4 py-3 font-medium text-red-600 active:bg-red-500/10 dark:text-red-400"
        >
          Déconnexion
        </button>
      </form>
    </div>
  );
}
