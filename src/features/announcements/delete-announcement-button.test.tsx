import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DeleteAnnouncementButton } from "./delete-announcement-button";

vi.mock("./actions", () => ({ deleteAnnouncement: vi.fn() }));

const ID = "00000000-0000-0000-0000-00000000f001";

describe("DeleteAnnouncementButton", () => {
  it("starts as a single discreet button, with no way to delete in one tap", () => {
    render(<DeleteAnnouncementButton id={ID} title="Départ" />);
    expect(
      screen.getByRole("button", { name: "Supprimer l'annonce « Départ »" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Confirmer/ })).toBeNull();
    expect(document.querySelector("input[name=id]")).toBeNull();
  });

  it("asks for a confirmation that carries the id, and can be cancelled", async () => {
    const user = userEvent.setup();
    render(<DeleteAnnouncementButton id={ID} title="Départ" />);

    await user.click(screen.getByRole("button", { name: /Supprimer l'annonce/ }));
    expect(screen.getByRole("button", { name: "Confirmer la suppression" })).toHaveAttribute(
      "type",
      "submit",
    );
    expect(document.querySelector<HTMLInputElement>("input[name=id]")?.value).toBe(ID);

    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.queryByRole("button", { name: /Confirmer/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Supprimer l'annonce/ })).toBeInTheDocument();
  });
});
