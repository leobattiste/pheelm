import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

/**
 * The web app manifest: what Pheelm looks like once it's added to a home screen. It opens full
 * screen, without the browser's bars, on the black of the dark theme, with shortcuts to the main
 * pages from a long press on the icon.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/?source=app",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#0b0b0b",
    theme_color: "#0b0b0b",
    categories: ["entertainment", "movies", "education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Films", url: "/films?source=app", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Directors", url: "/directors?source=app", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Watchlist", url: "/me?source=app", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Random film", url: "/random", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
