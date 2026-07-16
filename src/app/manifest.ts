import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Apologia Sancta: Learn and Compete",
    short_name: "Apologia",
    description: "Sourced Catholic apologetics lessons, solo practice, and live room competition.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F7F2E8",
    theme_color: "#081B29",
    categories: ["education", "games"],
    icons: [
      {
        src: "/app-icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/app-icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
