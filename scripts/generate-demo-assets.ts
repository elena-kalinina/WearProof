// One-time: generate the scripted demo imagery via fal.ai into public/demo/.
// Run: npm run generate:demo
//
// Two models, two jobs:
//   BASE_MODEL (text-to-image) draws each scenario's "before" outfit shot.
//   EDIT_MODEL (instruction edit) derives every other frame FROM that shot, so
//     the face scan and the fixed outfit are provably the same person. Chaining
//     text-to-image generations instead drifts identity on every call.
//
// The "after" garment color is read from the scoring engine rather than typed
// in here, so the picture can never disagree with the verdict text.

import { fal } from "@fal-ai/client";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEMO_SCENARIOS, type DemoScenarioId } from "../src/lib/demo/scenarios";
import { analyzeProfile } from "../src/lib/color/seasons";
import { scoreOutfit } from "../src/lib/scoring/score";
import { planRestyle, type StyleDirection } from "../src/lib/style/signals";
import { hexToLch } from "../src/lib/color/convert";
import type { Hex } from "../src/lib/types";

const OUT_DIR = path.join(process.cwd(), "public", "demo");
const BASE_MODEL = "fal-ai/flux-pro/v1.1";
const EDIT_MODEL = "fal-ai/flux-pro/kontext";

/** Shared wording so both scenarios read as the same studio shoot. */
const STUDIO =
  "professional ecommerce studio photograph, adult woman in her late twenties, " +
  "straight-on front view, shoulders square to camera, looking directly at the lens, " +
  "framed from mid-chest to above the head, even soft lighting, plain light gray seamless background";

/** Identity anchors repeated in every edit prompt. */
const KEEP =
  "Keep the exact same woman: identical face, bone structure, skin tone, eye color, " +
  "hairstyle, earrings, pose, camera angle, lighting and background. Photorealistic, single photograph.";

/**
 * Both demo subjects must photograph as the season the engine measures from
 * the fixture hexes in scenarios.ts — Bright Spring. Dark hair over warm skin
 * scores warm but reads Autumn on screen, so the coloring is spelled out here
 * instead of left to the base model's default casting.
 */
const SPRING_COLORING =
  "light warm golden peach skin with a fresh clear complexion, " +
  "warm caramel golden-brown hair, clear golden hazel eyes, " +
  "bright warm spring coloring, low contrast between hair and skin, no ashy or olive tones";

/**
 * Repeated at both ends of the garment-clash prompt on purpose. Stated once it
 * gets diluted by the coloring clause and the base model falls back to its
 * default oval editorial face, which is the exact shape the scenario says is
 * being clashed against.
 */
const ROUND_FACE =
  "very round circular face, full chubby cheeks, soft rounded jawline with no visible angles, " +
  "short rounded chin, face as wide as it is long";

async function download(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status} for ${dest}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  console.log(`  saved ${path.basename(dest)} (${Math.round(buf.length / 1024)} KB)`);
}

function firstUrl(data: unknown): string {
  const d = data as { image?: { url: string }; images?: { url: string }[] };
  const url = d.image?.url ?? d.images?.[0]?.url;
  if (!url) throw new Error("fal returned no image URL");
  return url;
}

async function draw(prompt: string): Promise<string> {
  const result = await fal.subscribe(BASE_MODEL, {
    input: { prompt, image_size: "portrait_4_3", num_images: 1 },
  });
  return firstUrl(result.data);
}

/** Re-host an already-approved frame from public/demo/ so it can be edited. */
async function uploadLocal(file: string): Promise<string> {
  const buf = await readFile(path.join(OUT_DIR, file));
  return fal.storage.upload(new Blob([buf], { type: "image/jpeg" }));
}

async function edit(imageUrl: string, instruction: string): Promise<string> {
  const result = await fal.subscribe(EDIT_MODEL, {
    input: { prompt: `${instruction} ${KEEP}`, image_url: imageUrl, guidance_scale: 4 },
  });
  return firstUrl(result.data);
}

/**
 * Plain-language name for a hex, so the edit prompt and the palette agree.
 * Hue alone is not enough: #ff3e6c (raspberry) and #6d2833 (burgundy) sit one
 * degree apart, so naming both "crimson" told the editor to keep what it had.
 * Lightness and chroma qualifiers are what actually move the garment.
 */
function colorWord(hex: Hex): string {
  const { L, C, h } = hexToLch(hex);
  if (C < 10) return L > 60 ? "light gray" : "charcoal";

  const hue =
    h < 25 || h >= 345
      ? L >= 50
        ? "raspberry pink"
        : "burgundy red"
      : h < 55
        ? "coral red"
        : h < 75
          ? "warm orange"
          : h < 105
            ? "golden yellow"
            : h < 135
              ? "lime green"
              : h < 175
                ? "emerald green"
                : h < 200
                  ? "turquoise"
                  : h < 235
                    ? "clear cyan blue"
                    : h < 265
                      ? "azure blue"
                      : h < 300
                        ? "cobalt blue"
                        : h < 330
                          ? "violet"
                          : "magenta";

  const depth = L >= 78 ? "light " : L < 40 ? "deep " : "";
  const intensity = C >= 60 ? "vivid " : C < 25 ? "muted " : "";
  return `${depth}${intensity}${hue}`;
}

/** The exact replacement color the scoring engine will name in the verdict. */
function targetColorFor(id: DemoScenarioId): Hex {
  const scenario = DEMO_SCENARIOS[id];
  const profile = { ...scenario.face, redness: scenario.skin.redness };
  const season = analyzeProfile(profile);
  const suggestion = scoreOutfit(season, profile, scenario.perception).suggestion;
  if (!suggestion) throw new Error(`Scenario ${id} produced no suggestion`);
  return suggestion.targetColor;
}

const DIRECTION_LOOK: Record<StyleDirection, string> = {
  edgier:
    "a cropped structured top with sharp shoulders, an asymmetric neckline and matte black hardware",
  classier:
    "a tailored top with clean minimal lines, a neat neckline and refined drape",
};

/**
 * Style-playground frames. The target tone comes from planRestyle, the same
 * call the running app makes, so each direction's picture shows the swatch the
 * UI prints next to it.
 */
async function buildRestyleFrames(id: DemoScenarioId, beforeUrl: string, prefix: string) {
  const scenario = DEMO_SCENARIOS[id];
  const profile = { ...scenario.face, redness: scenario.skin.redness };
  const season = analyzeProfile(profile);
  const focus = scenario.perception.garments[scenario.perception.focusIndex];

  for (const direction of ["edgier", "classier"] as StyleDirection[]) {
    const plan = planRestyle(focus, direction, season);
    console.log(`  ${direction} target: ${plan.targetColor} (${colorWord(plan.targetColor)})`);
    const word = colorWord(plan.targetColor);
    const url = await edit(
      beforeUrl,
      `Replace her top with ${DIRECTION_LOOK[direction]}, ` +
        `in ${word}, hex ${plan.targetColor}. ` +
        `The new top must read clearly as ${word} — do not keep the previous garment colour.`,
    );
    await download(url, path.join(OUT_DIR, `${prefix}-restyle-${direction}.jpg`));
  }
}

async function buildColorClash() {
  console.log("\n[color-clash] off-season wine top, amplified by facial redness");

  // Deep muted wine reads as a Dark Winter color, so it is visibly wrong on a
  // light bright Spring while still being a red — which keeps the Skin AI
  // redness rule firing alongside the color-harmony failure.
  const beforeGarment = "deep dark burgundy wine red";
  const beforeUrl = await draw(
    `${STUDIO}, ${SPRING_COLORING}, visible rosy flush across the cheeks and nose, ` +
      `hair in a sleek low ponytail, ` +
      `wearing a plain ${beforeGarment} fitted crew neck t-shirt with short sleeves`,
  );
  await download(beforeUrl, path.join(OUT_DIR, "color-outfit-before.jpg"));

  const faceUrl = await edit(
    beforeUrl,
    "Zoom in to a tight head-and-shoulders beauty close-up of her face. " +
      `The top of the ${beforeGarment} crew neck collar stays visible at the bottom edge.`,
  );
  await download(faceUrl, path.join(OUT_DIR, "face.jpg"));

  const target = targetColorFor("color-clash");
  console.log(`  fix color from scoring engine: ${target} (${colorWord(target)})`);
  const afterUrl = await edit(
    beforeUrl,
    `Recolor only her t-shirt from ${beforeGarment} to a saturated ${colorWord(target)}, hex ${target}. ` +
      "The garment cut, crew neckline, sleeves and fabric folds stay exactly as they are.",
  );
  await download(afterUrl, path.join(OUT_DIR, "color-outfit-after.jpg"));

  await buildRestyleFrames("color-clash", beforeUrl, "color");
}

async function buildGarmentClash() {
  console.log("\n[garment-clash] crew neck fights a round face");

  // "not a fashion model" matters: without it the base model reliably draws an
  // angular editorial face, which kills the round-face-vs-crew-neck premise.
  const beforeUrl = await draw(
    `${STUDIO}, friendly everyday woman age 27, not a fashion model, curvy full figure, ` +
      `${ROUND_FACE}, ${SPRING_COLORING}, ` +
      `shoulder-length wavy hair tucked behind the shoulders, ` +
      `wearing a plain golden yellow fitted crew neck t-shirt with a ribbed round collar, ` +
      `${ROUND_FACE}`,
  );
  await download(beforeUrl, path.join(OUT_DIR, "garment-outfit-before.jpg"));

  const faceUrl = await edit(
    beforeUrl,
    "Zoom in to a tight head-and-shoulders beauty close-up of her round face. " +
      "The top of the yellow crew neck collar stays visible at the bottom edge.",
  );
  await download(faceUrl, path.join(OUT_DIR, "garment-face.jpg"));

  const target = targetColorFor("garment-clash");
  console.log(`  fix color from scoring engine: ${target} (${colorWord(target)})`);
  const afterUrl = await edit(
    beforeUrl,
    `Change only the neckline of her ${colorWord(target)} t-shirt from a round crew neck ` +
      "to a deep pointed V-neck. The shirt color, fabric and fit stay identical.",
  );
  await download(afterUrl, path.join(OUT_DIR, "garment-outfit-after.jpg"));

  await buildRestyleFrames("garment-clash", beforeUrl, "garment");
}

async function main() {
  const key = process.env.FAL_KEY?.trim();
  if (!key) {
    console.error("FAL_KEY is not set in .env.local");
    process.exit(1);
  }
  fal.config({ credentials: key });
  await mkdir(OUT_DIR, { recursive: true });

  // `npm run generate:demo -- garment-clash` rebuilds a single story, so a
  // reroll for one scenario does not disturb the other's already-good frames.
  // `-- restyle` goes further and only adds the style-playground frames on top
  // of the outfit shots already on disk, leaving an approved cast untouched.
  const only = process.argv[2];
  console.log(`Base: ${BASE_MODEL}\nEdit: ${EDIT_MODEL}`);

  if (only === "restyle") {
    console.log("\n[restyle] rebuilding style frames from existing outfit shots");
    await buildRestyleFrames("color-clash", await uploadLocal("color-outfit-before.jpg"), "color");
    await buildRestyleFrames("garment-clash", await uploadLocal("garment-outfit-before.jpg"), "garment");
  } else {
    if (only !== "garment-clash") await buildColorClash();
    if (only !== "color-clash") await buildGarmentClash();
  }
  console.log("\nDone. Demo images are in public/demo/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
