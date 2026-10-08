import { describe, expect, it } from "vitest";
import { checkConfiguration, configShare } from "./config";

const full = {
  CRON_SECRET: "a",
  SUPABASE_SERVICE_ROLE_KEY: "b",
  NEXT_PUBLIC_SITE_URL: "https://blocus.app",
  VERCEL_API_TOKEN: "c",
  VERCEL_PROJECT_ID: "prj_1",
};

describe("checkConfiguration", () => {
  it("passes every check when everything is set", () => {
    const checks = checkConfiguration(full);
    expect(checks.every((check) => check.ok)).toBe(true);
    expect(configShare(checks)).toBe(1);
  });

  it("flags what is missing and never exposes a value", () => {
    const checks = checkConfiguration({ NEXT_PUBLIC_SITE_URL: "https://blocus.app" });
    expect(checks.filter((check) => !check.ok).map((check) => check.key)).toEqual([
      "CRON_SECRET",
      "SUPABASE_SERVICE_ROLE_KEY",
      "VERCEL_API_TOKEN",
    ]);
    expect(JSON.stringify(checks)).not.toContain("blocus.app");
  });

  it("needs the Vercel project as well as the token", () => {
    const checks = checkConfiguration({ ...full, VERCEL_PROJECT_ID: "" });
    expect(checks.find((check) => check.key === "VERCEL_API_TOKEN")?.ok).toBe(false);
  });

  it("counts only the required checks in the share", () => {
    expect(configShare(checkConfiguration({ ...full, VERCEL_API_TOKEN: undefined }))).toBe(1);
    expect(configShare(checkConfiguration({ ...full, CRON_SECRET: undefined }))).toBeCloseTo(2 / 3);
  });
});
