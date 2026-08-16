// One-time: generate photorealistic demo images via fal.ai and save to public/demo/.
// Run: npm run generate:demo
// Requires FAL_KEY in .env.local (uses ~5 flux/schnell generations).

import { fal } from "@fal-ai/client";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "public", "demo");
const MODEL = "fal-ai/flux/schnell";

const ASSETS: { file: string; prompt: string; image_size: "portrait_4_3" }[] = [
  {
    file: "face.jpg",
    image_size: "portrait_4_3",
    prompt:
      "close-up portrait photo of a woman, warm tan skin tone, dark brown hair, brown eyes, soft natural window light, front facing, neutral expression, plain light gray background, realistic smartphone selfie style, entire face visible, eyes and forehead in frame",
  },
  {
    file: "color-outfit-before.jpg",
    image_size: "portrait_4_3",
    prompt:
      "medium shot studio photo, camera pulled back, woman from top of head to waist, ENTIRE FACE fully visible with eyes forehead and chin, wearing a brick red fitted crew neck t-shirt, facing camera, arms relaxed at sides, plain light gray background, headroom above hair, realistic fashion photo, no cropping of head",
  },
  {
    file: "color-outfit-after.jpg",
    image_size: "portrait_4_3",
    prompt:
      "medium shot studio photo, camera pulled back, same woman from top of head to waist, ENTIRE FACE fully visible with eyes forehead and chin, wearing a bright cyan blue fitted crew neck t-shirt, facing camera, arms relaxed at sides, plain light gray background, headroom above hair, realistic fashion photo, same pose as before, no cropping of head",
  },
  {
    file: "garment-outfit-before.jpg",
    image_size: "portrait_4_3",
    prompt:
      "medium shot studio photo, camera pulled back, woman with round soft face shape from top of head to waist, ENTIRE FACE fully visible, wearing a soft golden yellow fitted crew neck t-shirt, facing camera, arms relaxed, plain light gray background, headroom above hair, realistic fashion photo, crew neckline clearly visible",
  },
  {
    file: "garment-outfit-after.jpg",
    image_size: "portrait_4_3",
    prompt:
      "medium shot studio photo, camera pulled back, same woman from top of head to waist, ENTIRE FACE fully visible, wearing a soft golden yellow fitted v-neck t-shirt, v-neckline clearly visible, facing camera, arms relaxed, plain light gray background, headroom above hair, realistic fashion photo, same pose as before",
  },
];

async function download(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status} for ${dest}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  console.log(`  saved ${dest} (${buf.length} bytes)`);
}

async function generate(
  prompt: string,
  image_size: "portrait_4_3",
): Promise<string> {
  const result = await fal.subscribe(MODEL, {
    input: { prompt, image_size, num_images: 1 },
  });
  const url = (result.data as { images?: { url: string }[] })?.images?.[0]?.url;
  if (!url) throw new Error("No image URL in fal response");
  return url;
}

async function main() {
  const key = process.env.FAL_KEY?.trim();
  if (!key) {
    console.error("FAL_KEY is not set in .env.local");
    process.exit(1);
  }
  fal.config({ credentials: key });
  await mkdir(OUT_DIR, { recursive: true });

  console.log("Generating demo assets with fal-ai/flux/schnell …\n");
  for (const asset of ASSETS) {
    console.log(`→ ${asset.file}`);
    const url = await generate(asset.prompt, asset.image_size);
    console.log(`  fal url: ${url.slice(0, 72)}…`);
    await download(url, path.join(OUT_DIR, asset.file));
  }
  console.log("\nDone. Demo images are in public/demo/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
