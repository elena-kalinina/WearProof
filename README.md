# WearProof

**Don't guess your colors. Wear proof.**

WearProof answers a question every online shopper asks: *does this color actually work on me?* You upload a face scan and an outfit photo. The app measures your real skin, hair, and eye color plus facial redness, scores your outfit against a personal palette, finds the worst clash, generates a corrected garment, and virtually tries it on you — with a match score that climbs to prove the fix.

Built solo by **Elena Kalinina** for the [YouCam API Skin AI & Apparel VTO Hackathon](https://youcam-api.devpost.com/).

---

## Why this exists

Most styling apps *advise*. WearProof *operates*.

Every verdict is a measured number — CIEDE2000 color distance, a redness score from Skin AI — not a chatbot guess. When something clashes, one tap generates a palette-correct replacement and runs virtual try-on on your photo. You see yourself wearing the fix, and the score moves.

**Flagship demo:** a warm-red top on a face with measured redness scores **53**. One tap swaps to a redness-neutralizing tone from your season palette, tries it on, and the score climbs to **96**.

---

## Features

| What you get | How |
| --- | --- |
| **Personal color profile** | YouCam `face-attr-analysis` → skin, hair, eye hex + face shape |
| **Redness signal** | YouCam `skin-analysis` → `hd_redness` for clash rules grounded in Skin AI |
| **Outfit reading** | fal.ai vision → garment type, category, color, descriptors |
| **12-season palette** | CIELAB axes (undertone, value, chroma, contrast) → flattering swatches |
| **Harmony scoring** | CIEDE2000 vs palette + redness-adjacency penalty |
| **Worst-clash focus** | One clear problem, not a wall of minor notes |
| **Fix & prove loop** | fal generates garment → YouCam `cloth-v3` try-on → re-score |
| **Style playground** *(experimental)* | “Edgier” / “classier” moves along measured style axes, still on-palette |

Works on **phone or laptop** — upload or capture both photos in the browser.

---

## Quick start

**Prerequisites:** Node.js 20+

```bash
git clone https://github.com/elena-kalinina/WearProof.git
cd WearProof
npm install
cp .env.local.example .env.local   # optional
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**No API keys?** The app runs in demo mode end-to-end. Click **“Use demo photos”** on the landing screen — fixtures and demo fallbacks cover the full analyze → fix → score-climb loop.

---

## Configuration

Copy `.env.local.example` to `.env.local`:

```bash
YOUCAM_API_KEY=       # API Key (client_id) — V2 Bearer token
YOUCAM_SECRET_KEY=   # Secret key (sk...) — not needed for V2 endpoints we use
YOUCAM_BASE_URL=https://yce-api-01.makeupar.com
FAL_KEY=             # fal.ai key for vision + garment generation
```

YouCam issues **two** values. V2 endpoints authenticate with the **API Key** directly (`Authorization: Bearer <API_KEY>`). The `sk...` secret is for legacy V1 auth only.

Verify keys and print per-feature unit costs (**spends 0 units**):

```bash
npm run probe
```

Optional:

```bash
DEMO_MODE=1          # force fixtures even when keys are present
UNIT_BUDGET=300      # soft cap on YouCam units per server process
```

---

## How to use it

1. **Face scan** — close-up, front-facing, good light.
2. **Outfit shot** — upper body, facing forward.
3. **Analyze** — season, palette, per-garment verdicts, overall match score.
4. **Fix the worst clash** — generate corrected top, try-on, watch the score climb.
5. *(Optional)* **Style playground** — nudge edgier or classier on measured axes.

---

## How it works

```
Face scan   ──▶ YouCam face-attr-analysis (skin / hair / eye hex)
            ──▶ YouCam skin-analysis (hd_redness)

Outfit shot ──▶ fal any-llm/vision (garment JSON)

                    │
                    ▼
         Color engine: hex → CIELAB → 4 axes → 12-season palette

                    │
                    ▼
         Scoring: CIEDE2000 + redness rule → worst clash

                    │
                    ▼
         Fix: fal flux/schnell → YouCam cloth-v3 → re-score
```

User photos upload once to fal storage; the public URL is reused for vision, Skin AI, and VTO — no duplicate upload dance.

Color math is validated against the Sharma et al. (2005) CIEDE2000 reference suite (`npm run test:color`).

---

## Scripts

```bash
npm run dev            # development server
npm run build          # production build
npm run probe          # verify YouCam keys + unit costs (free)
npm test               # color + pipeline + style (demo mode)
npm run test:color     # CIEDE2000 reference tests
npm run test:pipeline  # analyze + fix smoke test
npm run test:style     # edgier / classier restyle loop
```

---

## Project structure

```
src/
├── app/
│   ├── page.tsx              # UI workflow (capture → results → fix)
│   └── api/
│       ├── analyze/route.ts  # measure + score
│       ├── fix/route.ts      # generate + try-on + re-score
│       └── style/route.ts    # style-axis restyle (experimental)
├── lib/
│   ├── color/                # CIELAB, seasons, CIEDE2000
│   ├── scoring/              # verdicts, redness rule, suggestions
│   ├── style/                # edgier / classier axes
│   ├── youcam/               # Skin AI + VTO client (+ demo fixtures)
│   ├── fal/                  # vision + garment generation
│   └── pipeline.ts           # orchestration
└── components/               # ScoreRing, VerdictCard, Uploader, …
```

---

## Tech stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4
- **Skin AI + VTO:** [YouCam API](https://docs.perfectcorp.com/) — `face-attr-analysis`, `skin-analysis`, `cloth-v3`
- **Vision + generation:** [fal.ai](https://fal.ai/) — `any-llm/vision`, `flux/schnell`

API keys stay server-side (`src/lib/env.ts`). Identical inputs are cached; unit spend is capped per process.

---

## Author

**Elena Kalinina** — fashion-tech builder. Ten years ago this app was a notebook idea; today the APIs finally close the loop.

---

## License

MIT (or specify your license here if you add one.)
