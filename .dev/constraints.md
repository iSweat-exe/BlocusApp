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
| Supabase Auth | e-mails SMTP par défaut très limités | Aucun e-mail envoyé : pas de SMTP custom, pas de vérification d'e-mail (R5). |
| Vercel Hobby | **usage non commercial uniquement** | Si l'app est commerciale / monétisée → plan Pro obligatoire (CGU). |
| Vercel Hobby | durée de fonction, bande passante, invocations plafonnées | Cache + batch pour limiter les invocations. |

## Principes d'architecture qui en découlent
1. **Lire peu, écrire en lot** : cache client → cache serveur → BDD (dans cet ordre).
2. **Écritures groupées** (batching) avec RPC SQL unique plutôt que N requêtes.
3. **Une seule source de permissions** : la BDD (RLS + fonctions SQL). Le front ne fait que masquer l'UI.
4. **Dégradation gracieuse** : sous charge, on ralentit (queue/throttle) au lieu de planter.
5. **Aucun secret côté client** : `service_role` uniquement côté serveur, jamais `NEXT_PUBLIC_`.
