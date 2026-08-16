// Exercises the route handlers directly (no HTTP server / no network),
// which is the most reliable check inside a sandbox. Run in demo mode.
// Run: npx tsx scripts/test-routes.ts

import { POST as analyzePOST } from "@/app/api/analyze/route";
import { POST as fixPOST } from "@/app/api/fix/route";

const DEMO_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQAY3Y2wAAAAAElFTkSuQmCC";

function req(body: unknown): Request {
  return new Request("http://local/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function main() {
  const aRes = await analyzePOST(req({ demo: "color-clash" }));
  if (aRes.status !== 200) {
    console.error("analyze status", aRes.status, await aRes.text());
    process.exit(1);
  }
  const analyzeData = await aRes.json();
  console.log("analyze OK:", analyzeData.season.season, "overall", analyzeData.score.overall);

  const fRes = await fixPOST(req({ analyze: analyzeData }));
  if (fRes.status !== 200) {
    console.error("fix status", fRes.status, await fRes.text());
    process.exit(1);
  }
  const fixData = await fRes.json();
  console.log(
    "fix OK:",
    `${fixData.previousOverall} -> ${fixData.newScore.overall}`,
  );

  // validate 400 on missing input
  const badRes = await analyzePOST(req({ faceImage: DEMO_PNG }));
  if (badRes.status !== 400) {
    console.error("expected 400 for missing outfitImage, got", badRes.status);
    process.exit(1);
  }
  console.log("validation OK: 400 on missing input");
  console.log("\nAll route handler checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
