# Contraintes & budget de charge

> Chiffres des offres gratuites à **revérifier** avant le dev (ils changent) :
> https://supabase.com/pricing · https://vercel.com/pricing · https://supabase.com/docs/guides/realtime/limits

## Cible
- ~1000 utilisateurs inscrits, ~200 simultanés (pic).

## Limites connues à garder en tête (à confirmer)

| Service | Limite (free) | Impact |
|---|---|---|
| Supabase Realtime | ~200 connexions simultanées | **Exactement notre pic** → aucune marge. Ne pas ouvrir 1 websocket par composant ; 1 seul canal partagé par client, ou polling/SSE pour le non-critique. |
| Supabase Realtime | débit de messages/s limité | Justifie le ralentissement contrôlé (rate limit/backpressure). |
| Supabase DB | ~500 Mo | La compression des données utile ; prévoir purge/archivage. |
| Supabase DB | connexions directes limitées | Passer par le pooler (Supavisor), jamais de connexion par requête serverless. |
| Supabase projet | mise en pause après ~1 semaine d'inactivité | Prévoir un ping/cron (attention au quota Vercel Cron). |
| Supabase Auth | e-mails SMTP par défaut très limités | Configurer un SMTP custom (Resend, Brevo…) avant toute ouverture publique. |
| Vercel Hobby | **usage non commercial uniquement** | Si l'app est commerciale / monétisée → plan Pro obligatoire (CGU). |
| Vercel Hobby | durée de fonction, bande passante, invocations plafonnées | Cache + batch pour limiter les invocations. |
| Vercel Hobby | ~1 M requêtes edge, ~1 M invocations (le `proxy` en compte une par requête qu'il intercepte), ~4 h de CPU actif | Le `proxy` ne s'exécute que pour les connectés, jamais pour un préchargement ; garder peu de requêtes par écran. |
| Vercel Hobby | **~10 Go de transfert depuis le serveur** (Fast Origin Transfer) : au-delà, projet mis en pause | Servir un maximum depuis le CDN (coques statiques), alléger les pages rendues par le serveur (≈ 66 Ko chacune). |
| Supabase (cache partagé) | le cache `'use cache'` est **par instance** Vercel : N instances chaudes = N lectures par donnée et par fenêtre | Fenêtre de 2 min (`feed`), bouton « Actualiser » pour la fraîcheur à la demande. |
| Vercel Web Analytics | 50 000 événements/mois, puis collecte coupée | Échantillonnage à 5 % (`SampledAnalytics`). |
| Supabase Auth | ≈ 150 renouvellements de jeton par tranche de 5 min et par IP ; **tous partent des IP de Vercel** | Jeton de 1 h ; une sanction ne doit pas forcer tout le monde à renouveler en même temps. |
| Supabase DB | `auth.audit_log_entries` grossit à chaque renouvellement de jeton | Écriture du journal d'audit Auth en base désactivée (`docs/runbook.md`). |

## Principes d'architecture qui en découlent
1. **Lire peu, écrire en lot** : cache client → cache serveur → BDD (dans cet ordre).
2. **Écritures groupées** (batching) avec RPC SQL unique plutôt que N requêtes.
3. **Une seule source de permissions** : la BDD (RLS + fonctions SQL). Le front ne fait que masquer l'UI.
4. **Dégradation gracieuse** : sous charge, on ralentit (queue/throttle) au lieu de planter.
5. **Aucun secret côté client** : `service_role` uniquement côté serveur, jamais `NEXT_PUBLIC_`.

## Budget de charge mesuré (voir `docs/performance.md` et `docs/load-testing.md`)

| Mesure | Budget | Mesuré (200 utilisateurs, local) |
|---|---|---|
| Temps de réponse p95 / p99 | < 800 ms / < 2 s | 61 ms / 85 ms |
| Taux d'erreur | < 1 % | 0 % |
| CPU par page rendue | < 25 ms | ≈ 14 ms |
| Poids d'une page | < 100 Ko | ≈ 66 Ko |
| Lectures en base par page | < 5 % des pages | 0,5 % |
| CPU actif Vercel (600 000 pages/mois) | < 70 % de ~4 h | ≈ 60 % (estimation) |
