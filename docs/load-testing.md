# Test de charge (200 utilisateurs simultanés)

Objectif : vérifier qu'un pic de ~200 utilisateurs simultanés ne dégrade pas l'app, et **mesurer** (au lieu
d'estimer) le coût par page pour le comparer aux quotas gratuits (voir `docs/performance.md`).

## Règle absolue

**Ne jamais lancer ce test contre le site de production ni contre un projet Supabase hébergé** : il consommerait
les quotas gratuits (invocations, CPU actif, egress) et pourrait faire **mettre le déploiement en pause**.
`load/run-local.sh` refuse de démarrer si la base n'est pas locale.

## Lancer

Prérequis : Docker démarré et la CLI Supabase (`npx supabase`). Rien à installer : k6 tourne dans l'image Docker
`grafana/k6` (téléchargée au premier lancement).

```bash
bash load/run-local.sh          # palier de 120 s à 200 utilisateurs (durée totale ≈ 3 min + build)
bash load/run-local.sh 300s     # palier plus long
```

Le script : démarre Supabase local, y crée **1000 profils, 50 annonces et 40 événements** (volume cible), construit et
démarre l'app en production locale (`next start`), fait un échauffement, remet à zéro les compteurs, lance le scénario
k6, puis affiche le **temps CPU du serveur** et le **nombre de lectures en base**. Le résumé de k6 est aussi écrit dans
`load/last-run.txt` (ignoré par Git).

## Scénario (`load/k6-200-users.js`)

200 utilisateurs virtuels arrivent en 30 s, restent au palier (120 s par défaut), puis repartent en 15 s. Chacun fait
l'enchaînement d'un utilisateur sur téléphone : accueil, lecture (3 à 8 s), calendrier, lecture, dans 30 % des cas
« Voir plus d'annonces », retour à l'accueil, pause (5 à 15 s), puis recommence. Un utilisateur sur cinq est connecté
(administrateur), les autres sont invités. Seuls les **documents HTML** sont demandés, donc chaque visite est un rendu
complet : c'est le pire cas pour le serveur (en production les fichiers statiques viennent du CDN).

## Seuils (le test échoue s'ils sont dépassés)

| Mesure | Seuil |
|---|---|
| Requêtes en échec | < 1 % |
| Temps de réponse p95 | < 800 ms |
| Temps de réponse p99 | < 2 s |
| Vérifications (statut 200 + page de l'app) | > 99 % |

## Résultats (PR 5, machine de développement, Supabase local)

Palier de 120 s à 200 utilisateurs, 4 520 requêtes (≈ 23 par seconde) :

| Mesure | Résultat |
|---|---|
| Requêtes en échec | 0 % |
| Temps de réponse moyen / médian | 32 ms / 29 ms |
| p95 / p99 / max | 61 ms / 85 ms / 120 ms |
| Lectures en base pendant le test | **22** pour 4 520 pages (0,5 %) : le cache partagé de 30 s absorbe presque tout |
| Temps CPU du serveur (Node) | 65 s, soit **≈ 14 ms par page** |
| Données reçues | 297 Mo, soit **≈ 66 Ko par page** (compressé) |

Conclusion : à 200 utilisateurs simultanés l'app n'est pas le goulot, et la base est quasi inactive.

## Ce que cela dit des quotas (à confirmer par le tableau de bord après mise en ligne)

Hypothèse de départ : 1000 utilisateurs × 20 navigations par jour × 30 jours = 600 000 pages par mois, **toutes
rendues par le serveur** (le cache du routeur client de 30 s et les préchargements réduits font que ce sera moins).

| Quota Hobby | Limite | Estimation | Part |
|---|---|---|---|
| CPU actif | ~4 h | 600 000 × 14 ms ≈ 2,4 h | ~60 % |
| Transfert | 100 Go | 600 000 × 66 Ko ≈ 40 Go | ~40 % |
| Invocations de fonctions | ~1 M | 600 000 rendus **+ le `proxy`** (une invocation de plus par requête qu'il intercepte : avant la PR « quotas, lot 1 », aussi pour les invités et les préchargements, soit ~1,5 à 2,6 M au total) | voir `docs/performance.md` |
| Transfert depuis le serveur (« Fast Origin Transfer ») | **~10 Go** | 600 000 × 20 à 66 Ko ≈ 12 à 40 Go | **à mesurer en production** : probablement le premier quota à surveiller |

**Limites de la mesure** : le CPU est celui de cette machine (Vercel n'est pas identique), le test n'exécute qu'une
seule instance (en production `use cache` est en mémoire **par instance** : avec plusieurs instances le taux de
succès du cache baisse un peu et les lectures en base augmentent), et les pages de ce test sont servies à chaud. Le
CPU reste donc le premier quota à surveiller : **contrôler Vercel → Usage une semaine après l'ouverture** (item A-114)
et, si le CPU actif dépasse 70 % du quota, passer d'abord à `use cache: remote`, puis réduire la taille des pages
(66 Ko par page est le principal levier restant).

## Modifier le scénario

Éditer `load/k6-200-users.js` (`VUS`, `HOLD`, parcours). Garder les seuils et le tableau ci-dessus à jour dans la
même PR si le parcours change.
