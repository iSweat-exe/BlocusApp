# 0003 — Monitoring des erreurs

- **Statut** : Proposed (décision requise)
- **Date** : 2026-10-06
- **Décideurs** : @iSweat-exe

## Contexte

Il faut savoir quand l'application plante en production, sans dépasser les offres gratuites ni envoyer
de données personnelles à un tiers sans y avoir réfléchi (RGPD).

## Options

1. **Logs Vercel + Supabase + error boundaries** (`error.tsx`, `global-error.tsx`) — gratuit, aucun tiers
   supplémentaire, mais pas d'agrégation ni d'alertes.
2. **Sentry (offre gratuite)** — regroupement, alertes, traces ; nécessite un compte, un DSN et un
   filtrage des données personnelles.

## Décision proposée

v1.0.0 : option 1 (déjà en place). Option 2 à réévaluer après la mise en production, si le volume
d'erreurs l'exige. Dans ce cas : DSN en variable d'environnement, `beforeSend` qui retire les données
personnelles.

## Conséquences

La case O-072 reste « en attente de décision » tant que ce choix n'est pas accepté.
