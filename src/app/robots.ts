import type { MetadataRoute } from "next";
import { getPublicAppUrl } from "@/lib/publicAppUrl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ["/", "/learn/", "/practice/", "/library/", "/leaderboard/"], disallow: ["/admin/", "/author/", "/api/"] },
    ],
    sitemap: getPublicAppUrl("/sitemap.xml"),
  };
}
