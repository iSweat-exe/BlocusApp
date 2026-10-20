import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PATCH_NOTES } from "./patch-notes";
import { PatchNotesLink } from "./patch-notes-link";
import { formatPatchDate, groupChanges, PatchNotesView } from "./patch-notes-view";

vi.mock("next/link", () => ({
  default: ({
    href,
    prefetch,
    children,
  }: {
    href: string;
    prefetch?: boolean;
    children: React.ReactNode;
  }) => (
    <a href={href} data-prefetch={String(prefetch)}>
      {children}
    </a>
  ),
}));

describe("PATCH_NOTES", () => {
  it("has real ISO dates, newest first and one entry per day", () => {
    const dates = PATCH_NOTES.map((note) => note.date);
    for (const date of dates) {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(date))).toBe(false);
    }
    expect(dates).toEqual([...dates].sort().reverse());
    expect(new Set(dates).size).toBe(dates.length);
  });

  it("has a title and at least one change per entry", () => {
    for (const note of PATCH_NOTES) {
      expect(note.title.trim()).not.toBe("");
      expect(note.changes.length).toBeGreaterThan(0);
    }
  });
});

describe("PatchNotesView", () => {
  it("formats the date in French without shifting the day", () => {
    expect(formatPatchDate("2026-10-20")).toBe("20 octobre 2026");
    expect(formatPatchDate("2026-01-01")).toBe("1 janvier 2026");
  });

  it("lists each entry under its date, with the kind of every change", () => {
    render(
      <PatchNotesView
        notes={[
          {
            date: "2026-10-20",
            title: "Titre",
            changes: [
              { kind: "new", text: "Une nouveauté" },
              { kind: "fixed", text: "Un bug en moins" },
            ],
          },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Patch notes", level: 1 })).toBeInTheDocument();
    const entry = screen.getByRole("region", { name: "20 octobre 2026" });
    expect(within(entry).getByText("Titre")).toBeInTheDocument();
    expect(within(entry).getByText("Nouveau")).toBeInTheDocument();
    expect(within(entry).getByText("Corrigé")).toBeInTheDocument();
    expect(within(entry).getAllByRole("listitem")).toHaveLength(2);
  });
});

describe("groupChanges", () => {
  it("merges neighbouring changes of the same kind and keeps the order", () => {
    expect(
      groupChanges([
        { kind: "new", text: "a" },
        { kind: "new", text: "b" },
        { kind: "fixed", text: "c" },
        { kind: "new", text: "d" },
      ]),
    ).toEqual([
      { kind: "new", texts: ["a", "b"] },
      { kind: "fixed", texts: ["c"] },
      { kind: "new", texts: ["d"] },
    ]);
  });

  it("shows a merged group as one label with a list, and a lone change as a sentence", () => {
    render(
      <PatchNotesView
        notes={[
          {
            date: "2026-10-20",
            title: "Titre",
            changes: [
              { kind: "new", text: "Premier" },
              { kind: "new", text: "Second" },
              { kind: "fixed", text: "Seul" },
            ],
          },
        ]}
      />,
    );
    expect(screen.getAllByText("Nouveau")).toHaveLength(1);
    const entry = screen.getByRole("region", { name: "20 octobre 2026" });
    expect(within(entry).getAllByRole("list")).toHaveLength(2);
    expect(within(entry).getByText("Premier")).toBeInTheDocument();
    expect(within(entry).getByText("Seul")).toBeInTheDocument();
  });
});

describe("PatchNotesLink", () => {
  it("leads to the patch notes without preloading them", () => {
    render(<PatchNotesLink />);
    const link = screen.getByRole("link", { name: /Patch notes/ });
    expect(link).toHaveAttribute("href", "/patch-notes");
    expect(link).toHaveAttribute("data-prefetch", "false");
  });
});
