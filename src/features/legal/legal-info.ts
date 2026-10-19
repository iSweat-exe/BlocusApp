/**
 * Facts the legal pages state about who runs BLOCUS. They are the only place to edit: the pages read them, so a
 * name or an address is never typed twice.
 *
 * Every value that still reads {@link TO_COMPLETE} must be replaced before the production launch: `legal-info.test.ts`
 * lists what is missing, and the pages show the placeholder in plain sight so that it cannot go unnoticed.
 */
export const TO_COMPLETE = "À COMPLÉTER";

export const LEGAL = {
  /** Person (or organisation) that publishes the application and decides what is done with the data. */
  publisher: {
    name: "iSweat",
    /** Country of residence (or of the registered office). */
    country: "France",
    /** Public e-mail address that answers legal and privacy requests. */
    contactEmail: "blocus@blocusapp.com",
  },
  /** Last change of the three texts, shown at the top of each of them. */
  updatedOn: "19 octobre 2026",
} as const;

/** The providers that run the application for us (data processors), with where the data sits. */
export const PROCESSORS = [
  {
    name: "Vercel Inc.",
    role: "Hébergement de l'application et mesure d'audience",
    place: "Fonctions exécutées à Dublin (Irlande) ; siège aux États-Unis",
    link: "https://vercel.com/legal/privacy-policy",
  },
  {
    name: "Supabase Inc.",
    role: "Base de données, authentification et stockage des images",
    place: "Projet hébergé en Irlande (UE) ; siège aux États-Unis",
    link: "https://supabase.com/privacy",
  },
  {
    name: "Discord Inc. et Google LLC",
    role: "Connexion avec ton compte (OAuth) : tu choisis l'un des deux",
    place: "États-Unis",
    link: "https://discord.com/privacy",
  },
] as const;

/** Names of the legal pages, to link to them from one place. */
export const LEGAL_PAGES = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/confidentialite", label: "Politique de confidentialité" },
  { href: "/cgu", label: "Conditions d'utilisation" },
] as const;

/** Names of the fields of {@link LEGAL.publisher} that still hold the placeholder. */
export function missingLegalInfo(): string[] {
  return (Object.entries(LEGAL.publisher) as [string, string][])
    .filter(([, value]) => value === TO_COMPLETE)
    .map(([key]) => key);
}
