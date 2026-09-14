// `npm run icons` — DESIGN.md §5.6: indigo square, cotton "H" (marigold dot),
// kanga band along the bottom 18%. Rendered from inline SVG via sharp, no
// external image assets. The icon glyph uses a generic bold sans-serif
// rather than Syne: sharp/librsvg rasterizes with whatever fonts are
// installed on the machine running this script, and Syne is loaded via
// next/font only inside the Next.js app, not available here — a deviation
// from §5.2's exact typeface, kept close in spirit (bold, squared, high
// weight).

import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const INDIGO = "#1F2A6B";
const COTTON = "#F6F1E7";
const MARIGOLD = "#E8A317";
const BAND_RED = "#B8312F";

const OUT_DIR = path.resolve(process.cwd(), "public/icons");

function bandStripes(size: number, bandHeight: number): string {
  const y = size - bandHeight;
  const stripeW = size / 8;
  const colors = [BAND_RED, INDIGO, MARIGOLD];
  let rects = "";
  for (let i = 0; i < 8; i++) {
    rects += `<rect x="${i * stripeW}" y="${y}" width="${stripeW}" height="${bandHeight}" fill="${colors[i % colors.length]}" />`;
  }
  return rects;
}

function iconSvg(size: number, { maskableSafe = false } = {}): string {
  const bandHeight = size * 0.18;
  // Maskable icons must keep content inside the centered ~80% safe zone.
  const scale = maskableSafe ? 0.68 : 1;
  const glyphSize = size * 0.42 * scale;
  const cx = size / 2 - (maskableSafe ? 0 : size * 0.03);
  const cy = maskableSafe ? size / 2 - bandHeight * 0.3 : size / 2 - bandHeight * 0.6;
  const dotR = size * 0.045 * scale;
  const dotX = cx + glyphSize * 0.62;

  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${INDIGO}" />
  <text
    x="${cx}"
    y="${cy}"
    font-family="Arial, Helvetica, sans-serif"
    font-weight="800"
    font-size="${glyphSize}"
    fill="${COTTON}"
    text-anchor="middle"
    dominant-baseline="central"
  >H</text>
  <circle cx="${dotX}" cy="${cy}" r="${dotR}" fill="${MARIGOLD}" />
  ${maskableSafe ? "" : bandStripes(size, bandHeight)}
</svg>`;
}

async function render(size: number, filename: string, opts?: { maskableSafe?: boolean }) {
  const svg = iconSvg(size, opts);
  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT_DIR, filename));
  console.log(`wrote ${filename} (${size}x${size})`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await render(192, "icon-192.png");
  await render(512, "icon-512.png");
  await render(512, "icon-512-maskable.png", { maskableSafe: true });
  await render(180, "apple-touch-icon.png");
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
