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

## Connexion Discord (A-021)

Actions manuelles (une fois par environnement) :

1. [Discord Developer Portal](https://discord.com/developers/applications) → New Application → OAuth2 :
   ajouter le redirect `https://<project-ref>.supabase.co/auth/v1/callback`, copier Client ID et Secret.
2. Supabase → Authentication → Providers → Discord : activer, coller Client ID / Secret.
3. Supabase → Authentication → URL Configuration : `Site URL` = URL de production ; `Redirect URLs` =
   `https://<prod>/auth/callback`, `https://*-<équipe>.vercel.app/auth/callback` (previews) et
   `http://localhost:3000/auth/callback`.
4. `NEXT_PUBLIC_SITE_URL` renseigné dans Vercel (utilisé pour le `redirectTo`).

Le Client Secret ne se met jamais dans le dépôt ni dans un commentaire de `.env`.

## Déploiement (O-035)

1. Lier le dépôt GitHub à Vercel (une seule fois).
2. Production Branch = `main` ; chaque PR = preview.
3. Appliquer les migrations Supabase **avant** de fusionner du code qui en dépend.
4. Vérifier les quotas (Supabase + Vercel) après chaque release.

## Création d'un `super_admin`

Uniquement par migration SQL ou SQL manuel exécuté par un mainteneur, jamais via l'UI publique. Procédure
détaillée à écrire à l'étape 1.4 (A-059).

## Sauvegarde et restauration (O-073)

L'offre gratuite de Supabase n'offre pas de sauvegarde automatique fiable : planifier un export régulier.

```bash
# Export complet (remplacer l'URI par la chaîne de connexion du POOLER, jamais commitée)
pg_dump "$SUPABASE_DB_URL" --no-owner --format=custom --file=backup-YYYY-MM-DD.dump

# Restauration vers une base VIERGE de test
pg_restore --no-owner --dbname="$TARGET_DB_URL" backup-YYYY-MM-DD.dump
```

- Stocker les dumps hors du dépôt, chiffrés.
- Fréquence recommandée : hebdomadaire, plus une avant chaque migration risquée.
- **À faire** : tester une restauration complète une fois le schéma initial en place (étape 1.1).

## Projet Supabase en pause

L'offre gratuite met le projet en pause après ~1 semaine d'inactivité. Le restaurer depuis le dashboard ;
prévoir une activité régulière ou un ping.

## Incidents

1. Activer le mode lecture seule/maintenance (étape 1.4, A-057) si disponible.
2. Consulter les logs Vercel (Runtime Logs) et Supabase (Logs Explorer).
3. Corriger via PR (hotfix `fix/…`), ne jamais modifier la production à la main.
