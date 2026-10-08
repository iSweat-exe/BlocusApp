# Performance, réseau et quotas

> Document vivant : chaque PR de la série « optimisation » y ajoute ses règles et ses mesures.
> Cible : ~1000 utilisateurs inscrits, ~200 simultanés, sur les offres gratuites (voir
> [`.dev/constraints.md`](../.dev/constraints.md)).

## Ce qui coûte (Vercel Hobby, Supabase Free)

Vercel Hobby : ~1 M requêtes edge/mois, ~1 M invocations de fonctions/mois, **~4 h de CPU actif/mois**, 100 Go de
transfert ; dépassement = déploiement mis en pause. Supabase Free : 500 Mo, 5 Go d'egress, ~200 connexions Realtime
(**notre pic : on n'utilise pas Realtime**), pause après 7 jours d'inactivité. Chiffres à revérifier sur les pages
officielles. Le CPU actif dépend surtout du **nombre de rendus serveur** : réduire les rendus et les requêtes
compte plus que raccourcir une requête SQL.

## Règles de conception

- **Préchargement (`<Link prefetch>`)** : seuls les 3 onglets de la barre du bas (Accueil, Calendrier, Carte) sont
  préchargés. Tous les liens rarement utilisés ont `prefetch={false}` : jours et flèches du calendrier, lignes de la
  liste admin, pagination du journal, sous-navigation admin, icônes profil/admin, marque, « Se connecter ».
  Nouveau lien dans une liste ou un en-tête = `prefetch={false}` par défaut.
- **Une lecture de session par requête** : `getSessionPermissions()` est enveloppée dans `React.cache`
  (`src/server/session.ts`) ; l'en-tête, la page et ses sections partagent la même lecture. Le JWT est vérifié
  localement (clés ES256, aucun appel réseau à Supabase Auth par requête).
- **`src/proxy.ts`** ignore les préchargements (`next-router-prefetch`) et les fichiers statiques (le `matcher` est
  testé : le point de `sw.js` est bien échappé).
- **Fichiers statiques** : `/icons/*` est servi avec `Cache-Control: public, max-age=86400,
  stale-while-revalidate=604800` (par défaut un fichier de `public/` est revalidé à chaque chargement).

- **Cache partagé des données publiques** (`'use cache'`, profil `feed` : revalider à 30 s, expirer à 5 min,
  défini dans `next.config.ts`) : annonces, événements d'une plage de dates, détail d'un événement, événements
  imminents (`src/lib/data/announcements.ts`, `src/lib/data/events.ts`). Ces lectures passent par un client Supabase
  **sans cookies** (`src/lib/supabase/public.ts`, rôle `anon`) : le résultat ne dépend donc pas de qui demande et peut
  être partagé. **Règles** : (1) n'y mettre que ce que `anon` peut lire avec le même résultat que pour un connecté ;
  jamais de permissions, de profil, de liste d'admin ; (2) une erreur est **levée** dans la fonction en cache puis
  convertie en `Result` à l'extérieur (une erreur ne doit pas être mise en cache) ; (3) toute écriture appelle
  `updateTag('announcements' | 'events')` dans sa Server Action (l'auteur voit son changement tout de suite, les autres
  au plus 30 s plus tard) ; (4) appeler `await connection()` **avant** une lecture en cache indépendante de la requête,
  sinon Next.js l'exécute pendant le build : annonces figées dans la page, et build en échec si la base est
  injoignable (c'est ce qu'a révélé la CI avec une URL Supabase factice).
- **Événements imminents** : la fenêtre est ancrée au début de la minute courante, donc tous les visiteurs d'une même
  minute partagent une seule lecture ; l'encart masque côté client ceux qui ont déjà commencé.

- **Fraîcheur sans sondage** : `RefreshOnReturn` (`src/components/refresh-on-return.tsx`, monté dans
  `(app)/layout.tsx`) appelle `router.refresh()` quand l'utilisateur **revient** sur l'app (onglet ou PWA de nouveau
  visible, page restaurée du cache avant/arrière, réseau retrouvé), **au plus une fois toutes les 30 s**. Aucune
  minuterie réseau : une app que personne ne regarde ne coûte rien. Les données rafraîchies viennent du cache partagé
  (≤ 30 s), donc le rafraîchissement ne multiplie pas les lectures en base. **Pas de Realtime** (quota gratuit de ~200
  connexions = notre pic) et **pas de polling** (1000 utilisateurs × une requête toutes les 3 min dépasseraient le quota
  de requêtes edge).
- **Cache du routeur client** : `experimental.staleTimes.dynamic = 30` (`next.config.ts`) : revenir sur une page vue
  il y a moins de 30 s ne sollicite pas le serveur. Les écritures (Server Actions) et `RefreshOnReturn` contournent ce
  cache.
- **Encart « événement imminent »** : le serveur envoie les événements ouverts des **3 prochaines heures**
  (`IMMINENT_FETCH_MINUTES`) et le navigateur ne montre que ceux de la fenêtre de 30 minutes (3 au maximum) : un
  événement devient imminent **sans rechargement**.
- **Durée de vie du jeton : 1 h** (`jwt_expiry = 3600`, voir `docs/runbook.md`) : un jeton de 15 min faisait renouveler
  chaque utilisateur actif 4 fois plus souvent, tous depuis les adresses IP de Vercel (limite Supabase Auth ≈ 150
  renouvellements par tranche de 5 min et par IP, un refus déconnecte). Rôles, permissions et sanctions sont pris en
  compte **à la requête suivante** grâce à `permission_epoch` (`docs/permissions.md` : au plus une lecture en base toutes
  les 10 s par instance, aucune requête de plus pour le visiteur) ; seule une sanction qui expire toute seule peut
  rester visible jusqu'à 1 h. Les actions sensibles vérifient de toute façon en base (`fresh`).

- **Annonces paginées** : 10 au départ, « Voir plus d'annonces » en ajoute 10 (`/?n=20`, …), plafond de **50** (une
  note l'indique). `n` est arrondi au multiple de 10 (peu de valeurs distinctes : le cache partagé reste petit) et
  toute valeur invalide retombe sur la première page. Le serveur lit une ligne de plus que demandé pour savoir s'il
  reste des annonces. Charge utile par visite : au plus 50 annonces, au lieu de 20 sans pagination ni borne claire.
- **Keep-alive** : `/api/keep-alive` (une lecture d'une ligne) appelé chaque jour à 6 h UTC par Vercel Cron
  (`vercel.json`) pour que le projet Supabase gratuit ne soit jamais mis en pause après 7 jours sans activité. Si
  `CRON_SECRET` est défini, tout autre appelant reçoit 401. Exclu du `proxy`.

## Quotas Vercel Hobby et Supabase Free : lot 1 (PR « optimisation des quotas »)

Audit fait avant l'ouverture au public (estimation à ~600 000 pages par mois ; **à confirmer dans Vercel → Usage et
Supabase → Usage une semaine après l'ouverture**). Quotas à connaître (à revérifier) : Vercel Hobby = 1 M requêtes
edge, 1 M invocations de fonctions, 4 h de CPU actif, 100 Go de transfert **et ~10 Go de transfert depuis le
serveur (« Fast Origin Transfer »)**, 50 000 événements Web Analytics ; Supabase Free = 500 Mo de base, 5 Go d'egress,
Auth limité par IP. Sur Hobby rien n'est facturé : un quota dépassé **met le projet en pause** (jusqu'à 30 jours).

| Problème trouvé | Correction | Quota |
|---|---|---|
| `src/proxy.ts` est une fonction Node distincte, invoquée pour **chaque** requête : document, navigation, préchargement (`.rsc`), Server Action, et aussi pour les invités qui n'ont rien à rafraîchir | `matcher` à objets : seulement avec un cookie de session (`blocus-auth` ou `blocus-auth.0`, nom fixé dans `src/lib/supabase/cookie.ts` au lieu de `sb-<ref>-auth-token`), jamais pour un préchargement (en-têtes `next-router-prefetch` et `purpose: prefetch`), ni pour `robots.txt` et `sitemap.xml`. Un préchargement d'une coque statique est alors servi par le CDN sans fonction | Invocations (÷ 2 à 3 estimé) |
| `<Analytics />` envoie un événement par vue (≈ 600 000 contre 50 000 inclus : collecte coupée après ~2,5 jours), chacun étant aussi une requête edge | `SampledAnalytics` : 5 % des navigateurs (tirage mémorisé), `ANALYTICS_SAMPLE_RATE` | Analytics, requêtes edge |
| `RefreshOnReturn` relançait un rendu complet à chaque retour sur l'app après 30 s de vie de la page, même après 2 s d'absence | Rafraîchit seulement si l'app est restée **cachée ≥ 2 min** (`MIN_AWAY_MS`) ; une navigation remet l'âge de la page à zéro | Invocations, CPU, transfert |
| Jeton de 15 min : renouvellements ×4 | 1 h (voir plus haut) | Auth, base |
| `auth.audit_log_entries` : 2 lignes par renouvellement, jamais purgées (500 Mo atteints en 4 à 8 mois) | Réglage du tableau de bord (`docs/runbook.md`) | **Taille de la base** |
| Fonctions Vercel à Washington, base en Irlande | `"regions": ["dub1"]` dans `vercel.json` | Durée des fonctions, latence |
| `revalidatePath` en plus de `updateTag` : `updateTag` purge déjà le cache du routeur et rend la page de nouveau ; `revalidatePath` régénérait en plus une coque statique sans données | `updateTag` seul dans les actions annonces, calendrier et carte (admin : inchangé, ses données ne sont pas en cache partagé) | Invocations, écritures ISR |
| Geist Mono préchargée sur toutes les pages (52 Ko) alors que quatre écrans l'utilisent ; deux logos de 168 Ko servis depuis `public/` | `preload: false` ; logos déplacés dans `design/` (sources des icônes) | Transfert |

Effet attendu sur le cache de partage : les lectures publiques restent revalidées toutes les 30 s ; c'est le lot
suivant qui évaluera 60–120 s et un bouton d'actualisation manuelle.

## Mesures (Supabase local, build de production, Pixel 7 émulé, 60 utilisateurs, 15 annonces, 20 événements)

« Requêtes réseau » = requêtes vers notre serveur réellement émises (hors ressources servies par le cache du
navigateur) ; « SQL » = requêtes PostgREST exécutées par la base (`pg_stat_statements`).

| Scénario | Mesure de référence | Après PR 1 |
|---|---|---|
| A. Ouvrir le calendrier | 25 req., 8 préch., 1 SQL | **21** req., 4 préch., 1 SQL |
| B. Accueil → Calendrier → Accueil → Calendrier → Accueil | 30 req., 8 préch., **8 SQL** | **26** req., 4 préch., 8 SQL |
| C. 10 rechargements de l'accueil (invité) | 113 req., 53 préch., **20 SQL** | **86** req., 36 préch., 20 SQL |
| D. Ouvrir la liste admin | 35 req., 17 préch., 2 SQL | **24** req., 6 préch., 2 SQL |

À retenir : la base est interrogée **à chaque vue** (2 requêtes pour l'accueil, 8 pour 5 écrans) ; la PR 1 réduit le
trafic réseau de 16 à 31 % selon le scénario mais ne touche pas aux requêtes SQL (cache partagé : PR suivante). Une
première estimation de 38 préchargements par affichage du calendrier s'est révélée fausse à la mesure (8) : Next.js
précharge la coque d'une *route*, pas une par jour.

### Après PR 2 (cache partagé)

| Scénario | Référence | Après PR 1 | Après PR 2 |
|---|---|---|---|
| B. Accueil → Calendrier → Accueil → Calendrier → Accueil | 8 SQL | 8 SQL | **2 SQL** |
| C. 10 rechargements de l'accueil (invité) | 20 SQL | 20 SQL | **0 SQL** (entrées déjà chaudes) |
| D. Liste admin (données par utilisateur, non partagées) | 2 SQL | 2 SQL | 2 SQL |

Fraîcheur vérifiée dans un navigateur sur Supabase local :
- 10 visites de suite d'un invité : **1 seule lecture** des annonces en base (cache froid au départ) ;
- annonce publiée **par l'application** (Server Action + `updateTag`) : visible par un invité **dès le chargement
  suivant** (≈ 0,4 s) ;
- ligne écrite **directement en base**, sans invalidation (cas d'une autre instance) : visible après **31 s**, soit le
  décalage maximum prévu (30 s de cache + un rafraîchissement en arrière-plan).

### Après PR 3 (fraîcheur et cache du routeur)

| Scénario | Référence | Après PR 2 | Après PR 3 |
|---|---|---|---|
| B. Accueil → Calendrier → Accueil → Calendrier → Accueil | 30 req., 4 navigations serveur | 26 req., 4 | **23** req., **1** navigation serveur |
| Six changements d'onglet en moins de 30 s | 6 navigations serveur | 6 | **1** |

Vérifié dans un navigateur (Supabase local) :
- un invité qui garde l'app ouverte **ne voit pas** une annonce publiée ailleurs (aucun sondage), un retour avant 30 s
  est ignoré, et **après 31 s** le retour sur l'app affiche l'annonce **sans rechargement** ;
- un événement à 40 minutes entre dans l'encart 12 minutes plus tard **sans rechargement** (« dans 28 min »).

### Après PR 4 (base de données et charge utile)

- Index manquant ajouté sur le journal d'audit filtré par action : 4,6 ms → 0,24 ms pour une action rare dans 100 000
  entrées (voir `docs/database.md` pour tous les plans).
- Pagination vérifiée dans un navigateur avec 62 annonces : 10 → 20 → 30 → 40 → 50 cartes, plus de bouton au plafond,
  `?n=999` donne 50, `?n=abc` et `?n=-1` donnent 10, `?n=15` donne 20 ; le défilement est conservé.
- `/api/keep-alive` : 200 `{"ok":true}` avec la base locale, 503 si elle est injoignable, 401 sans le secret quand
  `CRON_SECRET` est défini.

### Après PR 5 (test de charge)

Test de 200 utilisateurs simultanés sur le build local (voir `docs/load-testing.md`) : 0 % d'échec, p95 61 ms, p99
85 ms, 22 lectures en base pour 4 520 pages, ≈ 14 ms de CPU et ≈ 66 Ko par page. Ces chiffres remplacent l'estimation
de 25 ms de CPU par rendu faite lors de l'audit.

| Scénario (Supabase local, Pixel 7 émulé) | Avant | Après |
|---|---|---|
| 5 écrans enchaînés | 30 requêtes, 8 SQL | 23 requêtes, 2 SQL, 1 navigation serveur |
| 10 rechargements de l'accueil | 113 requêtes, 20 SQL | 86–90 requêtes, 0 SQL (à chaud) |
| Liste admin | 35 requêtes | 24 requêtes |

## Page carte (exception de poids)

`/map` charge MapLibre GL JS (mesuré : chunk de 279 Ko compressés, plus 143 Ko pour le worker et 10 Ko de CSS) : c'est le seul endroit où le budget de 100 Ko par page est
dépassé, volontairement. Il est isolé dans un chunk chargé à la demande (`next/dynamic`, `ssr: false`) : aucune autre
page ne le télécharge, et le style, les tuiles, les polices et les pictogrammes viennent d'OpenFreeMap (aucune requête
vers notre serveur ni notre base pour la carte de fond). Le worker (`maplibre-gl-worker.mjs`, 508 Ko non compressé)
est un fichier statique mis en cache par le navigateur.

Le tracé de la carte suit la règle des données publiques : lecture sans cookie mise en cache 30 s (une requête, au plus
500 points, soit quelques dizaines de Ko dans le pire cas), invalidée par `updateTag('map-route')` à chaque sauvegarde.

## Page calendrier (PR 6)

Audit de `/calendar` : la lecture en base était déjà minimale (une requête par mois, partagée par le cache de 30 s,
index `events_starts_at_idx`). Les coûts restants étaient ailleurs.

| Problème trouvé | Correction |
|---|---|
| **Chaque tap sur un jour = une navigation serveur** (un rendu de la page + une requête réseau), alors que les événements du mois sont déjà chargés | `MonthView` (client) reçoit tous les événements du mois en un seul envoi ; le jour sélectionné est un état client et l'URL est tenue à jour avec `history.replaceState` (reste partageable). Sans JavaScript, les jours restent des liens et le serveur rend le jour demandé |
| **`Intl.DateTimeFormat` reconstruit à chaque conversion** (`zonedFields` : 2 fois par `zonedToUtc`, 1 fois par événement, 1 à 2 fois par case de la grille) : environ 100 µs la construction | Formateur construit une seule fois au chargement du module |
| Liens des événements du jour préchargés par défaut (une requête de préchargement par ligne) | `prefetch={false}`, conformément à la règle ci-dessus |
| Regroupement par jour en O(n²) (`[...liste, x]` à chaque événement) | `push` dans un tableau par jour |
| Le client recevait des horodatages bruts et refaisait le travail de fuseau horaire | Le serveur regroupe par jour et formate la plage horaire ; le client ne reçoit que `id`, `title`, `location`, `time`, `finished` |

Mesures (build de production, Pixel 7 émulé, sans base de données : les événements sont vides, ce qui ne change pas
le nombre de requêtes) :

| Mesure | Avant | Après |
|---|---|---|
| Requêtes serveur pour 5 taps sur des jours différents | **5** (un rendu chacune, `?_rsc=`) | **0** |
| CPU d'un rendu de mois (42 cases + 100 événements, micro-banc) | **23,1 ms** | **1,4 ms** |
| Lectures en base par affichage du mois | 1 (cache partagé) | 1 (inchangé) |

Le micro-banc mesure la logique de dates seule (hors React) ; il a mis en évidence que la page du calendrier
dépassait à elle seule le budget de CPU par page (≈ 14 ms, voir plus haut).

**Choix non retenu** : charger trois mois d'un coup pour rendre aussi les flèches « mois précédent / suivant »
instantanées. Chaque visite enverrait trois fois plus de données pour économiser une requête à ceux qui changent de
mois ; le cache du routeur (30 s) et le cache partagé rendent déjà ce changement bon marché.
