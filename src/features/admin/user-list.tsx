import { listProfiles, listRoles, PROFILE_PAGE_SIZE } from "@/lib/data/profiles";
import { getSessionPermissions } from "@/server/session";
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
      <p role="alert" className="text-sm text-red-500">
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
        <ul className="flex flex-col gap-2">
          {profiles.value.map((profile) => {
            const editable = canManageUser(
              callerRank,
              rankOf(roles.value, profile.role),
              profile.id === session?.userId,
            );
            return (
              <li
                key={profile.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-foreground/10 p-3"
              >
                <span className="min-w-0 truncate font-medium">{profile.pseudo}</span>
                {editable ? (
                  <RoleForm targetId={profile.id} currentRole={profile.role} options={options} />
                ) : (
                  <span className="shrink-0 text-sm text-foreground/60">
                    {labelOf(profile.role)}
                  </span>
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
