// Hour-0 YouCam validation. Reads .env.local, figures out which credential is
// the real V2 Bearer token (by hitting a free metadata endpoint), and prints
// per-feature unit costs so you know what each call spends BEFORE spending it.
//
// Run: npm run probe   (loads .env.local via node --env-file-if-exists)
// No units are consumed: /credit and /feature-cost are metadata endpoints.

const BASE = process.env.YOUCAM_BASE_URL ?? "https://yce-api-01.makeupar.com";

const CANDIDATES = [
  { name: "YOUCAM_API_KEY", value: process.env.YOUCAM_API_KEY },
  { name: "YOUCAM_SECRET_KEY", value: process.env.YOUCAM_SECRET_KEY },
].filter((c): c is { name: string; value: string } => Boolean(c.value));

const FEATURES_OF_INTEREST = [
  "cloth-v3",
  "cloth",
  "face-attr-analysis",
  "skin-analysis",
];

async function getJson(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function main() {
  if (CANDIDATES.length === 0) {
    console.error(
      "No keys found. Add YOUCAM_API_KEY (and YOUCAM_SECRET_KEY) to .env.local.",
    );
    process.exit(1);
  }

  console.log(`Base: ${BASE}`);
  console.log(`Testing ${CANDIDATES.length} credential(s) against /s2s/v1.0/client/credit …\n`);

  let working: { name: string; value: string } | null = null;
  for (const cand of CANDIDATES) {
    const { status, body } = await getJson("/s2s/v1.0/client/credit", cand.value);
    const ok = status >= 200 && status < 300;
    console.log(`  ${cand.name}: HTTP ${status} ${ok ? "✅ authenticates" : "❌"}`);
    if (ok) {
      working = cand;
      console.log(`    credit: ${JSON.stringify(body)}`);
      break;
    } else {
      console.log(`    -> ${JSON.stringify(body).slice(0, 160)}`);
    }
  }

  if (!working) {
    console.error(
      "\nNeither credential authenticated. Double-check the values, or the key may not be activated / units not yet redeemed.",
    );
    process.exit(1);
  }

  console.log(`\n==> Use ${working.name} as the V2 Bearer token (YOUCAM_API_KEY).`);
  if (working.name !== "YOUCAM_API_KEY") {
    console.log(
      "    (It's currently in the wrong slot — swap it into YOUCAM_API_KEY in .env.local.)",
    );
  }

  console.log("\nPer-feature unit costs:");
  const { status, body } = await getJson(
    "/s2s/v2.0/credit/feature-cost?page_size=50",
    working.value,
  );
  if (status < 200 || status >= 300) {
    console.log(`  (feature-cost returned HTTP ${status}: ${JSON.stringify(body).slice(0, 160)})`);
    return;
  }
  const results =
    (body as { result_list?: unknown[]; results?: unknown[] }).result_list ??
    (body as { results?: unknown[] }).results ??
    [];
  const rows = (results as Record<string, unknown>[]).map((r) => ({
    feature: String(r.feature ?? r.name ?? r.feature_name ?? "?"),
    cost: r.credit ?? r.cost ?? r.unit ?? r.units ?? "?",
  }));
  for (const row of rows) {
    const mark = FEATURES_OF_INTEREST.some((f) => row.feature.includes(f)) ? " <—" : "";
    console.log(`  ${row.feature.padEnd(28)} ${String(row.cost)}${mark}`);
  }
  if (rows.length === 0) {
    console.log(`  (unexpected shape) ${JSON.stringify(body).slice(0, 300)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
