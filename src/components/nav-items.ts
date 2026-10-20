import { CalendarIcon, HomeIcon, MapIcon, SettingsIcon } from "./icons";

/** The four sections of the app: the tabs of the bottom bar on a phone, the rows of the sidebar on a desktop. */
export const NAV_ITEMS = [
  { href: "/", label: "Accueil", Icon: HomeIcon, animClass: "animate-home-bounce" },
  { href: "/calendar", label: "Calendrier", Icon: CalendarIcon, animClass: "animate-calendar-pop" },
  { href: "/map", label: "Carte", Icon: MapIcon, animClass: "animate-map-fold" },
  { href: "/settings", label: "Réglages", Icon: SettingsIcon, animClass: "animate-gear-spin" },
] as const;

/** Whether `pathname` is inside the section `href` (the home only on `/`, not on every page). */
export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
