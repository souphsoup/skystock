import type { NextConfig } from "next";
import { execSync } from "node:child_process";

// Stamped into both the server and the client bundle. The page compares its own
// stamp with /api/version to tell staff a new deploy is out (see update-banner.tsx).
function appVersion(): string {
  const v = process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA;
  if (v) return v;
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "dev";
  }
}

const nextConfig: NextConfig = {
  env: { APP_VERSION: appVersion() },
  // PGlite ships WASM + data files that must be loaded from node_modules at runtime.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Allow testing on real phones via `cloudflared tunnel` (HTTPS, needed for the service worker).
  // Also allow LAN access (e.g. http://192.168.x.x:3000) for quick testing on the same Wi-Fi.
  allowedDevOrigins: ["*.trycloudflare.com", "192.168.*.*", "10.*.*.*"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
