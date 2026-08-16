import { analyze } from "@/lib/pipeline";
import { getFalClient } from "@/lib/fal/client";
import { decodeDataUrl, hashKey } from "@/lib/image";
import { cached } from "@/lib/cache";

export const runtime = "nodejs";
export const maxDuration = 120;

interface AnalyzeBody {
  faceImage: string;
  outfitImage: string;
}

export async function POST(request: Request) {
  try {
    const { faceImage, outfitImage } = (await request.json()) as AnalyzeBody;
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
