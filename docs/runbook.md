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

## Claims JWT de permissions (A-034)

En local le hook est activé par `supabase/config.toml`. **Sur un projet hébergé**, activer à la main :
Supabase → Authentication → Hooks → Custom Access Token → type « Postgres », fonction
`public.custom_access_token_hook`. Sans cela, `requirePermission()` refuse tout (claims absents) ; la RLS
continue de fonctionner. Après l'activation, les utilisateurs déjà connectés reçoivent les claims au
prochain refresh du token (≤ 1 h) ou après reconnexion.

## Keep-alive contre la mise en pause (Supabase gratuit)

Un projet Supabase gratuit est mis en pause après ~7 jours sans activité. `vercel.json` déclare un cron quotidien
(`0 6 * * *`) qui appelle `/api/keep-alive` (une lecture d'une ligne). **À faire une fois sur Vercel** : définir la
variable d'environnement `CRON_SECRET` (une longue chaîne aléatoire, environnement Production) ; Vercel l'envoie
alors tout seul en `Authorization: Bearer …` à ses crons et la route refuse tout autre appelant. Vérifier ensuite
dans Vercel → Settings → Cron Jobs que la tâche apparaît et que sa dernière exécution renvoie 200. L'offre Hobby
autorise un cron par jour.

## Durée de vie du jeton (JWT) : 15 minutes

Le JWT porte le rôle et les permissions (`custom_access_token_hook`). Il est renouvelé automatiquement par
`src/proxy.ts` ; sa durée de vie fixe le délai maximal avant qu'un changement de rôle, de permission ou un
bannissement soit visible dans l'interface (les actions sensibles vérifient de toute façon en base).

- Local : `jwt_expiry = 900` dans `supabase/config.toml` (déjà fait).
- **Projet hébergé (à régler à la main)** : tableau de bord Supabase, réglage « JWT expiry » du projet
  (Authentication → Sessions, ou Project Settings → API / JWT Keys selon la version du tableau de bord) :
  mettre **900** secondes (valeur par défaut : 3600). Les utilisateurs déjà connectés reçoivent la nouvelle durée à
  leur prochain renouvellement. Coût : un renouvellement de jeton par utilisateur actif et par quart d'heure (appel à
  Supabase Auth et ~5 requêtes du hook), négligeable pour ~200 utilisateurs simultanés.

## Déploiement (O-035)

1. Lier le dépôt GitHub à Vercel (une seule fois).
2. Production Branch = `main` ; chaque PR = preview.
3. Appliquer les migrations Supabase **avant** de fusionner du code qui en dépend.
4. Vérifier les quotas (Supabase + Vercel) après chaque release.

## Création d'un `super_admin`

Uniquement par SQL exécuté par un mainteneur (éditeur SQL Supabase), jamais via l'application :
`assign_role()` interdit de promouvoir quiconque en `super_admin`. L'utilisateur doit s'être connecté une
fois (son profil existe) :

```sql
update public.profiles set role = 'super_admin' where pseudo = '<pseudo>';
```

Puis se déconnecter / reconnecter pour renouveler le token. Garde-fou : le **dernier** `super_admin` ne peut
être ni rétrogradé ni supprimé (trigger `profiles_keep_last_super_admin`, erreur `last_super_admin`) : pour le
remplacer, promouvoir d'abord le nouveau, puis rétrograder l'ancien. Cela bloque aussi la suppression de son
compte `auth.users` (cascade).

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
