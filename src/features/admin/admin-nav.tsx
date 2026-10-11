"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ChipTabs } from "@/components/chip-tabs";
import { ListIcon, PulseIcon, ShieldIcon, UserIcon } from "@/components/icons";

/** A section of the admin area. */
export type AdminLink = { href: string; label: string };

// Icons are picked here, by section, so the links stay plain data when the server hands them over.
const ICONS: Record<string, ReactNode> = {
  "/admin": <UserIcon className="size-[18px]" />,
  "/admin/roles": <ShieldIcon className="size-[18px]" />,
  "/admin/journal": <ListIcon className="size-[18px]" />,
  "/admin/health": <PulseIcon className="size-[18px]" />,
};

/** The section a path belongs to: the user pages belong to "Utilisateurs". */
export function activeAdminHref(pathname: string, links: AdminLink[]): string | undefined {
  const own = links.find(
    ({ href }) => href !== "/admin" && (pathname === href || pathname.startsWith(`${href}/`)),
  );
  if (own) return own.href;
  return pathname === "/admin" || pathname.startsWith("/admin/users") ? "/admin" : undefined;
}

/** Main navigation of the admin area; the current section is underlined and marked with `aria-current`. */
export function AdminNav({ links }: { links: AdminLink[] }) {
  const pathname = usePathname();

  return (
    <ChipTabs
      variant="underline"
      label="Sections de l'administration"
      activeKey={activeAdminHref(pathname, links) ?? ""}
      tabs={links.map(({ href, label }) => ({ key: href, label, href, icon: ICONS[href] }))}
    />
  );
}
