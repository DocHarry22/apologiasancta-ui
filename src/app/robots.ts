import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sandybrown-bear-488955.hostingersite.com";
  return {
    rules: [
      { userAgent: "*", allow: ["/", "/learn/", "/practice/", "/library/", "/leaderboard/"], disallow: ["/admin/", "/author/", "/api/"] },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
