import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FullScreenDialog, useDialogClose } from "./full-screen-dialog";

function SubmitLikeChild() {
  const close = useDialogClose();
  return (
    <button type="button" onClick={close}>
      Terminer
    </button>
  );
}

const renderDialog = () =>
  render(
    <FullScreenDialog triggerLabel="Créer un post" title="Nouveau post">
      <p>Contenu du formulaire</p>
      <SubmitLikeChild />
    </FullScreenDialog>,
  );

describe("FullScreenDialog", () => {
  it("only shows the trigger at first, without mounting the content", () => {
    renderDialog();
    expect(screen.getByRole("button", { name: "Créer un post" })).toBeInTheDocument();
    expect(screen.queryByText("Contenu du formulaire")).toBeNull();
    expect(document.querySelector("dialog")).not.toHaveAttribute("open");
  });

  it("opens as a modal with its title and content, and locks the page scroll", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Créer un post" }));

    const dialog = document.querySelector("dialog");
    expect(dialog).toHaveAttribute("open");
    expect(dialog).toHaveAccessibleName("Nouveau post");
    expect(screen.getByText("Contenu du formulaire")).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("closes with the close button, unmounts the content and restores the scroll", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Créer un post" }));
    await user.click(screen.getByRole("button", { name: "Fermer" }));

    expect(document.querySelector("dialog")).not.toHaveAttribute("open");
    expect(screen.queryByText("Contenu du formulaire")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("lets its content close it through useDialogClose", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Créer un post" }));
    await user.click(screen.getByRole("button", { name: "Terminer" }));
    expect(document.querySelector("dialog")).not.toHaveAttribute("open");
  });

  it("resets when the browser closes it itself (Escape, Android back gesture)", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Créer un post" }));
    act(() => {
      document.querySelector("dialog")?.close();
    });
    expect(screen.queryByText("Contenu du formulaire")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("useDialogClose is a harmless no-op outside a dialog", async () => {
    const user = userEvent.setup();
    render(<SubmitLikeChild />);
    await user.click(screen.getByRole("button", { name: "Terminer" }));
    expect(screen.getByRole("button", { name: "Terminer" })).toBeInTheDocument();
  });
});
