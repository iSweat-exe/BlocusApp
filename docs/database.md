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

Posts v2 (migration `20261009130000_announcements_v2.sql`, ADR 0007) : `status` (`draft` | `private` | `public`,
défaut `public`), `show_author` (booléen, défaut faux), `image_path` / `image_width` / `image_height` (une image,
les trois ensemble ou aucun ; chemin `<id auteur>/<uuid>.webp|jpg`), `published_at` (date de passage en public,
posée par le trigger `announcements_before_write`, le fil trie dessus), `edited_at` (posé quand le titre, le
texte ou l'image d'un post public change).

Index : `(published_at desc, id desc)` partiel sur les posts publics (le fil), `author_id`.
RLS sur la table : **plus aucune lecture pour `anon`** ; `authenticated` lit ses propres lignes (tous états), et
les titulaires de `announcement.delete` les lignes publiques (pour supprimer) ; insertion si `announcement.publish`,
`author_id = auth.uid()` et image dans son propre dossier ; modification de ses propres posts si
`announcement.publish` (`author_id` et `created_at` ne changent jamais) ; suppression si `announcement.delete`, ou de
ses propres posts si `announcement.publish`.

**Fil public** : la vue `announcement_feed` (propriétaire, `security_invoker = false`, volontaire) ne renvoie que les
posts `public` ; `author_id`, `author_pseudo` et `author_avatar_url` ne sont remplis que si `show_author` est vrai.
`anon` et `authenticated` n'ont que cette vue. **Images** : bucket public `announcement-images` (300 Ko, WebP/JPEG),
écriture réservée à `announcement.publish` dans son dossier, lecture et suppression par l'auteur ou un modérateur.

### `announcement_reactions`

Réactions emoji sur les posts publics, style Discord (migration `20261019100000_post_reactions.sql`, ADR 0009).
Colonnes : `announcement_id` (FK `announcements`, `on delete cascade`), `user_id` (FK `profiles`, `on delete cascade`),
`emoji`, `created_at` ; PK `(announcement_id, user_id, emoji)`. `emoji` est limité par un `check` à une palette fixe de
8 emojis (`👍 💜 😂 😮 😢 🔥 🎉 👏`), identique à `REACTION_EMOJIS` dans `src/features/announcements/reactions.ts` :
changer la palette demande une nouvelle migration.

RLS : `authenticated` ne lit que **ses propres** lignes (pour surligner ses réactions) ; **aucun droit d'écriture** pour
les clients. Toute écriture passe par `toggle_announcement_reaction(p_announcement_id, p_emoji)` (SECURITY DEFINER,
exécutable par `authenticated` seulement) : refuse un appelant absent ou banni (`42501`), un post qui n'est pas public
(`22023`), applique la limite `reaction.write` (60 / minute, `rate_limited` `54000`), puis ajoute la réaction ou la
retire si elle existe (renvoie `true` quand elle est ajoutée). La vue `announcement_reaction_counts` (propriétaire,
`security_invoker = false`, volontaire, comme `announcement_feed`) donne le total par post et par emoji pour les posts
publics, lisible par `anon` ; elle ne révèle aucun utilisateur. Test : `supabase/tests/database/post_reactions.test.sql`.

### `push_subscriptions`

Abonnements Web Push, un par appareil (migration `20261019110000_push_subscriptions.sql`, ADR 0010). Colonnes : `id`,
`user_id` (FK `profiles`, `on delete cascade`), `endpoint` (unique), `p256dh`, `auth`, `created_at`. Un abonnement donne
le droit d'envoyer des notifications à l'appareil : la table est **fermée aux clients** (RLS activée, aucune politique,
aucun droit pour `anon` / `authenticated`, même pas la lecture de ses propres lignes). Seul le serveur la lit, avec la
clé `service_role`, pour envoyer et pour purger les abonnements expirés.

`endpoint` est l'adresse où le serveur fera un `POST` : un `check` la limite à HTTPS sur les services de push des
navigateurs (`fcm.googleapis.com`, `updates.push.services.mozilla.com`, `*.push.apple.com`, `*.notify.windows.com`),
sinon un client pourrait faire appeler une adresse quelconque par le serveur. Les clés ont un format et une longueur
contrôlés. Écriture par `save_push_subscription(p_endpoint, p_p256dh, p_auth)` (SECURITY DEFINER, `authenticated`
seulement : refuse un appelant absent ou banni `42501`, limite `push.write` 20 / minute, reprend l'endpoint à un autre
compte qui utilisait le même appareil, garde les 10 appareils les plus récents) et `remove_push_subscription(p_endpoint)`
(supprime seulement l'abonnement de l'appelant). Test : `supabase/tests/database/push_subscriptions.test.sql`.

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

## Limites de débit (`rate_limits`, `consume_rate_limit()`)

Migration `20261009140000_rate_limits.sql` (A-100). Un client peut appeler PostgREST avec son propre jeton sans passer
par une Server Action : la limite est donc **dans la base**, sur les chemins d'écriture eux-mêmes. Table `rate_limits`
(`user_id` FK `profiles` `on delete cascade`, `bucket`, `window_start`, `hits`, PK `(user_id, bucket)`) : une ligne par
utilisateur et par compteur, jamais plus, donc rien à purger. RLS activée, **aucune politique ni droit** : seule la
fonction y accède. `consume_rate_limit(p_bucket, p_limit, p_window)` (SECURITY DEFINER, **exécution retirée à tous les
rôles**, sinon un client choisirait des noms de compteur et remplirait la table) compte une action de l'utilisateur
courant dans une **fenêtre fixe** et lève `rate_limited` (54000) au-delà. Le refus annule l'instruction : l'action
refusée n'est pas appliquée et son essai n'est pas compté. Sans utilisateur connecté (service role, scripts) : aucune
limite.

| Compteur             | Déclenché par                                                         | Limite             |
| -------------------- | --------------------------------------------------------------------- | ------------------ |
| `announcement.write` | trigger `announcements_rate_limit` (création ou modification d'un post) | 10 / 10 minutes    |
| `reaction.write`     | fonction `toggle_announcement_reaction` (ajout ou retrait d'une réaction) | 60 / minute        |
| `push.write`         | fonctions `save_push_subscription` et `remove_push_subscription`        | 20 / minute        |
| `event.write`        | trigger `events_rate_limit` (création, modification, « terminé »)     | 30 / 10 minutes    |
| `admin.write`        | trigger `audit_logs_rate_limit` : rôles, permissions, sanctions        | 60 / minute        |
| `map.write`          | même trigger, entrées `map.*` (tracé, retrait ; la déclaration garde sa règle des 5 s) | 30 / minute |

Toute action d'administration passe par `write_audit()` : limiter l'insertion dans `audit_logs` couvre d'un coup toutes
les fonctions présentes et futures (les entrées `event.*` sont ignorées, le trigger des événements les compte déjà).
**Les suppressions ne sont pas comptées.** Test : `supabase/tests/database/rate_limits.test.sql`. La table n'est pas
dans `database.types.ts` : le client ne la lit jamais.

## Origine d'inscription (`signup_origins`)

Migration `20261011100000_signup_origin.sql` (A-065, ADR 0008). Table `signup_origins` : `user_id` (PK, FK `profiles`
`on delete cascade`), `country` (code ISO à deux lettres en capitales), `region` (≤ 64), `city` (≤ 96), `created_at` ;
au moins une des trois colonnes de lieu est renseignée. **Jamais l'adresse IP.** Une ligne par compte, écrite une fois,
à la création du compte, par `record_signup_origin(user, country, region, city)` : `SECURITY DEFINER`, **réservée au
`service_role`** (la valeur vient d'un en-tête que seul le serveur peut croire, un client ne choisit donc pas son
origine), « le premier écrit gagne », et seulement pour un compte créé il y a moins de 15 minutes (le lieu d'une
connexion ultérieure n'est pas le lieu d'inscription). RLS : lecture avec la permission `user.origin.view` (admin, et
super_admin via `has_permission`), aucune écriture cliente ; l'utilisateur ne voit pas sa propre ligne. Index sur
`country` (statistiques). Test : `supabase/tests/database/signup_origins.test.sql`.

## Activité horaire (`user_activity`, `activity_hours`, `touch_activity()`)

Migration `20261011110000_activity_tracking.sql` (A-066, ADR 0008). `user_activity(user_id, last_seen_at)` garde la
dernière heure où chaque utilisateur a été vu ; `activity_hours(hour, active_users)` compte les utilisateurs **distincts**
vus pendant chaque heure UTC pleine (`hour` doit être une heure pleine). `touch_activity()` (`SECURITY DEFINER`,
exécutable par `authenticated`) ne compte un utilisateur qu'**une fois par heure** : l'upsert de `user_activity` ne
fait rien si la dernière visite est déjà dans l'heure en cours, et seul un vrai changement incrémente le compteur de
l'heure. Rappeler la fonction est donc inoffensif ; le proxy l'appelle de toute façon au plus une fois par heure et par
navigateur (cookie `blocus-seen`). Volume : 1 ligne par heure (≈ 9 000 par an) et 1 par utilisateur : **aucune purge**
nécessaire. RLS activée, **aucune politique ni droit** (comme `rate_limits`) ; les deux tables ne sont pas dans
`database.types.ts` (le client ne les lit jamais). Les heures d'avant la migration ne sont pas mesurées : l'historique
commence au déploiement. Test : `supabase/tests/database/activity_tracking.test.sql`.

**Dernière activité (migration `20261019120000_last_seen.sql`).** `touch_activity()` (même signature, remplacée) déplace
`last_seen_at` **au plus toutes les 5 minutes** par utilisateur ; le compteur de l'heure ne s'incrémente que si l'ancienne
valeur était dans une heure antérieure (ou absente), donc les statistiques horaires ne changent pas. `get_last_seen(p_user_id)`
(`SECURITY DEFINER`, lecture seule) renvoie la date (ou `null` : compte antérieur au suivi) et refuse (`forbidden`, 42501)
sans la permission `user.activity.view` (admin) ; la table reste sans politique ni droit. Test :
`supabase/tests/database/last_seen.test.sql`.

## Statistiques (`stats_overview()`, `stats_activity()`, `stats_breakdown()`)

Migration `20261011120000_statistics.sql` (A-067). Permission `statistics.view` (admin, super_admin via
`has_permission`) et trois fonctions `SECURITY DEFINER` en lecture seule, qui **revérifient la permission** (`forbidden`,
42501) et ne renvoient que des comptages :

- `stats_overview()` : inscrits, inscriptions sur 24 h / 7 j / 30 j, actifs sur 24 h / 7 j / 30 j (d'après
  `user_activity`), bans en cours (utilisateurs distincts), posts publics, événements (total et à venir), positions
  non retirées, et `tracking_since` (première heure mesurée, `null` tant qu'aucune).
- `stats_activity(p_hours)` : une ligne par heure UTC pleine sur les `p_hours` dernières heures (1 à 720, borné), l'heure
  en cours comprise : utilisateurs actifs, inscriptions, et `tracked` (**faux avant le début de la mesure** : « 0 »
  veut alors dire « inconnu », pas « personne »).
- `stats_breakdown()` : lignes `(kind, key, total)` : `role` (par rôle), `provider` (premier fournisseur du compte,
  d'après `auth.users.raw_app_meta_data`, `unknown` sinon) et `country` (10 premiers pays d'inscription, plus
  `unknown` pour les comptes sans pays).

Test : `supabase/tests/database/statistics.test.sql`.

## Nombre d'inscrits public (`public_user_count()`)

Migration `20261011140000_public_user_count.sql`. `profiles` est fermée à `anon` ; cette fonction (`SECURITY DEFINER`,
`search_path` vide, exécutable par `anon` et `authenticated`) renvoie **un seul entier**, le nombre de comptes, affiché sur
`/login`. Aucun nom, aucune date, aucun identifiant. L'application la lit à travers un cache partagé (une lecture toutes
les 2 min par instance) et tolère son absence. Test : `supabase/tests/database/public_user_count.test.sql`.

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
npm run db:reset   # rejoue migrations + seed (un compte par rôle : seed_user, seed_relay, seed_editor, seed_manager, seed_moderator, seed_developer, seed_admin, seed_super_admin)
npm run db:test    # tests pgTAP (supabase/tests/database)
npm run db:types   # régénère src/lib/database.types.ts
```

## Diagramme

_À ajouter (ERD) une fois le schéma initial écrit._
