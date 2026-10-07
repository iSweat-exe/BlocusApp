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
