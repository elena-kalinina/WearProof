// Centralized environment access. Server-only; never import from client code.

/** Unique non-empty YouCam Bearer tokens to try (API key slot, then secret). */
export function getYouCamBearerTokens(): string[] {
  const api = process.env.YOUCAM_API_KEY?.trim() ?? "";
  const secret = process.env.YOUCAM_SECRET_KEY?.trim() ?? "";
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of [api, secret]) {
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

const bearerTokens = getYouCamBearerTokens();

export const env = {
  youcamApiKey: process.env.YOUCAM_API_KEY?.trim() ?? "",
  youcamSecretKey: process.env.YOUCAM_SECRET_KEY?.trim() ?? "",
  /** First configured token; RealYouCamClient retries alternates on 401. */
  youcamBearerToken: bearerTokens[0] ?? "",
  youcamBaseUrl:
    process.env.YOUCAM_BASE_URL ?? "https://yce-api-01.makeupar.com",
  falKey: process.env.FAL_KEY ?? "",
  /**
   * When true (or when no YouCam token is set), YouCam calls use fixtures.
   */
  demoMode:
    process.env.DEMO_MODE === "1" ||
    process.env.DEMO_MODE === "true" ||
    bearerTokens.length === 0,
  /** Soft cap on YouCam units spent per server process, as a guard. */
  unitBudget: Number(process.env.UNIT_BUDGET ?? "300"),
} as const;

export function assertFalKey(): void {
  if (!env.falKey) {
    throw new Error(
      "FAL_KEY is not set. Add it to .env.local to enable fal.ai calls.",
    );
  }
}
