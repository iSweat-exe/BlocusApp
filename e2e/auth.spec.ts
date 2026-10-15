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

      // The session lives in cookies (SameSite=Lax), never in web storage.
      const cookies = await sessionCookies(page);
      expect(cookies.length).toBeGreaterThan(0);
      expect(cookies.every((cookie) => cookie.sameSite === "Lax")).toBe(true);
      expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).not.toContain(
        "access_token",
      );

      await header.getByRole("link", { name: "Mon profil" }).click();
      await page.waitForURL("**/profil");
      await expect(page.getByRole("heading", { level: 1, name: "Mon profil" })).toBeVisible();
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
    await page.goto(
      "/auth/callback?error=server_error&error_description=Error+getting+user+email+from+external+provider",
    );
    await page.waitForURL("**/login?error=oauth_callback");
    await expect(page.getByText("La connexion a échoué. Réessaie.")).toBeVisible();
    expect(await sessionCookies(page)).toEqual([]);
  });

  test("signing out is a POST only: a plain link to it does nothing", async ({ request }) => {
    const response = await request.get("/auth/logout", { maxRedirects: 0 });
    expect(response.status()).toBe(405);
  });
});
