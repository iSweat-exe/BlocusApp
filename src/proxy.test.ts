import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_COOKIE_NAME } from "@/lib/supabase/cookie";
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
  const entries = config.matcher;
  // Next.js compiles `source` with path-to-regexp; the negative look-ahead is plain regex syntax.
  const matcher = new RegExp(`^${entries[0]?.source}$`);

  it("has one entry for the session cookie and one for its chunked form, sharing the same source", () => {
    expect(entries).toHaveLength(2);
    expect(entries[1]?.source).toBe(entries[0]?.source);
    expect(entries.map((entry) => entry.has[0]?.key)).toEqual([
      AUTH_COOKIE_NAME,
      `${AUTH_COOKIE_NAME}.0`,
    ]);
  });

  it("skips link prefetches, whatever header the browser uses", () => {
    for (const entry of entries) {
      expect(entry.missing).toEqual([
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ]);
    }
  });

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
    "/robots.txt",
    "/sitemap.xml",
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
