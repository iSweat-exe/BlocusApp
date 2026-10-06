import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

// The app is private: only the public auth pages may be indexed.
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/login", "/register"],
        disallow: "/",
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
