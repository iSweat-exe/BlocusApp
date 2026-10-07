import { expect, test } from "@playwright/test";

// TODO(auth): once the access guard exists (A-121), assert that private routes redirect to /login.
test.describe("app shell", () => {
  test("serves the three main pages with the bottom navigation", async ({ page }) => {
    for (const [path, title] of [
      ["/", "Accueil"],
      ["/calendar", "Calendrier"],
      ["/map", "Carte"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
      await expect(page.getByRole("navigation").getByRole("link")).toHaveCount(3);
    }
  });

  test("home shows the announcements section without crashing when the data is unreachable", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("region", { name: "Actualités" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Publier" })).toHaveCount(0);
  });

  test("does not expose a public messages page", async ({ page }) => {
    const response = await page.goto("/messages");
    expect(response?.status()).toBe(404);
  });

  test("sends Guests away from the admin panel", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForURL("**/login");
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
  });

  test("sends Guests away from an admin user page", async ({ page }) => {
    await page.goto("/admin/users/00000000-0000-0000-0000-0000000000a1");
    await page.waitForURL("**/login");
  });

  test("sends Guests away from the roles page", async ({ page }) => {
    await page.goto("/admin/roles");
    await page.waitForURL("**/login");
  });

  test("sends Guests away from the profile page", async ({ page }) => {
    await page.goto("/profil");
    await page.waitForURL("**/login");
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
  });

  test("serves the public auth pages", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuer avec Discord" })).toBeVisible();
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

test.describe("security headers", () => {
  test("sends the baseline security headers", async ({ request }) => {
    const headers = (await request.get("/login")).headers();
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBeTruthy();
    expect(headers["strict-transport-security"]).toContain("max-age=");
  });

  test("renders pages without CSP violations", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      if (message.text().includes("Content Security Policy")) violations.push(message.text());
    });
    await page.goto("/login");
    await page.goto("/messages");
    expect(violations).toEqual([]);
  });
});
