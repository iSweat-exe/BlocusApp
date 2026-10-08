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
      await expect(
        page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link"),
      ).toHaveCount(4);
    }
  });

  test("home shows the announcements section without crashing when the data is unreachable", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("region", { name: "Actualités" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Publier" })).toHaveCount(0);
  });

  test("the settings page changes the accent color and keeps it after a reload", async ({
    page,
  }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { level: 1, name: "Réglages" })).toBeVisible();
    await page.getByRole("radio", { name: "Bleu" }).click();
    const accent = () =>
      page.evaluate(() => document.documentElement.style.getPropertyValue("--accent"));
    expect(await accent()).toBe("#3b82f6");
    await page.reload();
    // Applied before paint by the boot script, with no flash of the default red.
    expect(await accent()).toBe("#3b82f6");
    await expect(page.getByRole("radio", { name: "Bleu" })).toBeChecked();
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

  test("sends Guests away from the audit journal", async ({ page }) => {
    await page.goto("/admin/journal");
    await page.waitForURL("**/login");
  });

  test("the Discord login link redirects to the OAuth provider without JavaScript", async ({
    request,
  }) => {
    const response = await request.get("/auth/login/discord", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    const location = new URL(response.headers()["location"] ?? "");
    expect(location.pathname).toBe("/auth/v1/authorize");
    expect(location.searchParams.get("provider")).toBe("discord");
    // The PKCE verifier cookie travels with the redirect.
    expect(response.headers()["set-cookie"]).toContain("code-verifier");
  });

  test("the Discord login endpoint can also return its URL as JSON", async ({ request }) => {
    const response = await request.get("/auth/login/discord?format=json");
    expect(response.ok()).toBe(true);
    const { url } = await response.json();
    // Discord itself when Supabase is reachable, otherwise the Supabase authorize URL.
    expect(url).toMatch(/^https:\/\/(discord\.com\/oauth2\/authorize|[^/]+\/auth\/v1\/authorize)/);
  });

  test("the calendar shows a month grid and survives invalid parameters", async ({ page }) => {
    await page.goto("/calendar?month=2026-10&day=2026-10-07");
    await expect(page.getByRole("grid")).toBeVisible();
    await expect(page.getByRole("heading", { name: "octobre 2026", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "mercredi 7 octobre 2026" })).toBeVisible();
    await page.goto("/calendar?month=banana&day=2026-02-30");
    await expect(page.getByRole("grid")).toBeVisible();
  });

  test("Guests do not get event creation controls", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page.getByRole("grid")).toBeVisible();
    await expect(page.getByText("Ajouter un événement")).toHaveCount(0);
  });

  test("an invalid event id shows the not-found page", async ({ page }) => {
    await page.goto("/calendar/not-a-uuid");
    await expect(page.getByRole("heading", { name: "Page introuvable" })).toBeVisible();
  });

  test("icons are cacheable for a day, not revalidated on every load", async ({ request }) => {
    const response = await request.get("/icons/icon-192.png");
    expect(response.ok()).toBe(true);
    expect(response.headers()["cache-control"]).toContain("max-age=86400");
  });

  test("the home page survives any feed size parameter", async ({ page }) => {
    for (const n of ["20", "999", "abc", "-1"]) {
      await page.goto(`/?n=${n}`);
      await expect(page.getByRole("region", { name: "Actualités" })).toBeVisible();
    }
  });

  test("the keep-alive route answers with JSON and is never cached", async ({ request }) => {
    const response = await request.get("/api/keep-alive");
    // 200 when the database answers, 503 when it cannot be reached (the e2e environment has no database).
    expect([200, 503]).toContain(response.status());
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(await response.json()).toHaveProperty("ok");
  });

  test("sends Guests away from the profile page", async ({ page }) => {
    await page.goto("/profil");
    await page.waitForURL("**/login");
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
  });

  test("the home page shows no imminent-event banner when there is nothing to show", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Accueil" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Événements imminents" })).toHaveCount(0);
  });

  test("the header offers sign-in to Guests and never a sign-out button", async ({ page }) => {
    await page.goto("/");
    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: "BlocusApp" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Se connecter" })).toHaveAttribute(
      "href",
      "/login",
    );
    await expect(header.getByRole("link", { name: "Administration" })).toHaveCount(0);
    await expect(header.getByRole("link", { name: "Mon profil" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Déconnexion" })).toHaveCount(0);
  });

  test("serves the public auth pages", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
    const discordLink = page.getByRole("link", { name: "Continuer avec Discord" });
    await expect(discordLink).toBeVisible();
    // Starts on the server-redirect URL, then points straight at the provider once hydrated.
    await expect(discordLink).toHaveAttribute("href", /^(\/auth\/login\/discord|https:\/\/)/);
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "Inscription" })).toBeVisible();
  });

  test("the login page shows a disabled Google button and a working Guest mode", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /Continuer avec Google/ })).toBeDisabled();
    await page.getByRole("link", { name: /invité/ }).click();
    await page.waitForURL((url) => url.pathname === "/");
    await expect(page.getByRole("heading", { level: 1, name: "Accueil" })).toBeVisible();
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
