import { describe, expect, it } from "vitest";
import { AUTH_COOKIE_NAME, authCookieOptions } from "./cookie";

describe("authCookieOptions", () => {
  it("uses the fixed session cookie name", () => {
    expect(authCookieOptions.name).toBe(AUTH_COOKIE_NAME);
  });

  it("keeps the session cookies out of reach of page scripts", () => {
    expect(authCookieOptions.httpOnly).toBe(true);
  });
});
