# Architecture Decision Records (ADR)

Chaque décision structurante (stack, bibliothèque, modèle de données, compromis de sécurité) est
consignée ici dans **un fichier numéroté** : `NNNN-titre-en-kebab-case.md`, créé depuis
[`0000-template.md`](./0000-template.md).

Un ADR n'est jamais supprimé : s'il est remplacé, son statut passe à `Superseded by NNNN`.

| N°                                         | Titre                                  | Statut   |
| ------------------------------------------ | -------------------------------------- | -------- |
| [0001](./0001-stack-choice.md)             | Choix de la stack                      | Accepted |
| [0002](./0002-compression-scope.md)        | Périmètre de la compression des données | Proposed |
| [0003](./0003-error-monitoring.md)         | Monitoring des erreurs                 | Proposed |
| [0004](./0004-design-system-tokens.md)     | Design system centralisé (tokens)      | Proposed |

À venir : bibliothèque de carte (A-126), stratégie de cache (A-080), modèle de messagerie (A-124).
