import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RefreshButton } from "./refresh-button";

const refreshPublicData = vi.fn();
vi.mock("@/features/refresh/actions", () => ({ refreshPublicData: () => refreshPublicData() }));

beforeEach(() => refreshPublicData.mockReset());

describe("RefreshButton", () => {
  it("is a named button that asks the server to refresh the shared data", async () => {
    refreshPublicData.mockResolvedValue(undefined);
    render(<RefreshButton />);
    await userEvent.click(screen.getByRole("button", { name: "Actualiser" }));
    expect(refreshPublicData).toHaveBeenCalledTimes(1);
  });

  it("is busy and disabled while the page refreshes, then available again", async () => {
    let finish: () => void = () => {};
    refreshPublicData.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    render(<RefreshButton />);
    const button = screen.getByRole("button", { name: "Actualiser" });
    await userEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveAttribute("aria-busy", "true");

    finish();
    await waitFor(() => expect(button).toBeEnabled());
  });

  it("stays busy for as long as the action has not finished, however long that takes", async () => {
    // A slow refresh: no timer may re-enable the button and allow a second press while it is running.
    let finish: () => void = () => {};
    refreshPublicData.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    render(<RefreshButton />);
    const button = screen.getByRole("button", { name: "Actualiser" });
    await userEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    await new Promise((resolve) => setTimeout(resolve, 900));
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");

    // Resolved last: the `beforeEach` above returns the mock, which Vitest calls again as the teardown.
    finish();
    await waitFor(() => expect(button).toBeEnabled());
  });
});
