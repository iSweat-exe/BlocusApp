# Checklist v1.0.0 — Organisation du développement (Phase 0)

> Objectif : établir règles et objectifs pour développer proprement, sans débordement.
> Cette phase doit être **100 % terminée** avant d'attaquer [la checklist application](./checklist-v1.0.0-application.md).

---

## Étape 0.1 — Initialisation du dépôt
- [ ] **O-001** Créer le dépôt GitHub (privé) et pousser le projet — _dépôt accessible à l'équipe_
- [ ] **O-002** `git init`, branche par défaut `main`, `.gitignore` Node/Next/Vercel (`.env*` ignorés sauf `.env.example`) — _aucun secret versionné_
- [ ] **O-003** Scaffold Next.js (App Router) + TypeScript strict + ESLint + Prettier — _`npm run build` passe_
- [ ] **O-004** Verrouiller les versions : `engines` dans `package.json`, `.nvmrc`, `package-lock.json` commité — _même version Node pour tous_
- [ ] **O-005** Scripts npm standard : `dev`, `build`, `lint`, `typecheck`, `test`, `format` — _documentés dans le README_
- [ ] **O-006** Fichier `.env.example` listant toutes les variables (sans valeurs) — _onboarding sans question_
- [ ] **O-007** Créer les projets Supabase (dev + prod) et Vercel, lier Vercel ↔ GitHub — _preview deploy sur chaque PR_

## Étape 0.2 — Conventions de code (stack Next.js / React / TypeScript)
- [ ] **O-010** TypeScript `strict: true`, `noUncheckedIndexedAccess`, interdiction de `any` (règle ESLint) — _CI échoue sinon_
- [ ] **O-011** Config ESLint (`next/core-web-vitals`, `typescript-eslint`, règles hooks) + Prettier — _format auto à la sauvegarde_
- [ ] **O-012** Règles de nommage : fichiers `kebab-case`, composants `PascalCase`, hooks `useXxx`, constantes `UPPER_SNAKE_CASE` — _documenté dans `docs/conventions.md`_
- [ ] **O-013** Structure de dossiers figée (ex. `src/app`, `src/features/<domaine>`, `src/lib`, `src/server`, `supabase/migrations`) — _schéma dans la doc_
- [ ] **O-014** Règle Server Components par défaut ; `"use client"` uniquement si nécessaire — _documenté_
- [ ] **O-015** Règle : aucun accès Supabase direct dans les composants → passer par une couche `src/lib/data/*` — _point unique pour cache/batch/compression_
- [ ] **O-016** Validation des entrées avec un schéma (ex. Zod) à **chaque** frontière (API, Server Actions, formulaires) — _documenté_
- [ ] **O-017** Gestion d'erreurs uniforme (type `Result`/codes d'erreur) et logs sans données personnelles — _documenté_
- [ ] **O-018** **Tous les commentaires, noms de variables, messages de commit, JSDoc : en anglais** (règle ESLint/relecture) — _vérifié en revue de PR_
- [ ] **O-019** Les textes UI utilisateur passent par un fichier de traductions (i18n) 🆕 — _aucun texte FR en dur dans les composants_

## Étape 0.3 — Convention Git & GitHub
- [ ] **O-020** Adopter **Conventional Commits** : `type(scope): description` (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`) — _documenté avec exemples_
- [ ] **O-021** `commitlint` + `husky` : hook `commit-msg` qui rejette les messages invalides — _commit non conforme impossible_
- [ ] **O-022** Hook `pre-commit` (`lint-staged` : lint + prettier + typecheck rapide) — _rapide (< 10 s)_
- [ ] **O-023** Stratégie de branches : `main` (protégée, = prod), `develop` optionnel, branches `feat/…`, `fix/…`, `docs/…`, `chore/…` — _nommage documenté_
- [ ] **O-024** Protection de `main` : PR obligatoire, 1 review min, CI verte, pas de force-push, historique linéaire (squash merge) — _réglages GitHub appliqués_
- [ ] **O-025** Template de PR (`.github/pull_request_template.md`) : description, lien issue, checklist (tests, docs, migration, RLS) — _affiché à chaque PR_
- [ ] **O-026** Templates d'issues (bug, feature, tâche LLM) + labels standards — _créés sur GitHub_
- [ ] **O-027** `CODEOWNERS` : les dossiers sensibles (`supabase/migrations`, auth, permissions) nécessitent un reviewer désigné 🔒 — _fichier actif_
- [ ] **O-028** Versionnage SemVer + `CHANGELOG.md` généré (ex. `release-please` / `changesets`) — _tag `v1.0.0` à la fin_
- [ ] **O-029** Taille de PR recommandée (< ~400 lignes) et « 1 PR = 1 case de checklist » — _documenté_

## Étape 0.4 — CI/CD
- [ ] **O-030** GitHub Actions : `lint`, `typecheck`, `test`, `build` à chaque PR — _bloque le merge si rouge_
- [ ] **O-031** Vérification des commits/titres de PR au format Conventional Commits en CI — _CI rouge sinon_
- [ ] **O-032** Scan de secrets (gitleaks) 🆕 🔒 — _CI rouge si secret détecté_
- [ ] **O-033** Audit des dépendances (`npm audit` + Dependabot/Renovate) — _PRs automatiques hebdo_
- [ ] **O-034** Migrations Supabase testées en CI sur une base jetable (`supabase db reset` + tests RLS) 🆕 — _CI rouge si migration cassée_
- [ ] **O-035** Déploiement : preview par PR, prod uniquement depuis `main` — _vérifié_

## Étape 0.5 — Organisation multi-développeurs avec LLMs
- [ ] **O-040** `CLAUDE.md` (et `AGENTS.md` pointant vers le même contenu) à la racine : stack, commandes, conventions, interdits — _un LLM peut coder sans contexte oral_
- [ ] **O-041** Section « Règles pour les LLMs » : lire `.dev/` avant d'agir, 1 tâche = 1 case de checklist, ne pas toucher hors périmètre, ne jamais inventer d'API/clé/table — _écrite_
- [ ] **O-042** Interdits absolus pour LLM : modifier `.env*`, committer des secrets, désactiver RLS, `--no-verify`, force-push, supprimer des migrations existantes 🔒 — _écrits dans `CLAUDE.md`_
- [ ] **O-043** Obligation de relecture humaine : tout code généré par LLM passe par une PR relue par un humain — _règle de protection de branche_
- [ ] **O-044** Marquage des commits assistés par LLM (trailer `Co-Authored-By`) — _convention écrite_
- [ ] **O-045** Dossier `docs/prompts/` (ou `.dev/prompts/`) : prompts/recettes réutilisables (ex. « créer une migration », « ajouter un rôle ») 🆕 — _au moins 3 recettes_
- [ ] **O-046** Règle anti-conflit : 1 développeur/LLM par domaine (`features/<domaine>`), déclaré dans l'issue (assignee) avant de commencer — _documenté_
- [ ] **O-047** Définition de « Done » commune (code + tests + doc + RLS vérifiée + changelog) — _dans le template de PR_

## Étape 0.6 — Documentation (claire et toujours à jour)
- [ ] **O-050** `README.md` : présentation, prérequis, installation en < 10 min, scripts, déploiement — _un nouvel arrivant démarre seul_
- [ ] **O-051** `docs/` structuré : `architecture.md`, `conventions.md`, `database.md`, `permissions.md`, `security.md`, `runbook.md` — _squelettes créés_
- [ ] **O-052** ADR (Architecture Decision Records) dans `docs/adr/` pour chaque décision structurante 🆕 — _modèle + ADR-001 « choix de la stack »_
- [ ] **O-053** Règle « pas de PR sans doc » : si le comportement, le schéma ou une permission change → doc modifiée dans la **même PR** — _case dans le template de PR_
- [ ] **O-054** Doc auto-générée quand possible : types Supabase (`supabase gen types`), schéma de BDD, liste des permissions — _script `npm run docs:gen`_
- [ ] **O-055** Vérification en CI que les types/doc générés sont à jour (diff = échec) — _CI rouge si doc périmée_
- [ ] **O-056** TSDoc (en anglais) sur toutes les fonctions publiques des couches `lib/` et `server/` — _règle ESLint `jsdoc` ou revue_

## Étape 0.7 — Qualité & tests
- [ ] **O-060** Framework de tests unitaires (Vitest) + Testing Library — _`npm test` passe_
- [ ] **O-061** Tests E2E (Playwright) sur les parcours critiques (login, ban, permissions) — _tournent en CI_
- [ ] **O-062** Tests des politiques RLS (pgTAP ou tests SQL) : chaque table a un test « accès autorisé / refusé » 🔒 — _obligatoire pour toute nouvelle table_
- [ ] **O-063** Seuil de couverture minimal sur `lib/` et `server/` (ex. 70 %) 🆕 — _CI_

## Étape 0.8 — Sécurité & opérations de base
- [ ] **O-070** Gestion des secrets : variables Vercel + `.env.local` ; rotation documentée — _`runbook.md`_
- [ ] **O-071** En-têtes de sécurité (CSP, HSTS, X-Frame-Options…) dans `next.config` 🔒 — _vérifié avec un scanner_
- [ ] **O-072** Monitoring minimal des erreurs (Sentry free tier ou logs Vercel) 🆕 — _erreur de test remontée_
- [ ] **O-073** Procédure de backup/restauration (le free tier n'a pas de backup auto fiable → export régulier) 🆕 🔒 — _testée une fois_

---

## ✅ Critère de sortie Phase 0
Un nouveau développeur (ou LLM) clone le dépôt, lance `npm install && npm run dev`, ouvre une PR conforme, la CI passe, et il n'a posé aucune question sur les conventions.

## Backlog (hors v1.0.0)
_(vide — y noter toute idée qui déborde)_
