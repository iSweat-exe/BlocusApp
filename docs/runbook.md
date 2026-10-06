# Runbook (opérations)

## Environnements

| Env  | Supabase        | Vercel                         |
| ---- | --------------- | ------------------------------ |
| dev  | projet de DEV   | local (`npm run dev`)          |
| prod | projet de PROD  | production depuis `main`       |

Une **preview Vercel** est créée pour chaque pull request. Utiliser un projet Supabase **distinct** pour
dev et prod ; ne jamais pointer une preview vers la base de production.

## Gestion des secrets (O-070)

- Local : `.env.local` (jamais commité). Modèle : `.env.example`.
- Vercel : Project Settings → Environment Variables (séparer Preview et Production).
- `SUPABASE_SERVICE_ROLE_KEY` : serveur uniquement, jamais `NEXT_PUBLIC_`.
- **Rotation** (clé fuitée ou départ d'un développeur) : régénérer dans Supabase (Project Settings → API),
  mettre à jour Vercel, redéployer, révoquer l'ancienne clé. Si un secret a été commité : le considérer
  compromis, le rotater, puis nettoyer l'historique si nécessaire.
- Le mot de passe de la base Postgres ne doit apparaître nulle part dans le projet.

## Déploiement (O-035)

1. Lier le dépôt GitHub à Vercel (une seule fois).
2. Production Branch = `main` ; chaque PR = preview.
3. Appliquer les migrations Supabase **avant** de fusionner du code qui en dépend.
4. Vérifier les quotas (Supabase + Vercel) après chaque release.

## Création d'un `super_admin`

Uniquement par migration SQL ou SQL manuel exécuté par un mainteneur, jamais via l'UI publique. Procédure
détaillée à écrire à l'étape 1.4 (A-059).

## Sauvegarde et restauration

**Aucune sauvegarde n'est prévue** (décision R4, voir `.dev/decisions-a-valider.md`) : une perte de
données est tolérée. Cloudflare R2 (free tier) pourrait héberger des exports `pg_dump` si le besoin
apparaît, mais cela reste hors périmètre v1.0.0.

## Projet Supabase en pause

L'offre gratuite met le projet en pause après ~1 semaine d'inactivité. Le restaurer depuis le dashboard ;
prévoir une activité régulière ou un ping.

## Incidents

1. Activer le mode lecture seule/maintenance (étape 1.4, A-057) si disponible.
2. Consulter les logs Vercel (Runtime Logs) et Supabase (Logs Explorer).
3. Corriger via PR (hotfix `fix/…`), ne jamais modifier la production à la main.
