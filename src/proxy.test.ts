import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { config, proxy } from "./proxy";

const updateSession = vi.fn();
vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: (...args: unknown[]) => updateSession(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  updateSession.mockImplementation(() => NextResponse.next());
});

describe("proxy", () => {
  it("refreshes the session on a normal page request", () => {
    proxy(new NextRequest("http://localhost/calendar"));
    expect(updateSession).toHaveBeenCalledTimes(1);
  });

  it("does not touch the session for link prefetches", () => {
    const response = proxy(
      new NextRequest("http://localhost/calendar", { headers: { "next-router-prefetch": "1" } }),
    );
    expect(updateSession).not.toHaveBeenCalled();
    expect(response).toBeInstanceOf(NextResponse);
  });
});

describe("matcher", () => {
  // Next.js compiles the matcher with path-to-regexp; the negative look-ahead is plain regex syntax.
  const matcher = new RegExp(`^${config.matcher[0]}$`);

  it.each(["/", "/calendar", "/calendar/123", "/admin/users/abc", "/auth/callback", "/login"])(
    "runs for the page %s",
    (path) => {
      expect(matcher.test(path)).toBe(true);
    },
  );

  it.each([
    "/_next/static/chunks/app.js",
    "/_next/image",
    "/sw.js",
    "/manifest.webmanifest",
    "/icons/icon-192.png",
    "/favicon.ico",
    "/api/keep-alive",
    "/logo.png",
    "/pictures/photo.webp",
  ])("skips the asset %s", (path) => {
    expect(matcher.test(path)).toBe(false);
  });

  it("only skips a literal sw.js (the dot is escaped)", () => {
    expect(matcher.test("/swXjs")).toBe(true);
  });
});
