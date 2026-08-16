// End-to-end orchestration: measure -> classify -> perceive -> score, and the
// fix loop: generate the corrected garment -> try it on -> re-score.

import type {
  OutfitPerception,
  SeasonResult,
  UserProfile,
} from "@/lib/types";
import { analyzeProfile } from "@/lib/color/seasons";
import { scoreOutfit, type ScoreResult } from "@/lib/scoring/score";
import { createYouCamClient, type GarmentCategory } from "@/lib/youcam/client";
import { createFalClient } from "@/lib/fal/client";
import { planRestyle, type RestylePlan, type StyleDirection } from "@/lib/style/signals";
import { DEMO_ASSETS } from "@/lib/demo/assets";

export interface AnalyzeResult {
  profile: UserProfile;
  season: SeasonResult;
  perception: OutfitPerception;
  score: ScoreResult;
  outfitUrl: string;
  /** Set when run with demo fixtures (UI "Use demo photos"). */
  demo?: boolean;
}

export interface AnalyzeOptions {
  demo?: boolean;
}

export async function analyze(
  faceUrl: string,
  outfitUrl: string,
  options?: AnalyzeOptions,
): Promise<AnalyzeResult> {
  const demo = options?.demo ?? false;
  const youcam = createYouCamClient(demo);
  const fal = createFalClient(demo);

  // Face measurement + redness run in parallel; perception too.
  const [face, skin, perception] = await Promise.all([
    youcam.analyzeFace(faceUrl),
    youcam.analyzeSkin(faceUrl),
    fal.perceiveOutfit(outfitUrl),
  ]);

  const profile: UserProfile = {
    skinColor: face.skinColor,
    hairColor: face.hairColor,
    eyeColor: face.eyeColor,
    faceShape: face.faceShape,
    redness: skin.redness,
  };

  const season = analyzeProfile(profile);
  const score = scoreOutfit(season, profile, perception);

  return { profile, season, perception, score, outfitUrl, demo };
}

/** Stable URLs for the demo fixture path (served from public/demo/). */
export function demoAnalyzeUrls(): { faceUrl: string; outfitUrl: string } {
  return { faceUrl: DEMO_ASSETS.face, outfitUrl: DEMO_ASSETS.outfitBefore };
}

export interface FixResult {
  garmentUrl: string;
  resultUrl: string;
  newScore: ScoreResult;
  previousOverall: number;
}

export async function applyFix(prev: AnalyzeResult): Promise<FixResult> {
  const suggestion = prev.score.suggestion;
  if (!suggestion) throw new Error("Nothing to fix: outfit already passes.");

  const demo = prev.demo ?? false;
  const fal = createFalClient(demo);
  const youcam = createYouCamClient(demo);

  const focus = prev.perception.garments[prev.perception.focusIndex];
  const category = focus.category as GarmentCategory;

  const garmentUrl = await fal.generateGarment(
    suggestion.description,
    suggestion.targetColor,
  );
  const tryOn = await youcam.tryOn(prev.outfitUrl, garmentUrl, category);

  // Re-score deterministically: the fixed garment now wears the target
  // palette color, so we swap the focus color and re-run the same scorer.
  const fixedPerception: OutfitPerception = {
    ...prev.perception,
    garments: prev.perception.garments.map((g, i) =>
      i === prev.perception.focusIndex
        ? { ...g, color: suggestion.targetColor }
        : g,
    ),
  };
  const newScore = scoreOutfit(prev.season, prev.profile, fixedPerception);

  return {
    garmentUrl,
    resultUrl: tryOn.resultUrl,
    newScore,
    previousOverall: prev.score.overall,
  };
}

// --- Style learning layer (additive) -------------------------------------

export interface RestyleResult {
  direction: StyleDirection;
  plan: RestylePlan;
  garmentUrl: string;
  resultUrl: string;
}

/**
 * Restyle the focus garment "edgier" or "classier": measure its style signals,
 * shift them along the chosen direction, generate the new garment, and try it
 * on. Palette-correct by construction (color is drawn from the user's season).
 */
export async function restyle(
  prev: AnalyzeResult,
  direction: StyleDirection,
): Promise<RestyleResult> {
  const demo = prev.demo ?? false;
  const fal = createFalClient(demo);
  const youcam = createYouCamClient(demo);

  const focus = prev.perception.garments[prev.perception.focusIndex];
  const plan = planRestyle(focus, direction, prev.season);

  const garmentUrl = await fal.generateGarment(plan.description, plan.targetColor);
  const tryOn = await youcam.tryOn(
    prev.outfitUrl,
    garmentUrl,
    focus.category as GarmentCategory,
  );

  return { direction, plan, garmentUrl, resultUrl: tryOn.resultUrl };
}
