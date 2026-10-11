import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { ChipTabs } from "@/components/chip-tabs";
import { ChevronRightIcon, CloseIcon, SearchIcon } from "@/components/icons";
import {
  listProfiles,
  listRoles,
  PROFILE_PAGE_SIZE,
  type AdminProfile,
  type Role,
} from "@/lib/data/profiles";
import { getSessionPermissions } from "@/server/session";
import { RoleBadge } from "./role-badge";
import {
  parseUserListParams,
  SEARCH_MAX_LENGTH,
  userListHref,
  type UserListParams,
} from "./user-list-params";

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;

/** Search by pseudo. A plain GET form: it works without JavaScript, and Enter (or the keyboard key) sends it. */
function UserSearch({ search, role }: UserListParams) {
  return (
    <form role="search" className="relative">
      {role && <input type="hidden" name="role" value={role} />}
      <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-faint" />
      <input
        type="search"
        name="q"
        defaultValue={search}
        maxLength={SEARCH_MAX_LENGTH}
        placeholder="Rechercher un pseudo"
        aria-label="Rechercher un pseudo"
        enterKeyHint="search"
        autoComplete="off"
        className="field pr-12 pl-12 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {search && (
        <Link
          href={userListHref({ role })}
          prefetch={false}
          aria-label="Effacer la recherche"
          className="absolute top-1/2 right-1 grid size-11 -translate-y-1/2 place-items-center text-muted"
        >
          <CloseIcon className="size-5" />
        </Link>
      )}
      <button type="submit" className="sr-only">
        Rechercher
      </button>
    </form>
  );
}

/** The users page, from loaded data: pure, so it renders the same with any list. */
export function UserListView({
  profiles,
  roles,
  params,
  currentUserId,
}: {
  profiles: AdminProfile[];
  roles: Role[];
  params: UserListParams;
  /** The signed-in admin, marked « Toi » in the list. */
  currentUserId: string | null;
}) {
  const roleLabel = (key: string) => roles.find((role) => role.key === key)?.label ?? key;
  const byRankDesc = [...roles].sort((a, b) => b.rank - a.rank);
  const filtered = Boolean(params.search || params.role);

  return (
    <div className="flex flex-col gap-section">
      <div className="flex flex-col gap-3">
        <UserSearch {...params} />
        <ChipTabs
          label="Filtrer par rôle"
          activeKey={params.role ?? "all"}
          tabs={[
            { key: "all", label: "Tous", href: userListHref({ search: params.search }) },
            ...byRankDesc.map((role) => ({
              key: role.key,
              label: role.label,
              href: userListHref({ search: params.search, role: role.key }),
            })),
          ]}
        />
      </div>

      {profiles.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
          <span
            aria-hidden="true"
            className="grid size-12 place-items-center rounded-full bg-foreground/10 text-muted"
          >
            <SearchIcon className="size-6" />
          </span>
          <div>
            <p className="font-semibold">{filtered ? "Aucun compte trouvé" : "Aucun compte"}</p>
            <p className="mt-1 text-sm text-muted">
              {params.search
                ? `Aucun pseudo ne contient « ${params.search} »${params.role ? ` parmi les ${roleLabel(params.role)}` : ""}.`
                : params.role
                  ? `Personne n'a le rôle ${roleLabel(params.role)}.`
                  : "Les comptes apparaîtront ici dès la première connexion."}
            </p>
          </div>
          {filtered && (
            <Link href="/admin" prefetch={false} className="btn btn-outline btn-sm">
              Voir tous les comptes
            </Link>
          )}
        </div>
      ) : (
        <section aria-label="Comptes" className="flex flex-col gap-2">
          <p className="px-1 text-xs tabular-nums text-faint">
            {plural(profiles.length, "compte")}
            {params.search && ` · « ${params.search} »`}
            {params.role && ` · ${roleLabel(params.role)}`}
          </p>
          <ul className="card divide-y divide-line overflow-hidden">
            {profiles.map((profile) => (
              <li key={profile.id}>
                <Link
                  href={`/admin/users/${profile.id}`}
                  prefetch={false}
                  className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors active:bg-foreground/5 [@media(hover:hover)]:hover:bg-foreground/[0.03]"
                >
                  <Avatar pseudo={profile.pseudo} url={profile.avatar_url} size="md" decorative />
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                    <span className="flex max-w-full items-center gap-2">
                      <span className="truncate font-semibold">{profile.pseudo}</span>
                      {profile.id === currentUserId && (
                        <span className="chip px-2 py-0.5 text-[0.7rem]">Toi</span>
                      )}
                    </span>
                    <RoleBadge
                      roleKey={profile.role}
                      label={roleLabel(profile.role)}
                      className="px-2 py-0.5 text-[0.7rem]"
                    />
                  </span>
                  <ChevronRightIcon className="size-5 shrink-0 text-faint" />
                </Link>
              </li>
            ))}
          </ul>
          {profiles.length === PROFILE_PAGE_SIZE && (
            <p className="px-1 text-xs text-muted">
              Les {PROFILE_PAGE_SIZE} premiers résultats sont affichés : affine la recherche ou
              filtre par rôle.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

/** Admin user list: a pseudo search, a role filter, and a link to each user's page (roles are changed there). */
export async function UserList({ rawParams }: { rawParams: { q?: unknown; role?: unknown } }) {
  const [roles, session] = await Promise.all([listRoles(), getSessionPermissions()]);
  if (!roles.ok) {
    return (
      <p role="alert" className="alert alert-error">
        Impossible de charger les utilisateurs pour le moment.
      </p>
    );
  }

  // The role filter is validated against the roles, so it is read before the users.
  const params = parseUserListParams(
    rawParams,
    roles.value.map((role) => role.key),
  );
  const profiles = await listProfiles(params.search, params.role);
  if (!profiles.ok) {
    return (
      <p role="alert" className="alert alert-error">
        Impossible de charger les utilisateurs pour le moment.
      </p>
    );
  }

  return (
    <UserListView
      profiles={profiles.value}
      roles={roles.value}
      params={params}
      currentUserId={session?.userId ?? null}
    />
  );
}
