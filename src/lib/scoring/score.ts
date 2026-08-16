// Deterministic outfit scoring. Grades the focus garment against the user's
// measured season palette and facial redness, and picks the single worst
// clash to fix first. Every verdict carries the number behind it.

import type {
  Garment,
  Hex,
  OutfitPerception,
  OutfitScore,
  SeasonResult,
  UserProfile,
  Verdict,
  VerdictLevel,
} from "@/lib/types";
import { deltaE2000, hexToLab, hexToLch } from "@/lib/color/convert";
import { seasonTemperature } from "@/lib/color/seasons";

const REDNESS_THRESHOLD = 60; // hd_redness ui_score above which warm-reds amplify

function levelFor(score: number): VerdictLevel {
  if (score >= 75) return "pass";
  if (score >= 50) return "warn";
  return "fail";
}

function garmentTemperature(color: Hex): "warm" | "cool" | "neutral" {
  const { C, h } = hexToLch(color);
  if (C < 8) return "neutral"; // near-grey: works with either
  if (h <= 70 || h >= 330) return "warm";
  if (h >= 180 && h <= 300) return "cool";
  return "neutral";
}

function isWarmRed(color: Hex): boolean {
  // Reds through red-orange (tomato/coral/brick) that visually amplify facial
  // redness when worn near the face. Brick red sits near hue 36 deg.
  const { C, h } = hexToLch(color);
  return C > 18 && (h <= 45 || h >= 345);
}

/** Nearest palette swatch by CIEDE2000, with the distance. */
function nearestPaletteColor(
  color: Hex,
  palette: Hex[],
): { hex: Hex; deltaE: number } {
  const target = hexToLab(color);
  let best = { hex: palette[0], deltaE: Infinity };
  for (const p of palette) {
    const d = deltaE2000(target, hexToLab(p));
    if (d < best.deltaE) best = { hex: p, deltaE: d };
  }
  return best;
}

export interface FixSuggestion {
  /** target replacement color from the user's palette. */
  targetColor: Hex;
  /** short natural-language description to drive garment generation. */
  description: string;
}

export interface ScoreResult extends OutfitScore {
  suggestion: FixSuggestion | null;
}

/**
 * Score an outfit against a measured season result and the user's redness.
 */
export function scoreOutfit(
  season: SeasonResult,
  profile: UserProfile,
  perception: OutfitPerception,
): ScoreResult {
  const focus = perception.garments[perception.focusIndex];
  const verdicts: Verdict[] = [];

  // --- Color harmony (the primary axis) ---
  const nearest = nearestPaletteColor(focus.color, season.palette);
  let colorScore = clamp(100 - nearest.deltaE * 1.8, 0, 100);

  const gTemp = garmentTemperature(focus.color);
  const sTemp = seasonTemperature(season.season);
  // Only penalize temperature when the color is off-palette; in-palette accents
  // (a season's own cool/warm accents) should not be double-counted.
  const offPalette = nearest.deltaE > 12;
  const tempMismatch = offPalette && gTemp !== "neutral" && gTemp !== sTemp;
  if (tempMismatch) colorScore -= 25;

  colorScore = clamp(colorScore, 0, 100);
  verdicts.push({
    id: "color",
    label: "Color harmony",
    level: levelFor(colorScore),
    score: Math.round(colorScore),
    reason: tempMismatch
      ? `${gTemp} garment vs your ${sTemp} ${season.season}; nearest palette match is ΔE ${nearest.deltaE.toFixed(1)} away.`
      : `Nearest palette match ΔE ${nearest.deltaE.toFixed(1)} (${nearest.deltaE < 12 ? "in-palette" : "off-palette"}).`,
  });

  // --- Redness adjacency (skin-AI grounded) ---
  const redness = profile.redness ?? 0;
  if (focus.category === "upper_body" && redness >= REDNESS_THRESHOLD && isWarmRed(focus.color)) {
    const penalty = Math.min(30, Math.round((redness - 50) / 1.5));
    const rednessScore = clamp(100 - penalty * 3, 0, 100);
    verdicts.push({
      id: "redness",
      label: "Redness amplification",
      level: levelFor(rednessScore),
      score: Math.round(rednessScore),
      reason: `Your facial redness reads ${redness}/100; this warm-red top near the face amplifies it. A cooler, muted tone neutralizes it.`,
    });
    // fold the penalty into the color axis too
    colorScore = clamp(colorScore - penalty, 0, 100);
    verdicts[0].score = Math.round(colorScore);
    verdicts[0].level = levelFor(colorScore);
  }

  // --- Neckline vs faceShape (secondary bonus card) ---
  const neckVerdict = necklineVerdict(focus, profile.faceShape);
  if (neckVerdict) verdicts.push(neckVerdict);

  // Overall: color-weighted, since the peak is color-fit.
  const weights: Record<string, number> = { color: 0.6, redness: 0.25, neckline: 0.15 };
  let wSum = 0;
  let acc = 0;
  for (const v of verdicts) {
    const w = weights[v.id] ?? 0.1;
    acc += v.score * w;
    wSum += w;
  }
  const overall = Math.round(wSum > 0 ? acc / wSum : colorScore);

  const worstClash = verdicts.reduce((a, b) => (b.score < a.score ? b : a), verdicts[0]);

  const suggestion = buildSuggestion(season, focus, worstClash, redness);

  return { overall, verdicts, worstClash, suggestion };
}

function necklineVerdict(focus: Garment, faceShape?: string): Verdict | null {
  if (!faceShape) return null;
  const neckline = focus.descriptors.find((d) =>
    /crew|v-?neck|scoop|boat|turtle|collar|halter|square/i.test(d),
  );
  if (!neckline) return null;

  const shape = faceShape.toLowerCase();
  // simple flattering-pairs rule table
  const good: Record<string, RegExp> = {
    round: /v-?neck|scoop|square/i,
    square: /scoop|crew|round/i,
    oval: /.*/, // oval suits most
    long: /boat|crew|turtle|halter/i,
    oblong: /boat|crew|turtle|halter/i,
    heart: /scoop|boat/i,
  };
  const rule = good[shape];
  const ok = rule ? rule.test(neckline) : true;
  const score = ok ? 82 : 55;
  return {
    id: "neckline",
    label: "Neckline vs face shape",
    level: levelFor(score),
    score,
    reason: ok
      ? `${neckline} works with a ${shape} face shape.`
      : `A ${neckline} can overemphasize a ${shape} face; a different neckline balances it better.`,
  };
}

function buildSuggestion(
  season: SeasonResult,
  focus: Garment,
  worst: Verdict,
  redness: number,
): FixSuggestion | null {
  if (worst.level === "pass") return null;

  // When facial redness is high, exclude warm-reds from the candidate palette
  // so the fix actually neutralizes redness rather than re-triggering it.
  const avoidWarmRed = redness >= REDNESS_THRESHOLD;
  const candidates = avoidWarmRed
    ? season.palette.filter((p) => !isWarmRed(p))
    : season.palette;
  const pool = candidates.length ? candidates : season.palette;

  // Among candidates, pick the one closest in lightness to the current
  // garment, so the fix changes hue/temperature but keeps a similar look.
  const gL = hexToLch(focus.color).L;
  let target = pool[0];
  let bestDiff = Infinity;
  for (const p of pool) {
    const diff = Math.abs(hexToLch(p).L - gL);
    if (diff < bestDiff) {
      bestDiff = diff;
      target = p;
    }
  }

  const descriptors = focus.descriptors.length
    ? focus.descriptors.join(", ") + " "
    : "";
  const rednessNote = avoidWarmRed
    ? "cooler redness-neutralizing tone, "
    : "";
  return {
    targetColor: target,
    description: `a ${descriptors}${focus.item} in a ${rednessNote}${season.season} palette tone (${target}), product photo on plain white background, front-facing, single garment`,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
