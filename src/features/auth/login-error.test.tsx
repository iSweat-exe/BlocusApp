import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginError } from "./login-error";

let query = "";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(query) }));

beforeEach(() => {
  query = "";
});

describe("LoginError", () => {
  it("shows nothing without an error", () => {
    const { container } = render(<LoginError />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ["oauth_start", "Impossible de démarrer la connexion Discord. Réessaie."],
    ["oauth_callback", "La connexion a échoué. Réessaie."],
  ])("explains the %s error", (code, message) => {
    query = `error=${code}`;
    render(<LoginError />);
    expect(screen.getByRole("alert")).toHaveTextContent(message);
  });

  it("ignores unknown codes, including names inherited from Object", () => {
    query = "error=unknown";
    const { container, rerender } = render(<LoginError />);
    expect(container).toBeEmptyDOMElement();
    query = "error=constructor";
    rerender(<LoginError />);
    expect(container).toBeEmptyDOMElement();
  });
});
