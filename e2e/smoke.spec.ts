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

  test("the map page loads the map and starts its worker", async ({ page }) => {
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
    const violations: string[] = [];
    page.on("console", (message) => {
      if (message.text().includes("Content Security Policy")) violations.push(message.text());
    });
    // MapLibre parses tiles in a module worker served from our own origin (CSP `worker-src 'self'`).
    const worker = page.waitForEvent("worker");

    await page.goto("/map");
    await expect(page.getByRole("heading", { level: 1, name: "Carte" })).toBeVisible();
    // Guests never get the editing controls.
    await expect(page.getByRole("button", { name: "Modifier le tracé" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Déclarer la position" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Carte" })).toBeVisible();
    expect((await worker).url()).toContain("/_next/static/media/maplibre-gl-worker");
    await expect(page.getByRole("button", { name: "Me localiser" })).toBeEnabled();
    expect(violations).toEqual([]);
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

  test("the settings page forces the theme and keeps it after a reload", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/settings");
    const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(await background()).toBe("rgb(10, 10, 10)");

    await page.getByRole("radio", { name: "Clair" }).click();
    expect(await background()).toBe("rgb(255, 255, 255)");
    await page.reload();
    // Applied before paint by the boot script, even though the system is dark.
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(await background()).toBe("rgb(255, 255, 255)");

    await page.getByRole("radio", { name: "Système" }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme");
    expect(await background()).toBe("rgb(10, 10, 10)");
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

  test("picking another day in the calendar costs no request to the server", async ({ page }) => {
    await page.goto("/calendar?month=2026-10&day=2026-10-07");
    await expect(page.getByRole("grid")).toBeVisible();
    // Wait for hydration: the grid cells only switch day client-side once it is done.
    await page.waitForLoadState("networkidle");

    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.getByRole("gridcell", { name: /^jeudi 8 octobre 2026/ }).click();
    await expect(page.getByRole("heading", { name: "jeudi 8 octobre 2026" })).toBeVisible();
    await page.getByRole("gridcell", { name: /^vendredi 9 octobre 2026/ }).click();
    await expect(page.getByRole("heading", { name: "vendredi 9 octobre 2026" })).toBeVisible();
    expect(page.url()).toContain("day=2026-10-09");
    expect(requests).toEqual([]);
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

  test("the header has a manual refresh button that survives a press", async ({ page }) => {
    await page.goto("/");
    const refresh = page.getByRole("banner").getByRole("button", { name: "Actualiser" });
    await expect(refresh).toBeVisible();
    await refresh.click();
    // The page is rendered again on the server (slow here: the test database is unreachable), then the button is back.
    await expect(refresh).toBeEnabled({ timeout: 60_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Accueil" })).toBeVisible();
  });

  test("the login page is static and shows the error of a failed sign-in", async ({ page }) => {
    const response = await page.goto("/login?error=oauth_callback");
    // Prerendered: served without running the page on the server (no function invocation on Vercel).
    expect(response?.headers()["x-nextjs-prerender"]).toMatch(/^1/);
    await expect(page.getByText("La connexion a échoué. Réessaie.")).toBeVisible();
    await page.goto("/login?error=nonsense");
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
    await expect(page.getByText("La connexion a échoué.")).toHaveCount(0);
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

  test("the login page links to Google sign-in and has a working Guest mode", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("link", { name: /Continuer avec Google/ })).toHaveAttribute(
      "href",
      "/auth/login/google",
    );
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
  test("the page stays at 100 %: no pinch or double-tap zoom, fields never trigger the iOS zoom", async ({
    page,
  }) => {
    await page.goto("/login");
    const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
    expect(viewport).toContain("width=device-width");
    expect(viewport).toContain("maximum-scale=1");
    expect(viewport).toContain("minimum-scale=1");
    expect(viewport).toContain("user-scalable=no");
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).touchAction)).toBe(
      "pan-x pan-y",
    );
  });

  test("on a touch screen text fields stay at 16 px, so iOS never zooms in on focus", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "touch screens only");
    await page.goto("/settings");
    const size = await page
      .locator("#accent-hex")
      .evaluate((input) => getComputedStyle(input).fontSize);
    expect(size).toBe("16px");
  });

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
