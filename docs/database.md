# Base de données

> Squelette : rempli à l'étape 1.1 de la checklist. Toute modification du schéma met ce fichier à jour
> dans la même PR.

## Règles

- Le schéma vit **uniquement** dans `supabase/migrations/` (jamais d'édition manuelle en production).
- Une migration existante ne se modifie jamais : on en ajoute une nouvelle.
- **RLS activée sur toutes les tables** du schéma `public`, « deny by default », une politique par
  opération (`select`, `insert`, `update`, `delete`) et par table, testée (accès autorisé **et** refusé).
- Utiliser `(select auth.uid())` dans les politiques (performance).
- Fonctions `SECURITY DEFINER` : `search_path` fixé explicitement.
- Index sur toute colonne filtrée ou jointe, y compris les clés étrangères.
- Types TypeScript générés avec `supabase gen types` (jamais écrits à la main).
- Connexions via le pooler Supabase ; jamais une connexion par requête serverless.

## Tables

### `profiles`

Profil public 1:1 avec `auth.users` (migration `20261007120000_create_profiles.sql`).

| Colonne      | Type          | Notes                                                                  |
| ------------ | ------------- | ---------------------------------------------------------------------- |
| `id`         | `uuid` PK     | FK `auth.users(id)` `on delete cascade`                                |
| `pseudo`     | `text`        | `^[A-Za-z0-9_.-]{3,32}$`, unique insensible à la casse (index `lower`) |
| `avatar_url` | `text`        | ≤ 2048 caractères, nullable                                            |
| `created_at` | `timestamptz` | défaut `now()`                                                         |
| `updated_at` | `timestamptz` | mis à jour par le trigger `set_updated_at`                             |

- Création : trigger `on_auth_user_created` → `handle_new_user()` (`SECURITY DEFINER`, `search_path` vide).
  Pseudo initial tiré du nom Discord (nettoyé) ; suffixe si collision ; `user` par défaut. Cette valeur
  n'est **jamais** utilisée pour une décision d'autorisation.
- RLS : `select` pour `authenticated` ; `update` limité à sa propre ligne et aux colonnes `pseudo` et
  `avatar_url` (grant par colonne) ; aucun `insert`/`delete` côté client ; `anon` sans aucun droit.
- `role` (`text`, FK `roles.key`, défaut `user`) ajoutée par la migration RBAC ; non modifiable par le client.
- Fonctions `role_rank(text)`, `assign_role(uuid, text)` et trigger `profiles_keep_last_super_admin` : voir [`permissions.md`](./permissions.md).
- À venir : `moderation_actions`, `audit_logs`.

### `roles`, `permissions`, `role_permissions`

Données de référence RBAC (migration `20261007130000_create_rbac.sql`) : `roles(key, label, rank)`,
`permissions(key, description)`, `role_permissions(role, permission)` (PK composite, index sur
`permission`). Fonction `has_permission(uuid, text)`. Détail : [`permissions.md`](./permissions.md).

### `announcements`

Annonces du fil d'accueil (migration `20261007150000_create_announcements.sql`).

| Colonne      | Type          | Notes                                                           |
| ------------ | ------------- | --------------------------------------------------------------- |
| `id`         | `uuid` PK     | `gen_random_uuid()`                                             |
| `author_id`  | `uuid`        | FK `profiles(id)` `on delete set null` (l'annonce survit au compte) |
| `title`      | `text`        | 1 à 120 caractères                                              |
| `body`       | `text`        | 1 à 5000 caractères                                             |
| `created_at` | `timestamptz` | défaut `now()`                                                  |
| `updated_at` | `timestamptz` | trigger `set_updated_at`                                        |

Index : `(created_at desc, id desc)` pour le fil (pagination par curseur), `author_id`.
RLS : lecture pour `anon` et `authenticated` (Guest) ; insertion si `announcement.publish` et
`author_id = auth.uid()` ; modification (titre/corps) de ses propres annonces si `announcement.publish` ;
suppression si `announcement.delete`, ou de ses propres annonces si `announcement.publish`.
Le pseudo de l'auteur n'est pas exposé aux Guests (`profiles` est réservé aux connectés).

### `audit_logs`

Journal des actions d'administration (migration `20261007170000_create_audit_log.sql`).

| Colonne      | Type          | Notes                                                              |
| ------------ | ------------- | ------------------------------------------------------------------ |
| `id`         | `bigint` PK   | identité                                                           |
| `actor_id`   | `uuid`        | auteur (`auth.uid()`), sans FK pour survivre à la suppression       |
| `action`     | `text`        | `ressource.action` au passé, ex. `role.assigned`                   |
| `target_id`  | `uuid`        | utilisateur visé, nullable                                         |
| `details`    | `jsonb`       | contexte (ex. `{"from": "user", "to": "manager"}`)                 |
| `created_at` | `timestamptz` | défaut `now()`                                                     |

Index `(created_at desc, id desc)` (pagination par curseur), `actor_id`, `target_id`. RLS : `select` avec
`audit.read` ; aucune écriture client. `assign_role()` journalise chaque changement de rôle.

## Développement local

Docker requis. Les secrets Discord locaux viennent de l'environnement (`.env.example`).

```bash
npm run db:start   # Supabase local (supabase start)
npm run db:reset   # rejoue migrations + seed (un compte par rôle : seed_user … seed_super_admin)
npm run db:test    # tests pgTAP (supabase/tests/database)
npm run db:types   # régénère src/lib/database.types.ts
```

## Diagramme

_À ajouter (ERD) une fois le schéma initial écrit._
