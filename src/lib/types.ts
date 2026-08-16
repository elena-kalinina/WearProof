// Shared domain types for the WearProof styling engine.

/** A measured color as an sRGB hex string, e.g. "#b28e73". */
export type Hex = string;

/** CIELAB color (D65). */
export interface Lab {
  L: number; // 0..100
  a: number;
  b: number;
}

/** CIE LCh (cylindrical Lab). */
export interface LCh {
  L: number; // lightness 0..100
  C: number; // chroma
  h: number; // hue angle in degrees 0..360
}

/**
 * The measured user profile, assembled from YouCam face-attr-analysis
 * (colors + faceShape) and skin-analysis (redness).
 */
export interface UserProfile {
  skinColor: Hex;
  hairColor: Hex;
  eyeColor: Hex;
  /** faceShape label from face-attr-analysis, e.g. "oval", "round". */
  faceShape?: string;
  /** hd_redness ui_score 1..100 from skin-analysis; higher = more redness. */
  redness?: number;
}

/** One of the 12 seasonal color types. */
export type Season =
  | "Bright Winter"
  | "True Winter"
  | "Dark Winter"
  | "Bright Spring"
  | "True Spring"
  | "Light Spring"
  | "Light Summer"
  | "True Summer"
  | "Soft Summer"
  | "Soft Autumn"
  | "True Autumn"
  | "Dark Autumn";

/** The four measured axes that drive seasonal classification. */
export interface ColorAxes {
  /** Warm (+) vs cool (-), derived from skin hue. Range roughly -1..1. */
  undertone: number;
  /** Overall lightness (skin + hair), 0 (deep) .. 1 (light). */
  value: number;
  /** Saturation / clarity, 0 (muted) .. 1 (bright). */
  chroma: number;
  /** Hair-to-skin lightness contrast, 0 (low) .. 1 (high). */
  contrast: number;
}

export interface SeasonResult {
  season: Season;
  axes: ColorAxes;
  /** Palette of flattering colors for this season, as hex. */
  palette: Hex[];
  /** Human-readable one-line rationale. */
  rationale: string;
}

/** A garment detected in the outfit photo. */
export interface Garment {
  /** e.g. "top", "jacket", "shirt", "dress". */
  item: string;
  /** dominant color as hex. */
  color: Hex;
  /** YouCam garment_category this maps to. */
  category: "upper_body" | "lower_body" | "full_body" | "shoes";
  /** free-form style descriptors, e.g. ["structured", "cropped"]. */
  descriptors: string[];
}

export interface OutfitPerception {
  garments: Garment[];
  /** the garment nearest the face that the color critique focuses on. */
  focusIndex: number;
}

export type VerdictLevel = "pass" | "warn" | "fail";

export interface Verdict {
  id: string;
  /** short label, e.g. "Color harmony". */
  label: string;
  level: VerdictLevel;
  /** 0..100 sub-score. */
  score: number;
  /** the measured number behind the verdict, stated plainly. */
  reason: string;
}

export interface OutfitScore {
  /** overall 0..100. */
  overall: number;
  verdicts: Verdict[];
  /** the single worst clash to fix first. */
  worstClash: Verdict;
}
