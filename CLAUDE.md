# CLAUDE.md — Rules for LLM agents and developers

BlocusApp: Next.js (App Router) + React + TypeScript + Tailwind CSS 4 + Supabase, deployed on Vercel
(free tiers only). Target: ~1000 users, ~200 concurrent. Mobile-first PWA (iOS + Android).

Also read [AGENTS.md](./AGENTS.md): this Next.js version has breaking changes, check
`node_modules/next/dist/docs/` before using any Next.js API.

## Read first (mandatory)

1. `.dev/README.md` — how the checklists work.
2. `.dev/checklist-v1.0.0-organisation.md` and `.dev/checklist-v1.0.0-application.md` — the scope.
3. `.dev/constraints.md` — free-tier limits and load budget.
4. `docs/conventions.md` and `docs/git-workflow.md` — code and Git rules.

## Working rules

- **One task = one checklist item** (`O-xxx` / `A-xxx`). Never work outside the current step.
  Out-of-scope ideas go to the `Backlog` section of the checklist, never into code.
- Work on a dedicated branch (`feat/…`, `fix/…`, `docs/…`, `chore/…`), never directly on `main`.
- A change is done only with: code + tests + docs updated in the same PR + checklist item ticked.
- Do not invent APIs, tables, env vars, keys or library behaviour. If unsure, read the docs/code or ask.
- Ask before adding a dependency; prefer what the stack already provides.
- Keep PRs small (~400 lines max).

## Language

- **All code, comments, TSDoc, identifiers, commit messages and PR titles are in English.**
- User-facing UI text is French for now (i18n decision pending, see `.dev/decisions-a-valider.md`).
- Project documentation (`.dev/`, `docs/`) is in French; code snippets and identifiers stay English.

## Commands

```bash
npm run dev          # dev server
npm run lint         # ESLint (must pass with 0 warnings in CI)
npm run typecheck    # next typegen + tsc --noEmit
npm run format       # Prettier (write) / format:check
npm run test         # unit tests (Vitest)
npm run test:e2e     # end-to-end tests (Playwright)
npm run build        # production build
```

## Code conventions (summary — full version in `docs/conventions.md`)

- TypeScript `strict`, no `any`, no unchecked index access.
- Server Components by default; add `"use client"` only when needed.
- No direct Supabase calls in components: go through `src/lib/data/*` (single place for cache,
  batching and compression).
- Validate every input at every boundary (Server Actions, Route Handlers, forms) with a schema.
- Permissions are enforced in the database (RLS + SQL functions) **and** re-checked server-side.
  The UI only hides things; it never grants anything.
- Every table has RLS enabled (deny by default) and a test for allowed/denied access.

## Hard prohibitions

- Never commit secrets. Never edit or print `.env*` files. `SUPABASE_SERVICE_ROLE_KEY` is server-only
  and must never be prefixed with `NEXT_PUBLIC_`.
- Never disable or bypass RLS. Never edit an existing migration: add a new one.
- Never use `--no-verify`, never force-push, never rewrite history on shared branches.
- Never run destructive commands (drop, truncate, mass delete) against a real Supabase project.
- Never change branch protection, CI secrets or deployment settings.
- Never push to `main` once branch protection is enabled: open a PR.

## Git

- Conventional Commits: `type(scope): description` — enforced by commitlint (husky `commit-msg`).
  Types: `feat fix docs refactor test chore perf ci build revert style`.
- Squash merge; the PR title becomes the commit message, so it must be a valid Conventional Commit.
- Human review is required for every PR, including LLM-generated ones.

## Docs to keep up to date

When behaviour, schema, permissions or conventions change, update in the **same PR**:
`docs/architecture.md`, `docs/database.md`, `docs/permissions.md`, `docs/security.md`,
`docs/runbook.md`, the checklist, and add an ADR in `docs/adr/` for structural decisions.

## Recipes

Reusable step-by-step prompts live in `.dev/prompts/` (create a migration, add a permission, add a page).
