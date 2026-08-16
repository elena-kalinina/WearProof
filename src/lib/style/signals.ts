// Style learning layer (additive, off the demo spine).
//
// "Edgier" and "classier" are not vibes here: they are directional moves along
// named, measured style axes derived from the garment. Each move emits a
// concrete garment description + a palette-correct target color that drives fal
// generation and a YouCam try-on -- the same proof loop as the color fix.

import type { Garment, Hex, SeasonResult } from "@/lib/types";
import { hexToLch } from "@/lib/color/convert";

export type StyleDirection = "edgier" | "classier";

/** Four named style axes, each 0..1. */
export interface StyleSignals {
  /** soft/drapey (0) .. tailored/sharp (1) */
  structure: number;
  /** casual (0) .. formal (1) */
  formality: number;
  /** plain (0) .. embellished/ornate (1) */
  embellishment: number;
  /** understated (0) .. bold/statement (1) */
  boldness: number;
}

const KEYWORDS: Record<keyof StyleSignals, { up: RegExp; down: RegExp }> = {
  structure: {
    up: /structured|tailored|fitted|blazer|collar|crew|sharp|crisp/i,
    down: /flowy|draped|loose|oversized|slouch|soft|knit/i,
  },
  formality: {
    up: /blazer|collar|tailored|silk|suit|formal|dress\b/i,
    down: /tee|t-?shirt|hoodie|casual|denim|jersey|sweat/i,
  },
  embellishment: {
    up: /sequin|print|embroider|ruffle|pattern|graphic|lace|beaded/i,
    down: /plain|minimal|solid|clean/i,
  },
  boldness: {
    up: /bold|bright|graphic|neon|statement|vivid/i,
    down: /muted|subtle|neutral|pastel|understated/i,
  },
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Derive measured style signals from a garment's descriptors + color. */
export function deriveSignals(garment: Garment): StyleSignals {
  const text = [garment.item, ...garment.descriptors].join(" ");
  const axis = (k: keyof StyleSignals, base: number) => {
    let v = base;
    if (KEYWORDS[k].up.test(text)) v += 0.25;
    if (KEYWORDS[k].down.test(text)) v -= 0.25;
    return clamp01(v);
  };
  // boldness also gets a nudge from the garment's own chroma.
  const chromaBoost = clamp01(hexToLch(garment.color).C / 80);
  return {
    structure: axis("structure", 0.5),
    formality: axis("formality", 0.45),
    embellishment: axis("embellishment", 0.35),
    boldness: clamp01(axis("boldness", 0.4) * 0.6 + chromaBoost * 0.4),
  };
}

interface DirectionSpec {
  delta: Partial<StyleSignals>;
  descriptors: string[];
  /** how to pick the target color from the season palette. */
  pickColor: (palette: Hex[]) => Hex;
  headline: string;
}

/** darkest palette entry (lowest L*). */
function darkest(palette: Hex[]): Hex {
  return [...palette].sort((a, b) => hexToLch(a).L - hexToLch(b).L)[0];
}
/** most muted mid-tone (lowest chroma, mid lightness). */
function refined(palette: Hex[]): Hex {
  return [...palette].sort((a, b) => {
    const la = hexToLch(a);
    const lb = hexToLch(b);
    const scoreA = la.C + Math.abs(la.L - 55);
    const scoreB = lb.C + Math.abs(lb.L - 55);
    return scoreA - scoreB;
  })[0];
}

const DIRECTIONS: Record<StyleDirection, DirectionSpec> = {
  edgier: {
    delta: { structure: 0.2, formality: -0.2, boldness: 0.3, embellishment: 0.1 },
    descriptors: ["structured", "asymmetric cut", "matte hardware", "cropped"],
    pickColor: darkest,
    headline: "sharper structure, deeper palette, hardware detail",
  },
  classier: {
    delta: { structure: 0.25, formality: 0.35, boldness: -0.1, embellishment: -0.3 },
    descriptors: ["tailored", "clean lines", "minimal", "refined drape"],
    pickColor: refined,
    headline: "more tailoring, cleaner lines, refined tone",
  },
};

export interface RestylePlan {
  direction: StyleDirection;
  targetColor: Hex;
  description: string;
  changes: string[];
  signalsBefore: StyleSignals;
  signalsAfter: StyleSignals;
}

/** Plan a restyle move: measure, shift along axes, emit a garment description. */
export function planRestyle(
  garment: Garment,
  direction: StyleDirection,
  season: SeasonResult,
): RestylePlan {
  const before = deriveSignals(garment);
  const spec = DIRECTIONS[direction];
  const after: StyleSignals = {
    structure: clamp01(before.structure + (spec.delta.structure ?? 0)),
    formality: clamp01(before.formality + (spec.delta.formality ?? 0)),
    embellishment: clamp01(before.embellishment + (spec.delta.embellishment ?? 0)),
    boldness: clamp01(before.boldness + (spec.delta.boldness ?? 0)),
  };
  const targetColor = spec.pickColor(season.palette);
  const description =
    `a ${garment.item} restyled ${direction}: ${spec.descriptors.join(", ")}, ` +
    `in ${targetColor} from a ${season.season} palette, ` +
    `product photo on plain white background, front-facing, single garment`;

  const changes = describeChanges(before, after);
  return { direction, targetColor, description, changes, signalsBefore: before, signalsAfter: after };
}

function describeChanges(before: StyleSignals, after: StyleSignals): string[] {
  const labels: Record<keyof StyleSignals, string> = {
    structure: "structure",
    formality: "formality",
    embellishment: "embellishment",
    boldness: "boldness",
  };
  const out: string[] = [];
  (Object.keys(labels) as (keyof StyleSignals)[]).forEach((k) => {
    const d = after[k] - before[k];
    if (Math.abs(d) >= 0.05) {
      out.push(`${labels[k]} ${d > 0 ? "+" : ""}${Math.round(d * 100)}%`);
    }
  });
  return out;
}
