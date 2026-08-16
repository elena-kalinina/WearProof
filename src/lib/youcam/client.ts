// YouCam API client. All YouCam task endpoints accept a public `src_file_url`,
// so we pass fal-hosted image URLs directly and skip the file-upload step.
//
// Two implementations:
//  - RealYouCamClient: hits the documented REST endpoints (verify exact
//    field names during the hour-0 validation once the key is live).
//  - DemoYouCamClient: serves recorded fixtures so the pipeline runs today.

import { env, getYouCamBearerTokens } from "@/lib/env";
import type { Hex } from "@/lib/types";
import { FACE_FIXTURE, SKIN_FIXTURE, tryOnFixture } from "@/lib/youcam/fixtures";
import { spendUnits } from "@/lib/youcam/budget";

export interface FaceAnalysis {
  skinColor: Hex;
  hairColor: Hex;
  eyeColor: Hex;
  faceShape?: string;
}

export interface SkinAnalysis {
  /** hd_redness ui_score 1..100. */
  redness: number;
}

export interface TryOnResult {
  resultUrl: string;
}

export type GarmentCategory =
  | "upper_body"
  | "lower_body"
  | "full_body"
  | "shoes"
  | "auto";

export interface YouCamClient {
  analyzeFace(imageUrl: string): Promise<FaceAnalysis>;
  analyzeSkin(imageUrl: string): Promise<SkinAnalysis>;
  tryOn(
    srcImageUrl: string,
    refGarmentUrl: string,
    category: GarmentCategory,
  ): Promise<TryOnResult>;
}

// --- Real client ---------------------------------------------------------

interface TaskStatusResponse {
  status: number;
  data?: {
    task_status?: "running" | "success" | "error";
    error?: string;
    error_message?: string;
    results?: { url?: string } | Record<string, unknown>;
    // face-attr / skin analysis return their payloads here too
    [k: string]: unknown;
  };
}

class RealYouCamClient implements YouCamClient {
  private activeToken = getYouCamBearerTokens()[0] ?? "";

  private headers(token = this.activeToken): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  /** Fetch with Bearer auth; on 401, retry other configured tokens. */
  private async youcamFetch(
    url: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const tokens = getYouCamBearerTokens();
    if (!tokens.length) {
      throw new Error("No YouCam API key configured.");
    }
    let last: Response | undefined;
    for (const token of tokens) {
      const res = await fetch(url, {
        ...init,
        headers: { ...this.headers(token), ...(init.headers as Record<string, string>) },
      });
      if (res.status !== 401) {
        this.activeToken = token;
        return res;
      }
      last = res;
    }
    return last!;
  }

  private async startTask(path: string, body: unknown): Promise<string> {
    const res = await this.youcamFetch(`${env.youcamBaseUrl}${path}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { data?: { task_id?: string }; error?: string };
    const taskId = json.data?.task_id;
    if (!res.ok || !taskId) {
      throw new Error(`YouCam task start failed (${res.status}): ${JSON.stringify(json)}`);
    }
    return taskId;
  }

  private async pollTask(
    path: string,
    taskId: string,
    { intervalMs = 1500, timeoutMs = 90_000 } = {},
  ): Promise<TaskStatusResponse["data"]> {
    const deadline = Date.now() + timeoutMs;
    // Polling is mandatory: an un-polled task expires and still consumes units.
    while (Date.now() < deadline) {
      const res = await this.youcamFetch(`${env.youcamBaseUrl}${path}/${taskId}`);
      const json = (await res.json()) as TaskStatusResponse;
      const st = json.data?.task_status;
      if (st === "success") {
        spendUnits(1);
        return json.data;
      }
      if (st === "error") {
        throw new Error(
          `YouCam task error: ${json.data?.error} ${json.data?.error_message ?? ""}`,
        );
      }
      await sleep(intervalMs);
    }
    throw new Error("YouCam task timed out");
  }

  async analyzeFace(imageUrl: string): Promise<FaceAnalysis> {
    const path = "/s2s/v2.0/task/face-attr-analysis";
    const taskId = await this.startTask(path, {
      src_file_url: imageUrl,
      features: ["faceShape", "eyeColor", "hairColor", "lipColor"],
    });
    const data = await this.pollTask(path, taskId);
    // NOTE: exact result shape to confirm in hour-0 validation. We defensively
    // read common field names.
    const r = (data ?? {}) as Record<string, string | undefined>;
    return {
      skinColor: r.skin_color ?? r.skinColor ?? FACE_FIXTURE.skinColor,
      hairColor: r.hairColor ?? r.hair_color ?? FACE_FIXTURE.hairColor,
      eyeColor: r.eyeColor ?? r.eye_color ?? FACE_FIXTURE.eyeColor,
      faceShape: r.faceShape ?? r.face_shape,
    };
  }

  async analyzeSkin(imageUrl: string): Promise<SkinAnalysis> {
    const path = "/s2s/v2.1/task/skin-analysis";
    const taskId = await this.startTask(path, {
      src_file_url: imageUrl,
      dst_actions: ["hd_redness"],
      format: "json",
    });
    const data = await this.pollTask(path, taskId);
    const redness = extractRedness(data);
    return { redness };
  }

  async tryOn(
    srcImageUrl: string,
    refGarmentUrl: string,
    category: GarmentCategory,
  ): Promise<TryOnResult> {
    const path = "/s2s/v2.0/task/cloth-v3";
    const taskId = await this.startTask(path, {
      src_file_url: srcImageUrl,
      ref_file_url: refGarmentUrl,
      garment_category: category,
    });
    const data = await this.pollTask(path, taskId, { timeoutMs: 120_000 });
    const url = (data?.results as { url?: string } | undefined)?.url;
    if (!url) throw new Error("YouCam try-on returned no result URL");
    return { resultUrl: url };
  }
}

function extractRedness(data: TaskStatusResponse["data"]): number {
  if (!data) return 0;
  // json format returns score_info-like object; look for hd_redness ui_score.
  const anyData = data as Record<string, unknown>;
  const hd = anyData.hd_redness as { ui_score?: number } | undefined;
  if (hd?.ui_score != null) return hd.ui_score;
  const results = anyData.results as
    | { hd_redness?: { ui_score?: number } }
    | undefined;
  if (results?.hd_redness?.ui_score != null) return results.hd_redness.ui_score;
  return 0;
}

// --- Demo client ---------------------------------------------------------

class DemoYouCamClient implements YouCamClient {
  async analyzeFace(): Promise<FaceAnalysis> {
    await sleep(400);
    return { ...FACE_FIXTURE };
  }
  async analyzeSkin(): Promise<SkinAnalysis> {
    await sleep(400);
    return { ...SKIN_FIXTURE };
  }
  async tryOn(
    _srcImageUrl: string,
    refGarmentUrl: string,
  ): Promise<TryOnResult> {
    await sleep(800);
    return { resultUrl: tryOnFixture(refGarmentUrl) };
  }
}

let cached: YouCamClient | null = null;
export function getYouCamClient(): YouCamClient {
  if (cached) return cached;
  cached = env.demoMode ? new DemoYouCamClient() : new RealYouCamClient();
  return cached;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
