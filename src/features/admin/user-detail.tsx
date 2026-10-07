import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile, listRoles } from "@/lib/data/profiles";
import { listSanctions } from "@/lib/data/sanctions";
import type { SessionPermissions } from "@/server/session";
import { BanForm } from "./ban-form";
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
      <p role="alert" className="text-sm text-red-500">
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
    <div className="flex flex-col gap-4">
      <Link href="/admin" className="text-sm underline">
        ← Utilisateurs
      </Link>

      <header>
        <h2 className="text-xl font-semibold">{user.pseudo}</h2>
        <p className="text-sm text-foreground/60">
          {roleLabel} · inscrit le {dateFormat.format(new Date(user.created_at))}
        </p>
        <code className="break-all font-mono text-xs text-foreground/60">{user.id}</code>
      </header>

      {activeBan && (
        <section
          aria-label="Ban en cours"
          className="flex flex-col gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-4"
        >
          <p className="font-semibold text-red-500">Utilisateur banni</p>
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
                className="rounded border border-foreground/20 px-3 py-1 text-sm"
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
          className="flex flex-col gap-2 rounded-lg border border-foreground/10 p-4"
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
            className="self-start rounded-lg border border-foreground/20 px-4 py-2 text-sm opacity-50"
          >
            Mute (bientôt disponible)
          </button>
        </section>
      )}

      <section aria-labelledby="history-title" className="flex flex-col gap-2">
        <h3 id="history-title" className="font-semibold">
          Historique des sanctions
        </h3>
        {!sanctions.ok ? (
          <p role="alert" className="text-sm text-red-500">
            Impossible de charger l&apos;historique.
          </p>
        ) : history.length === 0 ? (
          <p className="text-sm text-foreground/60">Aucune sanction.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.map((sanction) => {
              const active = isSanctionActive(sanction, now);
              const state = sanction.revoked_at ? "levée" : active ? "en cours" : "expirée";
              return (
                <li
                  key={sanction.id}
                  className="rounded-lg border border-foreground/10 p-3 text-sm"
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
