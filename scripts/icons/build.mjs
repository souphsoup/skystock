// Render the app icon master SVG into the PNG sizes the PWA and iOS need.
// Usage: node scripts/icons/build.mjs
import sharp from "sharp";
import { readFile } from "node:fs/promises";

const master = await readFile(new URL("./app-icon.svg", import.meta.url), "utf8");
const out = new URL("../../public/icons/", import.meta.url);

// Glyph scale vs the 512 master. Maskable keeps the board inside Android's 80% safe circle.
const targets = [
  ["apple-touch-icon.png", 180, 1],
  ["icon-192.png", 192, 1],
  ["icon-512.png", 512, 1],
  ["icon-512-maskable.png", 512, 0.76],
];

for (const [name, size, scale] of targets) {
  const svg = Buffer.from(master.replace("GLYPH_SCALE", String(scale)));
  await sharp(svg, { density: 72 * (size / 512) * 4 })
    .resize(size, size)
    .flatten({ background: "#2b4c70" }) // iOS requires an opaque icon
    .png({ compressionLevel: 9 })
    .toFile(new URL(name, out).pathname);
  console.log("wrote", name);
}
