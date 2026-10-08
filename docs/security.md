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

## Bans

Un ban est effectif **immédiatement côté données** : le banni n'a plus aucune permission (la RLS refuse ses
écritures même avec un token encore valide), ses sessions et refresh tokens sont supprimés, et le hook JWT
refuse d'émettre un nouveau token (connexion et renouvellement échouent en 403 `account_banned`). Seul reste
possible, au plus une heure (durée de vie de l'access token), la **lecture** de contenus publics déjà
accessibles aux invités. Un ban temporaire se lève tout seul à l'expiration (évalué à chaque lecture).

## Cache partagé

Le cache serveur partagé (`'use cache'`, `src/lib/data/announcements.ts`, `src/lib/data/events.ts`) ne contient que
des données lisibles par le rôle `anon`, lues par un client sans cookies (`src/lib/supabase/public.ts`). Ne jamais y
mettre une donnée qui varie selon l'utilisateur (permissions, profil, administration) : elle serait servie à tout le
monde. Si une règle RLS de lecture de ces tables est un jour restreinte (par exemple « membres seulement »), il faut
retirer la lecture du cache partagé au même moment.

## En-têtes HTTP

Définis dans `next.config.ts` (CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy`, `frame-ancestors`). Toute nouvelle origine externe (carte, images, analytics) doit
être ajoutée explicitement à la CSP dans la même PR.

## Vie privée de la carte (A-127)

Seule la **position de la manifestation, déclarée par un gérant**, est stockée et affichée (table `map_positions`,
lecture publique). La position d'un utilisateur ordinaire n'est **jamais** envoyée au serveur : « Me localiser » place un
repère local sur l'écran de l'utilisateur seul. Le gérant qui utilise « Ma position » ne déclare rien tant qu'il n'a pas
validé : le bouton déplace seulement la carte. L'accès à la géolocalisation de l'appareil est limité à notre origine
(`Permissions-Policy: geolocation=(self)`) et n'est demandé qu'au toucher d'un de ces boutons.

## Signalement d'une vulnérabilité

Ne pas ouvrir d'issue publique : contacter directement les mainteneurs.

## Revue avant release

Checklist A-110 : RLS, secrets, en-têtes, dépendances (`npm audit`), Security Advisor Supabase à 0 warning.

## Limites connues de la CSP (suivi)

- `script-src` autorise `'unsafe-inline'` car Next.js injecte des scripts inline ; passer à des **nonces**
  rendrait toutes les pages dynamiques (perte du cache statique). À réévaluer avant la v1.0.0.
- `img-src` autorise `https://cdn.discordapp.com` (avatars Discord de `/profil`). `profiles.avatar_url` étant modifiable par l'utilisateur, `safeAvatarUrl()` (`src/features/profile/avatar.ts`) n'affiche que du https sur un hôte autorisé.
- `tiles.openfreemap.org` (style, tuiles vectorielles, polices et pictogrammes de la carte, ADR 0005) est autorisé dans
  `img-src` et `connect-src` (`TILES_ORIGIN`, `src/features/map/map-config.ts`), et `worker-src` accepte `blob:` pour le
  worker de MapLibre. L'analytics et toute autre origine externe restent **bloqués par défaut** : les ajouter
  explicitement dans `next.config.ts` (`img-src`, `connect-src`…) avec la PR qui les introduit.
- Vercel Analytics (`<Analytics />` dans `layout.tsx`) fonctionne en production via `/_vercel/insights` (même origine, donc couvert par `'self'`) ; il doit être activé dans le dashboard Vercel (onglet Analytics). Pensez à l'indiquer dans la politique de confidentialité (RGPD, A-113).
- Après le premier déploiement, passer l'URL de production dans un scanner d'en-têtes
  (https://securityheaders.com) et consigner le résultat ici.
- HSTS est envoyé sans `preload` : n'ajouter `preload` qu'après décision explicite (difficile à annuler).
