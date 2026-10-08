# Recette : créer une migration Supabase

> À copier dans la conversation avec le LLM. Remplacer les `<…>`.

```
Lis CLAUDE.md, docs/database.md et docs/security.md, puis traite la case <A-xxx>.

Tâche : créer une migration pour <description du changement>.

Règles :
- Nouveau fichier dans supabase/migrations/ (nom : <timestamp>_<description_snake_case>.sql).
  Ne modifie JAMAIS une migration existante.
- Tables et colonnes en snake_case ; clés étrangères indexées.
- Pour chaque nouvelle table : ALTER TABLE ... ENABLE ROW LEVEL SECURITY; puis une politique par
  opération (select/insert/update/delete) en "deny by default", avec (select auth.uid()).
- Fonctions SECURITY DEFINER : search_path fixé.
- Ajoute les tests SQL des politiques (accès autorisé ET refusé, pour chaque rôle concerné).
- Régénère les types TypeScript (supabase gen types) et mets à jour docs/database.md
  (et docs/permissions.md si une permission change).
- Commentaires SQL et noms en anglais.

Contrainte de déploiement : après la fusion sur main, la migration est appliquée en production par le workflow
`supabase.yml` (après approbation). Écris-la de façon additive et fais tolérer son absence au code (voir
docs/runbook.md).
Livrable : branche feat/<sujet>, PR petite (< 400 lignes), commits Conventional Commits en anglais.
Ne touche à aucun autre fichier. Si une information manque, demande-la.
```
