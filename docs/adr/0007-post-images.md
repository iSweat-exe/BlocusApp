# 0007 — Images des posts et visibilité

- **Statut** : Proposed
- **Date** : 2026-10-09
- **Décideurs** : @iSweat-exe

## Contexte

Les posts du fil d'accueil reçoivent une photo facultative, un état (brouillon, privé, public) et un choix « afficher
l'auteur ». Contraintes : Supabase Free offre 1 Go de fichiers (et 5 Go de sortie de données, partagés avec le reste),
la base fait 500 Mo, les téléphones envoient des photos de plusieurs Mo, et le fil public est servi aux invités depuis
un cache partagé.

## Options envisagées

1. **Envoyer l'original et le réduire côté serveur** — nécessite une bibliothèque d'images (`sharp`) et du CPU Vercel,
   et le fichier de plusieurs Mo traverse déjà le réseau (limite de 4,5 Mo du corps de requête).
2. **Service d'images tiers (Cloudinary…)** — compte, quotas, dépendance.
3. **Compresser dans le navigateur, puis plafonner à la source** — aucun CPU serveur, aucun compte ; le serveur et le
   bucket refusent ce qui dépasse, quoi que le client envoie.
4. **Stocker l'image dans la base (bytea / base64)** — fait exploser les 500 Mo. Écarté.

## Décision

Option 3.

- **Compression** (`src/features/announcements/compress-image.ts`) : redimensionnement à 1 600 px au plus, WebP (JPEG
  sur les navigateurs qui ne savent pas encoder du WebP, notamment Safari), meilleure qualité qui tient sous ~220 Ko ;
  si besoin la taille baisse de 20 % par palier. Un PNG de 13 Mo devient ~200 Ko.
- **Plafond serveur** : l'action refuse plus de 300 Ko, un format autre que WebP/JPEG (lu dans les premiers octets, pas
  dans le nom) et des dimensions hors 1-4 000 ; le bucket `announcement-images` impose les mêmes limites
  (`file_size_limit` 300 Ko, `allowed_mime_types`).
- **Stockage** : bucket public (pas d'URL signée, le fil reste cachable), un chemin `<id auteur>/<uuid>.webp|jpg` jamais
  réutilisé (cache d'un an), une seule image par post. Écriture réservée à `announcement.publish` dans son propre dossier ;
  l'image remplacée, retirée ou d'un post supprimé est effacée par l'API Storage (les suppressions SQL directes sont
  bloquées par Supabase). Un échec de suppression laisse un fichier orphelin, journalisé.
- **Visibilité** : `draft` et `private` ne sont lisibles que par leur auteur (RLS) ; `public` par tous. Le fil public
  passe par la vue `announcement_feed`, qui ne montre que les posts publics et **cache l'auteur** (id, pseudo, avatar)
  tant que `show_author` n'est pas coché. La table n'est plus lisible par `anon`. Les brouillons de l'auteur sont lus
  hors cache, seulement pour les titulaires de `announcement.publish`.
- **Modification** : l'auteur seul, et seulement avec `announcement.publish` ; `edited_at` marque un post public dont le
  texte ou l'image a changé (« modifié »).

## Conséquences

- Positives : stockage borné (≈ 200 Ko par photo, soit ~5 000 photos pour 1 Go), pas de CPU serveur, pas de service
  tiers, auteur non exposé par défaut, fil public toujours cachable.
- Négatives : la qualité dépend du navigateur ; fichiers orphelins possibles ; les modérateurs
  (`announcement.delete`) voient l'auteur des posts publics dans la table (pas dans le fil).
- Brouillon et privé sont aujourd'hui tous deux visibles par l'auteur seul : la distinction est une étiquette, facile à
  durcir plus tard (par exemple « privé = équipe »).
- Travail induit : à surveiller en A-114 (taille du bucket et sortie de données Supabase).
