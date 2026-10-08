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
  Pseudo initial tiré du nom Discord / Google (accents retirés, caractères non autorisés supprimés) ; suffixe si collision ; `user` par défaut. Cette valeur
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

**Rétention** (migration `20261008230000_prune_map_audit.sql`) : les entrées `map.position_declared` et
`map.route_saved` (une par position déclarée ou tracé enregistré, soit ~220 000 lignes par an pendant des événements
fréquents, 50 à 80 Mo avec les 5 index, alors que les tables de la carte n'en gardent que 200 et 20) sont supprimées au
bout de **90 jours**. La purge est faite par un trigger `after insert` sur ces deux actions (`prune_map_audit()`, au plus
500 lignes par insertion, parcours d'index sur `audit_logs_action_idx`) : elle est payée par l'activité qui crée les
lignes, sans `pg_cron` ni extension à activer (rien qui puisse casser le pipeline de migrations). Les actions
d'administration (rôles, permissions, sanctions, événements) ne sont **jamais** purgées. Test :
`supabase/tests/database/audit_map_retention.test.sql`.

### `permission_overrides`

Overrides de permission par utilisateur (migration `20261007180000_permission_management.sql`) :
`(user_id, permission)` PK, `effect` (`grant` | `deny`), `created_by`, `created_at` ; index sur
`permission`. RLS : lecture de ses propres lignes ou avec `permission.manage` ; écriture uniquement via
`set_user_permission()`. Fonctions : `effective_permissions(uuid)` (interne), `has_permission` et
`custom_access_token_hook` (réécrits pour l'utiliser), `set_role_permission`, `set_user_permission`.

### `moderation_actions`

Sanctions (migration `20261007190000_create_bans.sql`) : `id`, `target_id` (sans FK : l'historique survit au
compte), `kind` (`ban` | `mute`), `reason` (1-500), `created_by`, `created_at`, `expires_at` (null =
permanent, doit être > `created_at`), `revoked_at`, `revoked_by`. Index `(target_id, created_at desc)` et
`(created_at desc, id desc)`. RLS : lecture avec `user.ban` ou `user.mute` ; écriture via `ban_user()` et
`revoke_sanction()` uniquement. `is_banned(uuid)` (interne) est utilisée par `effective_permissions` et le hook JWT.

### `events`

Événements du calendrier (migration `20261007200000_create_events.sql`) : `id`, `author_id` (FK `profiles`,
`on delete set null`), `title` (1-120), `description` (≤ 5000, vide par défaut), `location` (≤ 200, vide par
défaut), `starts_at` (UTC), `ends_at` (nullable, ≥ `starts_at`), `created_at`, `updated_at`. Ponctuels, sans
récurrence. Index `(starts_at, id)` (vues par jour) et `author_id`. Trigger `check_event_start` : un événement
ne peut être créé ni déplacé dans le passé (tolérance 5 min) ; le texte d'un événement déjà commencé reste
modifiable. RLS : lecture pour `anon` et `authenticated` (Guest) ; insertion avec `event.create` et
`author_id = auth.uid()` ; modification de ses propres événements (titre, texte, lieu, horaires) avec
`event.create` ; suppression avec `event.delete`, ou de ses propres événements avec `event.create`.
Migration `20261007210000_event_finish.sql` : colonnes `finished_at` / `finished_by` (hors des grants de colonnes,
modifiées seulement par `set_event_finished(id, finished)` qui exige `event.finish`), et la policy de modification
exclut les événements terminés.

## Surveillance (`health_snapshots`, `health_stats()`)

Migration `20261009100000_health_monitoring.sql` : permission `monitoring.view` (admin ; super_admin via
`has_permission`), `can_monitor()` (permission **ou** rôle `service_role`), `health_stats()` (inscrits, actifs =
sessions `auth.sessions` renouvelées il y a moins de 15 min, taille de la base ; `SECURITY DEFINER`),
`record_health_snapshot(...)` (au plus un instantané par 10 min, purge des lignes de plus de 30 jours à l'insertion,
sans `pg_cron`) et la table `health_snapshots` (`score` 0-100, latences, taille, compteurs, état Vercel, `source`
`page` | `cron`). RLS : lecture avec `monitoring.view`, aucune écriture directe. Migration
`20261009110000_health_monitoring_details.sql` : `health_trends()` (instantanés des 7 derniers jours, disponibilité =
score ≥ 60, p95 de la latence, dernier passage du cron), `health_tables()` (5 plus grosses tables de `public`),
`health_connections()` (connexions ouvertes et `max_connections`) ; la limite de 10 min de
`record_health_snapshot()` s'applique désormais **par source**, sinon une visite juste avant le cron effacerait
son instantané. Fonctions exécutables par
`authenticated` (contrôle interne) et `service_role` seulement.

## Époque des permissions (`permission_epoch`)

Table à **une seule ligne** (`singleton`, `changed_at`), RLS activée sans policy (aucun accès client direct). Des
triggers par instruction la mettent à jour après tout changement de `role_permissions`, `permission_overrides`,
`permissions`, `profiles.role` ou `moderation_actions` (les entrées du JWT). `get_permission_epoch()` (SECURITY
DEFINER, exécutable par `anon` et `authenticated`) renvoie la date : aucune donnée utilisateur. Sert à réémettre les
tokens périmés, voir `docs/permissions.md`. Test : `supabase/tests/database/permission_epoch.test.sql`.

## Tracé de la carte (`map_route_versions`)

Migration `20261008200000_map_route.sql`. Le tracé est une suite de points `[longitude, latitude]` enregistrée comme une
**nouvelle version** à chaque sauvegarde ; le tracé courant est la plus récente, les **20 dernières** sont gardées
(retour en arrière possible). Colonnes : `id`, `author_id` (`set null` si le compte est supprimé), `points` (jsonb),
`point_count` (calculée), `created_at`. `is_valid_route()` (immuable, aussi en contrainte `CHECK`) : tableau vide (pas de
tracé) ou 2 à 500 points, chacun `[lng, lat]` numérique dans les bornes du monde. RLS : lecture pour `anon` et
`authenticated` (Guest compris) ; **aucune écriture directe**. `save_map_route(p_points, p_base)` (SECURITY DEFINER,
`authenticated`) exige `map.route.edit`, valide les points, refuse avec `stale_route` (40001) si une autre version a été
enregistrée depuis `p_base` (l'éditeur ne l'écrase jamais en silence ; verrou consultatif pour les sauvegardes
simultanées), élague les vieilles versions et journalise `map.route_saved`. Test :
`supabase/tests/database/map_route.test.sql`.

## Positions déclarées (`map_positions`)

Migration `20261008210000_map_positions.sql`. Un gérant déclare où se trouve la manifestation (un point et une heure) ;
la plus récente est la **position courante**, les **200 dernières** sont gardées (historique). Colonnes : `id`,
`author_id` (`set null` si le compte est supprimé), `lng` / `lat` (bornes vérifiées par `CHECK`), `label` (≤ 80
caractères, facultatif), `declared_at`. **Seules les positions déclarées existent ici : la position des utilisateurs
n'est jamais stockée** (A-127). RLS : lecture pour `anon` et `authenticated` ; **aucune écriture directe**.
`declare_map_position(p_lng, p_lat, p_label)` (SECURITY DEFINER, `authenticated`) exige `map.position.declare`, valide
les coordonnées, **refuse `rate_limited` (54000) si le même gérant a déjà déclaré dans les 5 dernières secondes**
(anti-rafale), élague l'historique et journalise `map.position_declared` (libellé et coordonnées arrondies). Test :
`supabase/tests/database/map_positions.test.sql`.

### Retrait d'une position (`remove_map_position`)

Migration `20261008220000_map_position_removal.sql` : colonnes `removed_at` / `removed_by` (**retrait logique** : la ligne
reste dans l'historique, marquée « Retirée »). **La déclaration la plus récente décide** : si elle est retirée, la carte
n'affiche aucune position, une ancienne déclaration ne « revient » jamais. `remove_map_position(p_id)` (SECURITY
DEFINER, `authenticated`) est accepté pour **l'auteur** de la position (qui doit encore pouvoir en déclarer) ou pour un
titulaire de la nouvelle permission **`map.position.remove`** (administrateurs et super-administrateurs : garde-fou si
l'auteur est absent) ; sinon `forbidden`. Idempotent (un second retrait n'ajoute pas d'entrée d'audit), journalisé
`map.position_removed`. Test : `supabase/tests/database/map_position_removal.test.sql`.

## Plans de requêtes mesurés (`EXPLAIN ANALYZE`)

Volumes de test, bien au-delà de la cible : 5 000 profils, 20 000 annonces, 20 000 événements, 100 000 entrées
d'audit, 20 000 sanctions (Supabase local, base « chaude »). Toutes les requêtes chaudes passent par un index :

| Requête | Plan | Temps |
|---|---|---|
| Fil d'annonces (11 plus récentes) | `Index Scan announcements_feed_idx` | 0,02 ms |
| Événements d'un mois (grille du calendrier) | `Index Scan events_starts_at_idx` | 0,09 ms |
| Événements imminents (3 h) | `Index Scan events_starts_at_idx` | 0,04 ms |
| Un événement par id | `Index Scan events_pkey` | 0,01 ms |
| `is_banned` d'un utilisateur | `Index Scan moderation_actions_target_idx` | 0,01 ms |
| Sanctions d'un utilisateur | `Index Scan moderation_actions_target_idx` | 0,04 ms |
| Journal d'audit (26 plus récentes) | `Index Scan Backward audit_logs_pkey` | 0,01 ms |
| Journal filtré par action **rare** | **avant** `Seq Scan` (100 000 lignes) 4,6 ms → **après** `audit_logs_action_idx (action, id desc)` 0,24 ms | |
| Recherche de pseudo `ilike '%…%'` (admin) | `Seq Scan profiles` + tri | 3,2 ms pour 5 000 profils |

Seul point sans index : la recherche de pseudo (`ilike '%q%'`), acceptable sous quelques milliers de profils (3,2 ms à
5 000) ; si la liste dépasse largement 10 000, ajouter `pg_trgm` + un index GIN. La migration
`20261007220000_audit_action_index.sql` ajoute l'index manquant du journal.

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
