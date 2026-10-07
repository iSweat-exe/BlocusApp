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
| `user.mute`            |  -   |    -    |    ✅     |  ✅   |     ✅      |
| `user.ban`             |  -   |    -    |     -     |  ✅   |     ✅      |
| `role.assign`          |  -   |    -    |     -     |  ✅   |     ✅      |
| `audit.read`           |  -   |    -    |     -     |  ✅   |     ✅      |
| `permission.manage`    |  -   |    -    |     -     |  ✅   |     ✅      |
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
  `supabase_auth_admin` peut l'exécuter. Les claims ne sont rafraîchis qu'avec le token (≤ 1 h) : ils servent
  de chemin rapide côté serveur, la RLS (`has_permission`) reste l'autorité.
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
  section vérifie la sienne. Liste et recherche de pseudo (50 max) ; le sélecteur de rôle exige
  `role.assign` et un rang strictement inférieur (`hierarchy.ts` reflète `assign_role`, qui reste
  l'autorité). Les actions appellent `requirePermission(..., { fresh: true })` puis la RPC.
- **Fiche utilisateur** (`/admin/users/[id]`) : identité, **ban en cours** (motif, expiration, bouton
  « Lever le ban »), formulaire de **ban** (motif, durée 1 h / 24 h / 7 j / 30 j / permanent ou date
  personnalisée, max 5 ans ; l'expiration est recalculée côté serveur), historique des sanctions, et bouton
  **Mute désactivé** (« bientôt disponible », aucun backend). Le formulaire n'apparaît que si l'appelant a
  `user.ban` **et** un rang supérieur à la cible ; sinon un message l'explique.
- **Gestion des permissions dans le panneau** : sous-navigation de `/admin` (Utilisateurs · Rôles et
  permissions). `/admin/roles` (permission `permission.manage`) : une carte par rôle (le plus élevé en
  premier) listant les permissions ; bouton **Accorder / Retirer** seulement pour un rôle de rang strictement
  inférieur et, pour accorder, une permission que l'appelant possède ; `super_admin` verrouillé. La fiche
  utilisateur affiche l'**état effectif** de chaque permission (« Via le rôle », « Accordée / Refusée à cet
  utilisateur ») avec **Accorder / Refuser / Réinitialiser** (Accorder seulement pour une permission détenue).
  Actions : `toggleRolePermission` et `setUserPermission` (`requirePermission("permission.manage", { fresh:
  true })` puis RPC ; erreurs traduites). `permission-rules.ts` reflète les règles de la base pour l'affichage.
- **Journal d'audit dans le panneau** : `/admin/journal` (permission `audit.read`), lecture seule. Chaque
  entrée est décrite en une phrase (« boss a banni victim définitivement — motif : … »), les pseudos sont
  résolus (compte supprimé = identifiant tronqué), filtre par type d'action, pagination par curseur sur
  `id` (25 par page, « Plus anciennes → » / « ← Plus récentes »). Paramètres d'URL validés
  (`parseJournalParams`). Rien n'est écrit depuis l'interface : le journal est alimenté par les RPC.
- **Calendrier** : `event.create` (créer, et modifier ses propres événements), `event.delete` (supprimer
  n'importe lequel ; supprimer les siens suffit avec `event.create`). Boutons affichés d'après les claims,
  vérification `fresh` côté serveur, RLS en base.
- **Événements terminés** : `event.finish` permet de marquer **n'importe quel** événement comme terminé ou de
  le rouvrir (RPC `set_event_finished`, idempotente, journalisée `event.finished` / `event.reopened`). Un
  événement terminé n'est plus modifiable par son auteur (RLS) mais reste supprimable.
- Reste à faire : hiérarchie pour ban/mute (A-051/A-052), audit (A-039), usage de `requirePermission` dans les futures actions.
