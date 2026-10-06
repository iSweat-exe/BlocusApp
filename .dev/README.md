# .dev/ — Pilotage du développement

Ce dossier est la **source de vérité** pour organiser le développement de BlocusApp.
Il est lu par les développeurs ET par les LLMs : tout agent doit le lire avant de coder.

## Fichiers

| Fichier | Rôle |
|---|---|
| [`checklist-v1.0.0-organisation.md`](./checklist-v1.0.0-organisation.md) | Phase 0 : règles, conventions, workflow équipe/LLM, docs |
| [`checklist-v1.0.0-application.md`](./checklist-v1.0.0-application.md) | Phase 1 : fonctionnalités de l'app v1.0.0, étape par étape |
| [`constraints.md`](./constraints.md) | Limites des offres gratuites + budget de charge (1000 users / 200 simultanés) |
| [`decisions-a-valider.md`](./decisions-a-valider.md) | Idées ajoutées par Claude : à GARDER ou RETIRER |

## Règles d'usage des checklists

1. **Une étape à la fois.** On ne commence pas l'étape N+1 tant que l'étape N n'est pas entièrement cochée.
2. **Pas de débordement (scope creep).** Tout ce qui n'est pas dans une checklist = hors v1.0.0 → on l'ajoute dans la section « Backlog » de la checklist, jamais dans le code.
3. **Cocher = prouvé.** Une case `[x]` exige : code mergé + test + doc à jour. Mettre le lien PR à côté.
4. Format d'une case : `- [ ] **ID** Description — _critère de validation_`.
5. Un changement de périmètre se discute dans une issue GitHub, puis se reflète ici dans la même PR.

## Légende

- `[ ]` à faire · `[~]` en cours (ajouter @pseudo) · `[x]` fini et vérifié
- 🔒 sécurité critique · ⚡ performance/charge · 📚 documentation · 🆕 idée ajoutée par Claude
