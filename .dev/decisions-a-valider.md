# Idées ajoutées par Claude — à valider

Marque chaque ligne **GARDER** ou **RETIRER**. Les idées retirées seront supprimées des checklists.

## Points d'attention (pas des idées, des risques réels)
| # | Sujet | Pourquoi c'est important |
|---|---|---|
| R1 | Vercel Hobby = **non commercial** | ✅ Accepté : l'app ne génère pas d'argent, Hobby suffit. |
| R2 | 200 users simultanés = limite Realtime free tier | Zéro marge : prévoir 1 canal/client, dégradation gracieuse, voire polling pour le non-critique. |
| R3 | Compression ≠ requêtable | On ne peut pas filtrer/indexer/protéger par RLS un champ compressé → à limiter aux gros blobs. |
| R4 | Pas de backups fiables en free tier | ✅ Accepté : pas de backup prévu, la perte de données est tolérée (O-073 retiré, aucune sauvegarde prévue ; Cloudflare R2 possible en théorie, hors périmètre). |
| R5 | E-mails d'auth très limités par défaut | ✅ Accepté : aucune vérification d'e-mail prévue, risque toléré. Pas de SMTP : A-012 retiré, A-011 sans e-mail. |
| R6 | Projet Supabase mis en pause si inactif | **Traité** : cron quotidien `/api/keep-alive` (`vercel.json`), voir `docs/runbook.md`. |

## Idées ajoutées (🆕)
| ID | Idée | Décision |
|---|---|---|
| O-019 | i18n : aucun texte UI en dur | ✅ GARDER, facultatif (non prioritaire) |
| O-032 | Scan de secrets (gitleaks) en CI | ☐ GARDER ☐ RETIRER |
| O-034 | Tests de migrations + RLS en CI | ☐ GARDER ☐ RETIRER |
| O-045 | Bibliothèque de prompts/recettes LLM | ☐ GARDER ☐ RETIRER |
| O-052 | ADR (journal des décisions d'architecture) | ☐ GARDER ☐ RETIRER |
| O-063 | Seuil de couverture de tests | ☐ GARDER ☐ RETIRER |
| O-072 | Monitoring d'erreurs (Sentry free) | ☐ GARDER ☐ RETIRER |
| O-073 | Procédure de backup/restauration | ❌ RETIRER (aucune sauvegarde prévue) |
| A-013 | CAPTCHA + leaked password protection | ❌ RETIRER (supprimé de la checklist) |
| A-020 | Security Advisor Supabase à 0 warning | ☐ GARDER ☐ RETIRER |
| A-036 | Overrides de permission par utilisateur | ☐ GARDER ☐ RETIRER |
| A-039 | Audit log des changements de rôles | ☐ GARDER ☐ RETIRER |
| A-056 | Actions admin : suspendre, force-logout, shadow-ban, reset profil | ☐ GARDER ☐ RETIRER |
| A-057 | Kill switch / mode lecture seule global | ☐ GARDER ☐ RETIRER |
| A-058 | Anti-lockout (dernier super_admin) | ☐ GARDER ☐ RETIRER |
| A-060 | 2FA obligatoire pour admins | ☐ GARDER ☐ RETIRER |
| A-021 | Login Discord + Google (priorité) | ☐ GARDER ☐ RETIRER |
| A-022 | Mode Guest en lecture seule (priorité) | ☐ GARDER ☐ RETIRER |
| A-126b | Édition du tracé sur mobile | ☐ GARDER ☐ RETIRER |
| A-126c | Outils gérants sur la carte (position + heure) | ☐ GARDER ☐ RETIRER |
| A-135a | Recherche approfondie push iOS avant implémentation | ☐ GARDER ☐ RETIRER |
| A-086 | Redis (Upstash) si cache insuffisant | ☐ GARDER ☐ RETIRER |
| A-097 | UI optimiste + indicateur de synchro | ☐ GARDER ☐ RETIRER |
| A-106 | Rendu des messages par lots | ☐ GARDER ☐ RETIRER |
| A-107 | Test de charge k6/Artillery | ☐ GARDER ☐ RETIRER |
| A-112 | Accessibilité + Lighthouse | ✅ GARDER, facultatif (peu important) |
| A-113 | RGPD : export/suppression de compte | ☐ GARDER ☐ RETIRER |

## Décisions d'authentification
- Pas d'authentification e-mail/mot de passe (trop complexe pour notre infra) : pas de « mot de passe oublié », un utilisateur qui perd son accès recrée un compte.
- Fournisseurs : **Google et Discord** (OAuth, natifs dans Supabase Auth). Instagram est abandonné (trop complexe à implémenter).

## Questions ouvertes
1. ~~Quels rôles exacts veux-tu (au-delà de `user`, `moderator`, `admin`, `super_admin`) ?~~ Réponse : `manager` (Gérant), plus `relay` (Relais), `editor` (Rédacteur) et `developer` (Développeur), voir A-031b et `docs/permissions.md`.
2. ~~Que sont les « messages » ?~~ Réponse : pas de messagerie pour l'instant, on communique via Instagram (reportée au Backlog).
3. ~~L'app est-elle commerciale (impact sur Vercel Hobby) ?~~ Réponse : non, elle ne génère pas d'argent (R1).
4. ~~Langue de la documentation~~ Réponse : **français** ; commentaires de code en **anglais**.
5. ~~Rôle « gérant » : nom exact et liste précise de ses permissions ?~~ Réponse : « Gérant » (`manager`) : annonces, tracé, position, création et clôture d'événements (matrice dans `docs/permissions.md`).
6. ~~Garde-t-on e-mail / mot de passe (A-011) en plus de Discord et Google ?~~ Réponse : non, OAuth uniquement (voir « Décisions d'authentification »).
7. Ville X et emprise de la carte ; lib de carte (A-126) ?
8. Un Guest voit-il la position de la manifestation en direct ?
