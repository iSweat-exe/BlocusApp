import { expect, test, type Page } from "@playwright/test";

// A-011: sign-in and sign-out journeys. Discord and Google are replaced by e2e/support/fake-supabase.mjs, which
// answers the authorize / token / user endpoints, so the app's own routes, cookies and redirects run for real.
const PROVIDERS = [
  { name: "Discord", link: "Continuer avec Discord", pseudo: "TesteurDiscord" },
  { name: "Google", link: "Continuer avec Google", pseudo: "TesteurGoogle" },
] as const;

const SESSION_COOKIE = "blocus-auth";

async function sessionCookies(page: Page) {
  return (await page.context().cookies()).filter(
    (cookie) => cookie.name === SESSION_COOKIE || cookie.name.startsWith(`${SESSION_COOKIE}.`),
  );
}

test.describe("sign-in and sign-out", () => {
  for (const provider of PROVIDERS) {
    test(`signs in with ${provider.name}, shows the profile, then signs out`, async ({ page }) => {
      await page.goto("/login");
      const link = page.getByRole("link", { name: new RegExp(provider.link) });
      // Wait for hydration: the Discord link first targets our route, then the provider itself.
      await page.waitForLoadState("networkidle");
      await link.click();
      await page.waitForURL((url) => url.pathname === "/");

      // Signed in: the header offers the profile, never the sign-in link.
      const header = page.getByRole("banner");
      await expect(header.getByRole("link", { name: "Mon profil" })).toBeVisible();
      await expect(header.getByRole("link", { name: "Se connecter" })).toHaveCount(0);

      // First launch of a signed-in person: the onboarding covers the page once, "Passer" closes it for good.
      const onboarding = page.getByRole("dialog", { name: "Bienvenue sur BLOCUS" });
      await expect(onboarding).toBeVisible();
      await onboarding.getByRole("button", { name: "Passer" }).click();
      await expect(onboarding).toHaveCount(0);

      // The session lives in httpOnly cookies (SameSite=Lax) that page scripts cannot read, never in web storage.
      const cookies = await sessionCookies(page);
      expect(cookies.length).toBeGreaterThan(0);
      expect(cookies.every((cookie) => cookie.httpOnly && cookie.sameSite === "Lax")).toBe(true);
      expect(await page.evaluate(() => document.cookie)).not.toContain(SESSION_COOKIE);
      expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).not.toContain(
        "access_token",
      );

      await header.getByRole("link", { name: "Mon profil" }).click();
      await page.waitForURL("**/profil");
      await expect(page.getByRole("heading", { level: 1, name: "Mon profil" })).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0); // not shown again
      await expect(page.getByText(provider.pseudo)).toBeVisible();
      await expect(page.getByText(`e2e-${provider.name.toLowerCase()}@example.test`)).toBeVisible();
      await expect(page.getByText(provider.name, { exact: true })).toBeVisible();

      await page.getByRole("button", { name: "Déconnexion" }).click();
      await page.waitForURL("**/login");
      await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
      expect(await sessionCookies(page)).toEqual([]);

      // Back to being a Guest: the private page sends away again and the header offers sign-in.
      await page.goto("/profil");
      await page.waitForURL("**/login");
      await page.goto("/");
      await expect(
        page.getByRole("banner").getByRole("link", { name: "Se connecter" }),
      ).toBeVisible();
    });
  }

  test("stays signed in after a reload and on another page", async ({ page }) => {
    await page.goto("/auth/login/google");
    await page.waitForURL((url) => url.pathname === "/");
    await page.goto("/profil");
    await expect(page.getByText("TesteurGoogle")).toBeVisible();
    await page.reload();
    await expect(page.getByText("TesteurGoogle")).toBeVisible();
  });

  test("a code the server cannot exchange sends back to /login with an error and no session", async ({
    page,
  }) => {
    await page.goto("/auth/callback?code=forged");
    await page.waitForURL("**/login?error=oauth_callback");
    await expect(page.getByText("La connexion a échoué. Réessaie.")).toBeVisible();
    expect(await sessionCookies(page)).toEqual([]);
  });

  test("a provider that refuses the sign-in (no code) sends back to /login with an error", async ({
    page,
  }) => {
    await page.goto("/auth/callback?error=access_denied&error_description=The+user+denied+access");
    await page.waitForURL("**/login?error=oauth_callback");
    await expect(page.getByText("La connexion a échoué. Réessaie.")).toBeVisible();
    expect(await sessionCookies(page)).toEqual([]);
  });

  test("a Discord account that shares no e-mail is told «Email non vérifié»", async ({ page }) => {
    await page.goto(
      "/auth/callback?error=server_error&error_description=Error+getting+user+email+from+external+provider",
    );
    await page.waitForURL("**/login?error=email_not_verified");
    await expect(page.getByText(/Email non vérifié/)).toBeVisible();
    expect(await sessionCookies(page)).toEqual([]);
  });

  test.describe("e-mail not verified by the provider", () => {
    // Tells the fake provider to answer with an address it did not verify (see the scenarios in fake-supabase.mjs).
    async function signInAs(page: Page, scenario: string) {
      await page
        .context()
        .addCookies([{ name: "e2e_scenario", value: scenario, url: "http://localhost:3100" }]);
      await page.goto("/auth/login/discord");
    }

    test("refuses the sign-up, leaves no session and removes the new account", async ({
      page,
      request,
    }) => {
      await signInAs(page, "new-unverified");
      await page.waitForURL("**/login?error=email_not_verified");
      await expect(page.getByText(/Email non vérifié/)).toBeVisible();
      expect(await sessionCookies(page)).toEqual([]);

      await page.goto("/profil");
      await page.waitForURL("**/login");
      const deleted = await (await request.get("http://localhost:54399/__deleted-users")).json();
      expect(deleted).toContain("00000000-0000-4000-8000-000000000cd1");
    });

    test("refuses an older account too, without deleting it", async ({ page, request }) => {
      await signInAs(page, "unverified");
      await page.waitForURL("**/login?error=email_not_verified");
      await expect(page.getByText(/Email non vérifié/)).toBeVisible();
      expect(await sessionCookies(page)).toEqual([]);

      const deleted = await (await request.get("http://localhost:54399/__deleted-users")).json();
      expect(deleted).not.toContain("00000000-0000-4000-8000-00000000" + "0bd1");
    });
  });

  test("signing out is a POST only: a plain link to it does nothing", async ({ request }) => {
    const response = await request.get("/auth/logout", { maxRedirects: 0 });
    expect(response.status()).toBe(405);
  });
});
