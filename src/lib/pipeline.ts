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
import {
  DEFAULT_DEMO_SCENARIO,
  getDemoScenario,
  type DemoScenarioId,
} from "@/lib/demo/scenarios";

export interface AnalyzeResult {
  profile: UserProfile;
  season: SeasonResult;
  perception: OutfitPerception;
  score: ScoreResult;
  outfitUrl: string;
  /** Set when run with demo fixtures. */
  demo?: boolean;
  demoScenario?: DemoScenarioId;
}

export interface AnalyzeOptions {
  demo?: boolean;
  demoScenario?: DemoScenarioId;
}

export async function analyze(
  faceUrl: string,
  outfitUrl: string,
  options?: AnalyzeOptions,
): Promise<AnalyzeResult> {
  const demo = options?.demo ?? false;
  const demoScenario = options?.demoScenario ?? DEFAULT_DEMO_SCENARIO;
  const youcam = createYouCamClient(demo, demoScenario);
  const fal = createFalClient(demo, demoScenario);

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

  return { profile, season, perception, score, outfitUrl, demo, demoScenario };
}

export function demoAnalyzeUrls(scenarioId: DemoScenarioId = DEFAULT_DEMO_SCENARIO) {
  const s = getDemoScenario(scenarioId);
  return { faceUrl: s.assets.face, outfitUrl: s.assets.outfitBefore };
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
  const scenario = prev.demoScenario ?? DEFAULT_DEMO_SCENARIO;
  const fal = createFalClient(demo, scenario);
  const youcam = createYouCamClient(demo, scenario);

  const focus = prev.perception.garments[prev.perception.focusIndex];
  const category = focus.category as GarmentCategory;

  const garmentUrl = await fal.generateGarment(
    suggestion.description,
    suggestion.targetColor,
  );
  const tryOn = await youcam.tryOn(prev.outfitUrl, garmentUrl, category);

  const fixedFocus: typeof focus = {
    ...focus,
    color: suggestion.targetColor,
  };
  if (prev.score.worstClash.id === "neckline" && prev.profile.faceShape) {
    const shape = prev.profile.faceShape.toLowerCase();
    const betterNeck =
      shape === "round" || shape === "square" ? "v-neck" : "scoop";
    fixedFocus.descriptors = focus.descriptors
      .filter((d) => !/crew|v-?neck|scoop|neck/i.test(d))
      .concat(betterNeck);
  }

  const fixedPerception: OutfitPerception = {
    ...prev.perception,
    garments: prev.perception.garments.map((g, i) =>
      i === prev.perception.focusIndex ? fixedFocus : g,
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
  const scenario = prev.demoScenario ?? DEFAULT_DEMO_SCENARIO;
  const fal = createFalClient(demo, scenario, direction);
  const youcam = createYouCamClient(demo, scenario, direction);

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
