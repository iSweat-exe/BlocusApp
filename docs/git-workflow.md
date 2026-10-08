# Workflow Git & GitHub

## Branches

- `main` : branche protégée = production. Jamais de commit direct une fois la protection activée.
- Branches de travail, courtes, créées depuis `main` : `feat/<sujet>`, `fix/<sujet>`, `docs/<sujet>`,
  `chore/<sujet>`, `refactor/<sujet>`, `test/<sujet>`, `ci/<sujet>`. Noms en `kebab-case`, en anglais.

## Commits — Conventional Commits

Format : `type(scope): description` (impératif, minuscule, sans point final, ≤ 100 caractères, **en anglais**).

| Type       | Usage                                    |
| ---------- | ---------------------------------------- |
| `feat`     | Nouvelle fonctionnalité                  |
| `fix`      | Correction de bug                        |
| `docs`     | Documentation uniquement                 |
| `refactor` | Refactor sans changement de comportement |
| `perf`     | Amélioration de performance              |
| `test`     | Ajout/modif de tests                     |
| `build`    | Build, dépendances                       |
| `ci`       | Configuration CI/CD                      |
| `chore`    | Maintenance, outillage                   |
| `style`    | Mise en forme sans impact sur le code    |
| `revert`   | Annulation d'un commit                   |

Exemples : `feat(auth): add email sign-up flow`, `fix(messages): prevent duplicate send on retry`,
`docs(permissions): document moderator role`. Breaking change : `feat(api)!:` ou pied de page
`BREAKING CHANGE:`.

Appliqué automatiquement : hook `commit-msg` (commitlint) en local, vérification de la PR en CI.
**Ne jamais utiliser `--no-verify`.**

## Pull requests

- 1 PR = 1 case de checklist ; taille recommandée < ~400 lignes.
- Titre = Conventional Commit (il devient le message du squash).
- Template obligatoire (Definition of Done). CI verte + 1 review humaine (y compris pour le code LLM).
- **Squash merge** uniquement, historique linéaire, branche supprimée après merge.
- Docs mises à jour dans la **même** PR que le code.

## Labels

Source de vérité : [`.github/labels.yml`](../.github/labels.yml). Ne jamais créer ou modifier un label à la main
dans l'interface GitHub : le workflow `Sync labels` (push sur `main` ou « Run workflow ») applique le fichier,
crée les manquants, renomme ceux listés en `aliases` et ne supprime rien.

| Famille      | Exemples                                                                         | Posé par                                        |
| ------------ | -------------------------------------------------------------------------------- | ----------------------------------------------- |
| `type:`      | `feature`, `bug`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`      | Titre de la PR (Conventional Commit), ou template d'issue |
| `area:`      | `auth`, `permissions`, `database`, `admin`, `map`, `ui`, `pwa`, `infra`, `docs`…  | Fichiers modifiés (`.github/labeler.yml`), ou liste « Area » du template |
| `priority:`  | `critical`, `high`, `medium`, `low`                                              | Template d'issue, puis tri humain               |
| `status:`    | `needs-triage`, `needs-info`, `needs-decision`, `ready`, `in-progress`, `needs-review`, `blocked` | Humain (`needs-triage` posé à l'ouverture d'une issue) |
| `size:`      | `XS` (< 10 lignes) à `XL` (≥ 400 lignes : à découper)                             | Automatique (fichiers générés exclus)           |
| `platform:`  | `ios`, `android`, `desktop`                                                      | Template de bug, ou humain                      |
| `checklist:` | `organisation` (O-xxx), `application` (A-xxx), et `backlog` (hors v1.0.0)         | ID de checklist du template, ou humain          |
| Marqueurs    | `security`, `breaking change`, `migration`, `free-tier`, `llm-generated`, `needs-tests`, `needs-docs` | Automatique (chemins, titre, case LLM du template de PR) |

Règles :

- Une PR a **un** `type:`, **un** `size:`, et autant de `area:` que de domaines touchés. Une PR avec plus de
  trois `area:` ou `size: XL` est probablement à découper (« 1 PR = 1 case de checklist »).
- `needs-tests` et `needs-docs` sont des signaux du Definition of Done, retirés automatiquement dès que les
  tests ou la doc sont ajoutés. `llm-generated` vient de la case du template de PR : ne pas reformuler cette ligne.
- `security` et `migration` signalent les PR qui exigent la review du code owner (`CODEOWNERS`).
- Les labels de Dependabot (`dependencies`, `github_actions`) et de release-please (`autorelease: …`) sont
  gérés par ces outils.
- Les workflows `Auto label` utilisent `pull_request_target` sans jamais exécuter de code de la PR : ne pas y
  ajouter de `checkout` de la branche de la PR.

## Releases

SemVer. Les versions et le `CHANGELOG.md` sont générés par release-please à partir des Conventional
Commits ; le tag `v1.0.0` marque la fin de la v1.0.0.

## Collaboration développeurs + LLMs

- Un développeur/LLM par domaine (`src/features/<domaine>`) : l'owner est déclaré dans l'issue **avant** de
  commencer.
- Tout code généré par un LLM est relu par un humain avant merge.
- Les recettes réutilisables sont dans `.dev/prompts/`.
- `.claude/settings.json` est versionné : il désactive l'ajout automatique de lignes d'attribution
  (`Co-Authored-By`) dans les commits et PR. L'usage d'un LLM se déclare via la case dédiée du template de PR.
