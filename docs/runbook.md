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
prochaine requête de page : l'application réémet elle-même les tokens plus anciens que le dernier changement de
permissions (`permission_epoch`, voir `docs/permissions.md`). **Appliquer la migration `20261008100000_permission_epoch.sql`
sur le projet hébergé** avant de déployer ce code : sans elle `get_permission_epoch` n'existe pas, l'application
l'ignore sans erreur et retombe sur le délai d'expiration du token.

## Keep-alive contre la mise en pause (Supabase gratuit)

Un projet Supabase gratuit est mis en pause après ~7 jours sans activité. `vercel.json` déclare un cron quotidien
(`0 6 * * *`) qui appelle `/api/keep-alive` (une lecture d'une ligne). **À faire une fois sur Vercel** : définir la
variable d'environnement `CRON_SECRET` (une longue chaîne aléatoire, environnement Production) ; Vercel l'envoie
alors tout seul en `Authorization: Bearer …` à ses crons et la route refuse tout autre appelant. Vérifier ensuite
dans Vercel → Settings → Cron Jobs que la tâche apparaît et que sa dernière exécution renvoie 200. L'offre Hobby
autorise un cron par jour.

## Durée de vie du jeton (JWT) : 1 heure

Le JWT porte le rôle et les permissions (`custom_access_token_hook`). Il est renouvelé automatiquement par
`src/proxy.ts`. Sa durée de vie est de **1 heure** (valeur par défaut de Supabase) : elle fixe le délai maximal avant
qu'une sanction qui **expire toute seule** (mute ou bannissement temporaire arrivé à échéance) soit visible dans
l'interface. Tout le reste est pris en compte à la requête suivante : les changements de rôle, de permission et les
sanctions passent par `permission_epoch` (`docs/permissions.md`), un bannissement supprime la session, et les actions
sensibles vérifient de toute façon en base (`fresh`).

Pourquoi pas 15 minutes (valeur utilisée avant) : chaque utilisateur actif renouvelait son jeton 4 fois plus
souvent, et **tous les renouvellements partent des adresses IP de Vercel** : la limite de Supabase Auth
(150 renouvellements par tranche de 5 minutes et par IP, par défaut) est alors atteinte plus vite, et un refus (429)
déconnecte l'utilisateur dont le jeton vient d'expirer. Chaque renouvellement écrit aussi 2 lignes dans le journal
d'audit d'Auth (voir plus bas) et renvoie l'objet utilisateur complet (egress).

- Local : `jwt_expiry = 3600` dans `supabase/config.toml`.
- **Projet hébergé (à vérifier à la main)** : tableau de bord Supabase, réglage « JWT expiry » (Authentication →
  Sessions, ou Project Settings → API / JWT Keys selon la version) : mettre **3600** secondes. Si le projet avait été
  réglé à 900, les utilisateurs déjà connectés reçoivent la nouvelle durée à leur prochain renouvellement.

## Journal d'audit de Supabase Auth : ne pas l'écrire en base

Depuis 2025, Supabase Auth écrit **2 lignes par renouvellement de jeton** (`token_refreshed` et `token_revoked`) dans
`auth.audit_log_entries`, une table que rien ne purge. À 1000 utilisateurs actifs, cela représente des millions de
lignes par an : le quota de **500 Mo** de la base gratuite serait atteint en 4 à 8 mois, alors que toutes les tables de
l'application ensemble restent sous 20 Mo par an.

**À faire une fois sur le projet hébergé** : tableau de bord Supabase → Authentication → Audit Logs → activer
« Disable writing auth audit logs to the project database ». Les journaux restent consultables dans le tableau de bord
(Logs Explorer), seul l'accès en SQL à cet historique est perdu. Contrôler ensuite la taille avec :

```sql
select relname, pg_size_pretty(pg_total_relation_size(c.oid))
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'auth' order by pg_total_relation_size(c.oid) desc limit 5;
```

Si la table `auth.audit_log_entries` est déjà volumineuse, elle peut être vidée depuis l'éditeur SQL du tableau de
bord (`truncate auth.audit_log_entries;`) : c'est un journal, pas une donnée de l'application. Le journal d'audit de
l'application (`audit_logs`) est distinct et n'est pas concerné.

## Région des fonctions Vercel

`vercel.json` fixe `"regions": ["dub1"]` (Dublin) : le projet Supabase est à **Irlande (eu-west-1)**. Sans cela, les
fonctions tournent par défaut à Washington (`iad1`) : chaque lecture en base, renouvellement de jeton ou lecture de
l'epoch ajoutait ~90 ms d'aller-retour transatlantique à la durée de la fonction (durée comptée en mémoire
provisionnée) et à la latence perçue. Si le projet Supabase est un jour recréé dans une autre région, changer cette
valeur (une seule région est autorisée sur l'offre Hobby).

## Déploiement (O-035)

1. Lier le dépôt GitHub à Vercel (une seule fois).
2. Production Branch = `main` ; chaque PR = preview.
3. Les migrations Supabase sont appliquées **automatiquement** après la fusion sur `main` (section ci-dessous) : ne
   plus les passer à la main.
4. Vérifier les quotas (Supabase + Vercel) après chaque release.

## Migrations automatiques (workflow `.github/workflows/supabase.yml`)

- **Sur une PR** touchant `supabase/**` : job « Database tests » : `supabase start` (base jetable en local, toutes
  les migrations rejouées depuis zéro) puis `supabase test db` (pgTAP, dont les tests RLS). Une migration cassée ou
  un test SQL rouge fait échouer la PR. Aucun secret n'est exposé aux PR.
- **Après fusion sur `main`** d'une PR qui ajoute une migration : job « Apply migrations to production » (après les
  tests) : `supabase link`, `supabase db push --dry-run` (liste ce qui va être appliqué, visible dans le journal)
  puis `supabase db push`. Une seule exécution à la fois (`concurrency`), jamais annulée en cours de route, chaque
  migration est transactionnelle (en cas d'erreur, la migration fautive n'est pas appliquée).
- **À configurer une seule fois (réglages GitHub, par un mainteneur)** :
  1. Settings → Environments → **New environment** `production` ; ajouter **Required reviewers** (toi) : chaque
     exécution attend ton approbation (depuis l'application GitHub mobile) avant de toucher à la production.
     Restreindre aussi « Deployment branches » à `main`.
  2. Dans cet environnement, ajouter les **secrets** : `SUPABASE_ACCESS_TOKEN` (Supabase → Account → Access
     Tokens), `SUPABASE_DB_PASSWORD` (mot de passe de la base du projet) et `SUPABASE_PROJECT_ID` (la « reference ID »
     du projet, Project Settings → General). Le job échoue avec un message clair s'il en manque un.
- **Base de référence (une seule fois si des migrations ont déjà été passées à la main)** : `db push` applique tout
  ce qui n'est pas dans l'historique `supabase_migrations` du projet. Si les migrations existantes ont été exécutées
  dans l'éditeur SQL, déclarer leurs versions comme déjà appliquées : Actions → **Supabase** → *Run workflow* sur
  `main`, champ `mark_applied` = les versions séparées par des espaces (noms des fichiers de `supabase/migrations/`
  sans `_description.sql`, par exemple `20261007120000 20261007130000 …`). Ne mettre **que** celles réellement
  présentes en production ; les autres seront appliquées par ce même run. Si les migrations ont toujours été
  appliquées avec `supabase db push`, rien à faire.
- **Règle de compatibilité** : le code se déploie sur Vercel dès la fusion, en parallèle de la migration (et la
  migration peut attendre une approbation). Écrire les migrations de façon **additive** (nouvelle colonne, nouvelle
  fonction, nouvelle table) et ne retirer l'ancien (colonne, fonction) qu'une PR plus tard, quand plus aucun code ne
  s'en sert. Le code doit tolérer l'absence d'un ajout récent (comme `get_permission_epoch` : l'application l'ignore
  tant que la migration n'est pas passée).
- Un échec laisse la production inchangée pour la migration fautive : lire le journal, corriger par une **nouvelle**
  migration (jamais en éditant une migration déjà fusionnée), puis relancer le workflow (*Re-run jobs*).

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
