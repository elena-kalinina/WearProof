// Recorded YouCam response fixtures used in DEMO_MODE (no API key required).
// Values mirror the real API shapes documented for face-attr-analysis and
// skin-analysis (hd_redness ui_score example is 77 in the docs).

import type { Hex } from "@/lib/types";

export const FACE_FIXTURE: {
  skinColor: Hex;
  hairColor: Hex;
  eyeColor: Hex;
  faceShape: string;
} = {
  skinColor: "#b28e73", // warm tan (from the docs example)
  hairColor: "#3b2a20", // dark brown
  eyeColor: "#5a4632", // warm brown
  faceShape: "oval",
};

export const SKIN_FIXTURE = {
  redness: 77, // hd_redness ui_score from the docs example
};

/**
 * In demo mode we can't run a real try-on, so we surface the target garment
 * image as the stand-in "after". The UI labels it as a demo result.
 */
export function tryOnFixture(refGarmentUrl: string): string {
  return refGarmentUrl;
}
