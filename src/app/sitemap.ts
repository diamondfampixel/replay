import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const page = (path: string, priority: number): MetadataRoute.Sitemap[number] => ({
    url: `${appUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority,
  });
  return [page("/", 1), page("/pricing", 0.8), page("/privacy", 0.2), page("/terms", 0.2), page("/refunds", 0.2)];
}
