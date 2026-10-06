# 0002 — Périmètre de la compression des données

- **Statut** : Proposed (à valider avant l'étape 1.5)
- **Date** : 2026-10-06
- **Décideurs** : @iSweat-exe

## Contexte

Les données utilisateur doivent être compressées avant envoi à la base (économie de bande passante et de
stockage sur 500 Mo). Un champ compressé n'est plus filtrable, indexable ni utilisable dans une
politique RLS.

## Décision proposée

- Compresser uniquement les **gros champs non requêtés** (contenu long, payloads JSON, historiques).
- Garder **en clair** toute colonne filtrée, triée, indexée, unique ou utilisée par la RLS (pseudo,
  identifiants, dates, statuts, rôles).
- Format versionné (`v1:` + base64 ou `bytea`), gzip, seuil minimal configurable (pas de gain sous
  quelques centaines d'octets), limite de taille avant **et** après décompression (zip bomb).

## Conséquences

- Module unique `src/lib/compression/` ; validation du contenu après décompression côté serveur.
- Mesure du gain réel avant généralisation (A-075).
