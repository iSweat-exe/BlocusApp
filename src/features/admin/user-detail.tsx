import Link from "next/link";
import { notFound } from "next/navigation";
import { initialsOf } from "@/features/profile/avatar";
import { getProfile, listRoles } from "@/lib/data/profiles";
import { listSanctions } from "@/lib/data/sanctions";
import type { SessionPermissions } from "@/server/session";
import { BanForm } from "./ban-form";
import { UserPermissions } from "./user-permissions";
import { canManageUser, rankOf } from "./hierarchy";
import { liftSanction } from "./sanction-actions";
import { isSanctionActive } from "./sanctions";

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

const KIND_LABELS: Record<string, string> = { ban: "Ban", mute: "Mute" };

/** Admin page of one user: identity, active ban, sanction history and sanction controls. */
export async function UserDetail({ id, session }: { id: string; session: SessionPermissions }) {
  const [profile, roles, sanctions] = await Promise.all([
    getProfile(id),
    listRoles(),
    listSanctions(id),
  ]);

  if (!profile.ok || !roles.ok) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400"
      >
        Impossible de charger cet utilisateur pour le moment.
      </p>
    );
  }
  if (!profile.value) notFound();

  const now = new Date();
  const user = profile.value;
  const roleLabel = roles.value.find((role) => role.key === user.role)?.label ?? user.role;
  const canManage = canManageUser(
    rankOf(roles.value, session.role),
    rankOf(roles.value, user.role),
    user.id === session.userId,
  );
  const history = sanctions.ok ? sanctions.value : [];
  const activeBan = history.find(
    (sanction) => sanction.kind === "ban" && isSanctionActive(sanction, now),
  );
  const canBan = canManage && session.permissions.includes("user.ban");
  const canMute = canManage && session.permissions.includes("user.mute");

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/admin"
        className="flex min-h-11 items-center text-sm font-medium text-foreground/70"
      >
        ‹ Utilisateurs
      </Link>

      <header className="flex flex-col items-center gap-2 text-center">
        <div
          aria-hidden="true"
          className="flex h-20 w-20 items-center justify-center rounded-full bg-foreground/10 text-2xl font-semibold ring-4 ring-foreground/10"
        >
          {initialsOf(user.pseudo)}
        </div>
        <h2 className="max-w-full truncate text-xl font-semibold tracking-tight">{user.pseudo}</h2>
        <span className="rounded-full bg-red-500/15 px-3 py-1 text-sm font-medium text-red-600 dark:text-red-400">
          {roleLabel}
        </span>
        <p className="text-sm text-foreground/60">
          Inscrit le {dateFormat.format(new Date(user.created_at))}
        </p>
        <code className="break-all font-mono text-xs text-foreground/50">{user.id}</code>
      </header>

      {activeBan && (
        <section
          aria-label="Ban en cours"
          className="flex flex-col gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 p-4"
        >
          <p className="font-semibold text-red-600 dark:text-red-400">Utilisateur banni</p>
          <p className="text-sm">Motif : {activeBan.reason}</p>
          <p className="text-sm text-foreground/60">
            {activeBan.expires_at
              ? `Jusqu'au ${dateFormat.format(new Date(activeBan.expires_at))}`
              : "Permanent"}
          </p>
          {canBan && (
            <form action={liftSanction}>
              <input type="hidden" name="id" value={activeBan.id} />
              <input type="hidden" name="target" value={user.id} />
              <button
                type="submit"
                className="min-h-11 rounded-xl border border-foreground/20 px-4 text-sm font-medium active:bg-foreground/5"
              >
                Lever le ban
              </button>
            </form>
          )}
        </section>
      )}

      {!canManage && (
        <p className="text-sm text-foreground/60">
          Tu ne peux pas sanctionner cet utilisateur : son rôle est supérieur ou égal au tien (ou
          c&apos;est toi).
        </p>
      )}

      {canBan && !activeBan && <BanForm targetId={user.id} />}

      {canMute && (
        <section
          aria-label="Mute"
          className="flex flex-col gap-2 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4"
        >
          <h3 className="font-semibold">Mute</h3>
          <p className="text-sm text-foreground/60">
            Le mute servira à empêcher d&apos;écrire sans bloquer la lecture. Il sera activé avec la
            messagerie.
          </p>
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="min-h-11 self-start rounded-xl border border-foreground/20 px-4 text-sm opacity-50"
          >
            Mute (bientôt disponible)
          </button>
        </section>
      )}

      {canManage && session.permissions.includes("permission.manage") && (
        <UserPermissions
          targetId={user.id}
          targetRole={user.role}
          callerPermissions={session.permissions}
        />
      )}

      <section aria-labelledby="history-title" className="flex flex-col gap-2">
        <h3 id="history-title" className="font-semibold">
          Historique des sanctions
        </h3>
        {!sanctions.ok ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            Impossible de charger l&apos;historique.
          </p>
        ) : history.length === 0 ? (
          <p className="text-sm text-foreground/60">Aucune sanction.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {history.map((sanction) => {
              const active = isSanctionActive(sanction, now);
              const state = sanction.revoked_at ? "levée" : active ? "en cours" : "expirée";
              return (
                <li
                  key={sanction.id}
                  className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4 text-sm"
                >
                  <p className="font-medium">
                    {KIND_LABELS[sanction.kind] ?? sanction.kind} · {state}
                  </p>
                  <p>{sanction.reason}</p>
                  <p className="text-xs text-foreground/60">
                    {dateFormat.format(new Date(sanction.created_at))} →{" "}
                    {sanction.expires_at
                      ? dateFormat.format(new Date(sanction.expires_at))
                      : "permanent"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
