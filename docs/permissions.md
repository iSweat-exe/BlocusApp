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

## Implémentation

- `profiles.role` (FK `roles.key`, défaut `user`) : hors du grant de colonnes, donc **non modifiable par
  l'utilisateur**. Changement de rôle : plus tard via une action serveur protégée par `role.assign` (A-038).
- `has_permission(user_id, 'perm.key')` : `SECURITY DEFINER`, `search_path` vide, exécutable par
  `authenticated` et `service_role` uniquement. Permission inconnue = refusée, même pour `super_admin`.
- `roles`, `permissions`, `role_permissions` : RLS, lecture seule pour `authenticated`, aucune écriture
  client (l'édition depuis le panneau admin viendra avec A-035).
- Reste à faire : claims JWT (A-034), hiérarchie appliquée (A-037), `requirePermission()` (A-038), audit (A-039).
