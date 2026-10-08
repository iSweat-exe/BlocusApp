# 0006 — Surveillance de la santé du back end

- **Statut** : Proposed
- **Date** : 2026-10-09
- **Décideurs** : @iSweat-exe

## Contexte

Il faut voir d'un coup d'œil si l'application va bien : base de données, authentification, déploiement Vercel,
quota de stockage, nombre d'utilisateurs, avec un score global et un historique. Contraintes : offres gratuites
(Vercel Hobby : un cron par jour ; Supabase Free : ~200 connexions Realtime, 500 Mo), pas de service payant, aucun
secret côté client, et la page doit rester réservée à une permission.

## Options envisagées

1. **Service externe (UptimeRobot, Better Stack, Sentry)** — mesures fiables depuis l'extérieur, mais ni score
   maison, ni compteurs d'utilisateurs, ni stockage ; reste utile en complément (alerte).
2. **`pg_cron` + extension Supabase** — historique fin sans Vercel, mais une extension à activer à la main sur
   chaque environnement, un risque pour le pipeline de migrations, et aucune mesure de latence depuis Vercel.
3. **Page admin qui mesure à la demande + historique alimenté à chaque visite et par le cron quotidien existant** —
   rien à installer, aucun quota de plus ; l'historique est plus dense quand l'équipe consulte la page.
4. **Utilisateurs « en direct » par présence Supabase Realtime** — précis, mais un websocket par visiteur : le pic
   visé (~200) est exactement la limite gratuite (`.dev/constraints.md`). **Écarté.**

## Décision

Option 3 (+ un endpoint public `/api/health` pour un moniteur externe, option 1 en complément).

- Permission `monitoring.view` (admin, super_admin) ; page `/admin/health` ; fonctions SQL `health_stats()`,
  `record_health_snapshot()` et `can_monitor()` (permission **ou** rôle `service_role`), table `health_snapshots`
  en lecture seule pour `monitoring.view`.
- **Utilisateurs actifs** = utilisateurs dont une session Auth a été renouvelée dans les 15 dernières minutes
  (`auth.sessions.refreshed_at`) : le jeton dure 15 minutes, toute requête d'un utilisateur actif le renouvelle.
  C'est une approximation (jusqu'à 15 minutes de retard, invités non comptés), sans aucune connexion de plus.
- **Historique** : un instantané par visite de la page (la base en garde au plus un toutes les 10 minutes) et un
  par jour dans le cron de `/api/keep-alive`, conservés 30 jours (purge à l'insertion, sans `pg_cron`).
- **Score** (0-100) : latence de la base (40), latence d'Auth (25), taille de la base face aux 500 Mo (20),
  dernier déploiement Vercel (15) ; une mesure inconnue (Vercel non configuré) est écartée du calcul.
- **Vercel** : API REST `GET /v6/deployments` avec un jeton, uniquement côté serveur.
- Le cron n'ayant pas d'utilisateur, il utilise la clé `service_role` (premier usage dans l'application), via un
  client dédié et étroit ; sans la clé, il ne fait rien.

## Conséquences

- Positives : aucun coût, aucune extension, aucune connexion Realtime ; la page est testée (pgTAP, unitaires).
- Négatives : historique sans trou garanti seulement à une mesure par jour ; « actifs » est une approximation ;
  la clé `service_role` est désormais lue par le code serveur (portée limitée au cron).
- Travail induit : variables d'environnement Vercel (`docs/runbook.md`), moniteur externe sur `/api/health`.
