// fal.ai client: image hosting, outfit perception (VLM), and garment
// generation. Falls back to fixtures when FAL_KEY is absent so the pipeline
// runs end-to-end with zero keys during development.

import { fal } from "@fal-ai/client";
import { env } from "@/lib/env";
import type { Hex, OutfitPerception } from "@/lib/types";
import {
  DEFAULT_DEMO_SCENARIO,
  getDemoScenario,
  type DemoScenarioId,
} from "@/lib/demo/scenarios";

export interface FalClient {
  uploadImage(bytes: Uint8Array, contentType: string): Promise<string>;
  perceiveOutfit(imageUrl: string): Promise<OutfitPerception>;
  generateGarment(prompt: string, hintColor?: Hex): Promise<string>;
}

const VISION_MODEL = "google/gemini-2.5-flash";
const IMAGE_MODEL = "fal-ai/flux/schnell";

const PERCEPTION_PROMPT = `You are a fashion cataloguer. Look at the outfit in the image and return ONLY strict JSON (no markdown, no prose) of this exact shape:
{"garments":[{"item":"top|shirt|jacket|dress|pants|skirt|shoes","color":"#rrggbb","category":"upper_body|lower_body|full_body|shoes","descriptors":["short","adjectives"]}],"focusIndex":0}
- "color" is the dominant hex of that garment.
- "focusIndex" is the index of the garment closest to the face (prefer an upper_body item).
- Keep descriptors to 2-4 words like "structured", "cropped", "v-neck", "flowy".`;

let configured = false;
function ensureConfigured() {
  if (!configured) {
    fal.config({ credentials: env.falKey });
    configured = true;
  }
}

class RealFalClient implements FalClient {
  async uploadImage(bytes: Uint8Array, contentType: string): Promise<string> {
    ensureConfigured();
    const blob = new Blob([bytes as BlobPart], { type: contentType });
    return fal.storage.upload(blob);
  }

  async perceiveOutfit(imageUrl: string): Promise<OutfitPerception> {
    ensureConfigured();
    const result = await fal.subscribe("fal-ai/any-llm/vision", {
      input: {
        prompt: PERCEPTION_PROMPT,
        image_urls: [imageUrl],
        model: VISION_MODEL,
      },
    });
    const output = (result.data as { output?: string })?.output ?? "";
    return parsePerception(output);
  }

  async generateGarment(prompt: string): Promise<string> {
    ensureConfigured();
    const result = await fal.subscribe(IMAGE_MODEL, {
      input: { prompt, image_size: "portrait_4_3", num_images: 1 },
    });
    const images = (result.data as { images?: { url: string }[] })?.images;
    const url = images?.[0]?.url;
    if (!url) throw new Error("fal garment generation returned no image");
    return url;
  }
}

class DemoFalClient implements FalClient {
  constructor(private scenarioId: DemoScenarioId = DEFAULT_DEMO_SCENARIO) {}

  async uploadImage(): Promise<string> {
    return "https://demo.local/uploaded-image.jpg";
  }
  async perceiveOutfit(): Promise<OutfitPerception> {
    await sleep(500);
    return structuredClone(getDemoScenario(this.scenarioId).perception);
  }
  async generateGarment(_prompt: string, _hintColor?: Hex): Promise<string> {
    await sleep(700);
    return getDemoScenario(this.scenarioId).assets.outfitAfter;
  }
}

/** Parse the VLM output into an OutfitPerception, tolerating code fences. */
export function parsePerception(raw: string): OutfitPerception {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // last resort: grab the first {...} block
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) throw new Error(`Could not parse perception JSON: ${raw.slice(0, 200)}`);
    parsed = JSON.parse(m[0]);
  }
  const p = parsed as OutfitPerception;
  if (!p.garments?.length) throw new Error("Perception has no garments");
  p.focusIndex = clampIndex(p.focusIndex ?? 0, p.garments.length);
  return p;
}

function clampIndex(i: number, len: number): number {
  if (!Number.isFinite(i) || i < 0) return 0;
  return Math.min(Math.floor(i), len - 1);
}

let cached: FalClient | null = null;
export function getFalClient(): FalClient {
  if (cached) return cached;
  cached = env.falKey ? new RealFalClient() : new DemoFalClient();
  return cached;
}

/** Per-request client; pass demoScenario when using scripted demo stories. */
export function createFalClient(
  demo = false,
  demoScenario: DemoScenarioId = DEFAULT_DEMO_SCENARIO,
): FalClient {
  if (demo || !env.falKey) return new DemoFalClient(demoScenario);
  return getFalClient();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
