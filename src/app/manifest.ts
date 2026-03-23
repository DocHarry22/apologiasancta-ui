import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Apologia Sancta Live",
    short_name: "Apologia",
    description: "Installable live apologetics quiz with room-based play and study access.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#1a1816",
    theme_color: "#d4af37",
    orientation: "portrait-primary",
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
