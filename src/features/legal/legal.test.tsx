import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CguPage from "@/app/(app)/cgu/page";
import PrivacyPage from "@/app/(app)/confidentialite/page";
import LegalNoticePage from "@/app/(app)/mentions-legales/page";
import { DeleteAccountForm } from "./delete-account-form";
import { LEGAL, LEGAL_PAGES, missingLegalInfo, PROCESSORS } from "./legal-info";
import { LegalConsentNote, LegalLinks } from "./legal-links";

vi.mock("./actions", () => ({ deleteMyAccount: vi.fn() }));

describe("legal information", () => {
  it("has no placeholder left to publish", () => {
    expect(missingLegalInfo()).toEqual([]);
  });

  it("names every processor with where the data sits", () => {
    for (const processor of PROCESSORS) {
      expect(processor.place.length).toBeGreaterThan(0);
      expect(processor.link).toMatch(/^https:\/\//);
    }
  });
});

describe.each([
  ["Mentions légales", LegalNoticePage],
  ["Politique de confidentialité", PrivacyPage],
  ["Conditions d'utilisation", CguPage],
])("%s", (title, Page) => {
  it("has its title, the date, the publisher and links to the other legal pages", () => {
    render(<Page />);
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(LEGAL.updatedOn))).toBeInTheDocument();
    const others = within(screen.getByRole("navigation", { name: "Autres pages légales" }));
    for (const page of LEGAL_PAGES) {
      expect(others.getByRole("link", { name: page.label })).toHaveAttribute("href", page.href);
    }
  });
});

describe("privacy policy", () => {
  it("covers the data kept, the cookies, the retention and the rights, with the self-service tools", () => {
    render(<PrivacyPage />);
    for (const heading of [
      "Ce que nous gardons",
      "Cookies et stockage sur ton appareil",
      "Combien de temps",
      "Tes droits",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
    expect(screen.getAllByText(LEGAL.publisher.contactEmail).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: LEGAL.publisher.contactEmail })[0]).toHaveAttribute(
      "href",
      `mailto:${LEGAL.publisher.contactEmail}`,
    );
    expect(screen.getByRole("link", { name: "Réglages" })).toHaveAttribute("href", "/settings");
  });
});

describe("LegalLinks and LegalConsentNote", () => {
  it("lists the three pages", () => {
    render(<LegalLinks />);
    expect(screen.getAllByRole("link")).toHaveLength(LEGAL_PAGES.length);
  });

  it("tells signing in means accepting the terms and the policy, with a link to each", () => {
    render(<LegalConsentNote />);
    expect(screen.getByRole("link", { name: /conditions d'utilisation/ })).toHaveAttribute(
      "href",
      "/cgu",
    );
    expect(screen.getByRole("link", { name: /politique de confidentialité/ })).toHaveAttribute(
      "href",
      "/confidentialite",
    );
  });
});

describe("DeleteAccountForm", () => {
  it("hides the form behind a button, and only enables the deletion once the word is typed", async () => {
    const user = userEvent.setup();
    render(<DeleteAccountForm />);
    expect(screen.queryByLabelText(/SUPPRIMER/)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Supprimer mon compte" }));
    const confirm = screen.getByRole("button", { name: "Supprimer" });
    expect(confirm).toBeDisabled();

    await user.type(screen.getByLabelText(/SUPPRIMER/), "supprimer");
    expect(confirm).toBeEnabled();
  });

  it("can be cancelled", async () => {
    const user = userEvent.setup();
    render(<DeleteAccountForm />);
    await user.click(screen.getByRole("button", { name: "Supprimer mon compte" }));
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.getByRole("button", { name: "Supprimer mon compte" })).toBeInTheDocument();
  });
});
