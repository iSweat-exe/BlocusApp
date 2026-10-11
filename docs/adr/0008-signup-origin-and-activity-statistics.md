# 0008 — Origine d'inscription et statistiques d'activité

- **Statut** : Proposed
- **Date** : 2026-10-11
- **Décideurs** : @iSweat-exe

## Contexte

Les administrateurs veulent savoir **d'où** viennent les inscrits (fiche utilisateur) et disposer d'une page de
statistiques : pics d'activité (utilisateurs en ligne par heure), inscriptions par heure, et d'autres chiffres.
Contraintes : offres gratuites (Vercel Hobby : un cron par jour ; Supabase Free : ~200 connexions Realtime, 500 Mo),
aucune bibliothèque ajoutée sans accord, permissions décidées en base, et une donnée de localisation est une donnée
personnelle.

## Options envisagées

**Origine d'inscription**

1. **Stocker l'adresse IP** et la géolocaliser plus tard — donnée personnelle brute, inutile pour le besoin, difficile à
   justifier (RGPD). Écarté.
2. **Service de géolocalisation tiers** — compte, quota, l'IP part chez un tiers. Écarté.
3. **Lire les en-têtes que Vercel ajoute déjà** (`x-vercel-ip-country`, `-country-region`, `-city`) au moment du
   callback OAuth, et ne garder que pays, région et ville — gratuit, aucune IP stockée, aucune dépendance.

**Activité par heure**

1. **Présence Realtime** — un websocket par visiteur : le pic visé (~200) est exactement la limite gratuite
   (`.dev/constraints.md`, ADR 0006). Écarté.
2. **Dériver l'activité de `auth.sessions`** — seulement l'instant présent, aucun historique par heure, et le jeton
   dure 1 h.
3. **Un cron qui échantillonne** — Vercel Hobby n'offre qu'un cron par jour ; `pg_cron` n'est pas utilisé dans ce projet.
4. **Un compteur alimenté par l'activité elle-même** — le proxy, qui voit déjà chaque requête d'un connecté, signale
   l'utilisateur au plus une fois par heure ; la base compte les utilisateurs distincts par heure.

**Graphiques** : une bibliothèque (Recharts, Chart.js) pèse plusieurs dizaines de Ko côté client et demande l'accord
de l'équipe ; des SVG rendus côté serveur ne coûtent aucun JavaScript.

## Décision

**Origine** : option 3. Table `signup_origins` (pays, région, ville ; jamais l'IP), écrite **une fois** par
`record_signup_origin()`, réservée au `service_role` (le callback est le seul endroit où l'en-tête est fiable ; un
client ne doit pas pouvoir choisir son origine), seulement pour un compte créé depuis moins de 15 minutes. Lecture avec
une permission dédiée `user.origin.view` (admin, super_admin), pas avec le simple accès à l'administration : un
modérateur n'a pas besoin de la localisation des gens. Sans la clé `service_role`, l'origine n'est pas notée et rien
d'autre n'est affecté.

**Activité** : option 4. `touch_activity()` appelée par le proxy après le rafraîchissement de la session, en
arrière-plan (`waitUntil`), au plus une fois par heure et par navigateur (cookie `blocus-seen`) ; la base n'incrémente le
compteur de l'heure (`activity_hours`) que la première fois qu'un utilisateur est vu dans cette heure
(`user_activity.last_seen_at`). Deux tables minuscules (≈ 9 000 lignes par an pour l'une, une ligne par utilisateur pour
l'autre), sans purge. Une heure UTC pleine est l'unité ; l'affichage est en heure de Paris. Les heures avant le déploiement
ne sont pas mesurées et sont marquées comme telles (`tracked`), jamais affichées comme « 0 ».

**Inscriptions par heure** : calculées à la demande depuis `profiles.created_at` (aucun stockage de plus ; l'historique
est complet dès le premier jour).

**Statistiques** : permission `statistics.view` (admin, super_admin), trois fonctions SQL en lecture seule qui ne
renvoient que des comptages et revérifient la permission, page `/admin/statistics` dynamique, graphiques en SVG écrits à
la main (aucune dépendance).

## Conséquences

- Positives : coût nul (≤ 1 appel SQL par utilisateur et par heure), aucune connexion Realtime, aucune IP stockée,
  permissions granulaires, aucune dépendance ajoutée, historique des inscriptions complet.
- Négatives : « en ligne par heure » = utilisateurs **distincts vus** dans l'heure, pas une simultanéité (le pic de
  connexions simultanées n'est pas mesuré) ; l'historique d'activité commence au déploiement ; l'origine est
  approximative (VPN, réseau mobile) et absente pour les comptes existants et en local ; la clé `service_role` est lue
  par un second endroit du code (le callback, pour une seule fonction SQL).
- Travail induit : appliquer les trois migrations (additives : le proxy ignore l'absence de `touch_activity()`, la fiche
  et la page affichent une erreur lisible tant que les fonctions manquent), vérifier `SUPABASE_SERVICE_ROLE_KEY`
  (`docs/runbook.md`), mentionner la localisation approximative dans la politique de confidentialité (A-113).
