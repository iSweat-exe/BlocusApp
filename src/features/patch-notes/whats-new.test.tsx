import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ONBOARDING_STORAGE_KEY } from "@/features/onboarding/onboarding-store";
import type { PatchNote } from "./patch-notes";
import { decideWhatsNew, WhatsNew } from "./whats-new";
import { WHATS_NEW_BLOCKED, WHATS_NEW_STORAGE_KEY } from "./whats-new-store";

vi.mock("next/link", () => ({
  default: ({
    href,
    onClick,
    children,
  }: {
    href: string;
    onClick?: () => void;
    children: React.ReactNode;
  }) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onClick?.();
      }}
    >
      {children}
    </a>
  ),
}));

const NOTES: PatchNote[] = [
  {
    date: "2026-10-20",
    title: "Dernière mise à jour",
    changes: [{ kind: "new", text: "Nouveauté récente" }],
  },
  {
    date: "2026-10-19",
    title: "Mise à jour précédente",
    changes: [{ kind: "fixed", text: "Correction ancienne" }],
  },
  { date: "2026-10-11", title: "Mise à jour ancienne", changes: [{ kind: "new", text: "Vieux" }] },
];

const SIGNED_IN = { signedIn: true, onboardingDone: true };
const NEW_GUEST = { signedIn: false, onboardingDone: false };
const NEWCOMER = { signedIn: true, onboardingDone: false };

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("decideWhatsNew", () => {
  it.each([
    ["shows an entry newer than the one seen", "2026-10-11", SIGNED_IN, "show"],
    ["hides what was already seen", "2026-10-20", SIGNED_IN, "hide"],
    ["hides when the seen date is ahead", "2026-10-25", SIGNED_IN, "hide"],
    ["shows once to a known signed-in person with no date yet", null, SIGNED_IN, "show"],
    ["records silently for a new guest", null, NEW_GUEST, "silent"],
    ["shows to a guest who has a date", "2026-10-11", NEW_GUEST, "show"],
    ["records silently for a newcomer in the onboarding", null, NEWCOMER, "silent"],
    ["waits for the onboarding to end", "2026-10-11", NEWCOMER, "hide"],
    ["hides when the storage is unusable", WHATS_NEW_BLOCKED, SIGNED_IN, "hide"],
  ])("%s", (_name, seen, context, expected) => {
    expect(decideWhatsNew("2026-10-20", seen, context)).toBe(expected);
  });
});

describe("WhatsNew", () => {
  function onboardingDone() {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "2026-10-01");
  }

  it("shows only the newest entry after a long absence, with the date, a cross and the history link", () => {
    onboardingDone();
    window.localStorage.setItem(WHATS_NEW_STORAGE_KEY, "2026-09-01");
    render(<WhatsNew signedIn notes={NOTES} />);

    expect(document.querySelector("dialog")).toHaveAttribute("open");
    expect(screen.getByRole("heading", { name: "Dernière mise à jour" })).toBeInTheDocument();
    expect(screen.getByText("20 octobre 2026")).toBeInTheDocument();
    expect(screen.getByText("Nouveauté récente")).toBeInTheDocument();
    expect(screen.queryByText("Mise à jour précédente")).toBeNull();
    expect(screen.queryByText("Correction ancienne")).toBeNull();
    expect(screen.getByRole("button", { name: "Fermer" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir tout l'historique" })).toHaveAttribute(
      "href",
      "/patch-notes",
    );
  });

  it("closes with « Continuer » and remembers the date", async () => {
    onboardingDone();
    window.localStorage.setItem(WHATS_NEW_STORAGE_KEY, "2026-10-19");
    const user = userEvent.setup();
    render(<WhatsNew signedIn notes={NOTES} />);

    await user.click(screen.getByRole("button", { name: "Continuer" }));
    expect(document.querySelector("dialog")).toBeNull();
    expect(window.localStorage.getItem(WHATS_NEW_STORAGE_KEY)).toBe("2026-10-20");
  });

  it("closes with the cross and with the history link, both remembering the date", async () => {
    onboardingDone();
    window.localStorage.setItem(WHATS_NEW_STORAGE_KEY, "2026-10-11");
    const user = userEvent.setup();
    const first = render(<WhatsNew signedIn notes={NOTES} />);
    await user.click(screen.getByRole("button", { name: "Fermer" }));
    expect(window.localStorage.getItem(WHATS_NEW_STORAGE_KEY)).toBe("2026-10-20");
    first.unmount();

    window.localStorage.setItem(WHATS_NEW_STORAGE_KEY, "2026-10-11");
    render(<WhatsNew signedIn notes={NOTES} />);
    await user.click(screen.getByRole("link", { name: "Voir tout l'historique" }));
    expect(window.localStorage.getItem(WHATS_NEW_STORAGE_KEY)).toBe("2026-10-20");
  });

  it("shows nothing and records the entry on a new guest device, so only the next update shows", () => {
    render(<WhatsNew signedIn={false} notes={NOTES} />);
    expect(document.querySelector("dialog")).toBeNull();
    expect(window.localStorage.getItem(WHATS_NEW_STORAGE_KEY)).toBe("2026-10-20");
  });

  it("lets a signed-in newcomer finish the onboarding first", () => {
    render(<WhatsNew signedIn notes={NOTES} />);
    expect(document.querySelector("dialog")).toBeNull();
    expect(window.localStorage.getItem(WHATS_NEW_STORAGE_KEY)).toBe("2026-10-20");
  });

  it("shows nothing when there is no patch note", () => {
    onboardingDone();
    render(<WhatsNew signedIn notes={[]} />);
    expect(document.querySelector("dialog")).toBeNull();
  });
});
