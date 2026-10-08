import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FullScreenDialog, useDialogClose, useInDialog } from "./full-screen-dialog";

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

  it("slides up on opening and slides away before closing (Web Animations API)", async () => {
    const finished = Promise.resolve();
    const animate = vi.fn<(keyframes: unknown, options?: unknown) => { finished: Promise<void> }>(
      () => ({ finished }),
    );
    Object.defineProperty(HTMLElement.prototype, "animate", { value: animate, configurable: true });
    try {
      const user = userEvent.setup();
      renderDialog();
      await user.click(screen.getByRole("button", { name: "Créer un post" }));
      const sheetCall = animate.mock.calls.find(([keyframes]) => Array.isArray(keyframes));
      expect(sheetCall?.[0]).toEqual([
        { transform: "translateY(100%)" },
        { transform: "translateY(0)" },
      ]);
      // The opening must not hold its end state: it would override the swipe gesture's inline transform.
      expect(sheetCall?.[1]).toMatchObject({ fill: "backwards" });

      await user.click(screen.getByRole("button", { name: "Fermer" }));
      await act(async () => {
        await finished;
      });
      expect(document.querySelector("dialog")).not.toHaveAttribute("open");
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, "animate");
    }
  });

  it("never scrolls the dialog box itself (iOS would make the sliding sheet jump)", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Créer un post" }));
    const dialog = document.querySelector("dialog");
    if (!dialog) throw new Error("no dialog");
    expect(dialog).toHaveClass("overflow-clip");
    dialog.scrollTop = 120;
    fireEvent.scroll(dialog);
    expect(dialog.scrollTop).toBe(0);
  });

  it("useDialogClose is a harmless no-op outside a dialog", async () => {
    const user = userEvent.setup();
    render(<SubmitLikeChild />);
    await user.click(screen.getByRole("button", { name: "Terminer" }));
    expect(screen.getByRole("button", { name: "Terminer" })).toBeInTheDocument();
  });

  it("knows whether it is inside a dialog (useInDialog)", async () => {
    const user = userEvent.setup();
    function Probe() {
      return <p>{useInDialog() ? "dans un dialogue" : "hors dialogue"}</p>;
    }
    const { unmount } = render(<Probe />);
    expect(screen.getByText("hors dialogue")).toBeInTheDocument();
    unmount();
    render(
      <FullScreenDialog triggerLabel="Ouvrir" title="Titre">
        <Probe />
      </FullScreenDialog>,
    );
    await user.click(screen.getByRole("button", { name: "Ouvrir" }));
    expect(screen.getByText("dans un dialogue")).toBeInTheDocument();
  });

  it("does not put the focus on the close button when it opens", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Créer un post" }));
    expect(screen.getByRole("button", { name: "Fermer" })).not.toHaveFocus();
  });

  it("closes when the dimmed area around the sheet is tapped", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Créer un post" }));
    const dialog = document.querySelector("dialog") as HTMLDialogElement;
    await user.click(screen.getByText("Contenu du formulaire"));
    expect(dialog).toHaveAttribute("open");
    await user.click(dialog);
    expect(dialog).not.toHaveAttribute("open");
  });
});

describe("FullScreenDialog swipe down", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("dismisses on a long swipe from the header and is back in place next time", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Créer un post" }));
    const dialog = document.querySelector("dialog") as HTMLDialogElement;
    const title = screen.getByRole("heading", { name: "Nouveau post" });
    const sheet = title.closest("div[class*='rounded-t-sheet']") as HTMLElement;

    fireEvent.touchStart(title, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(title, { touches: [{ clientY: 150 }] });
    expect(sheet.style.transform).toBe("translateY(50px)");
    fireEvent.touchMove(title, { touches: [{ clientY: 400 }] });
    fireEvent.touchEnd(title);
    act(() => void vi.advanceTimersByTime(250));
    expect(dialog).not.toHaveAttribute("open");
    // Reset for the next opening (otherwise the sheet would reopen off-screen).
    expect(sheet.style.transform).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "Créer un post" }));
    expect(dialog).toHaveAttribute("open");
  });
});
