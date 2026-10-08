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
| `(app)`  | `/map`        | Carte : fond OpenFreeMap (MapLibre, ADR 0005), tracé (lecture et édition au doigt), « Me localiser » et position déclarée | Lecture : Guest ; tracé : `map.route.edit` ; position : `map.position.declare` |
| `(app)`  | `/admin`      | Administration (utilisateurs, rôles)      | Une permission d'administration (`role.assign`, `user.ban`, `user.mute`, `permission.manage`, `audit.read`) ; sinon 404, Guest → `/login` |
| `(app)`  | `/admin/users/[id]` | Fiche utilisateur : sanctions (ban, historique) | Une permission d'administration (sinon 404 ; Guest → `/login`) |
| `(app)`  | `/admin/roles` | Matrice rôle × permission (édition)       | Permission `permission.manage` (sinon 404 ; Guest → `/login`) |
| `(app)`  | `/admin/journal` | Journal d'audit (lecture, filtre, pagination) | Permission `audit.read` (sinon 404 ; Guest → `/login`) |
| `(app)`  | `/settings`   | Réglages : couleur de l'application (préréglages + couleur libre), raccourci profil/connexion | Public (réglages stockés sur l'appareil) |
| `(app)`  | `/profil`     | Profil (lecture) : carte identité, compte, permissions, déconnexion| Connecté (Guest → `/login`)                |

`/messages` n'existe pas (route supprimée, A-128) : la communication passe par Instagram. Messagerie = Backlog.

## Authentification (OAuth Discord et Google)

`src/proxy.ts` rafraîchit les cookies de session (`updateSession`) sans jamais rediriger (le Guest lit). Il ne s'exécute
que pour les requêtes qui portent un cookie de session (`blocus-auth`, `src/lib/supabase/cookie.ts`) et ni pour les
préchargements ni pour les fichiers statiques : voir `docs/performance.md` (« Quotas Vercel Hobby »).
`/login` → lien `<a href="/auth/login/discord">` → Route Handler GET (`src/app/auth/login/discord/route.ts`,
posé du verifier PKCE puis redirection vers Supabase → Discord ; un simple lien fonctionne sans JavaScript, avant
l'hydratation et dans une PWA installée) → Discord → Supabase →
`/auth/callback` (Route Handler : échange PKCE `code` → session en cookies httpOnly, `next` validé par
`safeRedirectPath`) → retour à l'app. La déconnexion est un `<form method="post" action="/auth/logout">` (Route Handler `src/app/auth/logout/route.ts`, redirection 303 vers `/login`) : pas de Server Action, donc rien qui dépende des identifiants d'actions du build. Google = même flux (`src/app/auth/login/google/route.ts`), sans l'étape mobile propre à Discord.

**Page `/login`.** Logo + titre, bouton Discord, bouton Google (`GoogleButton`, lien `/auth/login/google`), séparateur « ou » puis
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

`src/components/app-nav.tsx` : quatre onglets (Accueil, Calendrier, Carte, Réglages), chacun avec une **icône** (SVG en
ligne, `src/components/icons.tsx`) au-dessus de son libellé, **64 px de haut** (Android demande 48 px, iOS 44 px),
une pastille d'accent derrière l'icône active, un fond flouté et la marge `pb-safe-bottom` (token de `globals.css` :
`max(env(safe-area-inset-bottom), 2rem)`) pour ne pas passer sous l'indicateur d'accueil de l'iPhone (`viewport-fit=cover`
est déjà activé) ni coller au bord sur Android, dont les navigateurs et PWA renvoient souvent 0 pour `env()` alors que
la barre de gestes ou de navigation occupe le bas de l'écran. Même token pour les feuilles (`Select`, dialogues). Les survols ne s'appliquent
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

`src/components/full-screen-dialog.tsx` : un bouton qui ouvre une **feuille** (style modale native) couvrant l'écran
sous la barre d'état : coins supérieurs arrondis, poignée, fond assombri, animation de montée **fluide** (Web Animations API lancée explicitement à l'ouverture, contenu monté et focus posé avant que la feuille soit poussée hors écran ; le `<dialog>` est en `overflow: clip` et non `hidden`, car une boîte `hidden` reste défilable et Safari iOS la faisait défiler pour montrer l'élément focus pendant la montée, ce qui faisait sauter la feuille vers le haut ; l'animation d'ouverture ne garde pas son état final, sinon elle écrase le `transform` du geste de balayage ; pas d'animation CSS dépendante du `display` du `<dialog>`, que Safari iOS saute quand la première frame est chargée) et animation de descente à la fermeture (bouton, zone assombrie, Échap, geste « retour » ; désactivées si `prefers-reduced-motion`), **fermeture en la
glissant vers le bas** (depuis l'en-tête, ou depuis le contenu défilé tout en haut : `use-sheet-swipe.ts`, le même que
la feuille du `Select`) ou en touchant la zone assombrie. `<dialog>` natif : piège du focus, Échap et geste « retour »
Android pour fermer, focus restitué (le contenu reçoit le focus à l'ouverture, pas le bouton de fermeture) ;
`env(safe-area-inset-*)` pour l'iPhone ; défilement de la page bloquée derrière ; panneau centré dès `sm`. Le contenu
n'est monté que fenêtre ouverte (formulaire vierge à chaque ouverture). Un formulaire passé en `children` depuis un
Server Component la ferme après un succès avec `useDialogClose()` (pas de fonction en prop) et épingle son bouton
d'action en bas avec la classe `.form-actions` quand `useInDialog()` est vrai. Utilisée pour « Créer un post »
(`announcement-feed.tsx`) et « Ajouter un événement » (`month-view.tsx`).

**Carte.** Le tracé (`map_route_versions`, `src/lib/data/map.ts`, lecture partagée par le cache de 2 min, étiquette `map-route`) est dessiné par `route-layers.ts` : ligne avec contour blanc, marqueurs de départ et d'arrivée. Les gérants (`map.route.edit`) voient « Modifier le tracé » : **éditeur au doigt** (`route-editor-state.ts`, un réducteur pur testé : ajouter, déplacer, supprimer, annuler / rétablir jusqu'à 100 pas, un glissement = un pas). Un **viseur au centre** de la carte place un point (« Ajouter ici », après le point sélectionné ou en fin de ligne) ou déplace le point sélectionné (« Déplacer ici ») ; on peut aussi glisser un point (cible tactile de 44 px, la carte ne se déplace pas pendant le glissement, `use-route-editing.ts`). « Enregistrer » appelle l'action `saveMapRoute` (`map.route.edit` revérifiée en base, points revalidés, `updateTag('map-route')`) avec la version de départ : si quelqu'un a enregistré entre-temps, rien n'est écrasé et l'éditeur propose de recharger. Fermer avec des modifications demande confirmation. **Position de la manifestation** (`map_positions`, `src/lib/data/map-positions.ts`, lecture partagée 30 s (profil `live`), étiquette `map-positions`) : Le repère est un **bouton HTML** (`position-marker.ts`, disque à la couleur d'accent, bordure blanche, anneau qui pulse : visible aussi en thème sombre) ; **toucher le repère ouvre la fiche d'information** (`position-info.tsx`) visible par tous : lieu, « Déclarée il y a 5 min · 14:32 », « Peut-être dépassée » après 3 h, coordonnées, lien « Voir le plan » (OpenStreetMap) et « Historique » (les 20 dernières, les retirées marquées). **La personne qui a déclaré la position peut la retirer** (« Retirer la position », avec confirmation ; `removeMapPosition`, le serveur calcule `canRemovePosition` : l'identifiant de l'auteur n'est jamais envoyé au navigateur) ; les titulaires de `map.position.remove` aussi. Les gérants (`map.position.declare`) ont « Position » : viseur au centre, libellé facultatif, **« Ma position »** (déplace seulement la carte vers leur GPS pour vérifier, **rien n'est envoyé**) et **« Déclarer ici »** (action `declareMapPosition`, permission revérifiée en base, une déclaration toutes les 5 s au plus). Le reste de la carte : `MapLoader` (`next/dynamic`, sans SSR) charge `MapView` (MapLibre GL JS 6) seulement sur `/map`. Style OpenFreeMap (`liberty` clair, `positron` inversé en sombre via `.map-dark`, qui suit le thème forcé ou système avec `useMapTheme`), attribution OSM repliée, rotation au doigt désactivée, bouton « Me localiser » (position affichée **sur l'appareil uniquement**, jamais envoyée). Fournisseur, vue initiale (`DEFAULT_VIEW`, à remplacer par la ville X) et zoom dans `map-config.ts`. Le worker de MapLibre est un fichier émis par le bundler (`setWorkerUrl`), servi depuis notre origine. Sans WebGL ou si le style ne se charge pas : message d'erreur. CSP : voir `docs/security.md`.

**Couleur d'accent personnalisable.** `/settings` (`src/features/settings/`) : l'utilisateur choisit un préréglage ou une couleur libre ; elle est stockée dans `localStorage` (`blocus.accent`, `#rrggbb` validé par `normalizeHex`) et posée en variables CSS `--accent`, `--accent-strong`, `--accent-ink` sur `<html>`. Un script inline dans `<head>` (`accent-script.ts`, autorisé par la CSP actuelle `'unsafe-inline'`) l'applique avant le premier rendu, sans flash rouge. Réglage local à l'appareil, sans base de données (synchro entre appareils = hors périmètre).

**Pas de zoom (application à 100 %).** Décision produit : l'application se comporte comme une application native, sans zoom par pincement ni double tap. Trois couches, car aucune ne suffit seule : (1) `viewport` de `layout.tsx` : `width=device-width`, `initial-scale=1`, `minimum-scale=1`, `maximum-scale=1`, `user-scalable=no` (respecté par Android) ; (2) `touch-action: pan-x pan-y` sur `html` (`globals.css`) : le défilement reste possible, le zoom non ; la carte reste zoomable car MapLibre gère son propre pincement en JavaScript et pose `touch-action: none` sur son canevas ; (3) `NoZoom` (`src/components/no-zoom.tsx`) annule les événements `gesturestart` / `gesturechange` d'iOS Safari, qui ignore `user-scalable=no`. Sur écran tactile, les champs de saisie sont forcés à **16 px** (règle sans calque dans `globals.css`) : en dessous, iOS zoome sur le champ au focus. **Accessibilité** : bloquer le zoom empêche d'agrandir le texte par pincement (WCAG 1.4.4) ; les tailles de texte du design system doivent rester lisibles, et le réglage de taille de police du système continue de s'appliquer. Pour revenir en arrière : retirer ces trois éléments.

**Thème clair / sombre / système.** Sur `/settings`, un contrôle segmenté (`theme-picker.tsx`) stocke le choix dans `localStorage` (`blocus.theme`, `light` ou `dark` ; absent = système) et pose `data-theme` sur `<html>`. `globals.css` force alors les variables claires ou sombres ; sans attribut, `prefers-color-scheme` décide. Un script inline (`theme-script.ts`) l'applique avant le premier rendu et aligne les balises `theme-color` (barre du navigateur). `color-scheme` est aussi posé pour les contrôles natifs.

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
