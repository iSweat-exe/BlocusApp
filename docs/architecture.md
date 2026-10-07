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
| `(app)`  | `/calendar`   | Calendrier : grille de mois (`?month=AAAA-MM&day=AAAA-MM-JJ`) et événements du jour | Lecture : Guest ; écriture : autorisés (`event.create`) |
| `(app)`  | `/calendar/[id]` | Détail d'un événement                 | Lecture : Guest                            |
| `(app)`  | `/map`        | Carte (tracé, position de la manifestation) | Lecture : Guest ; édition : gérants     |
| `(app)`  | `/admin`      | Administration (utilisateurs, rôles)      | Une permission d'administration (`role.assign`, `user.ban`, `user.mute`, `permission.manage`, `audit.read`) ; sinon 404, Guest → `/login` |
| `(app)`  | `/admin/users/[id]` | Fiche utilisateur : sanctions (ban, historique) | Une permission d'administration (sinon 404 ; Guest → `/login`) |
| `(app)`  | `/admin/roles` | Matrice rôle × permission (édition)       | Permission `permission.manage` (sinon 404 ; Guest → `/login`) |
| `(app)`  | `/admin/journal` | Journal d'audit (lecture, filtre, pagination) | Permission `audit.read` (sinon 404 ; Guest → `/login`) |
| `(app)`  | `/profil`     | Profil de l'utilisateur connecté (lecture) | Connecté (Guest → `/login`)                |

`/messages` n'existe pas (route supprimée, A-128) : la communication passe par Instagram. Messagerie = Backlog.

## Authentification (OAuth Discord)

`src/proxy.ts` rafraîchit les cookies de session (`updateSession`) sans jamais rediriger (le Guest lit).
`/login` → lien `<a href="/auth/login/discord">` → Route Handler GET (`src/app/auth/login/discord/route.ts`,
posé du verifier PKCE puis redirection vers Supabase → Discord ; un simple lien fonctionne sans JavaScript, avant
l'hydratation et dans une PWA installée) → Discord → Supabase →
`/auth/callback` (Route Handler : échange PKCE `code` → session en cookies httpOnly, `next` validé par
`safeRedirectPath`) → retour à l'app. `signOut` termine la session. Google = même flux, autre `provider`.

**Connexion Discord sur mobile / PWA.** Une fois la page hydratée, le lien est remplacé par l'URL
`https://discord.com/oauth2/authorize?...` elle-même (obtenue via `GET /auth/login/discord?format=json`, qui
lit la redirection de Supabase sans la suivre, voir `src/features/auth/discord-url.ts`) : un lien touché par
l'utilisateur peut alors ouvrir l'**application Discord** (liens universels / App Links), ce qu'une redirection
serveur ne déclenche pas. Sans JavaScript, le lien reste `/auth/login/discord` (redirection serveur).
**Limites connues, à vérifier sur de vrais téléphones** : sur iOS, une PWA installée n'a pas le même stockage
que Safari, donc si la connexion se termine dans Safari ou via l'application Discord, la session n'arrive pas
dans la PWA (cookie PKCE et session ailleurs) ; sur Android le comportement d'ouverture dans l'application
Discord est un bug connu côté Discord. La solution robuste est un transfert de session par code à usage
unique (non implémenté, voir le suivi dans la checklist).

## Fil d'actualités (accueil)

`/` rend `AnnouncementFeed` (`src/features/announcements/`) sous `<Suspense>`. Lecture via
`src/lib/data/announcements.ts` (client Supabase serveur, RLS autorise `anon` : le Guest lit). Les boutons
« Publier » / « Supprimer » s'affichent d'après les claims JWT (`src/server/session.ts`, affichage seulement).
Les Server Actions `publishAnnouncement` / `deleteAnnouncement` appellent `requirePermission()` puis la RLS
revérifie en base ; l'auteur est toujours l'appelant. Le texte est affiché en texte brut (React échappe).
Pagination et cache (A-080+) : étape 1.6.

## Calendrier

`/calendar` (`src/features/calendar/`) : grille de mois (lundi en premier), repère sur les jours qui ont des
événements, liste du jour sélectionné ; détail sur `/calendar/[id]`. Les horaires sont stockés en **UTC** et
saisis/affichés en **Europe/Paris** (`EVENT_TIME_ZONE` dans `time.ts`, conversion tenant compte de l'heure
d'été). La page dépend de l'heure courante : elle appelle `await connection()` avant `new Date()` (sinon
Next.js refuse le rendu en prérendu). Lecture via `src/lib/data/events.ts` (RLS : le Guest lit).

Écriture (`src/features/calendar/actions.ts`) : `createEvent`, `updateEvent`, `deleteEvent`. Création : bouton
« Ajouter un événement » sous la liste du jour (permission `event.create`, jamais sur un jour passé) ; le
formulaire demande l'heure, le titre, le texte, et en option le lieu et l'heure de fin (même jour). L'auteur
modifie son événement depuis le détail (la date devient modifiable) ; la suppression exige `event.delete`, ou
`event.create` sur ses propres événements. Chaque action revérifie la permission en base (`fresh`), valide la
saisie (`schema.ts`, heures lues en Europe/Paris) et la RLS décide ; le trigger `check_event_start` refuse un
début dans le passé, mais le texte d'un événement déjà commencé reste modifiable.

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
