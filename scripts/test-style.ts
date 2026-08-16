// Style-axis smoke test in demo mode (no API keys needed).
// Run: npx tsx scripts/test-style.ts

import { analyze, restyle } from "@/lib/pipeline";
import { deriveSignals, planRestyle } from "@/lib/style/signals";

async function main() {
  const res = await analyze(
    "https://demo.local/face.jpg",
    "https://demo.local/outfit.jpg",
  );

  const focus = res.perception.garments[res.perception.focusIndex];
  const base = deriveSignals(focus);
  console.log("Focus garment:", focus.item, focus.descriptors.join("/"));
  console.log("Base signals:", base);

  // Unit checks on the deterministic plan.
  const edgy = planRestyle(focus, "edgier", res.season);
  const classy = planRestyle(focus, "classier", res.season);
  console.log("\nedgier changes:", edgy.changes.join(", "), "-> target", edgy.targetColor);
  console.log("classier changes:", classy.changes.join(", "), "-> target", classy.targetColor);

  if (classy.signalsAfter.formality <= base.formality) {
    console.error("FAIL: 'classier' did not raise formality");
    process.exit(1);
  }
  if (edgy.signalsAfter.boldness <= base.boldness) {
    console.error("FAIL: 'edgier' did not raise boldness");
    process.exit(1);
  }
  if (!res.season.palette.includes(edgy.targetColor)) {
    console.error("FAIL: edgier target color is off-palette");
    process.exit(1);
  }
  if (edgy.changes.length === 0 || classy.changes.length === 0) {
    console.error("FAIL: no measured changes reported");
    process.exit(1);
  }

  // Full loop through generation + try-on (demo clients).
  const applied = await restyle(res, "edgier");
  console.log("\n--- After restyle (edgier) ---");
  console.log("Garment URL (truncated):", applied.garmentUrl.slice(0, 60));
  console.log("Result URL (truncated):", applied.resultUrl.slice(0, 60));
  if (!applied.resultUrl) {
    console.error("FAIL: restyle produced no result image");
    process.exit(1);
  }

  console.log("\nStyle-axis smoke test passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
