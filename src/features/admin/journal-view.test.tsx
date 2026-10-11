import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AuditEntryView, AuditNames } from "./audit";
import { bindQuotationMarks } from "./audit";
import { JournalFeed } from "./journal-view";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// 10 October 2026, 21:30 in Paris.
const NOW = new Date("2026-10-10T19:30:00Z");
const NAMES: AuditNames = {
  users: new Map([
    ["a", "alice"],
    ["b", "bob"],
  ]),
  roles: new Map([
    ["user", "Utilisateur"],
    ["manager", "Gérant"],
  ]),
  permissions: (key) => (key === "user.ban" ? "Bannir un utilisateur" : key),
};

const entry = (over: Partial<AuditEntryView>): AuditEntryView => ({
  id: 1,
  actor_id: "a",
  action: "role.assigned",
  target_id: "b",
  details: { from: "user", to: "manager" },
  created_at: "2026-10-10T18:40:00Z",
  ...over,
});

const ENTRIES = [
  entry({
    id: 3,
    action: "user.banned",
    details: { reason: "spam" },
    created_at: "2026-10-10T08:05:00Z",
  }),
  entry({ id: 2, created_at: "2026-10-09T20:00:00Z" }),
  entry({ id: 1, action: "future.thing", target_id: null, created_at: "2026-10-03T09:00:00Z" }),
];

/** The entries of the journal (the tabs are list items too, so they are left out). */
const rows = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>("ol > li"));

function feed(over: Partial<React.ComponentProps<typeof JournalFeed>> = {}) {
  return render(
    <JournalFeed
      entries={ENTRIES}
      names={NAMES}
      params={{ category: null, before: null }}
      nextCursor={null}
      now={NOW}
      {...over}
    />,
  );
}

describe("JournalFeed", () => {
  it("groups the entries under a heading for each day", () => {
    feed();
    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(["Aujourd'hui", "Hier", "samedi 3 octobre"]);
    const today = screen.getByRole("region", { name: "Aujourd'hui" });
    expect(within(today).getAllByRole("listitem")).toHaveLength(1);
  });

  it("writes each entry as a sentence with the names in bold, and its time and family", () => {
    const { container } = feed();
    const item = rows(container)[1]!;
    expect(item).toHaveTextContent("alice a changé le rôle de bob : Utilisateur → Gérant.");
    const bold = within(item)
      .getAllByText(/./, { selector: "strong" })
      .map((node) => node.textContent);
    expect(bold).toEqual(["alice", "bob", "Utilisateur", "Gérant"]);
    expect(within(item).getByText("22:00")).toHaveAttribute("datetime", "2026-10-09T20:00:00Z");
    expect(within(item).getByText("Rôles")).toBeInTheDocument();
  });

  it("keeps the icon of an entry decorative and shows an unknown action as-is", () => {
    const { container } = feed();
    for (const icon of container.querySelectorAll("li > span")) {
      expect(icon).toHaveAttribute("aria-hidden", "true");
    }
    const unknown = rows(container)[2]!;
    expect(unknown).toHaveTextContent("alice : future.thing.");
    expect(within(unknown).getByText("Autre")).toBeInTheDocument();
  });

  it("offers every family as a link, and marks the open one", () => {
    feed({ params: { category: "sanctions", before: null } });
    const nav = screen.getByRole("navigation", { name: "Catégories d'actions" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual([
      "/admin/journal",
      "/admin/journal?category=roles",
      "/admin/journal?category=permissions",
      "/admin/journal?category=sanctions",
      "/admin/journal?category=calendar",
      "/admin/journal?category=map",
    ]);
    expect(within(nav).getByRole("link", { current: "page" })).toHaveTextContent("Sanctions");
    expect(screen.getByText(/3 entrées · Sanctions/)).toBeInTheDocument();
  });

  it("keeps the family when going to older entries, and offers to come back to the latest", () => {
    feed({ nextCursor: 42, params: { category: "map", before: 100 } });
    const nav = screen.getByRole("navigation", { name: "Pagination du journal" });
    expect(
      within(nav).getByRole("link", { name: "Voir les entrées plus anciennes" }),
    ).toHaveAttribute("href", "/admin/journal?category=map&before=42");
    expect(within(nav).getByRole("link", { name: "Revenir aux plus récentes" })).toHaveAttribute(
      "href",
      "/admin/journal?category=map",
    );
  });

  it("shows no pagination on a single, first page", () => {
    feed();
    expect(screen.queryByRole("navigation", { name: "Pagination du journal" })).toBeNull();
  });

  it("explains an empty journal, and an empty family with a way back", () => {
    const { unmount } = feed({ entries: [] });
    expect(screen.getByText("Aucune action enregistrée")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Voir toutes les actions" })).toBeNull();
    unmount();

    feed({ entries: [], params: { category: "sanctions", before: null } });
    expect(screen.getByText("Aucune action de ce type")).toBeInTheDocument();
    expect(screen.getByText(/Rien dans la catégorie/)).toHaveTextContent("Sanctions");
    expect(screen.getByRole("link", { name: "Voir toutes les actions" })).toHaveAttribute(
      "href",
      "/admin/journal",
    );
  });
});

describe("bindQuotationMarks", () => {
  it("replaces the space inside the French quotation marks, wherever the sentence is cut", () => {
    expect(bindQuotationMarks("alice a accordé « ")).toBe("alice a accordé « ");
    expect(bindQuotationMarks(" » au rôle ")).toBe(" » au rôle ");
    expect(bindQuotationMarks("une phrase sans guillemets")).toBe("une phrase sans guillemets");
  });
});
