/**
 * Generates the PitchSide brand icons from the Outfit "P" glyph.
 *
 * Output (written to /public):
 *   - favicon.svg              scalable website favicon (font-independent)
 *   - favicon-32.png           small raster fallback
 *   - apple-touch-icon.png     180x180 iOS home-screen icon
 *   - icon-192.png             PWA / Android icon
 *   - icon-512.png             PWA / Android icon (large)
 *   - icon-maskable-512.png    Android adaptive/maskable icon (safe-zone padded)
 *
 * The "P" is extracted as a vector outline from Outfit-Black.ttf so the mark
 * matches the site's display font without depending on any installed font.
 *
 * Run:  node scripts/gen-icons.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '..', 'public');
mkdirSync(publicDir, { recursive: true });

const fontBuf = readFileSync(resolve(__dirname, 'assets', 'Outfit.ttf'));
const font = opentype.parse(fontBuf.buffer.slice(fontBuf.byteOffset, fontBuf.byteOffset + fontBuf.byteLength));

// Keep these in sync with src/components/PitchSideMark.tsx
const GLYPH_X = 150;
const GLYPH_BASELINE = 368;
const GLYPH_SIZE = 360;
const DOT = { cx: 360, cy: 360, r: 32 };

const pPath = font.getPath('P', GLYPH_X, GLYPH_BASELINE, GLYPH_SIZE);
const pPathData = pPath.toPathData(2);

/**
 * Build the icon SVG. `pad` shrinks the artwork toward the centre so Android
 * maskable icons keep their content inside the safe zone.
 */
function buildSvg({ pad = 0 } = {}) {
  const scale = 1 - pad * 2;
  const inner = `
    <path d="${pPathData}" fill="#ffffff"/>
    <circle cx="${DOT.cx}" cy="${DOT.cy}" r="${DOT.r * 1.9}" fill="url(#psGlow)"/>
    <circle cx="${DOT.cx}" cy="${DOT.cy}" r="${DOT.r}" fill="url(#psDot)"/>
  `;
  const artwork =
    pad > 0
      ? `<g transform="translate(${256 - 256 * scale}, ${256 - 256 * scale}) scale(${scale})">${inner}</g>`
      : inner;

  return `<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="PitchSide">
  <defs>
    <linearGradient id="psBg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0f1e2e"/>
      <stop offset="1" stop-color="#020617"/>
    </linearGradient>
    <linearGradient id="psDot" x1="${DOT.cx - DOT.r}" y1="${DOT.cy - DOT.r}" x2="${DOT.cx + DOT.r}" y2="${DOT.cy + DOT.r}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#34d399"/>
      <stop offset="1" stop-color="#10b981"/>
    </linearGradient>
    <radialGradient id="psGlow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#10b981" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#10b981" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="512" height="512" rx="116" fill="url(#psBg)"/>
  <rect x="6" y="6" width="500" height="500" rx="110" fill="none" stroke="#1e2b3d" stroke-width="2"/>
  ${artwork}
</svg>
`;
}

const faviconSvg = buildSvg();
const maskableSvg = buildSvg({ pad: 0.12 });

writeFileSync(resolve(publicDir, 'favicon.svg'), faviconSvg, 'utf8');
console.log('wrote favicon.svg');

const rasterTargets = [
  { name: 'favicon-32.png', size: 32, svg: faviconSvg },
  { name: 'apple-touch-icon.png', size: 180, svg: faviconSvg },
  { name: 'icon-192.png', size: 192, svg: faviconSvg },
  { name: 'icon-512.png', size: 512, svg: faviconSvg },
  { name: 'icon-maskable-512.png', size: 512, svg: maskableSvg },
];

for (const t of rasterTargets) {
  await sharp(Buffer.from(t.svg))
    .resize(t.size, t.size)
    .png()
    .toFile(resolve(publicDir, t.name));
  console.log(`wrote ${t.name} (${t.size}px)`);
}

console.log('done');
