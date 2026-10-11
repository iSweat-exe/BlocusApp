# Rôles et permissions

> Squelette : rempli à l'étape 1.3 de la checklist. Toute modification de rôle ou de permission met ce
> fichier à jour dans la même PR.

## Modèle (RBAC)

- Tables `roles`, `permissions` (clé unique `ressource.action`, ex. `message.send`, `user.ban`),
  `role_permissions`. Aucune permission codée en dur dans le front.
- Fonction SQL `has_permission(user_id, 'perm.key')` utilisée par les politiques RLS.
- Permissions injectées dans le JWT (Custom Access Token Hook) pour éviter une requête par vérification.
- Hiérarchie : on ne peut pas agir sur un rôle supérieur ou égal au sien.
- Un `deny` utilisateur prime sur un `grant` (si les overrides sont retenus).
- `super_admin` : toutes les permissions, non retirables, créé uniquement par migration/SQL manuel.

## Rôles (implémentés, matrice à valider)

Table `roles` (`key`, `label`, `rank`). Rang plus élevé = plus de pouvoir (hiérarchie, A-037).

| Rôle          | Rang | Description                                                 |
| ------------- | ---- | ----------------------------------------------------------- |
| `guest`       | —    | Non connecté (`anon`) : lecture seule, aucun droit en base  |
| `user`        | 10   | Utilisateur standard (rôle par défaut à l'inscription)      |
| `manager`     | 20   | Gérant de la manifestation : annonces, tracé, position      |
| `moderator`   | 30   | Modération (mute, suppression d'annonces)                   |
| `admin`       | 40   | Administration                                              |
| `super_admin` | 100  | Développeurs : toutes les permissions, créé par SQL/migration |

## Catalogue des permissions

Source de vérité : table `permissions` (migration `20261007130000_create_rbac.sql`). Liens dans
`role_permissions`. `super_admin` reçoit toute permission du catalogue via `has_permission()`.

| Permission             | user | manager | moderator | admin | super_admin |
| ---------------------- | :--: | :-----: | :-------: | :---: | :---------: |
| `announcement.publish` |  -   |   ✅    |     -     |  ✅   |     ✅      |
| `announcement.delete`  |  -   |    -    |    ✅     |  ✅   |     ✅      |
| `map.route.edit`       |  -   |   ✅    |     -     |  ✅   |     ✅      |
| `map.position.declare` |  -   |   ✅    |     -     |  ✅   |     ✅      |
| `map.position.remove`  |  -   |    -    |     -     |  ✅   |     ✅      |
| `user.mute`            |  -   |    -    |    ✅     |  ✅   |     ✅      |
| `user.ban`             |  -   |    -    |     -     |  ✅   |     ✅      |
| `role.assign`          |  -   |    -    |     -     |  ✅   |     ✅      |
| `audit.read`           |  -   |    -    |     -     |  ✅   |     ✅      |
| `permission.manage`    |  -   |    -    |     -     |  ✅   |     ✅      |
| `monitoring.view`      |  -   |    -    |     -     |  ✅   |     ✅      |
| `event.create`         |  -   |   ✅    |     -     |  ✅   |     ✅      |
| `event.delete`         |  -   |    -    |    ✅     |  ✅   |     ✅      |
| `event.finish`         |  -   |   ✅    |    ✅     |  ✅   |     ✅      |

## Implémentation

- `profiles.role` (FK `roles.key`, défaut `user`) : hors du grant de colonnes, donc **non modifiable par
  l'utilisateur**. Changement de rôle : plus tard via une action serveur protégée par `role.assign` (A-038).
- `has_permission(user_id, 'perm.key')` : `SECURITY DEFINER`, `search_path` vide, exécutable par
  `authenticated` et `service_role` uniquement. Permission inconnue = refusée, même pour `super_admin`.
- `roles`, `permissions`, `role_permissions` : RLS, lecture seule pour `authenticated`, aucune écriture
  client (l'édition depuis le panneau admin viendra avec A-035).
- **Claims JWT (A-034)** : le hook `custom_access_token_hook` (migration `20261007140000_...`) ajoute au
  token `app_role` (le claim `role` est réservé par PostgREST) et `permissions` (tableau de clés). Seul
  `supabase_auth_admin` peut l'exécuter. Ils servent de chemin rapide côté serveur, la RLS (`has_permission`) reste
  l'autorité.
- **Prise en compte immédiate des changements** : un token n'est normalement renouvelé qu'à son expiration (**1 h**,
  valeur par défaut de Supabase), donc un ami promu administrateur, une permission accordée à un
  utilisateur ou à un rôle, un déni ou un bannissement restaient invisibles tout ce temps (bouton « Créer un post »
  absent, action refusée). La table à une ligne `permission_epoch` (migration `20261008100000_permission_epoch.sql`)
  est mise à jour par des triggers à chaque changement de `role_permissions`, `permission_overrides`, `permissions`,
  `profiles.role` et `moderation_actions` ; `get_permission_epoch()` la rend lisible. `src/lib/supabase/middleware.ts`
  compare cette date à l'`iat` du token à chaque requête de page et, si le token est plus ancien, le **réémet**
  (`refreshSession()`), donc la page et les Server Actions de cette même requête voient les nouveaux droits. Lecture
  mémorisée 10 s par instance (au plus une lecture en base toutes les 10 s), jamais bloquante en cas d'erreur, et
  jamais deux renouvellements pour le même changement. Limite : une page déjà ouverte se met à jour à la prochaine
  navigation ou au retour sur l'app (`RefreshOnReturn`, ≤ 30 s), pas en poussé.
- **`requirePermission(permission, { fresh? })` (A-038)** : `src/server/require-permission.ts`, à appeler en
  premier dans chaque Server Action / Route Handler. Retourne `Result<{ userId }, "unauthenticated" |
"forbidden">`. Par défaut lit les claims ; `fresh: true` interroge la base (actions sensibles : `user.ban`,
  `role.assign`).
- **Premier usage en base** : table `announcements` (RLS via `has_permission`) ; voir `database.md`.
- **Hiérarchie (A-037) et anti-lockout (A-058)** (migration `20261007160000_...`) : le seul moyen de
  changer un rôle est `assign_role(cible, rôle)` (`SECURITY DEFINER`). Il exige `role.assign` et que le rôle
  actuel de la cible **et** le nouveau rôle aient un rang **strictement inférieur** à celui de l'appelant.
  Conséquences : un admin gère `user`/`manager`/`moderator`, pas un autre admin ; personne ne change son
  propre rôle ; personne ne peut créer de `super_admin` via l'app (SQL manuel, voir runbook). Erreurs :
  `forbidden`, `hierarchy_violation` (42501), `unknown_role`/`unknown_user` (22023). Le trigger
  `profiles_keep_last_super_admin` empêche de retirer ou supprimer le dernier `super_admin` (`last_super_admin`).
- **Panneau admin** (`/admin`, `src/features/admin/`) : accessible avec **au moins une** permission
  d'administration (`role.assign`, `user.ban`, `user.mute`, `permission.manage`, `audit.read`) ; chaque
  section vérifie la sienne. Navigation de la section : onglets soulignés avec icône (Utilisateurs, Rôles, Journal, Santé selon les
  permissions). `/admin` : liste (recherche de pseudo avec loupe et bouton d'effacement, filtre par **rôle** en
  pastilles, badge de rôle coloré selon le rang, « Toi » sur son propre compte, 50 comptes max) ; chaque ligne
  mène à la fiche. Le **changement de rôle** se fait sur la fiche (section « Rôle ») : il exige `role.assign` et
  un rang strictement inférieur, jamais sur soi-même (`hierarchy.ts` reflète `assign_role`, qui reste
  l'autorité). Paramètres d'URL validés (`parseUserListParams` : `q`, `role`, un rôle inconnu est ignoré). Les actions appellent `requirePermission(..., { fresh: true })` puis la RPC.
- **Fiche utilisateur** (`/admin/users/[id]`) : identité, **ban en cours** (motif, expiration, bouton
  « Lever le ban »), formulaire de **ban** (motif, durée 1 h / 24 h / 7 j / 30 j / permanent ou date
  personnalisée, max 5 ans ; l'expiration est recalculée côté serveur), historique des sanctions, et bouton
  **Mute désactivé** (« bientôt disponible », aucun backend). Le formulaire n'apparaît que si l'appelant a
  `user.ban` **et** un rang supérieur à la cible ; sinon un message l'explique.
- **Gestion des permissions dans le panneau** : sous-navigation de `/admin` (Utilisateurs · Rôles ·
  Journal · Santé). `/admin/roles` (permission `permission.manage`) : **un rôle à la fois** (onglets, du plus élevé au plus bas,
  avec le nombre de permissions ; le rôle est dans l'URL, `?role=`), un résumé (statut « Modifiable », « Lecture
  seule » ou « Verrouillé », jauge) puis les permissions **groupées** (Annonces, Calendrier, Carte, Modération,
  Administration). Un **interrupteur** (qui bascule aussitôt et revient en arrière si le serveur refuse)
  n'apparaît que pour un rôle de rang strictement inférieur et, pour accorder, une permission que l'appelant
  possède ; sinon la ligne indique « Accordée / Non accordée » et, si besoin, pourquoi (« Tu ne possèdes pas
  cette permission »). `super_admin` est verrouillé. Les règles sont dans `role-matrix-model.ts` (pur, testé) et
  restent doublées par la base. La fiche
  utilisateur affiche l'**état effectif** de chaque permission (« Via le rôle », « Accordée / Refusée à cet
  utilisateur ») avec **Accorder / Refuser / Réinitialiser** (Accorder seulement pour une permission détenue).
  Actions : `toggleRolePermission` et `setUserPermission` (`requirePermission("permission.manage", { fresh:
  true })` puis RPC ; erreurs traduites). `permission-rules.ts` reflète les règles de la base pour l'affichage.
- **Journal d'audit dans le panneau** : `/admin/journal` (permission `audit.read`), lecture seule. Chaque
  entrée est décrite en une phrase (« boss a banni victim définitivement — motif : … »), les pseudos sont
  résolus (compte supprimé = identifiant tronqué), entrées **regroupées par jour** (« Aujourd'hui », « Hier », puis la date ; le jour est celui de Paris), une
  icône colorée par catégorie et les noms en gras, filtre par **catégorie** (Tout, Rôles, Permissions, Sanctions,
  Calendrier, Carte : `AUDIT_CATEGORIES`, chaque action connue appartient à une seule ; une action inconnue de
  cette version s'affiche sous « Autre »), pagination par curseur sur `id` (25 par page, « Voir les entrées plus
  anciennes » / « Revenir aux plus récentes »). Paramètres d'URL validés (`parseJournalParams` : `category`,
  `before` ; l'ancien paramètre `action` ouvre la catégorie de cette action). Rien n'est écrit depuis l'interface : le journal est alimenté par les RPC.
- **Calendrier** : `event.create` (créer, et modifier ses propres événements), `event.delete` (supprimer
  n'importe lequel ; supprimer les siens suffit avec `event.create`). Boutons affichés d'après les claims,
  vérification `fresh` côté serveur, RLS en base.
- **Événements terminés** : `event.finish` permet de marquer **n'importe quel** événement comme terminé ou de
  le rouvrir (RPC `set_event_finished`, idempotente, journalisée `event.finished` / `event.reopened`). Un
  événement terminé n'est plus modifiable par son auteur (RLS) mais reste supprimable.
- Reste à faire : hiérarchie pour ban/mute (A-051/A-052), audit (A-039), usage de `requirePermission` dans les futures actions.
