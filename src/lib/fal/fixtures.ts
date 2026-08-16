// Demo outfit perception used when FAL_KEY is absent. A warm-red upper-body
// top so the redness-adjacency rule fires against the (also demo) redness=77,
// producing the flagship "coral amplifies redness" verdict.

import type { OutfitPerception } from "@/lib/types";

export const DEMO_PERCEPTION: OutfitPerception = {
  garments: [
    {
      item: "top",
      color: "#c0392b", // warm red
      category: "upper_body",
      descriptors: ["fitted", "crew"],
    },
  ],
  focusIndex: 0,
};
