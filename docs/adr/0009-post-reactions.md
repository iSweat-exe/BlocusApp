# 0009 — Réactions emoji sur les posts

- **Statut** : Proposed
- **Date** : 2026-10-19
- **Décideurs** : @iSweat-exe

## Contexte

On veut pouvoir réagir à un post avec un emoji, comme sur Discord : une pastille par emoji avec son compteur, surlignée
quand on a réagi, et un « + » pour en ajouter. Contraintes : offres gratuites (le fil est lu en cache partagé de 2 min
par ~200 visiteurs), permissions décidées en base, mobile d'abord, aucune bibliothèque ajoutée sans accord.

## Options envisagées

**Quels emojis**

1. **N'importe quel emoji** (sélecteur complet) — demande une bibliothèque de sélecteur (poids, accord de l'équipe) et
   une validation Unicode délicate (séquences, variantes) ; stockage libre côté base.
2. **Une palette fixe** — 8 emojis choisis, un `check` en base, une rangée de boutons : aucun poids, aucune ambiguïté.

**Écriture**

1. **Droits `insert` / `delete` sur la table** protégés par RLS — il faut alors vérifier le bannissement, la
   visibilité du post et la limite de débit dans plusieurs politiques et triggers.
2. **Une fonction `toggle_announcement_reaction`** — un seul endroit pour toutes les vérifications, et un clic = un appel
   (pas de « lire puis écrire »).

**Lecture des totaux**

1. **Ajouter les totaux à la vue `announcement_feed`** — une seule requête, mais chaque réaction invalide le cache de tout
   le fil.
2. **Une vue séparée** lue avec son propre tag de cache — un clic n'invalide que les totaux.

## Décision

Palette fixe de 8 emojis (`👍 💜 😂 😮 😢 🔥 🎉 👏`), table `announcement_reactions` fermée en écriture, fonction
`toggle_announcement_reaction` (connecté, non banni, post public, 60 actions / minute), vue `announcement_reaction_counts`
lue en cache partagé (tag `reactions`). Pas de nouvelle permission : réagir est ouvert à tout compte connecté et actif,
comme lire ; les Guests voient les totaux. L'interface est optimiste (`useOptimistic`) et annule le changement si le
serveur refuse.

## Conséquences

- Aucune dépendance ajoutée ; poids client minimal.
- Les totaux des autres visiteurs peuvent retarder de 2 min au plus (ou immédiat avec « Actualiser ») ; les réactions du
  visiteur lui-même s'affichent toujours tout de suite et ne contredisent jamais le compteur.
- Changer la palette demande une migration (le `check`) et la mise à jour de `REACTION_EMOJIS`.
- Les réactions ne sont pas anonymes pour la base (la ligne porte `user_id`) mais aucun client ne peut lire celles des
  autres ; l'affichage de « qui a réagi » est au backlog.
