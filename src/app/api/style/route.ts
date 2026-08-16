import { restyle, type AnalyzeResult } from "@/lib/pipeline";
import type { StyleDirection } from "@/lib/style/signals";

export const runtime = "nodejs";
export const maxDuration = 120;

interface StyleBody {
  analyze: AnalyzeResult;
  direction: StyleDirection;
}

export async function POST(request: Request) {
  try {
    const { analyze, direction } = (await request.json()) as StyleBody;
    if (!analyze?.perception?.garments?.length) {
      return Response.json({ error: "Missing analyze result." }, { status: 400 });
    }
    if (direction !== "edgier" && direction !== "classier") {
      return Response.json(
        { error: "direction must be 'edgier' or 'classier'." },
        { status: 400 },
      );
    }
    const result = await restyle(analyze, direction);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
