import type { AdminLink } from "./admin-nav";

/** Sections of the admin area the user may see, from their permissions (display only). */
export function adminLinksFor(permissions: readonly string[]): AdminLink[] {
  const links: AdminLink[] = [{ href: "/admin", label: "Utilisateurs" }];
  if (permissions.includes("permission.manage")) {
    links.push({ href: "/admin/roles", label: "Rôles" });
  }
  if (permissions.includes("audit.read")) {
    links.push({ href: "/admin/journal", label: "Journal" });
  }
  if (permissions.includes("statistics.view")) {
    links.push({ href: "/admin/statistics", label: "Statistiques" });
  }
  if (permissions.includes("monitoring.view")) {
    links.push({ href: "/admin/health", label: "Santé" });
  }
  return links;
}
