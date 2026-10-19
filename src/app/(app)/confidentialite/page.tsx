import type { Metadata } from "next";
import { LEGAL, PROCESSORS } from "@/features/legal/legal-info";
import { InternalLink, LegalPage, LegalSection, LegalValue } from "@/features/legal/legal-page";

export const metadata: Metadata = { title: "Politique de confidentialité · BLOCUS" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      intro="Quelles données BLOCUS. garde, pourquoi, pour combien de temps, et comment les récupérer ou les effacer."
    >
      <LegalSection title="Qui est responsable">
        <p>
          Le responsable du traitement est <LegalValue value={LEGAL.publisher.name} /> (
          <LegalValue value={LEGAL.publisher.country} />
          ). Contact : <LegalValue value={LEGAL.publisher.contactEmail} />.
        </p>
      </LegalSection>

      <LegalSection title="Ce que nous gardons">
        <p>
          Sans compte (mode invité), tu lis l&apos;application sans que nous enregistrions quoi que
          ce soit à ton sujet. Avec un compte, nous gardons :
        </p>
        <ul>
          <li>
            <strong>Ton compte</strong> : l&apos;adresse e-mail, le pseudo et la photo que Discord
            ou Google nous transmet, la date de création et ton rôle dans l&apos;application.
          </li>
          <li>
            <strong>Ton origine d&apos;inscription</strong> : le pays, la région et la ville déduits
            de ton adresse IP par l&apos;hébergeur au moment de la création du compte.
            L&apos;adresse IP elle-même n&apos;est ni lue ni enregistrée. Seuls les administrateurs
            la voient (en totaux par pays dans les statistiques).
          </li>
          <li>
            <strong>Ta dernière activité</strong> : la date de ta dernière visite (précision de 5
            minutes), visible des seuls administrateurs, et un compteur anonyme d&apos;utilisateurs
            actifs par heure.
          </li>
          <li>
            <strong>Ce que tu fais dans l&apos;application</strong> : tes réactions aux posts et, si
            tu es gérant, les posts, événements et positions que tu publies.
          </li>
          <li>
            <strong>Tes notifications</strong> : si tu les actives, l&apos;identifiant technique de
            ton appareil fourni par ton navigateur, pour pouvoir t&apos;envoyer les notifications.
          </li>
          <li>
            <strong>La modération</strong> : l&apos;historique des sanctions (motif, date) et un
            journal des actions d&apos;administration.
          </li>
        </ul>
        <p>
          Nous ne demandons jamais ta position : « Me localiser » sur la carte reste sur ton écran.
          Aucune donnée n&apos;est vendue ni utilisée pour de la publicité.
        </p>
      </LegalSection>

      <LegalSection title="Pourquoi (bases légales)">
        <ul>
          <li>
            <strong>Exécution du service</strong> que tu demandes : compte, connexion, posts,
            réactions, notifications que tu actives (ton consentement, que tu retires en les
            désactivant).
          </li>
          <li>
            <strong>Intérêt légitime</strong> : sécurité, lutte contre les abus (modération, limites
            d&apos;usage), statistiques de fréquentation et dimensionnement du service.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Cookies et stockage sur ton appareil">
        <p>
          Nous n&apos;utilisons <strong>aucun cookie publicitaire ni de suivi</strong>, donc aucune
          bannière de consentement n&apos;est nécessaire. Seuls des éléments strictement nécessaires
          au fonctionnement sont posés :
        </p>
        <ul>
          <li>
            <strong>blocus-auth</strong> (cookie, illisible par les scripts) : ta session de
            connexion.
          </li>
          <li>
            <strong>blocus-seen</strong> (cookie, 5 minutes) : évite de signaler ton activité à
            chaque page.
          </li>
          <li>
            Un cookie temporaire pendant la connexion avec Discord ou Google (sécurité de
            l&apos;échange).
          </li>
          <li>
            Sur ton appareil (stockage local) : ton thème et ta couleur, la fin de
            l&apos;introduction, et un tirage anonyme qui décide si ta visite est comptée par la
            mesure d&apos;audience (environ 5 % des navigateurs). Cette mesure (Vercel Web
            Analytics) ne pose pas de cookie et ne te suit pas d&apos;un site à l&apos;autre.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Combien de temps">
        <ul>
          <li>Tes données de compte sont conservées tant que ton compte existe.</li>
          <li>
            À la suppression du compte, ton profil, tes réactions, ton origine d&apos;inscription,
            ta dernière activité, tes abonnements aux notifications et tes photos de posts sont
            effacés.
          </li>
          <li>
            Les posts, événements et positions que tu avais publiés restent visibles, sans plus être
            rattachés à toi. Demande-nous de les effacer aussi si tu le souhaites.
          </li>
          <li>
            Le journal d&apos;administration et l&apos;historique des sanctions gardent un
            identifiant technique, sans nom ni e-mail, pour la sécurité et la redevabilité. Les
            entrées du journal liées à la carte sont effacées après 90 jours.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Qui reçoit les données">
        <p>
          Uniquement les prestataires qui font fonctionner le service, au sein de l&apos;Union
          européenne quand c&apos;est possible :
        </p>
        <ul>
          {PROCESSORS.map((processor) => (
            <li key={processor.name}>
              <a href={processor.link} target="_blank" rel="noopener noreferrer">
                {processor.name}
              </a>{" "}
              : {processor.role}. {processor.place}.
            </li>
          ))}
        </ul>
        <p>
          Quand un prestataire est établi hors de l&apos;Union, le transfert s&apos;appuie sur les
          clauses contractuelles types de la Commission européenne ou sur le cadre de protection des
          données UE-États-Unis.
        </p>
      </LegalSection>

      <LegalSection title="Tes droits">
        <p>
          Tu peux accéder à tes données, les rectifier, les effacer, t&apos;opposer à leur
          traitement, en demander la limitation et les récupérer dans un format réutilisable.
        </p>
        <ul>
          <li>
            <strong>Récupérer tes données</strong> et <strong>supprimer ton compte</strong> : dans{" "}
            <InternalLink href="/settings">Réglages</InternalLink>, section « Mes données », en
            quelques secondes et sans nous écrire.
          </li>
          <li>
            Pour tout autre droit (rectification, opposition, effacement de contenus publiés) :{" "}
            <LegalValue value={LEGAL.publisher.contactEmail} />. Nous répondons dans un délai
            d&apos;un mois.
          </li>
          <li>
            Si tu estimes que tes droits ne sont pas respectés, tu peux saisir la CNIL (cnil.fr),
            l&apos;autorité française de protection des données.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Sécurité et mineurs">
        <p>
          Les accès sont protégés par des règles côté base de données et côté serveur, la session
          est illisible par les scripts de la page et les échanges sont chiffrés (HTTPS). Le service
          s&apos;adresse aux personnes d&apos;au moins 15 ans ; si tu es plus jeune, demande
          l&apos;accord d&apos;un parent avant de créer un compte.
        </p>
        <p>
          Cette politique peut évoluer : la date de mise à jour figure en haut de la page, et un
          changement important est annoncé dans l&apos;application.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
