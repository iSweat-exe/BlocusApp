# Recette : ajouter une page ou une fonctionnalité d'interface

```
Lis CLAUDE.md, docs/conventions.md et docs/architecture.md, puis traite la case <A-xxx>.
Cette version de Next.js a des changements incompatibles : consulte node_modules/next/dist/docs/ avant
d'utiliser une API.

Tâche : <description de la page / fonctionnalité>.

Règles :
- Route dans src/app/(app)/<route>/page.tsx (ou (auth)). Logique métier dans src/features/<domaine>/.
- Server Component par défaut ; "use client" seulement si nécessaire, composants client petits.
- Aucune requête Supabase dans les composants : passe par src/lib/data/* (cache, batching).
- Valide toutes les entrées (schéma) ; gère erreurs et états de chargement ; mobile-first
  (safe-area iOS), accessibilité clavier.
- Textes visibles en français ; code, commentaires et noms en anglais.
- Vérifie la permission côté serveur ; ne fais pas confiance à l'UI.
- Ajoute des tests (unitaires, et E2E si c'est un parcours critique) et mets à jour docs/architecture.md.

Livrable : branche feat/<sujet>, PR < 400 lignes, commits Conventional Commits en anglais.
Ne sors pas du périmètre de la case.
```
