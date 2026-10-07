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
