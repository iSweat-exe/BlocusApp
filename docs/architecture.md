# Architecture

> Document vivant : à mettre à jour dans chaque PR qui change l'architecture.

## Vue d'ensemble

```
Navigateur / PWA (React)
   │  cache client (TanStack Query / SWR) · file d'écriture groupée · compression
   ▼
Vercel (Next.js App Router)
   │  Server Components · Server Actions · Route Handlers · proxy (rafraîchit la session)
   │  cache serveur (tags) · rate limiting
   ▼
Supabase
   Auth · Postgres (RLS + fonctions SQL) · Realtime · Storage
```

## Principes

1. **Lire peu, écrire en lot** : cache client → cache serveur → base de données.
2. **La base est la source de vérité des permissions** (RLS + `has_permission`) ; le serveur les
   revérifie ; l'UI ne fait que masquer.
3. **Dégradation gracieuse** : sous charge on ralentit (file, throttle) au lieu de planter.
4. **Aucun secret côté client** : `SUPABASE_SERVICE_ROLE_KEY` uniquement dans `src/server/`.
5. Contraintes des offres gratuites : voir [`.dev/constraints.md`](../.dev/constraints.md).

## Vision produit

Gestion d'une manifestation dans une ville X : carte avec tracé des déplacements (éditable sur mobile,
outils pour les gérants dont la déclaration de la position actuelle : GPS + heure), accueil = dernières
actualités publiées par les personnes autorisées. Connexion Discord / Google ou mode Guest (lecture seule).
Pas de messagerie pour l'instant (communication via Instagram). Notifications push PWA iOS/Android :
priorité après l'authentification (A-135).

## Routes

| Groupe   | Route         | Contenu                                  | Accès                                      |
| -------- | ------------- | ---------------------------------------- | ------------------------------------------ |
| `(auth)` | `/login`      | Connexion (Discord, Google)              | Public                                     |
| `(auth)` | `/register`   | Inscription                              | Public                                     |
| `(app)`  | `/`           | Accueil (actualités)                     | Lecture : Guest ; publication : autorisés  |
| `(app)`  | `/calendar`   | Calendrier (jours et détails)            | Lecture : Guest ; écriture : autorisés     |
| `(app)`  | `/map`        | Carte (tracé, position de la manifestation) | Lecture : Guest ; édition : gérants     |
| `(app)`  | `/admin`      | Administration (utilisateurs, rôles)      | Une permission d'administration (`role.assign`, `user.ban`, `user.mute`, `permission.manage`, `audit.read`) ; sinon 404, Guest → `/login` |
| `(app)`  | `/admin/users/[id]` | Fiche utilisateur : sanctions (ban, historique) | Une permission d'administration (sinon 404 ; Guest → `/login`) |
| `(app)`  | `/admin/roles` | Matrice rôle × permission (édition)       | Permission `permission.manage` (sinon 404 ; Guest → `/login`) |
| `(app)`  | `/profil`     | Profil de l'utilisateur connecté (lecture) | Connecté (Guest → `/login`)                |

`/messages` n'existe pas (route supprimée, A-128) : la communication passe par Instagram. Messagerie = Backlog.

## Authentification (OAuth Discord)

`src/proxy.ts` rafraîchit les cookies de session (`updateSession`) sans jamais rediriger (le Guest lit).
`/login` → Server Action `signInWithDiscord` (`src/features/auth/actions.ts`) → Discord → Supabase →
`/auth/callback` (Route Handler : échange PKCE `code` → session en cookies httpOnly, `next` validé par
`safeRedirectPath`) → retour à l'app. `signOut` termine la session. Google = même flux, autre `provider`.

## Fil d'actualités (accueil)

`/` rend `AnnouncementFeed` (`src/features/announcements/`) sous `<Suspense>`. Lecture via
`src/lib/data/announcements.ts` (client Supabase serveur, RLS autorise `anon` : le Guest lit). Les boutons
« Publier » / « Supprimer » s'affichent d'après les claims JWT (`src/server/session.ts`, affichage seulement).
Les Server Actions `publishAnnouncement` / `deleteAnnouncement` appellent `requirePermission()` puis la RLS
revérifie en base ; l'auteur est toujours l'appelant. Le texte est affiché en texte brut (React échappe).
Pagination et cache (A-080+) : étape 1.6.

## PWA

`src/app/manifest.ts`, `public/sw.js` (enregistré en production par
`src/components/service-worker-register.tsx`), icônes dans `public/icons/`. Détails et reste à faire :
étape 1.10 de la checklist.

## Cache (cartographie — à compléter à l'étape 1.6)

| Donnée                  | Couche               | TTL | Invalidation          |
| ----------------------- | -------------------- | --- | --------------------- |
| Permissions de l'user   | Claims JWT           | —   | Refresh du token      |
| Profils                 | Client + serveur     | TBD | Après écriture (tag)  |
| Événements du calendrier| Client + serveur     | TBD | Après écriture (tag)  |
