// Two scripted demo stories for judges and offline testing.

import type { OutfitPerception } from "@/lib/types";
import type { Hex } from "@/lib/types";

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
  };
}

export const DEMO_SCENARIOS: Record<DemoScenarioId, DemoScenario> = {
  "color-clash": {
    id: "color-clash",
    label: "Demo: color clash",
    hint: "Warm red top amplifies facial redness (53 → 96)",
    face: {
      skinColor: "#b28e73",
      hairColor: "#3b2a20",
      eyeColor: "#5a4632",
      faceShape: "oval",
    },
    skin: { redness: 77 },
    perception: {
      garments: [
        {
          item: "top",
          color: "#c0392b",
          category: "upper_body",
          descriptors: ["fitted", "crew"],
        },
      ],
      focusIndex: 0,
    },
    assets: {
      face: "/demo/face.jpg",
      outfitBefore: "/demo/color-outfit-before.jpg",
      outfitAfter: "/demo/color-outfit-after.jpg",
    },
  },
  "garment-clash": {
    id: "garment-clash",
    label: "Demo: garment clash",
    hint: "Crew neck fights a round face — swap the neckline",
    face: {
      skinColor: "#b28e73",
      hairColor: "#3b2a20",
      eyeColor: "#5a4632",
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
      face: "/demo/face.jpg",
      outfitBefore: "/demo/garment-outfit-before.jpg",
      outfitAfter: "/demo/garment-outfit-after.jpg",
    },
  },
};

export function getDemoScenario(id: DemoScenarioId): DemoScenario {
  return DEMO_SCENARIOS[id];
}

export const DEFAULT_DEMO_SCENARIO: DemoScenarioId = "color-clash";
