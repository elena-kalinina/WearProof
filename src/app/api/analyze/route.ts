import { analyze, demoAnalyzeUrls } from "@/lib/pipeline";
import { getFalClient } from "@/lib/fal/client";
import { decodeDataUrl, hashKey } from "@/lib/image";
import { cached } from "@/lib/cache";
import {
  DEFAULT_DEMO_SCENARIO,
  type DemoScenarioId,
} from "@/lib/demo/scenarios";

export const runtime = "nodejs";
export const maxDuration = 120;

interface AnalyzeBody {
  faceImage?: string;
  outfitImage?: string;
  /** Scripted demo story id, or `true` for default color-clash demo. */
  demo?: boolean | DemoScenarioId;
}

function resolveDemoScenario(demo: AnalyzeBody["demo"]): DemoScenarioId | null {
  if (!demo) return null;
  if (demo === true) return DEFAULT_DEMO_SCENARIO;
  if (demo === "color-clash" || demo === "garment-clash") return demo;
  return DEFAULT_DEMO_SCENARIO;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalyzeBody;
    const scenarioId = resolveDemoScenario(body.demo);

    if (scenarioId) {
      const { faceUrl, outfitUrl } = demoAnalyzeUrls(scenarioId);
      const result = await cached(`analyze:demo:${scenarioId}`, () =>
        analyze(faceUrl, outfitUrl, { demo: true, demoScenario: scenarioId }),
      );
      return Response.json(result);
    }

    const { faceImage, outfitImage } = body;
    if (!faceImage || !outfitImage) {
      return Response.json(
        { error: "faceImage and outfitImage (data URLs) are required." },
        { status: 400 },
      );
    }

    const key = hashKey("analyze", faceImage, outfitImage);
    const result = await cached(key, async () => {
      const fal = getFalClient();
      const face = decodeDataUrl(faceImage);
      const outfit = decodeDataUrl(outfitImage);
      const [faceUrl, outfitUrl] = await Promise.all([
        fal.uploadImage(face.bytes, face.contentType),
        fal.uploadImage(outfit.bytes, outfit.contentType),
      ]);
      return analyze(faceUrl, outfitUrl);
    });

    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
