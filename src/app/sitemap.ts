import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

// Only public pages belong here; authenticated routes are excluded on purpose.
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  return [
    { url: `${siteUrl}/login`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${siteUrl}/register`, changeFrequency: "yearly", priority: 0.5 },
  ];
}
