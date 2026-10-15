import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
// Local stand-in for Supabase (e2e/support/fake-supabase.mjs): sign-in runs for real, with no network.
const SUPABASE_PORT = 54399;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "on-first-retry" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: "node e2e/support/fake-supabase.mjs",
      url: `http://localhost:${SUPABASE_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      env: { FAKE_SUPABASE_PORT: String(SUPABASE_PORT) },
    },
    {
      // Production build: the service worker and PWA manifest only behave realistically there.
      command: `npm run build && npm run start -- -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: `http://localhost:${SUPABASE_PORT}`,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "placeholder",
        NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
      },
    },
  ],
});
