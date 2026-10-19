import type { Metadata } from "next";
import { LEGAL, PROCESSORS } from "@/features/legal/legal-info";
import { InternalLink, LegalPage, LegalSection, LegalValue } from "@/features/legal/legal-page";

export const metadata: Metadata = { title: "Mentions légales" };

export default function LegalNoticePage() {
  return (
    <LegalPage
      title="Mentions légales"
      intro="Qui publie BLOCUS, qui l'héberge et comment nous joindre."
    >
      <LegalSection title="Éditeur">
        <p>
          BLOCUS. est un service d&apos;information sur la manifestation, publié à titre non
          commercial par <LegalValue value={LEGAL.publisher.name} />, établi en{" "}
          <LegalValue value={LEGAL.publisher.country} />.
        </p>
        <p>
          Contact : <LegalValue value={LEGAL.publisher.contactEmail} />. Pour toute demande liée à
          tes données, voir la{" "}
          <InternalLink href="/confidentialite">politique de confidentialité</InternalLink>.
        </p>
        <p>
          Le service est gratuit, sans publicité et ne vend aucune donnée. Le directeur de la
          publication est l&apos;éditeur ci-dessus.
        </p>
      </LegalSection>

      <LegalSection title="Hébergement et prestataires">
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
      </LegalSection>

      <LegalSection title="Contenus">
        <p>
          Les annonces et les événements sont publiés par les personnes autorisées (gérants et
          équipe). Elles restent responsables de ce qu&apos;elles publient. Pour signaler un contenu
          illicite ou inexact, écris à l&apos;adresse de contact : nous le retirons rapidement
          s&apos;il est manifestement illicite.
        </p>
        <p>
          Les photos de fond de l&apos;écran de connexion et les composants utilisés sont crédités
          sur la page <InternalLink href="/credits">Crédits</InternalLink>.
        </p>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <p>
          Le code, la marque BLOCUS. et les textes de l&apos;application appartiennent à
          l&apos;éditeur, sauf mention contraire. Les contenus publiés par les gérants restent à
          leurs auteurs.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
