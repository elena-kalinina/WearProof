// Helpers for handling data-URL image payloads from the browser.

import { createHash } from "crypto";

export interface DecodedImage {
  bytes: Uint8Array;
  contentType: string;
}

/** Decode a `data:image/...;base64,....` URL into bytes + content type. */
export function decodeDataUrl(dataUrl: string): DecodedImage {
  const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(dataUrl);
  if (!match) throw new Error("Expected a base64 data URL");
  const contentType = match[1];
  const bytes = new Uint8Array(Buffer.from(match[2], "base64"));
  return { bytes, contentType };
}

/** Stable short hash of one or more strings, for caching. */
export function hashKey(...parts: string[]): string {
  const h = createHash("sha256");
  for (const p of parts) h.update(p);
  return h.digest("hex").slice(0, 32);
}
