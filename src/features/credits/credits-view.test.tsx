import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CreditsView } from "./credits-view";
import { DEVELOPERS, githubAvatarUrl, githubUrl, STACK } from "./team";

describe("CreditsView", () => {
  it("is titled « Crédits »", () => {
    render(<CreditsView />);
    expect(screen.getByRole("heading", { level: 1, name: "Crédits" })).toBeInTheDocument();
  });

  it("lists every developer with a link to their GitHub profile", () => {
    render(<CreditsView />);
    const team = screen.getByRole("region", { name: "L'équipe" });
    const links = within(team).getAllByRole("link");
    expect(links).toHaveLength(DEVELOPERS.length);
    DEVELOPERS.forEach((developer, index) => {
      expect(links[index]).toHaveAttribute("href", githubUrl(developer.github));
      expect(links[index]).toHaveTextContent(`github.com/${developer.github}`);
    });
  });

  it("opens every external link in a new tab without leaking the opener, and says so", () => {
    render(<CreditsView />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(DEVELOPERS.length + STACK.length);
    for (const link of links) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link.textContent).toMatch(/nouvel onglet/);
    }
  });

  describe("contribution figures", () => {
    const first = DEVELOPERS[0]!;
    const stats = {
      [first.github.toLowerCase()]: { commits: 91, additions: 49776, deletions: 3007 },
    };

    it("shows commits and added / deleted lines like the Contributors tab of GitHub", () => {
      render(<CreditsView stats={stats} />);
      const card = screen.getByRole("link", { name: new RegExp(first.github) });
      expect(card.textContent).toMatch(/91 commits/);
      expect(card.textContent).toMatch(/49\s776 \+\+/);
      expect(card.textContent).toMatch(/3\s007 --/);
    });

    it("colors the added lines green and the deleted ones red", () => {
      render(<CreditsView stats={stats} />);
      expect(screen.getByText(/\+\+$/)).toHaveClass("text-success");
      expect(screen.getByText(/--$/)).toHaveClass("text-danger");
    });

    it("says the same in words to assistive technologies, and hides the symbols from them", () => {
      render(<CreditsView stats={stats} />);
      expect(screen.getByText(/lignes ajoutées/)).toHaveClass("sr-only");
      expect(screen.getByText(/lignes ajoutées/).textContent).toMatch(
        /91 commits, 49\s776 lignes ajoutées, 3\s007 lignes supprimées/,
      );
      expect(screen.getByText(/\+\+$/)).toHaveAttribute("aria-hidden", "true");
    });

    it("agrees in the singular", () => {
      render(
        <CreditsView
          stats={{ [first.github.toLowerCase()]: { commits: 1, additions: 2, deletions: 0 } }}
        />,
      );
      expect(screen.getByText("1 commit")).toBeInTheDocument();
    });

    it("matches the login whatever its case, and shows figures only to those who have some", () => {
      const other = DEVELOPERS[1]!;
      render(<CreditsView stats={stats} />);
      expect(screen.getAllByText(/commits?$/)).toHaveLength(1);
      const card = screen.getByRole("link", { name: new RegExp(other.github) });
      expect(card.textContent).not.toMatch(/commit/);
    });

    it("is complete without any figure (GitHub unreachable)", () => {
      render(<CreditsView />);
      expect(screen.queryByText(/commit/)).toBeNull();
      expect(screen.getAllByRole("link").length).toBe(DEVELOPERS.length + STACK.length);
    });
  });

  it("names what the application is built with and credits the map data", () => {
    render(<CreditsView />);
    const stack = screen.getByRole("region", { name: "Construite avec" });
    for (const item of STACK) expect(within(stack).getByText(item.name)).toBeInTheDocument();
    expect(screen.getByText(/contributeurs OpenStreetMap/)).toBeInTheDocument();
  });

  it("shows each developer's GitHub photo, from GitHub's avatar host only, without a referrer", () => {
    const { container } = render(<CreditsView />);
    const photos = [...container.querySelectorAll("img")];
    expect(photos).toHaveLength(DEVELOPERS.length);
    DEVELOPERS.forEach((developer, index) => {
      expect(photos[index]).toHaveAttribute("src", githubAvatarUrl(developer.github));
      // Decorative: the name sits right next to it.
      expect(photos[index]).toHaveAttribute("alt", "");
      expect(photos[index]).toHaveAttribute("referrerpolicy", "no-referrer");
    });
    for (const photo of photos) {
      expect(new URL(photo.getAttribute("src") ?? "").hostname).toBe(
        "avatars.githubusercontent.com",
      );
    }
  });
});
