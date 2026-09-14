import type { MetadataRoute } from "next";

const appName = process.env.APP_NAME ?? "Harusi";

// DESIGN.md §9/§5.6: name from APP_NAME, standalone, theme/background from tokens.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: appName,
    short_name: appName,
    description: `${appName}: a private wedding planner and expense tracker.`,
    start_url: "/",
    display: "standalone",
    background_color: "#F6F1E7",
    theme_color: "#1F2A6B",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
