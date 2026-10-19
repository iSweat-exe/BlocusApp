import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

// Only public pages belong here; authenticated routes are excluded on purpose.
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  return [
    { url: `${siteUrl}/login`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${siteUrl}/register`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${siteUrl}/mentions-legales`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/confidentialite`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/cgu`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
