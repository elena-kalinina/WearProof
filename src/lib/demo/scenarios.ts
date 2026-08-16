// Two scripted demo stories for judges and offline testing.

import type { OutfitPerception } from "@/lib/types";
import type { Hex } from "@/lib/types";
import type { StyleDirection } from "@/lib/style/signals";

export type DemoScenarioId = "color-clash" | "garment-clash";

export interface DemoScenario {
  id: DemoScenarioId;
  /** Short button label */
  label: string;
  /** One-line explanation on the capture screen */
  hint: string;
  face: {
    skinColor: Hex;
    hairColor: Hex;
    eyeColor: Hex;
    faceShape: string;
  };
  skin: { redness: number };
  perception: OutfitPerception;
  assets: {
    face: string;
    outfitBefore: string;
    outfitAfter: string;
    /** Style-playground outcome per direction, so each move shows its own tone. */
    restyle: Record<StyleDirection, string>;
  };
}

/** Which scripted result a demo client should hand back for the current call. */
export type DemoOutcome = "fix" | StyleDirection;

export function getDemoOutcomeAsset(
  id: DemoScenarioId,
  outcome: DemoOutcome,
): string {
  const { assets } = getDemoScenario(id);
  return outcome === "fix" ? assets.outfitAfter : assets.restyle[outcome];
}

export const DEMO_SCENARIOS: Record<DemoScenarioId, DemoScenario> = {
  "color-clash": {
    id: "color-clash",
    label: "Demo: color clash",
    hint: "Off-season wine top, worsened by facial redness (39 → 96)",
    face: {
      skinColor: "#eec49a",
      hairColor: "#a9743f",
      eyeColor: "#9a7b3f",
      faceShape: "oval",
    },
    skin: { redness: 77 },
    perception: {
      garments: [
        {
          item: "top",
          color: "#6d2833",
          category: "upper_body",
          descriptors: ["fitted", "crew"],
        },
      ],
      focusIndex: 0,
    },
    assets: {
      face: "/demo/face.jpg?v=5",
      outfitBefore: "/demo/color-outfit-before.jpg?v=5",
      outfitAfter: "/demo/color-outfit-after.jpg?v=5",
      restyle: {
        edgier: "/demo/color-restyle-edgier.jpg?v=5",
        classier: "/demo/color-restyle-classier.jpg?v=5",
      },
    },
  },
  "garment-clash": {
    id: "garment-clash",
    label: "Demo: garment clash",
    hint: "Crew neck fights a round face — swap the neckline",
    face: {
      skinColor: "#e8bd94",
      hairColor: "#b8834a",
      eyeColor: "#8a6a35",
      faceShape: "round",
    },
    skin: { redness: 38 },
    perception: {
      garments: [
        {
          item: "top",
          color: "#ffd166",
          category: "upper_body",
          descriptors: ["fitted", "crew"],
        },
      ],
      focusIndex: 0,
    },
    assets: {
      face: "/demo/garment-face.jpg?v=5",
      outfitBefore: "/demo/garment-outfit-before.jpg?v=5",
      outfitAfter: "/demo/garment-outfit-after.jpg?v=5",
      restyle: {
        edgier: "/demo/garment-restyle-edgier.jpg?v=5",
        classier: "/demo/garment-restyle-classier.jpg?v=5",
      },
    },
  },
};

export function getDemoScenario(id: DemoScenarioId): DemoScenario {
  return DEMO_SCENARIOS[id];
}

export const DEFAULT_DEMO_SCENARIO: DemoScenarioId = "color-clash";
