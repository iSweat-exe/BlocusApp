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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3">
      <dt className="text-xs uppercase tracking-wide text-foreground/60">{label}</dt>
      <dd className="break-all text-sm">{children}</dd>
    </div>
  );
}

/** The signed-in user's profile: identity, role, permissions and account details. */
export async function ProfileView({ session }: { session: SessionPermissions }) {
  const [profile, roles] = await Promise.all([getProfile(session.userId), listRoles()]);

  if (!profile.ok) {
    return (
      <p role="alert" className="text-sm text-red-500">
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
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-4">
        {avatar ? (
          <Image
            src={avatar}
            alt={`Photo de profil de ${pseudo}`}
            width={80}
            height={80}
            unoptimized
            referrerPolicy="no-referrer"
            className="h-20 w-20 rounded-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-20 w-20 items-center justify-center rounded-full bg-foreground/10 text-2xl font-semibold"
          >
            {initialsOf(pseudo)}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-xl font-semibold">{pseudo}</p>
          <span className="mt-1 inline-block rounded-full bg-red-500/15 px-3 py-0.5 text-sm font-medium text-red-500">
            {roleLabel}
          </span>
        </div>
      </header>

      <dl className="divide-y divide-foreground/10 rounded-lg border border-foreground/10 px-4">
        <Field label="Pseudo">{pseudo}</Field>
        <Field label="Identifiant">
          <code className="font-mono text-xs">{id}</code>
        </Field>
        <Field label="Rôle">{roleLabel}</Field>
        {session.email && <Field label="E-mail">{session.email}</Field>}
        {provider && <Field label="Connexion via">{provider}</Field>}
        <Field label="Membre depuis">{dateFormat.format(new Date(created_at))}</Field>
      </dl>

      <section aria-labelledby="permissions-title" className="flex flex-col gap-2">
        <h2 id="permissions-title" className="font-semibold">
          Tes permissions
        </h2>
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
      </section>

      <div className="flex items-center justify-between">
        {canAccessAdmin(session.permissions) ? (
          <Link href="/admin" className="text-sm underline">
            Administration
          </Link>
        ) : (
          <span />
        )}
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-lg border border-foreground/20 px-4 py-2 text-sm"
          >
            Déconnexion
          </button>
        </form>
      </div>
    </div>
  );
}
