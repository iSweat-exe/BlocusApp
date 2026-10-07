import Link from "next/link";
import { listProfiles, listRoles, PROFILE_PAGE_SIZE } from "@/lib/data/profiles";
import { getSessionPermissions } from "@/server/session";
import { initialsOf } from "@/features/profile/avatar";
import { assignableRoles, canManageUser, rankOf } from "./hierarchy";
import { RoleForm } from "./role-form";

/** Admin user list with a pseudo search and, where the hierarchy allows it, a role selector. */
export async function UserList({ search }: { search: string }) {
  const [profiles, roles, session] = await Promise.all([
    listProfiles(search),
    listRoles(),
    getSessionPermissions(),
  ]);

  if (!profiles.ok || !roles.ok) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400"
      >
        Impossible de charger les utilisateurs pour le moment.
      </p>
    );
  }

  const callerRank = rankOf(roles.value, session?.role ?? null);
  const options = assignableRoles(roles.value, callerRank);
  const labelOf = (key: string) => roles.value.find((role) => role.key === key)?.label ?? key;

  return (
    <div className="flex flex-col gap-3">
      {profiles.value.length === 0 ? (
        <p className="text-sm text-foreground/60">Aucun utilisateur trouvé.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {profiles.value.map((profile) => {
            const editable =
              (session?.permissions.includes("role.assign") ?? false) &&
              canManageUser(
                callerRank,
                rankOf(roles.value, profile.role),
                profile.id === session?.userId,
              );
            return (
              <li
                key={profile.id}
                className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-3"
              >
                <Link
                  href={`/admin/users/${profile.id}`}
                  prefetch={false}
                  className="flex min-h-12 items-center gap-3 rounded-xl active:bg-foreground/5"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-sm font-semibold"
                  >
                    {initialsOf(profile.pseudo)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">{profile.pseudo}</span>
                    {!editable && (
                      <span className="text-sm text-foreground/60">{labelOf(profile.role)}</span>
                    )}
                  </span>
                  <span aria-hidden="true" className="text-foreground/40">
                    ›
                  </span>
                </Link>
                {editable && (
                  <RoleForm targetId={profile.id} currentRole={profile.role} options={options} />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {profiles.value.length === PROFILE_PAGE_SIZE && (
        <p className="text-xs text-foreground/60">
          Les {PROFILE_PAGE_SIZE} premiers résultats sont affichés : affine la recherche.
        </p>
      )}
    </div>
  );
}
