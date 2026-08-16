// Color-space conversions and CIEDE2000 color difference.
// All conversions assume sRGB input under a D65 white point.

import type { Hex, Lab, LCh } from "@/lib/types";

export interface Rgb {
  r: number; // 0..255
  g: number;
  b: number;
}

export function hexToRgb(hex: Hex): Rgb {
  const h = hex.replace(/^#/, "").trim();
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  if (full.length !== 6 || /[^0-9a-fA-F]/.test(full)) {
    throw new Error(`Invalid hex color: "${hex}"`);
  }
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): Hex {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const to2 = (v: number) => clamp(v).toString(16).padStart(2, "0");
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

/** sRGB channel (0..1) to linear-light. */
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// D65 reference white in XYZ (scaled to 100).
const Xn = 95.047;
const Yn = 100.0;
const Zn = 108.883;

export function rgbToXyz({ r, g, b }: Rgb): { X: number; Y: number; Z: number } {
  const rl = srgbToLinear(r / 255);
  const gl = srgbToLinear(g / 255);
  const bl = srgbToLinear(b / 255);
  // sRGB -> XYZ (D65), matrix scaled to 100.
  return {
    X: (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) * 100,
    Y: (rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175) * 100,
    Z: (rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041) * 100,
  };
}

function fLab(t: number): number {
  const delta = 6 / 29;
  return t > Math.pow(delta, 3)
    ? Math.cbrt(t)
    : t / (3 * delta * delta) + 4 / 29;
}

export function xyzToLab({
  X,
  Y,
  Z,
}: {
  X: number;
  Y: number;
  Z: number;
}): Lab {
  const fx = fLab(X / Xn);
  const fy = fLab(Y / Yn);
  const fz = fLab(Z / Zn);
  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

export function hexToLab(hex: Hex): Lab {
  return xyzToLab(rgbToXyz(hexToRgb(hex)));
}

export function labToLch(lab: Lab): LCh {
  const C = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  let h = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L: lab.L, C, h };
}

export function hexToLch(hex: Hex): LCh {
  return labToLch(hexToLab(hex));
}

/**
 * CIEDE2000 color difference between two Lab colors.
 * Reference: Sharma, Wu & Dalal (2005).
 */
export function deltaE2000(lab1: Lab, lab2: Lab): number {
  const { L: L1, a: a1, b: b1 } = lab1;
  const { L: L2, a: a2, b: b2 } = lab2;

  const kL = 1;
  const kC = 1;
  const kH = 1;

  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cbar = (C1 + C2) / 2;

  const Cbar7 = Math.pow(Cbar, 7);
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + Math.pow(25, 7))));

  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;

  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  const hp = (ap: number, b: number): number => {
    if (ap === 0 && b === 0) return 0;
    let h = (Math.atan2(b, ap) * 180) / Math.PI;
    if (h < 0) h += 360;
    return h;
  };
  const h1p = hp(a1p, b1);
  const h2p = hp(a2p, b2);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp: number;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else {
    let diff = h2p - h1p;
    if (diff > 180) diff -= 360;
    else if (diff < -180) diff += 360;
    dhp = diff;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * Math.PI) / 360);

  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;

  let hbarp: number;
  if (C1p * C2p === 0) {
    hbarp = h1p + h2p;
  } else {
    const sum = h1p + h2p;
    if (Math.abs(h1p - h2p) > 180) {
      hbarp = sum < 360 ? (sum + 360) / 2 : (sum - 360) / 2;
    } else {
      hbarp = sum / 2;
    }
  }

  const T =
    1 -
    0.17 * Math.cos(((hbarp - 30) * Math.PI) / 180) +
    0.24 * Math.cos((2 * hbarp * Math.PI) / 180) +
    0.32 * Math.cos(((3 * hbarp + 6) * Math.PI) / 180) -
    0.2 * Math.cos(((4 * hbarp - 63) * Math.PI) / 180);

  const dTheta = 30 * Math.exp(-Math.pow((hbarp - 275) / 25, 2));
  const Cbarp7 = Math.pow(Cbarp, 7);
  const Rc = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + Math.pow(25, 7)));
  const Sl =
    1 + (0.015 * Math.pow(Lbarp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbarp - 50, 2));
  const Sc = 1 + 0.045 * Cbarp;
  const Sh = 1 + 0.015 * Cbarp * T;
  const Rt = -Math.sin((2 * dTheta * Math.PI) / 180) * Rc;

  const termL = dLp / (kL * Sl);
  const termC = dCp / (kC * Sc);
  const termH = dHp / (kH * Sh);

  return Math.sqrt(
    termL * termL + termC * termC + termH * termH + Rt * termC * termH,
  );
}

export function deltaE2000Hex(a: Hex, b: Hex): number {
  return deltaE2000(hexToLab(a), hexToLab(b));
}
