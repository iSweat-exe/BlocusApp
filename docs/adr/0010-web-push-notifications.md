# 0010 — Notifications push (Web Push + VAPID)

- **Statut** : Proposed
- **Date** : 2026-10-19
- **Décideurs** : @iSweat-exe

## Contexte

BLOCUS devient un média : il faut pouvoir prévenir les gens d'un nouveau post sans qu'ils ouvrent l'application.
L'application est une PWA (iOS et Android), sur offres gratuites (Vercel Hobby, Supabase Free), sans compte développeur
Apple ni Google. La checklist (A-135a) demande une recherche avant tout code.

## Ce que dit la recherche

- **Standard** : Web Push = API Push + API Notifications + service worker, avec une paire de clés **VAPID** (RFC 8292) qui
  identifie le serveur, et un message **chiffré** (RFC 8291) par le serveur avec les clés de l'abonné. Aucune plateforme
  propriétaire à configurer : le navigateur fournit l'adresse (`endpoint`) du service de push.
- **Android** : Chrome (service FCM, `fcm.googleapis.com` ; `jmt17.google.com` pour les versions Beta / Dev / Canary) et Firefox ; l'installation de l'application n'est pas requise.
- **iOS / iPadOS ≥ 16.4** : uniquement pour une web app **ajoutée à l'écran d'accueil** (manifeste avec
  `display: standalone`, ce qui est déjà le cas) ; la permission ne peut être demandée **qu'en réponse à un geste de
  l'utilisateur** ; passe par APNs (`*.push.apple.com`) ; aucun compte Apple Developer nécessaire ([WebKit, « Web Push
  for Web Apps on iOS and iPadOS »](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)). Safari
  n'accepte pas les pushs « silencieux » : chaque message doit afficher une notification, sinon la permission est retirée.
- **Declarative Web Push** (Safari 18.4+, [WebKit](https://webkit.org/blog/16535/meet-declarative-web-push/)) : un message
  JSON avec `web_push: 8030` est affiché par le navigateur lui-même, sans service worker ; les navigateurs qui ne le
  connaissent pas le passent au service worker comme un message ordinaire.
- **Fiabilité** : Apple ne garantit pas de renvoyer 410 après un désabonnement, avec un délai ; Chrome / Firefox renvoient
  404 / 410 pour un abonnement mort. On supprime sur 404 / 410 et on ne réessaie pas.
- **Taille** : ~4 Ko par message chiffré : on n'envoie que titre, début de texte et lien.
- Le guide Next.js installé dans le projet (`node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`) donne
  le même schéma (Server Actions + `web-push` + service worker) ; il stocke l'abonnement en mémoire, ce qui ne convient
  pas à la production.

## Options envisagées

**Service d'envoi**

1. **OneSignal, FCM direct, Novu…** — compte et quota tiers, les adresses des abonnés partent chez un tiers, SDK
   supplémentaire. Écarté.
2. **Chiffrement fait à la main avec `node:crypto`** — zéro dépendance mais ~150 lignes de cryptographie à maintenir ; une
   erreur casse les envois sans bruit. Écarté.
3. **Librairie `web-push`** — référence du marché, utilisée par le guide Next.js, gère VAPID, le chiffrement et les
   en-têtes ; `npm audit --omit=dev` : 0 vulnérabilité.

**Où envoyer**

1. **Dans la requête de publication** — l'auteur attend tous les envois.
2. **Après la réponse (`after()`)** — l'auteur n'attend rien ; la fonction continue de tourner. Retenu.
3. **File d'attente (pgmq, cron)** — plus robuste, mais disproportionné pour ~1000 abonnés et un cron par jour sur Hobby.

**Qui peut lire la table des abonnements** : personne côté client. Une adresse d'abonnement est une « capacité » : qui
la connaît peut envoyer des notifications à l'appareil.

## Décision

- Dépendance **`web-push`** (accord de l'équipe obtenu), `@types/web-push` en développement.
- Table `push_subscriptions` fermée aux clients ; écriture par `save_push_subscription` / `remove_push_subscription`
  (connecté, non banni, 20 / minute, 10 appareils par compte) ; **liste blanche des services de push** dans un `check`
  (protection contre un appel du serveur vers une adresse arbitraire).
- Envoi par `broadcastPush` (`src/server/push.ts`) dans `after()`, avec la clé `service_role`, par lots de 20,
  suppression des abonnements 404 / 410. Désactivé sans clés VAPID.
- Premier déclencheur : **un post qui devient public** (création publique, ou brouillon / privé passé en public).
- Message au format Declarative Web Push, lu aussi par `public/sw.js` ; le service worker affiche toujours une
  notification et n'ouvre que des adresses du site.
- L'abonnement est un réglage **par appareil**, activé dans Réglages sur un geste, jamais demandé au chargement.

## Conséquences

- Les notifications ne marchent pas en développement (le service worker n'est enregistré qu'en production) ni sans les
  variables `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (voir `docs/runbook.md`).
- Perdre ou changer la clé privée invalide tous les abonnements.
- Un envoi à ~1000 abonnés prend quelques secondes ; si la durée de la fonction devient un problème, passer à une file.
- Un abonnement mort n'est détecté qu'à l'envoi suivant : la table peut contenir des lignes périmées entre deux posts.
- La réception sur de vrais iPhone et Android reste à valider à la main (A-135b, A-135c).
- Suite au Backlog : autres déclencheurs, choix par rubrique, notification test, `pushsubscriptionchange`.
