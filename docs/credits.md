# Crédits des images

> Les crédits de l'équipe (développeurs et leur GitHub) sont dans l'application, page `/credits` : liste dans
> `src/features/credits/team.ts`.

Toute image du dépôt qui n'a pas été produite par l'équipe est listée ici, avec sa source, son auteur et sa
licence, **avant** d'être mergée. Pas de personne reconnaissable (surtout si elle semble mineure) sans son
consentement : c'est ce qui a fait retirer les premières photos de fond de `/login` (source et licence inconnues).

## Fond de l'écran de connexion (`/login`) : images provisoires

Trois photos de [Lorem Picsum](https://picsum.photos), un service libre qui sert des photos publiées sur Unsplash.
Ce sont des images « template » : elles tiennent la place du fond prévu, en attendant des images dont l'équipe
détient les droits (voir le Backlog de la checklist).

| Fichier (`public/images/login/`) | Photo Picsum | Auteur               | Page de la photo                        |
| -------------------------------- | ------------ | -------------------- | --------------------------------------- |
| `login-bg-1.jpg`                | id 15        | Paul Jarvis          | https://unsplash.com/photos/NYDo21ssGao |
| `login-bg-2.jpg`                | id 47        | Christopher Sardegna | https://unsplash.com/photos/uDUiRS8YroY |
| `login-bg-3.jpg`                | id 29        | Go Wild              | https://unsplash.com/photos/V0yAek6BgGk |

- **Licence** : celle d'Unsplash (d'après Lorem Picsum). Elle autorise l'usage libre, commercial compris, sans
  permission préalable. À **vérifier sur la page de chaque photo** avant la mise en production.
- **Traitement** : téléchargées en `https://picsum.photos/id/<id>/1200/800.webp`, redimensionnées à 900 px de large
  et recompressées en WebP qualité 40 avec `sharp` (déjà présent avec Next.js, aucune dépendance ajoutée). Poids :
  58, 20 et 85 Ko.
- **Aucune requête vers Picsum à l'exécution** : les fichiers sont servis par l'application elle-même (`img-src
  'self'`, pas de changement de CSP, aucune donnée de visiteur envoyée à un tiers).
- **Remplacer** : déposer les nouveaux fichiers dans `public/images/login/` (ou modifier `LOGIN_BACKGROUNDS` dans
  `src/features/auth/login-background.tsx`), viser moins de 100 Ko par image, puis mettre ce tableau à jour.
