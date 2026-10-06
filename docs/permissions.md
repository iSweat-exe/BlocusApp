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

## Rôles (proposition, à valider)

| Rôle          | Description                          |
| ------------- | ------------------------------------ |
| `user`        | Utilisateur standard                 |
| `moderator`   | Modération (mute, suppression)       |
| `admin`       | Administration                       |
| `super_admin` | Développeurs : contrôle total        |

## Catalogue des permissions

_À écrire : un tableau `permission × rôle` (source de vérité), généré depuis la base si possible._
