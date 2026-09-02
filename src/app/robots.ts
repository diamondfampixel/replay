import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The admin, auth flows, APIs, and demo storefronts are not for crawlers.
        disallow: ["/admin", "/api/", "/s/", "/dev/", "/onboarding", "/verify-email", "/reset-password"],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
