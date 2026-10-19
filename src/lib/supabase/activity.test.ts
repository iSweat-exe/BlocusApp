import { describe, expect, it } from "vitest";
import { ACTIVITY_REPORT_INTERVAL_SECONDS, activityCookieOptions } from "./activity";

describe("activityCookieOptions", () => {
  it("throttles the report to one every 5 minutes, like touch_activity()", () => {
    expect(ACTIVITY_REPORT_INTERVAL_SECONDS).toBe(300);
    expect(activityCookieOptions.maxAge).toBe(300);
  });

  it("keeps the cookie out of reach of page scripts", () => {
    expect(activityCookieOptions.httpOnly).toBe(true);
  });
});
