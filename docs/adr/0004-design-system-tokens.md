# 0004 — Design system centralisé (tokens Tailwind + classes partagées)

- **Statut** : Proposed
- **Date** : 2026-10-07
- **Décideurs** : @isweat-exe

## Contexte

L'application est mobile-first (PWA iOS/Android). Les couleurs, arrondis et tailles de boutons étaient
répétés en classes Tailwind dans chaque composant (`rounded-lg`, `red-500`, `px-3 py-2`…), avec des
incohérences d'une page à l'autre. Il faut une seule source de vérité, sans dépendance supplémentaire.

## Options envisagées

1. Bibliothèque de composants (shadcn/Radix…) — riche, mais une dépendance de plus (à valider) et un
   poids JS client.
2. Tokens `@theme` Tailwind 4 + quelques classes `@layer components` — zéro dépendance, zéro JS.
3. Statu quo — incohérences durables.

## Décision

Option 2. `src/app/globals.css` contient : couleurs (`accent`, `danger`, `success`, `surface`, `line`,
`muted`…, clair/sombre), arrondis (`rounded-control` 12 px, `rounded-card` 16 px, `rounded-sheet` 24 px),
espacements (`min-h-tap` 44 px, `min-h-control` 48 px, `min-h-control-sm` 40 px, `p-gutter`,
`gap-section`), polices, animations, et les classes `.card`, `.btn` (+ `-primary|-secondary|-outline|-danger|-sm`),
`.field`, `.alert`, `.chip`, `.page-title`, `.section-title`. Les composants partagés (`Select`,
`Avatar`) vivent dans `src/components/`.

## Conséquences

- Changer la DA = modifier `globals.css` ; plus de couleur ou d'arrondi codé en dur dans les pages.
- Règle : dans `src/`, utiliser ces tokens/classes ; ajouter un token plutôt qu'une valeur ad hoc.
- Doc : `docs/conventions.md` (section « Design system »).
