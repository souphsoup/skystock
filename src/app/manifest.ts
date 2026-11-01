import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "meStock",
    short_name: "meStock",
    description: "ระบบบริหารสินค้าคงคลัง",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f3ee",
    theme_color: "#1d2b45",
    lang: "th",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
