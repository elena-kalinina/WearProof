import { analyze, demoAnalyzeUrls } from "@/lib/pipeline";
import { getFalClient } from "@/lib/fal/client";
import { decodeDataUrl, hashKey } from "@/lib/image";
import { cached } from "@/lib/cache";

export const runtime = "nodejs";
export const maxDuration = 120;

interface AnalyzeBody {
  faceImage?: string;
  outfitImage?: string;
  /** Use recorded fixtures — works even when API keys are set. */
  demo?: boolean;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalyzeBody;

    if (body.demo) {
      const { faceUrl, outfitUrl } = demoAnalyzeUrls();
      const result = await cached("analyze:demo", () =>
        analyze(faceUrl, outfitUrl, { demo: true }),
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
