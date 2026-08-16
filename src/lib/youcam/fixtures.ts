// Recorded YouCam response fixtures used when no scenario is selected (legacy).

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
  redness: 77,
};
