# Recette : ajouter une permission ou un rôle

```
Lis CLAUDE.md et docs/permissions.md, puis traite la case <A-xxx>.

Tâche : <ajouter la permission `ressource.action` | ajouter le rôle `<nom>`> avec <description>.

Règles :
- Une permission = clé unique `ressource.action` (minuscules). Ne code aucune permission en dur dans le front.
- Passe par une NOUVELLE migration (jamais d'édition d'une migration existante) qui insère la
  permission / le rôle et ses liens dans role_permissions.
- Vérifie la hiérarchie : un rôle ne peut pas agir sur un rôle supérieur ou égal.
- Applique la permission côté base (RLS / has_permission) ET côté serveur (requirePermission()).
  L'UI ne fait que masquer.
- Ajoute des tests : pour CHAQUE rôle, la permission est autorisée ou refusée comme prévu.
- Mets à jour docs/permissions.md (tableau permission x rôle) dans la même PR.

Livrable : branche feat/<sujet>, PR < 400 lignes, commits Conventional Commits en anglais.
```
