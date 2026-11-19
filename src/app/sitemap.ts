import type { MetadataRoute } from "next";
import { getPublicAppUrl } from "@/lib/publicAppUrl";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: getPublicAppUrl("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: getPublicAppUrl("/learn"), lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: getPublicAppUrl("/learn/search"), lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: getPublicAppUrl("/practice"), lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: getPublicAppUrl("/library"), lastModified: now, changeFrequency: "weekly", priority: 0.75 },
    { url: getPublicAppUrl("/research"), lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: getPublicAppUrl("/research/timeline"), lastModified: now, changeFrequency: "weekly", priority: 0.65 },
    { url: getPublicAppUrl("/research/compare"), lastModified: now, changeFrequency: "weekly", priority: 0.65 },
    { url: getPublicAppUrl("/research/debate"), lastModified: now, changeFrequency: "weekly", priority: 0.65 },
    { url: getPublicAppUrl("/privacy"), lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: getPublicAppUrl("/leaderboard"), lastModified: now, changeFrequency: "daily", priority: 0.65 },
  ];
}
