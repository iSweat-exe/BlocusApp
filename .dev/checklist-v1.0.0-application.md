# Checklist v1.0.0 — Application (Phase 1)

> Prérequis : [Phase 0 terminée](./checklist-v1.0.0-organisation.md).
> Contraintes de charge : voir [`constraints.md`](./constraints.md).
> **Ordre strict.** Chaque étape = 1 ou plusieurs PRs, avec tests + doc.
> Dérogation : **A-135 (notifications push) passe en priorité juste après l'étape 1.2 (Authentification)**.

## Vision produit
L'application sert à **gérer une manifestation dans une ville X** :
- **Carte** : affiche le **tracé des déplacements** ; le tracé doit être **facilement éditable sur mobile** ; les gérants disposent de nombreux outils sur la carte (ex. déclarer le lieu actuel de la manifestation : position GPS + heure de déclaration).
- **Accueil** : montre les **dernières actualités** (annonces, etc.), publiables **uniquement par les personnes autorisées**.
- **Pas de messagerie publique** pour l'instant : la communication passe aussi par Instagram.
- **Accès** : connexion Discord / Google, ou mode **Guest** (lecture seule, sans interaction).

---

## Étape 1.1 — Schéma de base & fondations BDD
- [~] **A-001** Migrations Supabase versionnées dans `supabase/migrations/` (jamais d'édition manuelle en prod) — _`supabase db reset` rejoue tout_
- [~] **A-002** Table `profiles` liée à `auth.users` (id, pseudo unique, avatar_url, rôle courant, created_at, updated_at) + trigger de création à l'inscription — _inscription crée un profil_
- [ ] **A-003** Tables de rôles/permissions (voir 1.3) et table `moderation_actions` (ban, mute, historique) — _schéma documenté dans `docs/database.md`_
- [~] **A-004** Index sur toutes les colonnes filtrées/jointes (pseudo, user_id, created_at) ⚡ — _`EXPLAIN` sur requêtes clés_ (plans mesurés dans `docs/database.md`)
- [~] **A-005** Génération des types TS depuis le schéma (`supabase gen types`) — _types importés partout, zéro type écrit à la main_
- [~] **A-006** Seed de dev (`supabase/seed.sql`) avec un compte par rôle — _documenté_

## Étape 1.2 — Authentification sécurisée 🔒
- [ ] **A-010** Supabase Auth via `@supabase/ssr` (cookies httpOnly, pas de token en localStorage) — _session SSR fonctionnelle_
- [ ] **A-011** Inscription / connexion / déconnexion / mot de passe oublié / vérification e-mail obligatoire — _parcours E2E OK_
- [ ] **A-012** SMTP custom configuré (limite e-mails du free tier) — _e-mails reçus_
- [ ] **A-013** Politique de mot de passe + protection contre fuites (leaked password protection si dispo) + CAPTCHA (Turnstile/hCaptcha) sur signup/login 🆕 — _bots bloqués_
- [~] **A-014** Middleware Next.js : rafraîchit la session (fait, `src/proxy.ts`), protège les routes privées (reste, cf. A-121) — _route privée inaccessible déconnecté_
- [~] **A-015** **RLS activée sur TOUTES les tables du schéma `public`**, politique « deny by default » (test pgTAP écrit ; reste à le brancher en CI) — _test CI qui échoue si une table n'a pas RLS_
- [ ] **A-016** Politiques RLS écrites par table (select/insert/update/delete séparées), avec `(select auth.uid())` pour la perf ⚡ — _tests pgTAP accès OK/KO_
- [ ] **A-017** `service_role` utilisée uniquement côté serveur (Route Handlers/Server Actions), jamais exposée — _grep CI sur `NEXT_PUBLIC_`_
- [ ] **A-018** Vérifier que `anon` n'a aucun droit inattendu (`REVOKE` explicite) — _audit des grants_
- [ ] **A-019** Rate limit sur les endpoints d'auth (login, reset) — _429 après N essais_
- [ ] **A-020** Utiliser le Supabase Security Advisor (lints) et corriger tous les warnings 🆕 — _0 warning_
- [~] **A-021** **Priorité** : connexion / inscription via **Discord** (code fait ; reste : test réel, cf. `runbook.md`) et **Google** (code fait : bouton + route `/auth/login/google` ; Supabase OAuth, redirect URLs, callback PKCE) pour accéder à l'application 🆕 🔒 — _login OAuth E2E OK sur les 2 providers_
- [ ] **A-022** **Priorité** : mode **Guest** = consultation sans interaction (accueil, carte, actualités) ; toute action renvoie vers le login ; `anon` en SELECT limité aux données publiques 🆕 🔒 — _un guest ne peut rien écrire (test RLS)_
> Note : A-011 (e-mail / mot de passe) est conservé tant que non tranché, cf. [`decisions-a-valider.md`](./decisions-a-valider.md).

## Étape 1.3 — Permissions granulaires par rôle 🔒
> Objectif : régler **absolument chaque rôle séparément**, côté backend (BDD), pas côté UI.

- [~] **A-030** Modèle RBAC en tables : `roles`, `permissions` (clé unique ex. `message.send`, `user.ban`), `role_permissions` — _aucune permission codée en dur dans le front_
- [~] **A-031** Liste initiale des rôles (à valider avec toi) : `user`, `manager` (gérant de la manifestation, nom à valider), `moderator`, `admin`, `super_admin` (développeurs) — _documentée dans `docs/permissions.md`_
- [~] **A-032** Catalogue exhaustif des permissions (nomenclature `ressource.action`, dont `announcement.publish`, `map.route.edit`, `map.position.declare`) — _fichier unique source de vérité_
- [~] **A-033** Fonction SQL `has_permission(user_id, 'perm.key')` (`SECURITY DEFINER`, `search_path` fixé) utilisée par les politiques RLS — _testée_
- [~] **A-034** Permissions injectées dans le JWT via **Custom Access Token Hook** (évite une requête BDD par action) ⚡ — _claims présents dans le token_
- [~] **A-035** Matrice rôle × permission éditable depuis le panneau admin (écrit en BDD) — _changer une permission d'un rôle prend effet sans redéploiement_ (BDD + UI faites, à valider en production)
- [~] **A-036** Overrides par utilisateur (grant/deny ciblé) 🆕 — _un deny prime sur un grant_ (BDD + UI faites, à valider en production)
- [~] **A-036b** Les changements de rôle / permission / override / sanction sont pris en compte **tout de suite** (époque `permission_epoch` + réémission du token par le proxy) au lieu d'attendre l'expiration du JWT — _correctif ; migration à appliquer sur le projet hébergé_
- [~] **A-037** Hiérarchie de rôles : on ne peut pas agir sur un rôle ≥ au sien — _modo ne peut pas ban un admin (test)_
- [~] **A-038** Vérification des permissions côté serveur sur chaque Server Action/Route Handler **en plus** de la RLS (helper fait, reste à l'utiliser dans les actions) — _helper unique `requirePermission()`_
- [~] **A-039** Audit log : toute modification de rôle/permission est tracée (qui, quoi, quand) 🆕 — _table `audit_logs` en lecture seule pour non-admins_ (BDD, journalisation de toutes les actions d'administration et page `/admin/journal` faites, à valider en production)
- [ ] **A-040** Tests automatisés : pour chaque rôle, chaque permission autorisée/refusée — _matrice testée en CI_

## Étape 1.4 — Contrôle total des Admins absolus (développeurs) 🔒
- [ ] **A-050** Rôle `super_admin` : toutes les permissions, non retirables par un autre rôle — _verrou en BDD_
- [~] **A-051** **Bannissement** ciblé : durée (temporaire/permanent), raison, bannissement effectif immédiat (révocation des sessions + blocage RLS) — _user banni déconnecté et bloqué_ (BDD + UI faites, à valider en production)
- [~] **A-052** **Mute** ciblé : durée + raison, bloque l'envoi de messages mais pas la lecture — _vérifié côté BDD_ (seul le bouton désactivé existe ; backend avec la messagerie)
- [~] **A-053** Expiration automatique des sanctions temporaires (vérif à la lecture, pas de cron lourd) ⚡ — _sanction expirée = levée_ (BDD faite ; reste l'UI)
- [~] **A-054** Levée manuelle d'une sanction + historique complet — _audit_ (BDD + UI faites, à valider en production)
- [~] **A-055** Panneau admin `/admin` : liste/recherche des users et changement de rôle (fait, accès `role.assign` = admin et super_admin) ; reste : sanctions, logs — _accès sans permission = 404_
- [ ] **A-056** Actions supplémentaires : suspendre/supprimer un compte, forcer la déconnexion, reset du profil (pseudo/avatar), shadow-ban 🆕 — _à GARDER ou RETIRER_
- [ ] **A-057** Mode « maintenance / lecture seule globale » activable par un admin (kill switch) 🆕 — _bascule sans redéploiement_
- [~] **A-058** Protection anti-lockout : impossible de retirer le dernier `super_admin` 🆕 — _contrainte en BDD_
- [~] **A-059** Les super_admins sont créés uniquement via migration/SQL manuel, jamais via l'UI publique 🔒 — _documenté dans `runbook.md`_
- [ ] **A-060** 2FA (TOTP) obligatoire pour les rôles admin 🆕 🔒 — _non contournable_

## Étape 1.5 — Compression des données avant envoi à la BDD ⚡
> ⚠️ La compression rend un champ **illisible/non filtrable par SQL**. À réserver aux gros champs non requêtés (contenu long, payload JSON, historique). Les colonnes filtrées/triées/protégées par RLS restent en clair.

- [ ] **A-070** Décision documentée (ADR) : quels champs sont compressés, lesquels restent en clair — _ADR validé_
- [ ] **A-071** Module `src/lib/compression/` : compress/decompress (CompressionStream gzip côté client, `zlib` côté serveur), format versionné (`v1:` + base64 ou `bytea`) — _tests aller-retour_
- [ ] **A-072** Seuil minimal : ne pas compresser les petits payloads (gain négatif) ⚡ — _seuil configurable_
- [ ] **A-073** Limite de taille avant ET après décompression (protection contre « zip bomb ») 🔒 — _rejet au-delà du max_
- [ ] **A-074** Validation du contenu **après décompression** côté serveur (Zod) — _jamais de confiance au client_
- [ ] **A-075** Mesure du gain réel (taille avant/après, CPU) sur données représentatives — _résultat consigné dans la doc_

## Étape 1.6 — Cache ⚡
- [ ] **A-080** Cartographie des données lues fréquemment et de leur TTL (profils, rôles/permissions, listes) — _tableau dans `docs/architecture.md`_
- [~] **A-081** Cache client (TanStack Query / SWR) : `staleTime`, déduplication des requêtes identiques, pas de refetch au focus inutile — _vérifié dans l'onglet réseau_ (cache du routeur 30 s, rafraîchissement au retour sur l'app, encart imminent sans rechargement : fait ; React Query/SWR non retenu)
- [~] **A-082** Cache serveur Next.js (`unstable_cache`/`use cache`/`revalidateTag`) pour les données partagées — _invalidation par tag testée_ (annonces et événements : cache partagé 30 s fait, voir `docs/performance.md`)
- [ ] **A-083** Cache des permissions (JWT claims + cache court) — _0 requête BDD par vérification de permission courante_
- [~] **A-084** Invalidation propre : toute écriture invalide les clés concernées — _pas de donnée périmée visible_ (`updateTag` après chaque écriture sur annonces et événements)
- [~] **A-085** Headers HTTP (`Cache-Control`, ETag) pour les assets/avatars ; avatars servis via CDN/Supabase Storage avec cache long + nom de fichier versionné — _bande passante réduite_ (icônes : cache 1 jour fait)
- [~] **A-087** Politique de préchargement et rendus : `prefetch={false}` sur les liens rarement utilisés, session lue une fois par requête, proxy qui ignore les préchargements — _mesuré dans `docs/performance.md` (−16 à −31 % de requêtes)_ ⚡
- [~] **A-088** Charge utile et base : annonces paginées (10, « Voir plus », plafond 50), `EXPLAIN` des requêtes chaudes consigné, index du journal d'audit, keep-alive quotidien — _`docs/performance.md`, `docs/database.md`_ ⚡
- [ ] **A-086** Option : Redis gratuit (Upstash) si le cache en mémoire serverless s'avère insuffisant 🆕 — _à décider après mesure_

## Étape 1.7 — Mises à jour groupées (batching des changements de profil) ⚡
- [ ] **A-090** Couche « write queue » côté client : les changements (pseudo, avatar, préférences…) sont **accumulés** localement (dernier état gagne par champ) — _10 modifs = 1 requête_
- [ ] **A-091** Flush déclenché par : délai d'inactivité (ex. 5–10 s), taille max, fermeture/masquage de page (`visibilitychange` + `sendBeacon`) — _aucune perte à la fermeture_
- [ ] **A-092** Envoi en **une seule requête** vers une fonction RPC SQL qui applique tout en une transaction — _atomique_
- [ ] **A-093** Persistance temporaire de la file (localStorage/IndexedDB) pour survivre à un refresh/crash — _reprise testée_
- [ ] **A-094** Retry avec backoff exponentiel + gestion de conflits (version/`updated_at`) — _pas d'écrasement silencieux_
- [ ] **A-095** Validation serveur identique à l'instantané (pseudo unique, taille avatar, permissions) et retour d'erreurs par champ — _erreur claire à l'UI_
- [ ] **A-096** Upload d'avatar : redimensionnement/compression côté client avant envoi, limite de taille & types MIME, stockage Supabase Storage — _avatar ≤ taille max_
- [ ] **A-097** UI optimiste : l'utilisateur voit le changement immédiatement avant la synchro 🆕 — _indicateur « synchronisé »_

## Étape 1.8 — Ralentissement contrôlé / anti-surcharge (messages) ⚡
> Pas de messagerie en v1.0.0 : ces règles s'appliquent aux écritures (annonces, positions déclarées) et aux envois de notifications push. Les items « messages » ci-dessous se lisent en ce sens.

- [ ] **A-100** Rate limit **par utilisateur** (ex. N msgs / fenêtre glissante) appliqué côté serveur ET en BDD — _contournement client impossible_
- [ ] **A-101** Rate limit **par IP** pour les non-authentifiés (Vercel Firewall rules / Upstash Ratelimit) — _429 + `Retry-After`_
- [ ] **A-102** Ralentissement progressif (throttle/backpressure) plutôt que blocage brutal : file d'envoi côté client avec cadence adaptative — _l'UI informe « envoi ralenti »_
- [ ] **A-103** Limite globale de débit alignée sur les quotas Realtime Supabase ; au-dessus : mise en file + dégradation (ex. messages groupés) — _test de charge ≥ 200 users simulés_
- [ ] **A-104** Anti-flood : détection de doublons/rafales, taille max de message, cooldown après rafale — _spam bloqué_
- [ ] **A-105** Un seul canal Realtime par client, désabonnement propre au démontage — _≤ 1 connexion/onglet_
- [ ] **A-106** Réception : regrouper l'affichage (batch de rendu toutes les X ms) pour ne pas figer le navigateur 🆕 ⚡ — _200 msgs/s sans freeze_
- [x] **A-107** Test de charge (k6/Artillery) avec scénario 200 users simultanés ; seuils (p95, taux d'erreur) documentés 🆕 — _`docs/load-testing.md`, `load/`_
- [ ] **A-108** Les utilisateurs mute/ban sont filtrés **avant** la file (économie de charge) — _vérifié_

## Étape 1.9 — Pages de l’application (squelette + contenu)
> Squelette déjà en place : groupes de routes `(auth)` (`/login`, `/register`) et `(app)` (`/`, `/calendar`, `/map`) avec barre de navigation mobile (3 onglets ; `/messages` supprimée, A-128).

- [x] **A-120** Squelette des routes et navigation basse (mobile-first, safe-area iOS) — _`npm run build` génère les 6 routes_
- [ ] **A-121** Garde d’accès : `(app)` en lecture seule pour un Guest (A-022), actions d'écriture redirigées vers `/login` ; `(auth)` redirige vers `/` si déjà connecté 🔒 — _testé E2E_
- [ ] **A-122** Login / Register : formulaires, validation (Zod), erreurs par champ, états de chargement — _parcours E2E OK_
- [~] **A-123a** Table `announcements` + RLS (lecture Guest, écriture `announcement.publish` / `announcement.delete`) + tests pgTAP — _fait, reste la PR de l'UI_
- [~] **A-123b** **Accueil** : fil des **dernières actualités** (annonces…), plus récentes en premier ; publication réservée aux personnes autorisées (`announcement.publish`) ; lecture ouverte au Guest — _données issues du cache (1.6)_
- [~] **A-128** Retirer `/messages` : route supprimée (404) et onglet retiré de `src/components/app-nav.tsx` (+ test `app-nav.test.tsx`) — _`npm run build` sans `/messages`, 3 onglets_
- [~] **A-129** Page `/profil` (lecture) : pseudo, photo, identifiant, rôle, e-mail, fournisseur, date d'inscription, permissions (refonte visuelle mobile faite) — _édition du pseudo/avatar : étape 1.7 (batching)_
- [~] **A-129b** Composant « fenêtre plein écran » réutilisable ; « Créer un post » (annonces) et « Ajouter un événement » s'y ouvrent au lieu d'un formulaire affiché en permanence — _fait, à valider sur de vrais téléphones (iPhone et Android)_
- [~] **A-129c** En-tête de l'application : icônes Administration et profil (avatar), « Se connecter » pour les invités, déconnexion déplacée dans `/profil` — _fait, à valider sur de vrais téléphones_
- [~] **A-129d** Refonte mobile de l'administration (liste, fiche utilisateur, rôles, journal) + composant `Select` réutilisable (`src/components/select.tsx`) — _fait, à valider sur de vrais téléphones_
- [~] **A-129e** Design system centralisé (tokens `globals.css`, classes `.btn` / `.card` / `.field`…, `Avatar`, feuille `Select` swipeable) appliqué à toute l'application — _ADR 0004, à valider sur de vrais téléphones_
- [~] **A-129f** Page `/settings` (onglet « Réglages ») : couleur d'accent personnalisable (préréglages + couleur libre, stockée sur l'appareil, appliquée avant le premier rendu) — _fait, à valider sur de vrais téléphones ; synchro entre appareils : Backlog_
- [~] **A-129g** Réglage du thème Système / Clair / Sombre dans `/settings` (stocké sur l'appareil, appliqué avant le premier rendu) — _fait, à valider sur de vrais téléphones_
- [~] **A-129h** Optimisation de `/calendar` : sélection du jour côté client (0 requête par tap), formateur `Intl` construit une fois (rendu d'un mois 23 ms → 1,4 ms), liens sans préchargement — _mesures dans `docs/performance.md` ; à valider sur de vrais téléphones_
- [x] **A-129i** Pastille « En développement » de `/map` : retirée, le tracé et la position sont livrés (le composant `WorkInProgress` reste disponible pour d'autres pages)
- [~] **A-129j** Fenêtres plein écran (« Créer un post », « Ajouter un événement ») refaites en feuilles mobiles : poignée, glisser vers le bas pour fermer, bouton d'action épinglé, formulaires en sections, champs d'heure qui ne débordent plus — _fait, à valider sur de vrais téléphones_
- [~] **A-129k** Barre d'onglets trop basse sur Android : marge basse `pb-safe-bottom` (min. 2 rem, l'iPhone garde son `env()`), aussi pour les feuilles — _à valider sur de vrais Android (gestes et 3 boutons)_
- [~] **A-129l** Application figée à 100 % sur mobile (pas de zoom par pincement ni double tap : `viewport`, `touch-action`, `NoZoom`, champs à 16 px) — _fait ; la carte garde son zoom ; à valider sur iPhone et Android réels ; point d'attention accessibilité (A-112) : le zoom utilisateur est volontairement bloqué_
- [~] **A-129m** Animation d'ouverture/fermeture des feuilles plein écran (« Nouveau post », « Nouvel événement ») fluide : Web Animations API, contenu monté avant l'animation, `<dialog>` non défilable (`overflow: clip`), balayage prioritaire sur l'animation — _fait ; à valider sur iPhone et Android réels_
- [~] **A-129d** Barre du bas mobile (icônes, 64 px, zone sûre iPhone) et polish du design (annonces, calendrier, focus, colonne centrée desktop) — _fait, à valider sur de vrais téléphones_
- [~] **A-125a** Table `events` + permissions `event.create` / `event.delete` + RLS (lecture Guest, écriture selon permission, pas de création dans le passé) + tests pgTAP — _fait ; reste l'UI_
- [~] **A-125b** **Calendrier** `/calendar` : grille de mois (repère sur les jours avec événements), liste des événements du jour sélectionné, détail `/calendar/[id]` ; les autorisés ajoutent un événement sur un jour (heure, titre, texte, lieu et fin facultatifs) et l'auteur peut le modifier — _lecture cachée, écriture protégée par permissions_ (grille, liste du jour, détail, création, modification et suppression faits, à valider en production)
- [~] **A-125c** **Accueil** : un événement qui démarre dans moins de 30 min s'affiche tout en haut dans un encart distinct, fermable (mémorisé sur l'appareil), cliquable vers le détail — _disparaît au début de l'événement_ (fait, à valider en production)
- [~] **A-125d** Événements terminés : permission `event.finish`, RPC `set_event_finished`, événement grisé et non modifiable, retiré de l'encart d'accueil — _fait (BDD + interface), à valider en production_
- [~] **A-126** **Carte** : choix de la lib de carte via ADR (Leaflet/OSM gratuit vs Mapbox/Google, quotas, édition tactile) 🆕 — _ADR 0005 : MapLibre + OpenFreeMap ; fond de carte, thème clair/sombre et « Me localiser » faits ; reste : valider l'ADR, ville X et emprise_
- [~] **A-126a** Affichage du **tracé des déplacements** (polyline / GeoJSON) sur la carte 🆕 — _fait : tracé visible pour tous (Guests compris), lecture en cache 30 s ; à valider avec de vraies tuiles_
- [~] **A-126b** **Édition du tracé sur mobile** : ajouter / déplacer / supprimer des points au doigt, annuler/rétablir, sauvegarde groupée (1.7) 🆕 — _fait (viseur central, glisser, annuler/rétablir, 1 sauvegarde = 1 requête, conflits détectés) ; reste : tester au pouce sur iPhone et Android réels_
- [~] **A-126c** **Outils gérants** : déclarer le **lieu actuel de la manifestation** (position GPS + heure de déclaration, historique, dernière position mise en avant) ; autres actions gérants à lister avec toi (points d'intérêt, zones…) 🆕 🔒 — _permissions `map.*` vérifiées en RLS et côté serveur_ (fait pour la position : déclaration au viseur ou via « Ma position », libellé, historique, une déclaration / 5 s ; points d'intérêt et zones : Backlog) — _la personne qui a déclaré la position peut la retirer (+ permission `map.position.remove` pour les administrateurs) ; toucher le repère affiche les informations à tous_
- [~] **A-127** Respect de la vie privée sur la carte : seule la position de la manifestation, déclarée par un gérant, est affichée (pas de géolocalisation des utilisateurs sans consentement) 🆕 🔒 — _décision documentée_ (décision documentée dans `docs/security.md` ; reste : confirmer si un Guest voit la position)

## Étape 1.10 — PWA iOS & Android
> Base déjà en place : `manifest.ts`, `public/sw.js` minimal, icônes générées depuis `logo_app.png`, meta iOS (`appleWebApp`, `viewport-fit=cover`), en-têtes anti-cache du SW.

- [x] **A-130** Manifest, enregistrement du service worker (prod uniquement), meta iOS, icône apple-touch — _manifest et `sw.js` servis avec les bons en-têtes_
- [~] **A-131** Icônes générées depuis `logo_symbol.png` « B. » (192, 512, maskable, apple-touch 180, favicon) — _reste : validation visuelle sur appareils réels + écrans de démarrage iOS optionnels_
- [ ] **A-132** Stratégie hors-ligne dans `sw.js` : coquille de l’app en cache, page `/offline`, **jamais** de cache des réponses authentifiées/sensibles 🔒 — _mode avion testé_
- [ ] **A-133** Stratégie de mise à jour du SW (nouvelle version → message « mettre à jour ») 🆕 — _pas d’ancienne version bloquée_
- [ ] **A-134** Invite d’installation : bouton « Installer » sur Android (`beforeinstallprompt`) + explication « Partager → Sur l’écran d’accueil » sur iOS 🆕 — _testée sur appareils réels_
- [ ] **A-135a** **Priorité (après 1.2)** 📚 **Recherche approfondie avant toute implémentation** : Web Push sur iOS 16.4+ (installation écran d'accueil obligatoire, permission sur geste utilisateur, abonnement `PushManager.subscribe` + VAPID, endpoints Apple, limites de fiabilité) et sur Android (Chrome/FCM), choix de la lib d'envoi — _ADR dans `docs/adr/` validé avant le code_
- [ ] **A-135b** **Priorité** Notifications push (Web Push + VAPID) : table `push_subscriptions` + RLS, abonnement/désabonnement, envoi côté serveur, purge des abonnements expirés (404/410) ; déclencheurs : nouvelle annonce, nouvelle position déclarée — _reçue sur iOS et Android_
- [ ] **A-135c** **Priorité** Parcours d'abonnement iOS (installer l'app → activer les notifications) 🆕 — _testé sur iPhone réel_
- [ ] **A-136** Session persistante en mode standalone (cookies Supabase OK dans la PWA iOS) 🔒 — _reste connecté après fermeture_
- [ ] **A-137** Audit Lighthouse PWA + tests sur iPhone et Android réels (HTTPS requis, Vercel OK) — _installable, score validé_

## Étape 1.11 — Finalisation v1.0.0
- [ ] **A-110** Revue sécurité complète (RLS, secrets, en-têtes, dépendances) 🔒 — _rapport signé_
- [ ] **A-111** Documentation complète et à jour (README, architecture, permissions, DB, runbook) 📚 — _relecture par quelqu'un qui n'a pas écrit le code_
- [ ] **A-112** Pages d'erreur, états de chargement, accessibilité de base (clavier, contrastes) 🆕 — _Lighthouse ≥ 90_
- [ ] **A-113** Pages légales/RGPD : politique de confidentialité, export et suppression des données utilisateur 🆕 🔒 — _suppression de compte fonctionnelle_
- [ ] **A-114** Vérification des quotas free tier en conditions réelles (Supabase + Vercel dashboards) — _marge ≥ 20 %_
- [ ] **A-115** Changelog + tag `v1.0.0` + release GitHub — _publié_

---

## ✅ Critère de sortie v1.0.0
- Un user peut se connecter (Discord/Google) ou entrer en Guest, modifier son profil (batché), consulter actualités et carte ; les gérants publient annonces, tracé et position (throttlés) ; les notifications push sont reçues sur iOS et Android.
- Chaque rôle est configurable individuellement ; un super_admin peut ban/mute n'importe qui.
- RLS prouvée par tests ; aucun accès possible hors permissions.
- Test de charge 200 users simultanés validé sur les quotas gratuits.

## Backlog (hors v1.0.0)
- **Messagerie** (messages privés + groupes, permissions `message.*`) : reportée, la communication passe par Instagram pour l'instant ; la page `/messages` ne doit pas exister publiquement.
- _(y noter toute autre idée qui déborde)_
