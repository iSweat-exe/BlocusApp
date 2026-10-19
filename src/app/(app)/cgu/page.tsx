import type { Metadata } from "next";
import { LEGAL } from "@/features/legal/legal-info";
import { InternalLink, LegalPage, LegalSection, LegalValue } from "@/features/legal/legal-page";

export const metadata: Metadata = { title: "Conditions d'utilisation · BLOCUS" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Conditions d'utilisation"
      intro="Les règles simples d'usage de BLOCUS. En l'utilisant, tu les acceptes."
    >
      <LegalSection title="Le service">
        <p>
          BLOCUS. fournit gratuitement des informations sur la manifestation : actualités,
          calendrier et carte. Le mode invité permet de les consulter sans compte ; un compte
          (Discord ou Google) permet de réagir et de recevoir des notifications, et donne des droits
          supplémentaires aux gérants.
        </p>
        <p>
          Le service est fourni « en l&apos;état », sans garantie de disponibilité continue.
          L&apos;éditeur (<LegalValue value={LEGAL.publisher.name} />) peut le modifier, le
          suspendre ou l&apos;arrêter. Les informations (horaires, lieux, positions) sont données de
          bonne foi mais peuvent changer : en cas de doute, fie-toi aux consignes sur place.
        </p>
      </LegalSection>

      <LegalSection title="Ton compte">
        <ul>
          <li>
            Tu t&apos;inscris avec un compte Discord ou Google dont l&apos;adresse e-mail est
            vérifiée.
          </li>
          <li>Tu as au moins 15 ans, ou l&apos;accord d&apos;un parent.</li>
          <li>Les informations de ton compte sont exactes et tu gardes tes accès pour toi.</li>
          <li>
            Tu peux supprimer ton compte à tout moment dans{" "}
            <InternalLink href="/settings">Réglages</InternalLink>.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Ce qui est interdit">
        <ul>
          <li>
            Publier des contenus illicites, haineux, violents, diffamatoires ou qui exposent la vie
            privée de quelqu&apos;un.
          </li>
          <li>Se faire passer pour une autre personne, ou pour l&apos;équipe.</li>
          <li>
            Contourner la sécurité, les limites d&apos;usage ou les permissions, ou perturber le
            service (attaques, envois massifs).
          </li>
          <li>Collecter les données des autres membres ou détourner le service de son but.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Modération">
        <p>
          L&apos;équipe peut retirer un contenu et suspendre ou bannir un compte qui ne respecte pas
          ces règles, avec un motif. Les sanctions peuvent être levées ou expirer. Pour contester
          une décision, écris à <LegalValue value={LEGAL.publisher.contactEmail} />.
        </p>
      </LegalSection>

      <LegalSection title="Contenus que tu publies">
        <p>
          Si tu publies (gérants), tu restes l&apos;auteur de ton contenu et tu donnes à BLOCUS. le
          droit de l&apos;afficher dans l&apos;application. Tu garantis avoir le droit de le publier
          (textes, photos) et tu ne publies pas de photo reconnaissable d&apos;une personne sans son
          accord.
        </p>
      </LegalSection>

      <LegalSection title="Responsabilité">
        <p>
          L&apos;éditeur n&apos;est pas responsable des dommages indirects liés à l&apos;usage ou à
          l&apos;indisponibilité du service, ni des contenus publiés par des tiers. Rien dans ces
          conditions ne limite les droits que la loi te garantit.
        </p>
      </LegalSection>

      <LegalSection title="Données personnelles, droit applicable">
        <p>
          Le traitement de tes données est décrit dans la{" "}
          <InternalLink href="/confidentialite">politique de confidentialité</InternalLink>. Ces
          conditions sont régies par le droit du pays de l&apos;éditeur (
          <LegalValue value={LEGAL.publisher.country} />
          ), sans priver les consommateurs de la protection de la loi de leur pays de résidence.
          Elles peuvent évoluer : la date de mise à jour est en haut de la page.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
