/**
 * What each role is for, in French, shown on the roles screen. Kept here (like the permission labels) rather than in
 * the database: it is display text, and a missing entry only hides the line instead of breaking a page when the code
 * and the migration that adds a role are deployed in a different order.
 */
const ROLE_DESCRIPTIONS: Record<string, string> = {
  user: "Consulte le fil d'actualités, le calendrier et la carte.",
  relay: "Déclare la position de la manifestation sur le terrain, sans toucher au reste.",
  editor: "Publie des annonces sur le fil d'actualités, sans les outils de la carte.",
  manager: "Conduit la manifestation : annonces, tracé de la carte, position et événements.",
  moderator:
    "Supervise le contenu des gérants : supprime des annonces et des événements, clôt des événements.",
  developer:
    "Équipe technique : consulte la santé, les statistiques et le journal, sans pouvoir sur les comptes.",
  admin: "Gère les comptes, les rôles, les permissions et les sanctions, et voit tout le suivi.",
  super_admin:
    "Toutes les permissions, non modifiable. Réservé à l'équipe technique, créé uniquement en SQL.",
};

/** What a role is for, or `null` for a role this version does not know yet. */
export function roleDescription(roleKey: string): string | null {
  return ROLE_DESCRIPTIONS[roleKey] ?? null;
}
