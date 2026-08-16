import { applyFix, type AnalyzeResult } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 120;

interface FixBody {
  analyze: AnalyzeResult;
}

export async function POST(request: Request) {
  try {
    const { analyze } = (await request.json()) as FixBody;
    if (!analyze?.score?.suggestion) {
      return Response.json(
        { error: "No fixable suggestion in the analyze result." },
        { status: 400 },
      );
    }
    const result = await applyFix(analyze);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
