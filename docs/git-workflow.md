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
