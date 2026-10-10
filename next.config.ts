import type { NextConfig } from "next";
import { TILES_ORIGIN } from "./src/features/map/map-config";

const isDev = process.env.NODE_ENV !== "production";

// Origin of the Supabase project, e.g. https://xxxx.supabase.co (REST/Auth/Storage + Realtime websocket).
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
  : "https://*.supabase.co";
const supabaseWs = supabaseOrigin.replace(/^https:/, "wss:");

// Content Security Policy. Any new external origin (map tiles, analytics...) must be added here
// in the same PR that introduces it (see docs/security.md).
// NOTE: 'unsafe-inline' scripts are required by Next.js unless nonces are used, which would make
// every page dynamic. Moving to nonces is tracked as a follow-up in docs/security.md.
const contentSecurityPolicy = [
  "default-src 'self'",
  // Vercel Analytics is served from /_vercel/insights (same origin) in production; the debug build
  // used in development comes from va.vercel-scripts.com.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval' https://va.vercel-scripts.com" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // cdn.discordapp.com and lh3.googleusercontent.com serve the Discord / Google avatars (header, /profil); the tiles origin serves the map images.
  `img-src 'self' data: blob: ${supabaseOrigin} https://cdn.discordapp.com https://lh3.googleusercontent.com ${TILES_ORIGIN}`,
  "font-src 'self' data:",
  // The map fetches its style, vector tiles, glyphs and sprites from the tiles origin.
  `connect-src 'self' ${supabaseOrigin} ${supabaseWs} ${TILES_ORIGIN}${isDev ? " ws: http:" : ""}`,
  // MapLibre parses tiles in a worker (a same-origin file, or a blob: wrapper around a cross-origin one).
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // geolocation stays enabled for the map feature; everything else sensitive is off.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  ...(isDev
    ? {
        allowedDevOrigins: [
          "localhost:3000",
          "127.0.0.1:3000",
          "192.168.1.20",
          "192.168.1.20:3000",
          "192.168.56.1",
          "192.168.56.1:3000",
        ],
      }
    : {}),
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Icons change rarely: let the browser and the CDN keep them instead of revalidating on every load.
        source: "/icons/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
      {
        // The service worker must never be cached by the browser/CDN so updates apply quickly.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
  cacheComponents: true,
  experimental: {
    // Client router cache: going back to a page visited less than 30 s ago does not hit the server again.
    // Writes (Server Actions with updateTag/revalidatePath) and RefreshOnReturn bypass it.
    staleTimes: { dynamic: 30 },
  },
  cacheLife: {
    // Public data shared by every visitor (announcements, events, map route): at most one database read per
    // 2 min per server instance, refreshed in the background, dropped after 10 min without a visit. Writes
    // expire it at once (updateTag) and the "Actualiser" button expires it on demand.
    feed: { stale: 30, revalidate: 120, expire: 600 },
    // Live data, read often during a demonstration (the declared position on the map): 30 s.
    live: { stale: 30, revalidate: 30, expire: 300 },
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
