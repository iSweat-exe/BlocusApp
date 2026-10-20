/** What kind of change a line of the patch notes describes. */
export type PatchChangeKind = "new" | "improved" | "fixed";

export type PatchChange = { kind: PatchChangeKind; text: string };

/** One update of the application (French, technical and factual: see the rule in CLAUDE.md). */
export type PatchNote = {
  /** ISO date (`YYYY-MM-DD`) of the release. */
  date: string;
  title: string;
  changes: readonly PatchChange[];
};

/**
 * The patch notes, newest first. **Every pull request that changes what people see or can do adds a line here**
 * (see CLAUDE.md): a new entry for a new date, or a line in the entry of the day. Style: French, technical terms,
 * one factual statement per line (what changed, where, with which values), no marketing and no address to the reader.
 */
export const PATCH_NOTES: readonly PatchNote[] = [
  {
    date: "2026-10-20",
    title: "Desktop, calendrier, patch notes",
    changes: [
      { kind: "new", text: "Page Patch notes (Réglages > À propos)." },
      {
        kind: "new",
        text: "Interface desktop (≥ 1024 px) : sidebar, pages sur deux colonnes, raccourcis clavier du calendrier (M, S, J, ←, →, T).",
      },
      { kind: "new", text: "Calendrier : vues Mois, Semaine et Jour." },
      {
        kind: "improved",
        text: "Vue Jour : timeline horaire, événements simultanés affichés côte à côte, couleur stable par événement, heure de fin facultative.",
      },
      {
        kind: "improved",
        text: "Onboarding : procédure d'installation PWA détaillée pour iOS (Safari) et Android.",
      },
      { kind: "fixed", text: "Posts : auteur affiché avant la date." },
      {
        kind: "fixed",
        text: "Calendrier : journée complète affichée, heure de début alignée à gauche.",
      },
    ],
  },
  {
    date: "2026-10-19",
    title: "Notifications, réactions, données personnelles",
    changes: [
      { kind: "new", text: "Notifications push à la publication d'un post." },
      {
        kind: "new",
        text: "Réactions emoji sur les posts et les événements, avec la liste des utilisateurs ayant réagi.",
      },
      {
        kind: "new",
        text: "Onboarding à la première ouverture : installation, notifications, thème et couleur d'accent.",
      },
      {
        kind: "new",
        text: "Pages CGU, confidentialité et mentions légales ; export des données et suppression du compte (Réglages).",
      },
      {
        kind: "improved",
        text: "Boutons : effet d'appui (scale 0,96) et zones de toucher agrandies.",
      },
    ],
  },
  {
    date: "2026-10-11",
    title: "Refonte de l'interface",
    changes: [
      { kind: "new", text: "Page Crédits." },
      { kind: "new", text: "Page 404 refaite ; compteur de membres." },
      { kind: "improved", text: "Page de connexion : photo de fond." },
      { kind: "improved", text: "Polices : Inter (texte), Archivo (titres)." },
      {
        kind: "improved",
        text: "En-tête et barre de navigation refaits ; animation d'icône au toucher.",
      },
    ],
  },
];
