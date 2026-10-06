# Sécurité

> Document vivant. Voir aussi [`permissions.md`](./permissions.md) et [`runbook.md`](./runbook.md).

## Règles non négociables

1. RLS sur toutes les tables ; l'accès `anon` est révoqué explicitement là où il n'est pas voulu.
2. `SUPABASE_SERVICE_ROLE_KEY` uniquement côté serveur, jamais préfixée `NEXT_PUBLIC_`.
3. Aucun secret dans le dépôt (scan `gitleaks` en CI). Les `.env*` sont ignorés, sauf `.env.example`.
4. Validation de toutes les entrées côté serveur (schéma) ; limites de taille avant et après décompression.
5. Rate limiting sur l'authentification et l'envoi de messages.
6. Sessions Supabase en cookies httpOnly (`@supabase/ssr`), jamais en `localStorage`.
7. Le cache ne contient jamais de réponse authentifiée partagée entre utilisateurs ; le service worker ne
   met pas en cache les réponses authentifiées.

## En-têtes HTTP

Définis dans `next.config.ts` (CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy`, `frame-ancestors`). Toute nouvelle origine externe (carte, images, analytics) doit
être ajoutée explicitement à la CSP dans la même PR.

## Signalement d'une vulnérabilité

Ne pas ouvrir d'issue publique : contacter directement les mainteneurs.

## Revue avant release

Checklist A-110 : RLS, secrets, en-têtes, dépendances (`npm audit`), Security Advisor Supabase à 0 warning.

## Limites connues de la CSP (suivi)

- `script-src` autorise `'unsafe-inline'` car Next.js injecte des scripts inline ; passer à des **nonces**
  rendrait toutes les pages dynamiques (perte du cache statique). À réévaluer avant la v1.0.0.
- Les tuiles de carte, l'analytics et toute autre origine externe sont **bloqués par défaut** : les ajouter
  explicitement dans `next.config.ts` (`img-src`, `connect-src`…) avec la PR qui les introduit.
- Après le premier déploiement, passer l'URL de production dans un scanner d'en-têtes
  (https://securityheaders.com) et consigner le résultat ici.
- HSTS est envoyé sans `preload` : n'ajouter `preload` qu'après décision explicite (difficile à annuler).
