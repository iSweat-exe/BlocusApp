import { randomUUID } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";

// The three journeys that matter most while a demonstration is on: publish a post, react to it, declare the
// position of the demonstration. They run against the fake Supabase (e2e/support/fake-supabase.mjs), whose
// `manager` scenario may publish and declare, and whose `ok` scenario is a plain member.
const ORIGIN = "http://localhost:3100";

/** Signs in as the given scenario, then closes the first-launch onboarding that covers the page once. */
async function signIn(page: Page, scenario: "manager" | "ok") {
  await page.context().addCookies([{ name: "e2e_scenario", value: scenario, url: ORIGIN }]);
  await page.goto("/auth/login/discord");
  await page.waitForURL((url) => url.pathname === "/");
  const onboarding = page.getByRole("dialog", { name: "Bienvenue sur BLOCUS" });
  await onboarding.getByRole("button", { name: "Passer" }).click();
  await expect(onboarding).toHaveCount(0);
}

/** A title no other test uses: the fake database is shared by the whole run. */
const uniqueTitle = () => `Rendez-vous ${randomUUID().slice(0, 8)}`;

async function publish(page: Page, title: string) {
  await page.getByRole("button", { name: "Créer un post" }).click();
  const dialog = page.getByRole("dialog", { name: "Nouveau post" });
  await dialog.getByLabel("Titre").fill(title);
  await dialog.getByLabel("Message").fill("Départ à 14 h devant la mairie.");
  await dialog.getByRole("button", { name: "Publier", exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

/** The card of a post, found by its title. */
const cardOf = (page: Page, title: string) =>
  page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });

test.describe("posts and reactions", () => {
  test("a manager publishes a post, it shows in the feed, and people can react to it", async ({
    page,
  }) => {
    const title = uniqueTitle();
    await signIn(page, "manager");
    await publish(page, title);

    const card = cardOf(page, title);
    await expect(card).toBeVisible();
    await expect(card.getByText("Départ à 14 h devant la mairie.")).toBeVisible();

    // React with the palette: the pill shows the total and is highlighted for the person who used it.
    await card.getByRole("button", { name: "Ajouter une réaction" }).click();
    await card.getByRole("button", { name: "pouce levé" }).click();
    const pill = card.getByRole("button", { name: "pouce levé : 1" });
    await expect(pill).toHaveAttribute("aria-pressed", "true");

    // Who reacted is for signed-in people, on demand.
    await card.getByRole("button", { name: "Qui a réagi ?" }).click();
    await expect(card.getByRole("list", { name: "Qui a réagi" })).toContainText("GerantDiscord");

    // The reaction survives a reload (it is stored, not only optimistic).
    await page.reload();
    await expect(
      cardOf(page, title).getByRole("button", { name: "pouce levé : 1" }),
    ).toHaveAttribute("aria-pressed", "true");

    // Tapping the pill again removes it.
    await cardOf(page, title).getByRole("button", { name: "pouce levé : 1" }).click();
    await expect(cardOf(page, title).getByRole("button", { name: /pouce levé/ })).toHaveCount(0);
  });

  test("a Guest reads the post and the totals, but cannot react nor see who reacted", async ({
    page,
    browser,
  }) => {
    const title = uniqueTitle();
    await signIn(page, "manager");
    await publish(page, title);
    await cardOf(page, title).getByRole("button", { name: "Ajouter une réaction" }).click();
    await cardOf(page, title).getByRole("button", { name: "feu" }).click();
    await expect(cardOf(page, title).getByRole("button", { name: "feu : 1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const guest = await guestPage(browser);
    await guest.goto("/");
    const card = cardOf(guest, title);
    await expect(card).toBeVisible();
    await expect(card.getByRole("img", { name: "feu : 1" })).toBeVisible();
    await expect(card.getByRole("button", { name: "Ajouter une réaction" })).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Qui a réagi ?" })).toHaveCount(0);
    await guest.context().close();
  });

  test("a plain member can react but has no button to publish", async ({ page }) => {
    await signIn(page, "ok");
    await expect(page.getByRole("button", { name: "Créer un post" })).toHaveCount(0);
  });
});

test.describe("position of the demonstration", () => {
  test("a manager declares the position and the marker appears on the map", async ({ page }) => {
    // No network in the test: answer the style request with an empty one (a single background layer).
    await page.route("https://tiles.openfreemap.org/**", (route) =>
      route.fulfill({
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify({
          version: 8,
          sources: {},
          layers: [{ id: "bg", type: "background", paint: { "background-color": "#cfe8d5" } }],
        }),
      }),
    );
    const label = `Place ${randomUUID().slice(0, 6)}`;
    await signIn(page, "manager");
    await page.goto("/map");

    await page.getByRole("button", { name: "Déclarer la position" }).click();
    await expect(page.getByText("Déclarer la position", { exact: true })).toBeVisible();
    await page.getByLabel(/Lieu/).fill(label);
    await page.getByRole("button", { name: "Déclarer ici" }).click();

    // Back on the map, with the marker named after the place.
    const marker = page.getByRole("button", {
      name: new RegExp(`Position de la manifestation : ${label}`),
    });
    await expect(marker).toBeVisible();
    await marker.click();
    await expect(page.getByText(label).first()).toBeVisible();
  });

  test("a plain member has no button to declare it", async ({ page }) => {
    await page.route("https://tiles.openfreemap.org/**", (route) =>
      route.fulfill({
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify({ version: 8, sources: {}, layers: [] }),
      }),
    );
    await signIn(page, "ok");
    await page.goto("/map");
    await expect(page.getByRole("button", { name: "Me localiser" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Déclarer la position" })).toHaveCount(0);
  });
});

/** A browser context with no session: a Guest. */
async function guestPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ baseURL: ORIGIN });
  return context.newPage();
}
