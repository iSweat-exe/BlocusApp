import { expect, test } from "@playwright/test";

// TODO(auth): once the access guard exists (A-121), assert that private routes redirect to /login.
test.describe("app shell", () => {
  test("serves the four main pages with the bottom navigation", async ({ page }) => {
    for (const [path, title] of [
      ["/", "Accueil"],
      ["/messages", "Messagerie"],
      ["/calendar", "Calendrier"],
      ["/map", "Carte"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
      await expect(page.getByRole("navigation").getByRole("link")).toHaveCount(4);
    }
  });

  test("serves the public auth pages", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "Inscription" })).toBeVisible();
  });
});

test.describe("PWA and SEO files", () => {
  test("exposes a valid web app manifest", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.ok()).toBe(true);
    const manifest = await response.json();
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  });

  test("serves the service worker without caching", async ({ request }) => {
    const response = await request.get("/sw.js");
    expect(response.ok()).toBe(true);
    expect(response.headers()["cache-control"]).toContain("no-cache");
  });

  test("serves robots.txt and sitemap.xml", async ({ request }) => {
    expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /");
    expect(await (await request.get("/sitemap.xml")).text()).toContain("/login");
  });
});
