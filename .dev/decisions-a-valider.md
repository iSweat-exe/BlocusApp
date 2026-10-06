# Idées ajoutées par Claude — à valider

Marque chaque ligne **GARDER** ou **RETIRER**. Les idées retirées seront supprimées des checklists.

## Points d'attention (pas des idées, des risques réels)
| # | Sujet | Pourquoi c'est important |
|---|---|---|
| R1 | Vercel Hobby = **non commercial** | Si l'app est monétisée ou d'entreprise, il faut Pro (CGU Vercel). |
| R2 | 200 users simultanés = limite Realtime free tier | Zéro marge : prévoir 1 canal/client, dégradation gracieuse, voire polling pour le non-critique. |
| R3 | Compression ≠ requêtable | On ne peut pas filtrer/indexer/protéger par RLS un champ compressé → à limiter aux gros blobs. |
| R4 | Pas de backups fiables en free tier | Export régulier à planifier (O-073). |
| R5 | E-mails d'auth très limités par défaut | SMTP custom indispensable avant l'ouverture publique (A-012). |
| R6 | Projet Supabase mis en pause si inactif | Ping périodique ou usage régulier. |

## Idées ajoutées (🆕)
| ID | Idée | Décision |
|---|---|---|
| O-019 | i18n : aucun texte UI en dur | ☐ GARDER ☐ RETIRER |
| O-032 | Scan de secrets (gitleaks) en CI | ☐ GARDER ☐ RETIRER |
| O-034 | Tests de migrations + RLS en CI | ☐ GARDER ☐ RETIRER |
| O-045 | Bibliothèque de prompts/recettes LLM | ☐ GARDER ☐ RETIRER |
| O-052 | ADR (journal des décisions d'architecture) | ☐ GARDER ☐ RETIRER |
| O-063 | Seuil de couverture de tests | ☐ GARDER ☐ RETIRER |
| O-072 | Monitoring d'erreurs (Sentry free) | ☐ GARDER ☐ RETIRER |
| O-073 | Procédure de backup/restauration | ☐ GARDER ☐ RETIRER |
| A-013 | CAPTCHA + leaked password protection | ☐ GARDER ☐ RETIRER |
| A-020 | Security Advisor Supabase à 0 warning | ☐ GARDER ☐ RETIRER |
| A-036 | Overrides de permission par utilisateur | ☐ GARDER ☐ RETIRER |
| A-039 | Audit log des changements de rôles | ☐ GARDER ☐ RETIRER |
| A-056 | Actions admin : suspendre, force-logout, shadow-ban, reset profil | ☐ GARDER ☐ RETIRER |
| A-057 | Kill switch / mode lecture seule global | ☐ GARDER ☐ RETIRER |
| A-058 | Anti-lockout (dernier super_admin) | ☐ GARDER ☐ RETIRER |
| A-060 | 2FA obligatoire pour admins | ☐ GARDER ☐ RETIRER |
| A-086 | Redis (Upstash) si cache insuffisant | ☐ GARDER ☐ RETIRER |
| A-097 | UI optimiste + indicateur de synchro | ☐ GARDER ☐ RETIRER |
| A-106 | Rendu des messages par lots | ☐ GARDER ☐ RETIRER |
| A-107 | Test de charge k6/Artillery | ☐ GARDER ☐ RETIRER |
| A-112 | Accessibilité + Lighthouse | ☐ GARDER ☐ RETIRER |
| A-113 | RGPD : export/suppression de compte | ☐ GARDER ☐ RETIRER |

## Questions ouvertes
1. Quels rôles exacts veux-tu (au-delà de `user`, `moderator`, `admin`, `super_admin`) ?
2. Que sont les « messages » : chat temps réel, commentaires, messages privés ?
3. L'app est-elle commerciale (impact sur Vercel Hobby) ?
4. Langue de la documentation : français (actuel) ou anglais ? (les commentaires de code restent en anglais)
