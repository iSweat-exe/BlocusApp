# 0005 — Librairie et fond de carte

- **Statut** : Proposed
- **Date** : 2026-10-08
- **Décideurs** : @iSweat-exe (choix déléguées à l'assistant, contraintes : beau, simple à utiliser et à intégrer, sans quota ni crédits payants)

## Contexte

La carte (A-126) affiche le tracé des déplacements, éditable au doigt sur mobile, et la position de la manifestation
déclarée par un gérant. Contraintes : offres gratuites, aucun quota si possible, aucun compte ni clé, rendu agréable
sur mobile, intégration simple dans Next.js, aucune géolocalisation des utilisateurs envoyée au serveur (A-127).

## Options envisagées

1. **Leaflet + tuiles raster OpenStreetMap** — très léger (~40 Ko compressés), simple ; mais la politique d'usage des
   tuiles OSM officielles interdit un usage intensif, rendu raster moins fluide (pas de zoom continu, pas de rotation).
2. **MapLibre GL JS + tuiles vectorielles OpenFreeMap** — rendu vectoriel fluide (zoom continu, rotation), styles
   prêts à l'emploi, gratuit, sans compte, sans clé, sans limite annoncée, usage commercial autorisé ; plus lourd
   (chunk mesuré : 279 Ko compressés, plus 143 Ko de worker), nécessite WebGL, et le service vit de dons sans garantie publiée.
3. **Mapbox / Google Maps** — très complets, mais compte, quotas et facturation : écartés.
4. **MapLibre + tuiles auto-hébergées (PMTiles)** — indépendant de tout service, mais un fichier de plusieurs dizaines
   à centaines de Mo à héberger : repli possible plus tard, pas pour démarrer.

## Décision

Option 2 : **MapLibre GL JS** (licence BSD-3) avec le style **OpenFreeMap** (`liberty` en clair, `positron` inversé en
sombre). Tout ce qui dépend du fournisseur est dans `src/features/map/map-config.ts` (une URL de style) : passer à
l'option 4 en cas de besoin ne touche qu'un fichier et la CSP.

- Chargement **à la demande** (`next/dynamic`, sans SSR) : MapLibre n'alourdit aucune autre page. La page `/map` est
  une exception assumée au budget de 100 Ko par page.
- MapLibre 6 exécute un worker de module : son fichier est émis par le bundler et déclaré avec `setWorkerUrl()`.
- L'attribution « © OpenStreetMap contributors » est une obligation de licence (ODbL) : conservée, repliée derrière un
  petit bouton « i ».
- « Me localiser » utilise `navigator.geolocation` **sur l'appareil seulement** (marqueur local, rien n'est envoyé).
- Édition du tracé (A-126b) : éditeur maison sur une source GeoJSON (viseur central, poignées, annuler/rétablir) plutôt
  qu'une librairie de dessin dont le comportement au toucher n'est pas établi ; à rouvrir si l'essai sur téléphones réels
  ne convainc pas (Terra Draw, MIT, est la piste).

## Conséquences

- CSP (`next.config.ts`) : `tiles.openfreemap.org` ajouté à `img-src` et `connect-src`, `worker-src 'self' blob:`.
- Dépendance ajoutée : `maplibre-gl`.
- Risque : disponibilité d'OpenFreeMap (don, sans garantie) ; repli = option 4.
- Reste à faire : ville X et emprise (`DEFAULT_VIEW`), apparence du style sombre à valider sur de vrais écrans.
