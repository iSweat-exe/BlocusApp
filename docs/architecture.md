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
| `(app)`  | `/profil`     | Profil (lecture) : carte identité, compte, permissions, déconnexion| Connecté (Guest → `/login`)                |

`/messages` n'existe pas (route supprimée, A-128) : la communication passe par Instagram. Messagerie = Backlog.

## Authentification (OAuth Discord)

`src/proxy.ts` rafraîchit les cookies de session (`updateSession`) sans jamais rediriger (le Guest lit).
`/login` → lien `<a href="/auth/login/discord">` → Route Handler GET (`src/app/auth/login/discord/route.ts`,
posé du verifier PKCE puis redirection vers Supabase → Discord ; un simple lien fonctionne sans JavaScript, avant
l'hydratation et dans une PWA installée) → Discord → Supabase →
`/auth/callback` (Route Handler : échange PKCE `code` → session en cookies httpOnly, `next` validé par
`safeRedirectPath`) → retour à l'app. `signOut` termine la session. Google = même flux, autre `provider`.

**Page `/login`.** Logo + titre, bouton Discord, bouton Google (`GoogleButton`, `disabled` : pas encore branché), séparateur « ou » puis
`GuestLink` (« Continuer en tant qu'invité » → `/`, lecture seule : le Guest est simplement une visite sans session).

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
revérifie en base ; l'auteur est toujours l'appelant. Le texte est affiché en texte brut (React échappe). Cartes volontairement sobres (bordure, pas de barre
colorée, d'ombre ni de pastille) : date lisible (« Aujourd'hui, 19:35 », « Hier, 15:11 », « 1 oct., 09:00 ») au-dessus du
titre pleine largeur, puis le texte ; la suppression est un bouton discret en pied de carte (seulement si
autorisé) qui demande une confirmation explicite (`delete-announcement-button.tsx`).
Pagination et cache (A-080+) : étape 1.6.

## Barre du bas et design mobile

`src/components/app-nav.tsx` : trois onglets (Accueil, Calendrier, Carte), chacun avec une **icône** (SVG en
ligne, `src/components/icons.tsx`) au-dessus de son libellé, **64 px de haut** (Android demande 48 px, iOS 44 px),
une pastille d'accent derrière l'icône active, un fond flouté et `pb-[env(safe-area-inset-bottom)]` pour ne pas
passer sous l'indicateur d'accueil de l'iPhone (`viewport-fit=cover` est déjà activé). Les survols ne s'appliquent
qu'aux pointeurs qui survolent (`@media (hover: hover)`). Le contenu est une colonne centrée de `max-w-3xl`
(identique sur mobile, centrée sur desktop ; les pages `/profil` et `/admin` y sont aussi).
`globals.css` : variable `--accent`, `min-height: 100dvh`, pas de délai ni de zoom au double toucher
(`touch-action: manipulation`), pas de surbrillance grise au toucher, anneau de focus clavier visible,
`prefers-reduced-motion` respecté. Les dates françaises n'ont que leur première lettre en majuscule
(`first-letter:uppercase`, pas `capitalize`).

## En-tête de l'application

`src/components/app-header.tsx` (dans `(app)/layout.tsx`, sous `<Suspense>` avec un repli de même hauteur) :
barre collante floutée avec la marque à gauche ; à droite, un bouton rond de 44 px **Administration** (icône
bouclier, seulement avec une permission d'administration, `canAccessAdmin`) et un bouton **profil** (avatar Discord
si présent dans les métadonnées du JWT et passé par `safeAvatarUrl`, sinon une icône). Les invités ont un bouton
« Se connecter ». La section courante est marquée `aria-current` (`header-icon-link.tsx`). **La déconnexion n'est
plus dans l'en-tête : elle se trouve sur `/profil`.** Les icônes sont des SVG en ligne (`src/components/icons.tsx`).

## Fenêtre plein écran

`src/components/full-screen-dialog.tsx` : un bouton qui ouvre une fenêtre couvrant tout le viewport
(`<dialog>` natif : piège du focus, Échap et geste « retour » Android pour fermer, focus restitué ; `h-dvh`, marges
`env(safe-area-inset-*)` pour l'iPhone ; défilement de la page bloquée derrière). Le contenu n'est monté que
fenêtre ouverte (formulaire vierge à chaque ouverture). Un formulaire passé en `children` depuis un Server
Component la ferme après un succès avec le hook `useDialogClose()` (pas de fonction en prop). Utilisée pour
« Créer un post » (`announcement-feed.tsx`) et « Ajouter un événement » (`calendar-view.tsx`).

**Design system.** Tokens et classes partagées dans `src/app/globals.css` (couleurs, arrondis, espacements, polices), cf. `docs/conventions.md` et ADR 0004. `src/components/avatar.tsx` affiche la photo de profil (URL contrôlée par `safeAvatarUrl`) ou les initiales.

**Liste déroulante réutilisable.** `src/components/select.tsx` (`<Select label options name? defaultValue? value? onChange? size?>`) : feuille en bas d'écran sur mobile (fermable en la glissant vers le bas, `use-sheet-swipe.ts`), popover dès `sm`, motif ARIA listbox (flèches, Début/Fin, Entrée/Espace, Échap). Dans un formulaire, la valeur part par un `<input type="hidden" name>` : utilisable avec les Server Actions et les formulaires GET. Remplace les `<select>` natifs de l'administration (rôle, durée de ban, filtre du journal).

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

**Événements terminés.** Avec `event.finish`, le détail propose « Marquer comme terminé » / « Rouvrir »
(`setEventFinished` → RPC `set_event_finished`, journalisé). Un événement terminé est **grisé** avec un badge
« Terminé » (liste du jour : texte barré et `aria-disabled`, repère gris dans la grille), son bouton « Modifier »
est désactivé (la RLS refuse aussi la modification par l'auteur), et il n'apparaît plus dans l'encart d'accueil.
Il reste consultable et supprimable.

**Encart « événement imminent »** (accueil, tout en haut, `imminent-events.tsx` + `imminent-banner.tsx`) : un
événement qui démarre dans **moins de 30 minutes** (`IMMINENT_WINDOW_MINUTES`) et n'a pas commencé s'affiche
dans un encart rouge distinct des annonces, avec un compte à rebours (« dans 8 min »), l'heure et le lieu ; un
appui ouvre `/calendar/[id]`, la croix le ferme. Le serveur lit les événements à la requête
(`await connection()`), le client rafraîchit le compte à rebours toutes les 15 s et masque l'encart au début de
l'événement. Les ids fermés sont gardés **par appareil** dans `localStorage` (`blocus.dismissed-events`, 100 max,
lecture/écriture tolérantes aux erreurs : en navigation privée l'encart se ferme pour la visite seulement). Limite
connue : un événement qui devient imminent pendant que la page est déjà ouverte n'apparaît qu'au rechargement.

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
