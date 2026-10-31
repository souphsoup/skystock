import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SOP-Stock · MAI The Sky Bar",
    short_name: "SOP-Stock",
    description: "นับสต๊อกครัวและบาร์จากมือถือ",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f5f8",
    theme_color: "#2b4c70",
    lang: "th",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
