import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sandybrown-bear-488955.hostingersite.com";
  const now = new Date();
  return [
    { url: baseUrl, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/learn`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/learn/search`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/practice`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/library`, lastModified: now, changeFrequency: "weekly", priority: 0.75 },
    { url: `${baseUrl}/research`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/leaderboard`, lastModified: now, changeFrequency: "daily", priority: 0.65 },
  ];
}
