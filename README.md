# BlocusApp

Application mobile-first (PWA iOS/Android) construite avec **Next.js (App Router) + React + TypeScript +
Tailwind CSS 4 + Supabase**, déployée sur **Vercel** (offres gratuites). Cible : ~1000 utilisateurs,
~200 simultanés.

> Avant toute contribution (développeur **ou** LLM) : lire [`CLAUDE.md`](./CLAUDE.md) et le dossier
> [`.dev/`](./.dev/README.md).

## Prérequis

- Node.js **22+** (voir `.nvmrc`, recommandé : 24) et npm
- Un projet Supabase (dev) — URL et clés dans `.env.local`
- Git configuré avec accès au dépôt GitHub

## Installation (< 10 min)

```bash
git clone https://github.com/iSweat-exe/BlocusApp.git
cd BlocusApp
npm install            # installe aussi les hooks Git (husky)
cp .env.example .env.local
# remplir .env.local avec les valeurs de votre projet Supabase de DEV
npm run dev            # http://localhost:3000
```

Variables d'environnement : voir [`.env.example`](./.env.example). Ne jamais commiter un fichier `.env*`.

## Scripts

| Commande                | Rôle                                       |
| ----------------------- | ------------------------------------------ |
| `npm run dev`           | Serveur de développement                   |
| `npm run build`         | Build de production                        |
| `npm run lint`          | ESLint                                     |
| `npm run typecheck`     | `next typegen` + `tsc --noEmit`            |
| `npm run format`        | Prettier (écriture) — `format:check` en CI |
| `npm run test`          | Tests unitaires (Vitest)                   |
| `npm run test:coverage` | Tests unitaires + couverture               |
| `npm run test:e2e`      | Tests end-to-end (Playwright)              |

## Organisation du projet

```
src/app/        Routes (App Router) : (auth) = login/register, (app) = pages connectées
src/components/ Composants partagés
src/features/   Code par domaine métier (1 dossier = 1 domaine)
src/lib/        Code partagé : clients Supabase, utilitaires, couche data
src/server/     Code exécuté uniquement côté serveur
docs/           Documentation technique (architecture, base de données, permissions…)
.dev/           Pilotage : checklists v1.0.0, contraintes, décisions, recettes LLM
```

## Documentation

- [Architecture](./docs/architecture.md) · [Conventions](./docs/conventions.md) ·
  [Workflow Git](./docs/git-workflow.md)
- [Base de données](./docs/database.md) · [Permissions](./docs/permissions.md) ·
  [Sécurité](./docs/security.md) · [Runbook](./docs/runbook.md)
- [Décisions d'architecture (ADR)](./docs/adr/README.md)

## Déploiement

Vercel : une **preview** par pull request, la **production** uniquement depuis `main`
(voir [`docs/runbook.md`](./docs/runbook.md)). Attention : l'offre Vercel Hobby est réservée à un usage
non commercial.

## Contribuer

1. Choisir une case des checklists (`.dev/`), déclarer l'owner dans l'issue.
2. Créer une branche `feat/…`, `fix/…`, `docs/…` ou `chore/…`.
3. Commits en **Conventional Commits** (anglais), code et commentaires en **anglais**.
4. Ouvrir une PR avec le template, CI verte + 1 review humaine, squash merge.
