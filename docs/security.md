# Sécurité

> Document vivant. Voir aussi [`permissions.md`](./permissions.md) et [`runbook.md`](./runbook.md).

## Règles non négociables

1. RLS sur toutes les tables ; l'accès `anon` est révoqué explicitement là où il n'est pas voulu.
2. `SUPABASE_SERVICE_ROLE_KEY` uniquement côté serveur, jamais préfixée `NEXT_PUBLIC_`.
3. Aucun secret dans le dépôt (scan `gitleaks` en CI). Les `.env*` sont ignorés, sauf `.env.example`.
4. Validation de toutes les entrées côté serveur (schéma) ; limites de taille avant et après décompression.
5. Rate limiting par utilisateur sur toutes les écritures (voir « Limites de débit »). L'authentification passe par
   Discord et Google, dont les limites s'appliquent ; la limite par IP des visiteurs non connectés reste à faire (A-101).
6. Sessions Supabase en cookies httpOnly (`@supabase/ssr`), jamais en `localStorage`. Le cookie a un nom fixe, `blocus-auth`
   (`src/lib/supabase/cookie.ts`), commun à tous les clients Supabase ; le `matcher` du `proxy` en dépend.
7. Le cache ne contient jamais de réponse authentifiée partagée entre utilisateurs ; le service worker ne
   met pas en cache les réponses authentifiées.

## Limites de débit (A-100)

Chaque utilisateur est limité **dans la base de données** (table `rate_limits`, voir [`database.md`](./database.md)) :
10 créations ou modifications de posts par 10 minutes, 30 événements par 10 minutes, 60 actions d'administration par
minute, 30 actions de carte par minute. C'est la base qui décide, pas les Server Actions : un client qui appelle
PostgREST directement avec son jeton est limité de la même façon. Les Server Actions ne font que traduire l'erreur
`rate_limited` en message (`src/server/rate-limit.ts`). Limites connues :

- fenêtre fixe : un utilisateur peut enchaîner jusqu'à deux fois la limite à cheval sur deux fenêtres ;
- les suppressions ne sont pas comptées ;
- l'envoi d'une image de post (bucket `announcement-images`) n'est pas compté avant la création du post : seuls les
  titulaires de `announcement.publish` peuvent écrire, chaque fichier est plafonné à 300 Ko et le serveur supprime le
  fichier si la création est refusée ;
- les visiteurs non connectés n'écrivent rien (RLS) ; leur limite par IP relève de A-101.

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

## Posts : visibilité, auteur et images (A-123c à A-123f)

Les brouillons et posts privés ne sont lisibles que par leur auteur (RLS) ; la table `announcements` n'est plus lisible
par `anon`. Le fil public passe par la vue `announcement_feed`, qui s'exécute avec les droits de son propriétaire (choix
volontaire, `anon` n'a pas accès à `profiles`) et décide de ce qui sort : seulement les posts publics, et l'auteur
(id, pseudo, avatar) seulement si `show_author` est coché. Les modérateurs (`announcement.delete`) lisent la table pour
les posts publics et voient donc leur auteur. Images : bucket public plafonné à 300 Ko et à WebP/JPEG, écriture limitée
aux titulaires de `announcement.publish` dans leur propre dossier ; le serveur revérifie la taille, le format réel et
les dimensions. Une image est une donnée publique : ne pas y mettre de donnée sensible.

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

## Origine d'inscription (A-065)

À la création d'un compte, le callback OAuth (`/auth/callback`, `src/features/auth/signup-origin.ts`) note **d'où** la
requête vient : le **pays, la région et la ville** que Vercel déduit de l'adresse IP et ajoute aux requêtes (en-têtes
`x-vercel-ip-country`, `x-vercel-ip-country-region`, `x-vercel-ip-city` ; absents en local, donc rien n'est noté). Ce
sont des **données personnelles** (localisation approximative) :

- **L'adresse IP n'est ni lue ni stockée** ; seules ces trois valeurs, validées (pays = 2 lettres, longueurs bornées,
  caractères de contrôle retirés) puis contraintes par la base.
- Une seule fois, au moment du premier compte (comptes de moins de 10 min côté serveur, 15 min côté base) : une
  connexion ultérieure ne modifie rien.
- **Écriture par le `service_role` uniquement** (`record_signup_origin()` lui est réservée) : l'en-tête est la seule
  source fiable, et un utilisateur ne peut pas choisir son origine en appelant PostgREST avec son propre jeton. Sans
  `SUPABASE_SERVICE_ROLE_KEY`, l'origine n'est simplement pas notée (l'inscription n'est jamais bloquée).
- **Lecture limitée** à la permission `user.origin.view` (admin, super_admin) : RLS sur `signup_origins`, l'utilisateur
  lui-même ne voit pas sa ligne. Les statistiques n'affichent que des **totaux par pays** (`stats_breakdown()`).
- Supprimée avec le compte (`on delete cascade`). À mentionner dans la politique de confidentialité (A-113 : export et
  suppression des données).
- Limite : la valeur est celle que la plateforme annonce (VPN, réseau mobile, entreprise faussent la ville) : à lire
  comme une indication, jamais comme une preuve ni un critère de sécurité ou de sanction.

## Clé `service_role` et surveillance (A-061 à A-064)

Le code serveur lit `SUPABASE_SERVICE_ROLE_KEY` à deux endroits, tous deux via `src/lib/supabase/service.ts` :
`src/features/health/cron-snapshot.ts` (cron quotidien, sans utilisateur) et `src/features/auth/signup-origin.ts`
(origine d'inscription, voir ci-dessus ; une seule fonction SQL, `record_signup_origin()`). Les fonctions SQL appelées
(`health_stats`, `record_health_snapshot`) revérifient le rôle (`can_monitor()`). La page `/admin/health` n'utilise
pas cette clé : elle passe par la session de l'administrateur (`monitoring.view`, RLS). `/api/health` est public et
ne renvoie que le statut (jamais de mesure, de compteur ni de configuration) ; son résultat est gardé 10 s. Le jeton
Vercel (`VERCEL_API_TOKEN`) reste côté serveur.

## Données publiques volontaires et thèmes de profil

- **Nombre d'inscrits** : `public_user_count()` est lisible sans compte (page `/login`). C'est un total, rien de plus ; il est
  lu au plus une fois toutes les 2 min par instance (cache partagé), donc l'appel direct de la fonction par un tiers ne coûte
  qu'un `count(*)` sur une petite table.
- **Thèmes de profil** : l'id d'un compte à thème est écrit dans le code (`src/features/profile/profile-theme.ts`), donc dans
  un **dépôt public**. Un identifiant seul n'identifie personne, mais on n'y associe ni nom, ni pseudo, ni commentaire
  personnel (ni dans le code, ni dans les docs, ni dans les PR). Pour ne pas exposer l'id du tout, il faudrait le lire
  depuis la base ou une variable d'environnement.
- **Crédits** : uniquement des identifiants GitHub publics, jamais d'e-mail. Les chiffres de contribution viennent de l'API
  publique de GitHub, appelée **par le serveur** (aucune donnée de visiteur n'y part, aucun jeton, aucun secret), puis lus
  et validés comme des données externes (`parseContributorStats()`). La page affiche la **photo de profil GitHub**
  de chaque développeur : le navigateur du visiteur la charge depuis `avatars.githubusercontent.com` (hôte ajouté à `img-src`
  et à la liste des hôtes d'avatars), sans en-tête *referrer*. GitHub voit donc l'adresse IP des visiteurs de `/credits`,
  comme Discord et Google voient celle des utilisateurs dont l'avatar s'affiche ; aucune photo n'est copiée dans le dépôt.
  Chaque développeur listé doit être d'accord pour que sa photo publique y figure.

## Signalement d'une vulnérabilité

Ne pas ouvrir d'issue publique : contacter directement les mainteneurs.

## Revue avant release

Checklist A-110 : RLS, secrets, en-têtes, dépendances (`npm audit`), Security Advisor Supabase à 0 warning.

## Limites connues de la CSP (suivi)

- `script-src` autorise `'unsafe-inline'` car Next.js injecte des scripts inline ; passer à des **nonces**
  rendrait toutes les pages dynamiques (perte du cache statique). À réévaluer avant la v1.0.0.
- `img-src` autorise `https://cdn.discordapp.com` et `https://lh3.googleusercontent.com` (avatars Discord / Google). `profiles.avatar_url` étant modifiable par l'utilisateur, `safeAvatarUrl()` (`src/features/profile/avatar.ts`) n'affiche que du https sur un hôte autorisé.
- `tiles.openfreemap.org` (style, tuiles vectorielles, polices et pictogrammes de la carte, ADR 0005) est autorisé dans
  `img-src` et `connect-src` (`TILES_ORIGIN`, `src/features/map/map-config.ts`), et `worker-src` accepte `blob:` pour le
  worker de MapLibre. L'analytics et toute autre origine externe restent **bloqués par défaut** : les ajouter
  explicitement dans `next.config.ts` (`img-src`, `connect-src`…) avec la PR qui les introduit.
- Vercel Analytics (`<Analytics />` dans `layout.tsx`) fonctionne en production via `/_vercel/insights` (même origine, donc couvert par `'self'`) ; il doit être activé dans le dashboard Vercel (onglet Analytics). Pensez à l'indiquer dans la politique de confidentialité (RGPD, A-113).
- Après le premier déploiement, passer l'URL de production dans un scanner d'en-têtes
  (https://securityheaders.com) et consigner le résultat ici.
- HSTS est envoyé sans `preload` : n'ajouter `preload` qu'après décision explicite (difficile à annuler).
