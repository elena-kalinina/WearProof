// Builds a simple garment-swatch SVG data URL used as the demo stand-in for a
// generated garment (and, in demo mode, the try-on "after").

import type { Hex } from "@/lib/types";

export function garmentSwatchDataUrl(color: Hex): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">
  <rect width="400" height="500" fill="#f4f4f5"/>
  <path d="M120 90 L90 130 L120 160 L120 420 L280 420 L280 160 L310 130 L280 90 L240 110 Q200 130 160 110 Z" fill="${color}" stroke="#00000022" stroke-width="2"/>
  <text x="200" y="465" font-family="sans-serif" font-size="20" fill="#71717a" text-anchor="middle">${color}</text>
</svg>`;
  const encoded = Buffer.from(svg, "utf8").toString("base64");
  return `data:image/svg+xml;base64,${encoded}`;
}
