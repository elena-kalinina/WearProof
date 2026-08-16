// One-time: generate photorealistic demo images via fal.ai and save to public/demo/.
// Run: npm run generate:demo
// Requires FAL_KEY in .env.local (uses ~3 flux/schnell generations).

import { fal } from "@fal-ai/client";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "public", "demo");
const MODEL = "fal-ai/flux/schnell";

const ASSETS: { file: string; prompt: string }[] = [
  {
    file: "face.jpg",
    prompt:
      "close-up portrait photo of a woman, warm tan skin tone, dark brown hair, brown eyes, soft natural window light, front facing, neutral expression, plain light gray background, realistic smartphone selfie style, sharp focus on face",
  },
  {
    file: "outfit-before.jpg",
    prompt:
      "upper body fashion photo of a woman wearing a brick red fitted crew neck t-shirt, facing camera, arms relaxed, plain light background, realistic photo, natural skin visible at neck and face, ecommerce style",
  },
  {
    file: "outfit-after.jpg",
    prompt:
      "upper body fashion photo of the same woman wearing a bright cyan blue fitted crew neck t-shirt, facing camera, arms relaxed, plain light background, realistic photo, natural skin visible at neck and face, ecommerce style, same pose as before",
  },
];

async function download(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status} for ${dest}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  console.log(`  saved ${dest} (${buf.length} bytes)`);
}

async function generate(prompt: string): Promise<string> {
  const result = await fal.subscribe(MODEL, {
    input: { prompt, image_size: "portrait_4_3", num_images: 1 },
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
  for (const { file, prompt } of ASSETS) {
    console.log(`→ ${file}`);
    const url = await generate(prompt);
    console.log(`  fal url: ${url.slice(0, 72)}…`);
    await download(url, path.join(OUT_DIR, file));
  }
  console.log("\nDone. Demo images are in public/demo/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
