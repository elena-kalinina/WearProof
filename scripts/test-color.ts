// Validates CIEDE2000 against canonical Sharma et al. (2005) reference pairs.
// Run: npx tsx scripts/test-color.ts

import { deltaE2000, hexToLab, hexToRgb, rgbToHex } from "@/lib/color/convert";
import type { Lab } from "@/lib/types";

const L = (Lc: number, a: number, b: number): Lab => ({ L: Lc, a, b });

// [lab1, lab2, expected dE2000]
const cases: [Lab, Lab, number][] = [
  [L(50.0, 2.6772, -79.7751), L(50.0, 0.0, -82.7485), 2.0425],
  [L(50.0, 3.1571, -77.2803), L(50.0, 0.0, -82.7485), 2.8615],
  [L(50.0, 2.8361, -74.02), L(50.0, 0.0, -82.7485), 3.4412],
  [L(50.0, -1.3802, -84.2814), L(50.0, 0.0, -82.7485), 1.0],
  [L(50.0, -1.1848, -84.8006), L(50.0, 0.0, -82.7485), 1.0],
  [L(50.0, -0.9009, -85.5211), L(50.0, 0.0, -82.7485), 1.0],
  // red (h=0) vs blue (h=270): ~90 deg hue arc -> large dH term, total ~4.31
  [L(50.0, 2.5, 0.0), L(50.0, 0.0, -2.5), 4.3065],
  [L(50.0, 2.5, 0.0), L(73.0, 25.0, -18.0), 27.1492],
  [L(50.0, 2.5, 0.0), L(50.0, 3.1736, 0.5854), 1.0],
  [L(50.0, 2.5, 0.0), L(50.0, 3.2972, 0.0), 1.0],
  [L(60.2574, -34.0099, 36.2677), L(60.4626, -34.1751, 39.4387), 1.2644],
  [L(63.0109, -31.0961, -5.8663), L(62.8187, -29.7946, -4.0864), 1.263],
  [L(35.0831, -44.1164, 3.7933), L(35.0232, -40.0716, 1.5901), 1.8645],
  [L(22.7233, 20.0904, -46.694), L(23.0331, 14.973, -42.5619), 2.0373],
];

let failures = 0;
for (let i = 0; i < cases.length; i++) {
  const [l1, l2, expected] = cases[i];
  const got = deltaE2000(l1, l2);
  const ok = Math.abs(got - expected) < 1e-3;
  if (!ok) {
    failures++;
    console.error(
      `Case ${i + 1} FAIL: expected ${expected}, got ${got.toFixed(4)}`,
    );
  }
}

// sanity: hex roundtrip + a known Lab
const rt = rgbToHex(hexToRgb("#b28e73"));
if (rt.toLowerCase() !== "#b28e73") {
  failures++;
  console.error(`Hex roundtrip FAIL: got ${rt}`);
}
const white = hexToLab("#ffffff");
if (Math.abs(white.L - 100) > 0.5) {
  failures++;
  console.error(`White L* FAIL: got ${white.L.toFixed(2)}`);
}

if (failures === 0) {
  console.log(`All ${cases.length} CIEDE2000 cases + sanity checks passed.`);
} else {
  console.error(`${failures} failure(s).`);
  process.exit(1);
}
