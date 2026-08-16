// Seasonal color analysis: derive four measured axes from the user's
// skin / hair / eye colors, classify into one of 12 seasons, and expose a
// flattering palette. Every step is deterministic and explainable.

import type { ColorAxes, Hex, Season, SeasonResult, UserProfile } from "@/lib/types";
import { hexToLab, hexToLch } from "@/lib/color/convert";

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

/**
 * Derive the four seasonal axes from measured feature colors.
 * - undertone: warm (+1) vs cool (-1), from skin hue and the a-b balance.
 * - value: overall lightness (light +1 vs deep 0), weighted toward skin.
 * - chroma: clarity (bright +1 vs muted 0), from skin + eye saturation.
 * - contrast: hair-to-skin lightness gap (high +1 vs low 0).
 */
export function computeAxes(profile: UserProfile): ColorAxes {
  const skinLab = hexToLab(profile.skinColor);
  const skin = hexToLch(profile.skinColor);
  const hair = hexToLch(profile.hairColor);
  const eye = hexToLch(profile.eyeColor);

  // Undertone: skin hue pivots warm above ~55 deg; reinforce with the
  // yellow-minus-red balance (b* - a*) which is positive for golden skin.
  const hueWarmth = (skin.h - 55) / 20;
  const abWarmth = (skinLab.b - skinLab.a) / 25 - 0.3;
  const undertone = clamp((hueWarmth + abWarmth) / 2, -1, 1);

  const value = clamp((skin.L * 0.6 + hair.L * 0.4) / 100, 0, 1);

  const chroma = clamp((skin.C / 32) * 0.5 + (eye.C / 40) * 0.5, 0, 1);

  const contrast = clamp(Math.abs(hair.L - skin.L) / 70, 0, 1);

  return { undertone, value, chroma, contrast };
}

/** Classify the four axes into one of the 12 seasons. */
export function classifySeason(axes: ColorAxes): Season {
  const warm = axes.undertone >= 0;
  const light = axes.value >= 0.55;
  const deep = axes.value < 0.4;
  const bright = axes.chroma >= 0.55 || axes.contrast >= 0.6;
  const muted = axes.chroma < 0.4 && axes.contrast < 0.5;

  if (warm) {
    // Warm -> Spring (light/clear) or Autumn (deep/muted).
    if (deep) return "Dark Autumn";
    if (light && bright) return "Bright Spring";
    if (light) return "Light Spring";
    if (muted) return "Soft Autumn";
    if (bright) return "True Spring";
    return "True Autumn";
  }
  // Cool -> Summer (light/soft) or Winter (deep/clear).
  if (deep) return bright ? "Dark Winter" : "True Winter";
  if (bright && axes.contrast >= 0.6) return "Bright Winter";
  if (light && muted) return "Light Summer";
  if (muted) return "Soft Summer";
  if (light) return "Light Summer";
  return "True Summer";
}

/** Curated flattering palettes per season (representative swatches). */
export const SEASON_PALETTES: Record<Season, Hex[]> = {
  "Bright Winter": ["#0033a0", "#e40046", "#00a3e0", "#ffffff", "#111111", "#00857d", "#f2a900", "#7a1e8b"],
  "True Winter": ["#002d72", "#c8102e", "#ffffff", "#111111", "#6a1b9a", "#008578", "#b0b7bc", "#e0115f"],
  "Dark Winter": ["#1b1b3a", "#7b0828", "#0b3d2e", "#3c1361", "#111111", "#8c8c8c", "#004c6d", "#5c0011"],
  "Bright Spring": ["#ff6f3c", "#ffd23f", "#0aa1dd", "#ff3e6c", "#33ca7f", "#fff5b7", "#ff9a3c", "#12b5cb"],
  "True Spring": ["#ff8c42", "#ffd166", "#06d6a0", "#ef476f", "#3ec300", "#ffb703", "#f4845f", "#00b4d8"],
  "Light Spring": ["#ffd6a5", "#ffadad", "#caffbf", "#9bf6ff", "#fdffb6", "#ffc6ff", "#f6a192", "#a0e7e5"],
  "Light Summer": ["#a2d2ff", "#cdb4db", "#ffc8dd", "#bde0fe", "#b8f2e6", "#e2c2ff", "#aed9e0", "#f1c0e8"],
  "True Summer": ["#5b7fa6", "#9b7ca6", "#c9184a", "#6d9dc5", "#8e7cc3", "#aab7b8", "#4a7c8c", "#d16ba5"],
  "Soft Summer": ["#8a9a9a", "#b5838d", "#6d6875", "#a5a58d", "#9caea9", "#7d8ca3", "#c9ada7", "#6b705c"],
  "Soft Autumn": ["#a68a64", "#bc8a5f", "#8a7968", "#a3b18a", "#c1a57b", "#9c6644", "#b08968", "#7f7f5a"],
  "True Autumn": ["#8b5a2b", "#c1440e", "#d68c45", "#5f7161", "#a9762f", "#6f4e37", "#b3541e", "#4b5320"],
  "Dark Autumn": ["#5c3a21", "#7b2d26", "#3b2f2f", "#4a5320", "#8b4513", "#2f2213", "#6b4226", "#583e2e"],
};

const SEASON_TEMP: Record<Season, "warm" | "cool"> = {
  "Bright Winter": "cool",
  "True Winter": "cool",
  "Dark Winter": "cool",
  "Bright Spring": "warm",
  "True Spring": "warm",
  "Light Spring": "warm",
  "Light Summer": "cool",
  "True Summer": "cool",
  "Soft Summer": "cool",
  "Soft Autumn": "warm",
  "True Autumn": "warm",
  "Dark Autumn": "warm",
};

export function seasonTemperature(season: Season): "warm" | "cool" {
  return SEASON_TEMP[season];
}

/** Full analysis: axes + season + palette + a plain-language rationale. */
export function analyzeProfile(profile: UserProfile): SeasonResult {
  const axes = computeAxes(profile);
  const season = classifySeason(axes);
  const temp = seasonTemperature(season);
  const depth = axes.value >= 0.55 ? "light" : axes.value < 0.4 ? "deep" : "medium";
  const clarity =
    axes.chroma >= 0.55 ? "clear" : axes.chroma < 0.4 ? "muted" : "balanced";
  const contrastWord =
    axes.contrast >= 0.6 ? "high" : axes.contrast < 0.35 ? "low" : "moderate";

  const rationale =
    `Measured ${temp} undertone (${axes.undertone >= 0 ? "+" : ""}${axes.undertone.toFixed(2)}), ` +
    `${depth} value (${axes.value.toFixed(2)}), ${clarity} chroma (${axes.chroma.toFixed(2)}), ` +
    `${contrastWord} hair-skin contrast (${axes.contrast.toFixed(2)}) -> ${season}.`;

  return { season, axes, palette: SEASON_PALETTES[season], rationale };
}
