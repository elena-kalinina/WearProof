// Centralized environment access. Server-only; never import from client code.

export const env = {
  /**
   * The V2 Bearer token. YouCam V2 endpoints authenticate with the API Key
   * directly (`Authorization: Bearer <API_KEY>`) — no id_token/client-auth
   * exchange. See docs Quick Start + FAQ ("API Key is the client_id").
   */
  youcamApiKey: process.env.YOUCAM_API_KEY ?? "",
  /**
   * The Secret key (the `sk...` value / client_secret). Not needed for the V2
   * endpoints we use; kept only for the legacy V1 id_token auth flow.
   */
  youcamSecretKey: process.env.YOUCAM_SECRET_KEY ?? "",
  youcamBaseUrl:
    process.env.YOUCAM_BASE_URL ?? "https://yce-api-01.makeupar.com",
  falKey: process.env.FAL_KEY ?? "",
  /**
   * When true (or when the YouCam key is absent), YouCam calls are served from
   * recorded fixtures so the whole pipeline runs before the key arrives.
   */
  demoMode:
    process.env.DEMO_MODE === "1" ||
    process.env.DEMO_MODE === "true" ||
    !process.env.YOUCAM_API_KEY,
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
