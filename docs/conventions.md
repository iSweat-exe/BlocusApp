# Conventions de code

## Langue

Code, commentaires, TSDoc, identifiants, messages de commit et titres de PR : **anglais**. Les textes
affichés à l'utilisateur sont en français pour l'instant (décision i18n en attente).

## Nommage

| Élément                  | Convention               | Exemple                 |
| ------------------------ | ------------------------ | ----------------------- |
| Fichiers et dossiers     | `kebab-case`             | `app-nav.tsx`           |
| Composants React, types  | `PascalCase`             | `AppNav`, `UserProfile` |
| Fonctions, variables     | `camelCase`              | `getSiteUrl`            |
| Hooks                    | `useXxx`                 | `useProfile`            |
| Constantes globales      | `UPPER_SNAKE_CASE`       | `MAX_MESSAGE_LENGTH`    |
| Permissions              | `ressource.action`       | `message.send`          |
| Tables / colonnes SQL    | `snake_case`, minuscules | `moderation_actions`    |

## Structure des dossiers

```
src/app/<group>/<route>/page.tsx   Routes ; groupes (auth) et (app)
src/components/                    Composants UI partagés (sans logique métier)
src/features/<domaine>/            Composants, hooks, actions d'un domaine (announcements, calendar, map…)
src/lib/                           Code partagé (supabase/, data/, compression/, validation/, utils)
src/server/                        Code strictement serveur (service_role, jobs)
supabase/migrations/               Migrations SQL (créé à l'étape 1.1)
docs/ · .dev/                      Documentation et pilotage
```

## React / Next.js

- **Server Components par défaut.** `"use client"` uniquement pour l'état local, les effets, les
  événements, les API navigateur. Garder les composants client petits et proches des feuilles.
- Aucune requête Supabase directe dans les composants : passer par `src/lib/data/*` (point unique pour
  le cache, le batching, la compression).
- Cette version de Next.js a des changements incompatibles : consulter `node_modules/next/dist/docs/`.

## Validation et erreurs

- Valider **toute** entrée à chaque frontière (Server Actions, Route Handlers, formulaires) avec un schéma
  (Zod, à ajouter au premier usage). Ne jamais faire confiance au client.
- Erreurs prévisibles : type `Result` (`src/lib/result.ts`), pas d'exception pour le flux normal.
- Logs sans donnée personnelle (pas d'e-mail, de token, de contenu de message).

## Design system (UI)

Source unique : `src/app/globals.css` (voir ADR 0004). Ne jamais coder en dur une couleur, un arrondi ou une
hauteur de bouton : utiliser les tokens et classes partagées.

| Besoin                | À utiliser                                                                    |
| --------------------- | ----------------------------------------------------------------------------- |
| Couleurs              | `bg-accent`, `text-accent`, `text-danger`, `text-success`, `text-muted`, `text-faint`, `border-line`, `bg-surface` |
| Arrondis              | `rounded-control` (boutons, champs), `rounded-card` (cartes), `rounded-sheet` (feuilles), `rounded-full` (pastilles, avatars) |
| Zones tactiles        | `min-h-tap` (44 px), `min-h-control` (48 px), `min-h-control-sm` (40 px)      |
| Rythme                | `p-gutter` (marge de page), `gap-section` (entre sections)                    |
| Cartes / alertes      | `.card`, `.card-link`, `.alert .alert-error`, `.chip .chip-accent`            |
| Boutons               | `.btn` + `.btn-primary` / `-secondary` / `-outline` / `-danger`, `.btn-sm`    |
| Champs de formulaire  | `.field`, `.field-label`, `.field-error`                                      |
| Titres                | `.page-title`, `.section-title`                                               |
| Composants            | `Select` (liste déroulante, feuille swipeable sur mobile), `Avatar`, `FullScreenDialog` |

## TypeScript / qualité

- `strict`, `noUncheckedIndexedAccess`, pas de `any` (erreur ESLint), pas de `@ts-ignore` sans
  commentaire expliquant pourquoi.
- Les types de la base sont **générés** (`supabase gen types`), jamais écrits à la main.
- TSDoc (anglais) sur toute fonction exportée de `src/lib/` et `src/server/` (règle ESLint).
- Commentaires : expliquer le _pourquoi_, pas le _quoi_.
- Prettier gère le format (`npm run format`) ; ESLint doit passer avec 0 warning.

## Tests

Vitest (unitaires), Playwright (E2E, parcours critiques), tests SQL des politiques RLS. Couverture
minimale sur `src/lib/` et `src/server/` : voir `vitest.config.ts`.
