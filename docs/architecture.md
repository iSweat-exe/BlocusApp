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
Pas de messagerie pour l'instant (communication via Instagram). Notifications push PWA iOS/Android (A-135,
ADR 0010) : un abonnement par appareil, envoyé quand un post devient public.

## Notifications push (A-135, ADR 0010)

- **Abonnement** : Réglages > Notifications (`src/features/push/notifications-section.tsx`, `push-settings.tsx`). Le
  bouton « Activer » demande la permission **sur le geste de l'utilisateur** (obligatoire sur iOS), s'abonne avec la clé
  publique VAPID (`PushManager.subscribe`, `userVisibleOnly: true`) puis enregistre l'abonnement par la Server Action
  `savePushSubscription` → fonction SQL `save_push_subscription`. Sur iPhone / iPad tant que l'app n'est pas ajoutée à
  l'écran d'accueil, la section explique comment l'installer (iOS ne propose le push qu'aux apps installées). Rien n'est
  demandé au chargement d'une page. Un invité est invité à se connecter (l'abonnement appartient à un compte).
- **Envoi** : `publishAnnouncement` / `updateAnnouncement` appellent `broadcastPush` (`src/server/push.ts`) dans
  `after()`, donc après la réponse à l'auteur, **seulement quand un post devient public** (pas pour un brouillon, un
  post privé ni une simple modification). Lecture de tous les abonnements avec la clé `service_role`, envoi par lots de
  20 avec la librairie `web-push` (chiffrement RFC 8291, signature VAPID), TTL 24 h. Les abonnements que le service de
  push déclare disparus (404 / 410) sont supprimés. Sans clés VAPID, l'envoi est ignoré et la section est masquée.
- **Message** : JSON au format *Declarative Web Push* (`web_push: 8030`), que Safari 18.4+ affiche même sans service worker ;
  les autres navigateurs le passent à `public/sw.js`, qui lit le même champ `notification`, affiche **toujours** une
  notification (Safari retire la permission à un site qui reçoit un push sans rien afficher) et, au toucher, ouvre ou
  ramène l'application (adresses du même site uniquement).

## Onboarding (première ouverture, A-138)

- **Où** : `src/features/onboarding/`. `OnboardingGate` (Server Component, dans `src/app/(app)/layout.tsx`, sous `Suspense`) ne monte
  `Onboarding` que pour une personne **connectée** (l'invité est en lecture seule : ni compte, ni notifications). La session est lue
  par `getSessionPermissions()`, déjà partagée avec l'en-tête.
- **Forme** : une feuille plein écran (`<dialog>` natif : focus piégé, Échap et geste retour = « Passer »), barre de progression,
  bouton principal épinglé en bas, entrée en cascade (100 ms) de l'écran d'accueil, `prefers-reduced-motion` respecté.
- **Étapes** : Bienvenue (Accueil, Calendrier, Carte) → Installer l'app → Notifications → Thème et couleur. Les étapes inutiles
  sont retirées (`buildSteps`) : « Installer » seulement s'il y a une invite native (Chrome / Edge, `beforeinstallprompt` gardée
  par `install.ts`) ou sur Safari iOS (guide Partager > Sur l'écran d'accueil) ; « Notifications » seulement si l'appareil les
  supporte (réutilise `PushSettings`, donc la même logique d'abonnement) ; « Thème » réutilise `ThemePicker` et `AccentPicker`.
- **Mémoire** : `localStorage` (`blocus.onboarding.v1`), **par appareil** : l'installation et les notifications sont par appareil,
  un nouveau téléphone le revoit. Stockage bloqué : considéré comme terminé (on ne harcèle pas à chaque page). Changer la version
  de la clé le réaffiche à tout le monde. Aucune table, aucune migration.
- **Limite connue** : si le navigateur déclenche `beforeinstallprompt` avant le montage de l'onboarding, l'étape d'installation
  n'apparaît pas (le bouton reste disponible dans le menu du navigateur).

## Routes

| Groupe   | Route         | Contenu                                  | Accès                                      |
| -------- | ------------- | ---------------------------------------- | ------------------------------------------ |
| `(auth)` | `/login`      | Connexion (Discord, Google)              | Public                                     |
| `(auth)` | `/register`   | Inscription                              | Public                                     |
| `(app)`  | `/`           | Accueil (actualités)                     | Lecture : Guest ; publication : autorisés  |
| `(app)`  | `/calendar`   | Calendrier : grille de mois (`?month=AAAA-MM&day=AAAA-MM-JJ`) et événements du jour | Lecture : Guest ; écriture : autorisés (`event.create`) |
| `(app)`  | `/calendar/[id]` | Détail d'un événement                 | Lecture : Guest                            |
| `(app)`  | `/map`        | Carte : fond OpenFreeMap (MapLibre, ADR 0005), tracé (lecture et édition au doigt), « Me localiser » et position déclarée | Lecture : Guest ; tracé : `map.route.edit` ; position : `map.position.declare` |
| `(app)`  | `/admin`      | Administration : utilisateurs (recherche, filtre par rôle, liste) | Une permission d'administration (`role.assign`, `user.ban`, `permission.manage`, `audit.read`, `monitoring.view`, `statistics.view`) ; sinon 404, Guest → `/login` |
| `(app)`  | `/admin/statistics` | Statistiques : chiffres clés, activité et inscriptions par heure (24 h / 7 j / 30 j), heures de pointe, répartition des comptes, contenu | `statistics.view` (sinon 404 ; Guest → `/login`) |
| `(app)`  | `/admin/health` | Santé de l'application : score en jauge, services avec état coloré, tables, utilisateurs, historique, configuration | `monitoring.view` (sinon 404 ; Guest → `/login`) |
| `(app)`  | `/admin/users/[id]` | Fiche utilisateur : dernière activité (`user.activity.view`), origine d'inscription (`user.origin.view`), rôle, sanctions (ban, historique) | Une permission d'administration (sinon 404 ; Guest → `/login`) |
| `(app)`  | `/admin/roles` | Rôles et permissions : un rôle à la fois (onglets), permissions groupées, interrupteurs | Permission `permission.manage` (sinon 404 ; Guest → `/login`) |
| `(app)`  | `/admin/journal` | Journal d'audit : par jour, filtre par catégorie, pagination | Permission `audit.read` (sinon 404 ; Guest → `/login`) |
| `(app)`  | `/credits`    | Crédits : l'équipe de développement avec son GitHub, les technologies utilisées | Public (Guests et connectés) ; ligne « Crédits » dans `/settings` (À propos) et `/profil`, petit lien sur `/login` |
| `(app)`  | `/settings`   | Réglages : couleur de l'application (préréglages + couleur libre), raccourci profil/connexion | Public (réglages stockés sur l'appareil) |
| `(app)`  | `/profil`     | Profil (lecture) : carte identité, compte, permissions, déconnexion| Connecté (Guest → `/login`)                |
| `(app)`  | `/mentions-legales`, `/confidentialite`, `/cgu` | Mentions légales, politique de confidentialité (données, cookies, durées, droits), conditions d'utilisation | Public (Guests et connectés) ; liens dans `/settings` (À propos), mention sous les boutons de `/login` |
| `api`    | `GET /api/me/export` | Export JSON des données de la personne connectée (`export_my_data()`) | Connecté (Guest → 401), jamais mis en cache |

`/messages` n'existe pas (route supprimée, A-128) : la communication passe par Instagram. Messagerie = Backlog.

## Pages légales et droits RGPD (A-113)

- **Textes** : `src/app/(app)/{mentions-legales,confidentialite,cgu}/page.tsx`, composants communs dans `src/features/legal/`
  (`legal-page.tsx`). Les faits qu'ils énoncent (éditeur, pays, e-mail de contact, date de mise à jour, prestataires et lieu des
  données) sont **uniquement** dans `src/features/legal/legal-info.ts` : un texte modifié se relit, une information se change à un
  seul endroit. Une valeur restée à « À COMPLÉTER » s'affiche surlignée, et `legal.test.tsx` échoue tant qu'il en reste.
- **Acceptation** : phrase « En continuant, tu acceptes… » sous les boutons de `/login` (`LegalConsentNote`), sans case à cocher
  ni étape en plus ; pas de bannière de cookies (seuls des cookies strictement nécessaires, voir la politique).
- **Accès et portabilité** : `GET /api/me/export` appelle la fonction SQL `export_my_data()` (`SECURITY DEFINER`, l'identifiant vient
  du JWT) et renvoie un fichier JSON ; bouton « Télécharger » dans Réglages > Mes données (`MyDataSection`, connectés seulement).
- **Effacement** : Réglages > Mes données > « Supprimer mon compte » (mot de confirmation `SUPPRIMER`), Server Action
  `deleteMyAccount` (`src/features/legal/actions.ts`) : supprime les photos du bucket `announcement-images` (`<id>/…`), puis
  l'utilisateur Auth par l'API admin (`service_role`, l'identifiant vient de la session) ; le profil et ses dépendances partent en
  cascade, les posts, événements et positions restent sans auteur (`on delete set null`). Un super administrateur ne peut pas
  supprimer son compte. Si Storage échoue, le compte n'est pas supprimé.

## Authentification (OAuth Discord et Google)

`src/proxy.ts` rafraîchit les cookies de session (`updateSession`) sans jamais rediriger (le Guest lit). Il ne s'exécute
que pour les requêtes qui portent un cookie de session (`blocus-auth`, `src/lib/supabase/cookie.ts`) et ni pour les
préchargements ni pour les fichiers statiques : voir `docs/performance.md` (« Quotas Vercel Hobby »).
`/login` → lien `<a href="/auth/login/discord">` → Route Handler GET (`src/app/auth/login/discord/route.ts`,
posé du verifier PKCE puis redirection vers Supabase → Discord ; un simple lien fonctionne sans JavaScript, avant
l'hydratation et dans une PWA installée) → Discord → Supabase →
`/auth/callback` (Route Handler : échange PKCE `code` → session en cookies httpOnly, `next` validé par
`safeRedirectPath` ; pour un compte qui vient d'être créé, le pays, la région et la ville annoncés par Vercel sont aussi notés, voir « Origine d'inscription » dans `docs/security.md`) → retour à l'app. La déconnexion est un `<form method="post" action="/auth/logout">` (Route Handler `src/app/auth/logout/route.ts`, redirection 303 vers `/login`) : pas de Server Action, donc rien qui dépende des identifiants d'actions du build. Google = même flux (`src/app/auth/login/google/route.ts`), sans l'étape mobile propre à Discord.

**Verifier PKCE par flux.** Chaque démarrage OAuth (lien Discord pré-chargé, lien Google, autre onglet) stocke son propre
verifier dans un cookie `blocus-auth-flow-<id>-code-verifier` (5 au maximum) et ajoute `sb_flow_id=<id>` au `redirectTo`
(`auth.experimental.appendPkceFlowIdToRedirects` dans `src/lib/supabase/server.ts`). `/auth/callback` passe cet id à
`exchangeCodeForSession`. Sans lui, c'est le dernier verifier écrit qui était utilisé : un second démarrage OAuth écrasait
celui du lien déjà affiché et l'échange échouait avec `bad_code_verifier`. Les `Redirect URLs` de Supabase doivent donc finir
par `**` (`docs/runbook.md`).

**Page `/login`.** Titre de marque « BLOCUS. » (en Archivo ExtraBold, masqué aux lecteurs d'écran : le vrai titre de la page est un `h1` `sr-only` « Connexion »), bouton Discord, bouton Google (`GoogleButton`, lien `/auth/login/google`), séparateur « ou » puis
`GuestLink` (« Continuer en tant qu'invité » → `/`, lecture seule : le Guest est simplement une visite sans session). Chaque bouton porte une icône décorative de 20 px (`aria-hidden` : le texte nomme le lien) : logo Discord et logo Google en SVG inline dans leur composant, œil (`EyeIcon`) pour l'invité (consultation seule). Le fond est une photo (`LoginBackground`, trois images WebP de `public/images/login/`, de 20 à 85 Ko, tirée au hasard) fondue vers le haut à 35 % d'opacité (`.login-bg`), claire ou sombre. Elle est choisie **côté client seulement** : le serveur n'en rend rien, donc `/login` reste statique et aucune autre image ne peut clignoter ; le navigateur ne télécharge qu'un seul fichier, en fond CSS (pas de `next/image`, donc pas de quota d'optimisation d'images), et elle apparaît en fondu. Ce sont des **images provisoires** (Lorem Picsum, voir `docs/credits.md`). La page a une hauteur minimale d'écran (`min-h-dvh`) mais **défile** si le contenu est plus haut (mode paysage, grande police système, message d'erreur) : ne pas figer la hauteur ni masquer le débordement, le zoom étant bloqué (voir « Pas de zoom »). Les polices sont celles de toute l'application (Inter pour le texte, Archivo pour l'affichage, voir « Design system »).

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
Réactions (ADR 0009) : sous chaque post public, `ReactionBar` (composant client, `reaction-bar.tsx`) affiche une
pastille par emoji déjà utilisé (surlignée si le visiteur l'a choisi) et un bouton « + » qui ouvre la palette de 8
emojis. Le clic met l'écran à jour tout de suite (`useOptimistic`) puis appelle la Server Action `toggleReaction`
(`reaction-actions.ts`) ; en cas de refus, le changement est annulé et la raison affichée. Les totaux viennent de
`src/lib/data/reactions.ts` (cache partagé 2 min, tag `reactions`, expiré par chaque réaction et par « Actualiser ») ;
les réactions du visiteur sont lues hors cache. Un Guest voit les totaux sans pouvoir réagir ; brouillons et posts
privés n'ont pas de réactions.
Posts v2 (ADR 0007) : le fil public vient de la vue `announcement_feed` (cache partagé de 2 min). Les titulaires de
`announcement.publish` ont en plus, hors cache, leurs brouillons et posts privés (section « Mes brouillons et posts
privés ») et un bouton « Modifier » sur leurs posts (`updateAnnouncement`, formulaire prérempli dans la feuille plein
écran). Le formulaire permet une photo (compressée dans le navigateur avant l'envoi, `compress-image.ts`), une
visibilité (Brouillon / Privé / Public) et « Afficher l'auteur » (pseudo et avatar visibles de tous sur ce post).
Un post modifié affiche « · modifié ». L'action vérifie la taille (300 Ko), le format réel et les dimensions de
l'image, la range dans le dossier de l'auteur et efface l'ancienne.
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
barre collante floutée avec la marque « BLOCUS. » (en Archivo ExtraBold, nommée par son texte visible : le point est
`aria-hidden`) à gauche ; à droite, le bouton **Actualiser**, un bouton carré arrondi de 44 px **Administration**
(icône bouclier, seulement avec une permission d'administration, `canAccessAdmin`) et un bouton **profil** (avatar
Discord si présent dans les métadonnées du JWT et passé par `safeAvatarUrl`, sinon une icône ; l'avatar remplit le
bouton, `size="fill"`). Les invités ont un bouton « Se connecter ». Tout ce qui se touche garde **44 px** minimum
(`min-h-tap`). La section courante est marquée `aria-current` (`header-icon-link.tsx`). **La déconnexion n'est
plus dans l'en-tête : elle se trouve sur `/profil`.** Les icônes sont des SVG en ligne (`src/components/icons.tsx`).
Le bouton Actualiser reste désactivé et son icône tourne **jusqu'à la fin de l'action serveur** (la transition doit
renvoyer la promesse de `refreshPublicData`, sinon l'état d'attente s'arrête aussitôt). Les icônes de la barre
d'onglets jouent une courte animation au toucher (`--animate-*` de `globals.css`, jamais en `!important` : la règle
`prefers-reduced-motion` de `globals.css` doit pouvoir les neutraliser).

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

**Design system.** Tokens et classes partagées dans `src/app/globals.css` (couleurs, arrondis, espacements, polices), cf. `docs/conventions.md` et ADR 0004. `src/components/avatar.tsx` affiche la photo de profil (URL contrôlée par `safeAvatarUrl`) ou les initiales, en carré arrondi (`rounded-control`, comme les boutons) ; seules les pastilles (`.chip`) restent rondes. **Polices** (deux familles, toutes variables, chargées avec `next/font`) : **Inter** pour le texte (`--font-sans`, police par défaut de `body`) et **Archivo** pour l'affichage (`--font-display`, utilitaire `font-display`) : la marque « BLOCUS. » et tous les titres `h1` à `h3`, via une règle de la couche `base` de `globals.css` ; `.section-title` (petite étiquette en majuscules) reste en Inter. Geist Mono sert aux écrans de données (`font-mono`, chargée à la demande). **Graisses** : 400 pour le texte, 500 pour le texte secondaire, 600 pour les étiquettes et les boutons, 600 à 800 pour l'affichage (`.page-title` et la marque en 800). Une seule police variable par famille : changer de graisse ne coûte aucun fichier de plus.

**Onglets en pastilles réutilisables.** `src/components/chip-tabs.tsx` (`<ChipTabs label tabs activeKey>`) : une navigation entre pages (des liens, donc chaque onglet est une vraie URL) en pastilles ; la liste défile sur le côté sur petit écran et l'onglet courant est recentré. Deux variantes : `chips` (filtre dans une page : sélecteur de rôles, filtre du journal, filtre par rôle des utilisateurs) et `underline` (navigation d'une section : onglets soulignés avec icône, utilisée par la navigation de l'administration).

**Liste déroulante réutilisable.** `src/components/select.tsx` (`<Select label options name? defaultValue? value? onChange? size?>`) : feuille en bas d'écran sur mobile (fermable en la glissant vers le bas, `use-sheet-swipe.ts`), popover dès `sm`, motif ARIA listbox (flèches, Début/Fin, Entrée/Espace, Échap). Dans un formulaire, la valeur part par un `<input type="hidden" name>` : utilisable avec les Server Actions et les formulaires GET. Remplace les `<select>` natifs de l'administration (rôle, durée de ban).

## Santé de l'application (`/admin/health`, ADR 0006)

`HealthView` (`src/features/health/health-view.tsx`) mesure à chaque visite : latence de la base (lecture publique
minimale) et d'Auth (`/auth/v1/health`), compteurs SQL `health_stats()` (inscrits, actifs sur 15 min, taille de la
base), dernier déploiement de production via l'API Vercel (`vercel.ts`, « non configuré » sans jeton), les détails SQL
(`health_trends()`, `health_tables()`, `health_connections()` : disponibilité et p95 sur 7 jours, âge du dernier
passage du cron, tables les plus lourdes, connexions), la configuration d'environnement (`config.ts`, présence
seulement), puis calcule le score (`score.ts`, 7 facteurs, pondérations dans sa TSDoc). Elle enregistre un instantané (`record_health_snapshot()`, au plus
un toutes les 10 min) et dessine l'historique des 30 jours. La page est dynamique (`connection()`), derrière
`monitoring.view` (404 sinon) ; les fonctions SQL revérifient la permission. Le cron quotidien de `/api/keep-alive`
enregistre aussi un instantané avec la clé `service_role` (`cron-snapshot.ts`, sans effet si la clé manque).
**Présentation** : `HealthView` mesure puis délègue à `HealthDashboard` (pur : un rapport et un historique, testable avec n'importe quelles données). Le score est une **jauge circulaire** colorée par l'état (Opérationnel, Dégradé, Critique) ; les services sont des **lignes** avec une pastille d'état (vert, orange, rouge, gris si la mesure n'existe pas) et, pour le stockage et les connexions, une barre de la part utilisée ; les tables sont dessinées face à la plus lourde, l'historique prend la couleur de l'état courant (le rouge de la marque est évité : ici le rouge veut dire « critique »). Les couleurs viennent de `health-tones.ts`, qui lit les **mêmes seuils que le score** (`THRESHOLDS` dans `score.ts`) : la page et le score ne peuvent pas diverger. La couleur ne porte jamais seule l'information : chaque valeur est suivie d'un mot pour les lecteurs d'écran (« état bon », « à surveiller », « état critique », « non mesuré »).

`GET /api/health` (public, statut seul, 503 si la base ou Auth ne répond pas, réponse gardée 10 s) sert à un
moniteur externe.

## Statistiques (`/admin/statistics`, ADR 0008)

`StatisticsView` (`src/features/statistics/statistics-view.tsx`) lit en parallèle `stats_overview()`, `stats_activity(720)`,
`stats_breakdown()` et les rôles, chaque lecture pouvant échouer seule, puis délègue à `StatisticsDashboard` (pur : des
données et une période, testable avec n'importe quelles données). La page est dynamique (`connection()`), derrière
`statistics.view` (404 sinon) ; les fonctions SQL revérifient la permission. Sections : **vue d'ensemble** (inscrits,
inscriptions, actifs sur 24 h / 7 j / 30 j avec leur part des inscrits, bannis), **évolution** (onglets de période
`?period=24h|7d|30d`, validé par `parsePeriod` ; courbe des utilisateurs actifs par heure avec pic et moyenne, barres des
inscriptions par heure), **heures de pointe** (moyenne par heure de la journée, heure de Paris, sur 30 jours,
`hourOfDayProfile`), **répartition** (rôles, méthode d'inscription, pays) et **contenu** (posts, événements, positions).

Les graphiques sont des **SVG écrits à la main** (`charts.tsx`, géométrie pure et testée dans `chart.ts`), sans
bibliothèque : une courbe de 720 points pèse ~9 Ko, les barres des inscriptions ne dessinent que les heures non nulles.
Chaque graphique porte un `aria-label` (pic, total) ; le profil par heure a une liste lisible par les lecteurs d'écran.

**Comment l'activité est mesurée.** Le proxy (`src/lib/supabase/middleware.ts`) appelle `touch_activity()` après le
rafraîchissement de la session, **au plus une fois par heure et par navigateur** (cookie `blocus-seen`, qui porte
l'heure UTC et l'utilisateur : un second compte sur le même navigateur est compté), via `event.waitUntil` : la page n'attend pas, et une erreur (migration pas encore appliquée, réseau) est
ignorée. La base compte chaque utilisateur une seule fois par heure. « En ligne par heure » veut donc dire
**utilisateurs distincts vus pendant l'heure**, pas des connexions simultanées (la présence Realtime est écartée :
ADR 0006). Les heures d'avant le déploiement ne sont pas mesurées (`tracked = false`) : la courbe y est vide, et les
moyennes les ignorent. L'heure en cours n'est pas terminée : elle n'entre pas dans le profil par heure de la journée.

## Petites attentions : 404, états vides, crédits, thème de profil, compteur d'inscrits

- **404** (`src/app/not-found.tsx`) : un grand « 404 », le titre **Page introuvable** (le test e2e s'appuie dessus), une phrase
  légère (« Cette page s'est perdue dans le cortège ») et toujours une sortie (accueil, carte).
- **États vides** : composant `EmptyState` (`src/components/empty-state.tsx` : icône ronde décorative, titre, aide ; variante
  `compact` dans une liste), utilisé pour le fil sans annonce et un jour sans événement. L'administration garde des textes
  factuels.
- **Crédits** (`/credits`, `src/features/credits/`) : page publique et statique. La liste des développeurs est dans
  `team.ts` (**uniquement des identifiants GitHub publics**, jamais d'e-mail ; en ajouter un = une ligne) ; liens
  externes en `target="_blank" rel="noopener noreferrer"`. Chaque développeur a **sa photo de profil GitHub**
  (`githubAvatarUrl()` : `https://avatars.githubusercontent.com/<login>?s=96`, via le composant `Avatar`, sans optimisation
  d'image Vercel ni *referrer*) : cet hôte est autorisé dans `img-src` (`next.config.ts`) et dans `AVATAR_HOSTS`. Sous chaque développeur, ses chiffres comme dans
  l'onglet *Contributors* de GitHub (« 91 commits **49 776 ++** **3 007 --** », en vert et en rouge) : `getContributorStats()`
  (`src/lib/data/github-stats.ts`) lit `GET /repos/iSweat-exe/BlocusApp/stats/contributors` **côté serveur**, à travers le
  cache partagé (un appel au plus toutes les 15 min par instance), avec une nouvelle tentative si GitHub répond 202
  (calcul en cours). Si GitHub ne répond pas (limite de débit, panne), la fonction renvoie `null` et **la page reste
  complète sans les chiffres** (elle ne lève jamais : une erreur dans une fonction en cache fait échouer le build). Les
  chiffres sont ceux de GitHub : branche par défaut, commits de fusion exclus, fichiers générés (verrous, types) inclus,
  donc plus gros que du code écrit à la main. La page est
  la même pour tout le monde, **connecté ou non** (aucune garde)  ; **accès pour tout le monde, dans l'application** :
  une ligne « Crédits · Qui a développé BLOCUS. » (`CreditsLink`) dans la section **À propos** de `/settings` (onglet
  Réglages, que les invités ont aussi) et sur `/profil`, plus un petit lien en bas de `/login`.
- **Thème de profil** (`src/features/profile/profile-theme.ts`) : certains comptes ont un look à eux, repéré par l'**id du
  profil affiché** (jamais par une valeur fournie par un utilisateur). Le thème « love » recolore toute la page de `/profil`
  (variables CSS `--accent*` locales, comme les réglages de couleur), entoure l'avatar d'un cadre qui bat (`.love-ring`) et
  fait monter des cœurs derrière la page (`LoveHearts`, décoratif, `aria-hidden`). Animations en CSS pur ; avec
  `prefers-reduced-motion` le cadre reste immobile et les cœurs disparaissent. Visible par la personne sur son propre
  `/profil` seulement. Ajouter un thème = une ligne dans `THEMED_PROFILES` et un déploiement.
- **Nombre d'inscrits sur `/login`** : `MemberCount` affiche « Déjà N personnes ont rejoint BLOCUS. » sous les boutons, depuis
  `getPublicUserCount()` (`src/lib/data/user-count.ts`) qui appelle `public_user_count()` (un entier, lisible par `anon`)
  à travers le cache partagé (profil `feed` : une lecture toutes les 2 min au plus par instance). **`/login` reste
  statique** (servie par le CDN, regénérée toutes les 2 min). La lecture **renvoie `null` au lieu de lever** : une erreur
  levée par une fonction en cache pendant le pré-rendu fait échouer tout le build (par exemple quand le build précède la
  migration). Sans le chiffre (migration absente, base en panne) ou à 0, la ligne n'est pas affichée.

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
