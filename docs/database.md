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
- À venir : colonne de rôle (étape 1.3), `moderation_actions`, `audit_logs`.

## Développement local

Docker requis. Les secrets Discord locaux viennent de l'environnement (`.env.example`).

```bash
npm run db:start   # Supabase local (supabase start)
npm run db:reset   # rejoue migrations + seed
npm run db:test    # tests pgTAP (supabase/tests/database)
npm run db:types   # régénère src/lib/database.types.ts
```

## Diagramme

_À ajouter (ERD) une fois le schéma initial écrit._
