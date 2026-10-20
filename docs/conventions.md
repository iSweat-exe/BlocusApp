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
- **`import "server-only"`** en tête de tout module qui n'a rien à faire dans le navigateur : clients Supabase
  (`server.ts`, `service.ts`, `request-cookies.ts`), `src/server/*`, `src/lib/data/*`. Un import depuis un composant
  client fait alors **échouer le build** au lieu de livrer du code serveur (ou d'oublier un secret) au navigateur. Vitest
  l'alias vers un module vide (`vitest.config.ts`).
- **Chaque page a son `title`** (`export const metadata = { title: "Calendrier" }`) ; le modèle `%s · BLOCUS` du layout
  racine ajoute la marque, donc ne jamais l'écrire dans la page (`src/app/metadata.test.ts` le vérifie).
- **Composants courts.** Au-delà d'environ 300 lignes, un composant client se découpe : un sous-composant par vue
  (`week-view.tsx`, `day-timeline.tsx`), la logique qui n'est pas de l'affichage dans un hook (`use-pinch-zoom.ts`) ou un
  module pur testable (`timeline.ts`).
- Cette version de Next.js a des changements incompatibles : consulter `node_modules/next/dist/docs/`.

## Validation et erreurs

- Valider **toute** entrée à chaque frontière (Server Actions, Route Handlers, formulaires) avec un schéma
  (Zod, à ajouter au premier usage). Ne jamais faire confiance au client.
- Erreurs prévisibles : type `Result` (`src/lib/result.ts`), pas d'exception pour le flux normal.
- Logs sans donnée personnelle (pas d'e-mail, de token, de contenu de message).

## Design system (UI)

Source unique : `src/app/globals.css` (voir ADR 0004). Les valeurs sombres y sont écrites deux fois (système et `data-theme="dark"`) : les modifier dans les deux blocs. Ne jamais coder en dur une couleur, un arrondi ou une
hauteur de bouton : utiliser les tokens et classes partagées.

| Besoin                | À utiliser                                                                    |
| --------------------- | ----------------------------------------------------------------------------- |
| Couleurs              | `bg-accent`, `text-accent`, `text-danger`, `text-success`, `text-muted`, `text-faint`, `border-line`, `bg-surface` |
| Arrondis              | `rounded-control` (boutons, champs, boutons d’icône de l’en-tête, avatars), `rounded-card` (cartes), `rounded-sheet` (feuilles), `rounded-full` (pastilles) |
| Police                | rien à ajouter pour le texte (Inter, `--font-sans`) ; titres `h1` à `h3` et `font-display` (Archivo) pour la marque ; `font-mono` pour les valeurs techniques ; graisses : 400 texte, 500 secondaire, 600 étiquettes et boutons, 600 à 800 titres |
| Zones tactiles        | `min-h-tap` (44 px), `min-h-control` (48 px), `min-h-control-sm` (40 px)      |
| Rythme                | `p-gutter` (marge de page), `gap-section` (entre sections)                    |
| Cartes / alertes      | `.card`, `.card-link`, `.alert .alert-error`, `.chip .chip-accent`            |
| Boutons               | `.btn` + `.btn-primary` / `-secondary` / `-outline` / `-danger`, `.btn-sm`    |
| Champs de formulaire  | `.field`, `.field-label`, `.field-error`                                      |
| Titres                | `.page-title`, `.section-title`                                               |
| Retour au toucher     | `.btn` s’enfonce déjà (`scale(0.96)`) ; pour un autre contrôle : `transition-[scale,…] active:scale-[0.96]`, jamais `transition-all`, jamais sous `0.95` |
| Images                | `.img-outline` (contour intérieur noir pur en clair, blanc pur en sombre, jeton `--image-outline`) à la place d’une bordure |
| Composants            | `Select` (liste déroulante, feuille swipeable sur mobile), `Avatar`, `FullScreenDialog` |

**Valeurs et pastilles : une seule ligne.** Dans une ligne `flex` (libellé à gauche, valeur à droite), la valeur et les pastilles (`.chip`, qui ne se coupe jamais) portent `whitespace-nowrap` en plus de `shrink-0` : sans lui, un navigateur peut réduire la colonne à son plus petit mot (« 30 ms » devenait « 30 » / « ms » sur iPhone). C'est le texte d'aide qui se replie, jamais la valeur. Vérifier les écrans à **320 px** (le plus petit téléphone).

**Finitions (skill `make-interfaces-feel-better`).** Arrondis imbriqués : rayon extérieur = rayon intérieur + marge (`rounded-card` autour de `rounded-control` avec `p-1`). Chiffres qui changent : `tabular-nums`. Titres : `text-wrap: balance` et paragraphes : `text-wrap: pretty` (déjà dans `globals.css`). Zone tactile d’un petit contrôle : 44 px (40 px minimum en interface dense), étendue par un pseudo-élément sans chevaucher le voisin. Survol : toujours derrière `[@media(hover:hover)]:hover:` (sinon il reste collé après un toucher). Bureau : un seul point de rupture, `lg:` (1024 px), jamais de logique JS de largeur ; le téléphone reste la base, `lg:` ne fait qu'ajouter (voir `docs/architecture.md`, « Bureau »). Toute action au clavier passe par un raccourci annoncé (`aria-keyshortcuts`) et ignoré dans un champ. Animations d’entrée : seulement celles de `globals.css` (`animate-fade-in`…) ; `animate-in` / `zoom-in-95` n’existent pas dans ce projet et ne font rien.

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

Les tests E2E tournent contre un faux Supabase local (`e2e/support/fake-supabase.mjs`, lancé par
`playwright.config.ts`) : il répond aux endpoints `authorize`, `token` (PKCE) et `user` de l'authentification et
renvoie le profil de l'utilisateur connecté ; toutes les autres tables sont vides. Il garde aussi en mémoire des posts, des réactions et des positions (filtres, tri, limite, fonctions SQL utilisées par les
parcours) : `e2e/journeys.spec.ts` publie, réagit et déclare la position pour de vrai. Les parcours de connexion
et de déconnexion (`e2e/auth.spec.ts`) exécutent donc les vraies routes `/auth/*` sans appeler Discord ni
Google. Le scénario `manager` (cookie `e2e_scenario`) donne les permissions de publier et de déclarer. Le test avec les vrais fournisseurs reste manuel (`docs/runbook.md`).
