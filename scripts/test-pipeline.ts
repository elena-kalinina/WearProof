// End-to-end pipeline smoke test in demo mode (no API keys needed).
// Run: npx tsx scripts/test-pipeline.ts

import { analyze, applyFix } from "@/lib/pipeline";

async function main() {
  const res = await analyze(
    "https://demo.local/face.jpg",
    "https://demo.local/outfit.jpg",
  );

  console.log("Season:", res.season.season);
  console.log("Rationale:", res.season.rationale);
  console.log("Axes:", res.season.axes);
  console.log("Overall score:", res.score.overall);
  console.log(
    "Verdicts:",
    res.score.verdicts.map((v) => `${v.label}=${v.score}(${v.level})`).join(", "),
  );
  console.log("Worst clash:", res.score.worstClash.label, "-", res.score.worstClash.reason);
  console.log("Suggestion:", res.score.suggestion);

  if (res.score.suggestion) {
    const fix = await applyFix(res);
    console.log("\n--- After fix ---");
    console.log("Garment URL (truncated):", fix.garmentUrl.slice(0, 60));
    console.log("Result URL (truncated):", fix.resultUrl.slice(0, 60));
    console.log(
      `Score: ${fix.previousOverall} -> ${fix.newScore.overall} (Δ ${fix.newScore.overall - fix.previousOverall})`,
    );
    if (fix.newScore.overall <= fix.previousOverall) {
      console.error("FAIL: score did not climb after fix");
      process.exit(1);
    }
  }
  console.log("\nPipeline smoke test passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
