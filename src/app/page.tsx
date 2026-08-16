"use client";

import { useState } from "react";
import type { AnalyzeResult, FixResult, RestyleResult } from "@/lib/pipeline";
import type { StyleDirection } from "@/lib/style/signals";
import { Uploader } from "@/components/Uploader";
import { ScoreRing } from "@/components/ScoreRing";
import { VerdictCard } from "@/components/VerdictCard";
import { PaletteStrip } from "@/components/PaletteStrip";
import { DEMO_ASSETS } from "@/lib/demo/assets";

type Step = "capture" | "analyzing" | "results" | "fixing" | "fixed";

export default function Home() {
  const [step, setStep] = useState<Step>("capture");
  const [face, setFace] = useState<string | null>(null);
  const [outfit, setOutfit] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [fix, setFix] = useState<FixResult | null>(null);
  const [styleResult, setStyleResult] = useState<RestyleResult | null>(null);
  const [styleLoading, setStyleLoading] = useState<StyleDirection | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAnalyze(faceImg: string, outfitImg: string, demo = false) {
    setError(null);
    setStep("analyzing");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          demo
            ? { demo: true }
            : { faceImage: faceImg, outfitImage: outfitImg },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setResult(data as AnalyzeResult);
      setStep("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
      setStep("capture");
    }
  }

  async function runFix() {
    if (!result) return;
    setError(null);
    setStep("fixing");
    try {
      const res = await fetch("/api/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analyze: result }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fix failed");
      setFix(data as FixResult);
      setStep("fixed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fix failed");
      setStep("results");
    }
  }

  async function runRestyle(direction: StyleDirection) {
    if (!result) return;
    setError(null);
    setStyleLoading(direction);
    try {
      const res = await fetch("/api/style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analyze: result, direction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Restyle failed");
      setStyleResult(data as RestyleResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restyle failed");
    } finally {
      setStyleLoading(null);
    }
  }

  function reset() {
    setStep("capture");
    setResult(null);
    setFix(null);
    setStyleResult(null);
    setStyleLoading(null);
    setError(null);
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          WearProof
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          One selfie. Your measured colors, your worst clash, fixed on you.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {step === "capture" && (
        <CaptureStep
          face={face}
          outfit={outfit}
          setFace={setFace}
          setOutfit={setOutfit}
          onAnalyze={() => runAnalyze(face!, outfit!)}
          onDemo={() => {
            setFace(DEMO_ASSETS.face);
            setOutfit(DEMO_ASSETS.outfitBefore);
            runAnalyze("", "", true);
          }}
        />
      )}

      {step === "analyzing" && <Loading text="Measuring your coloring and reading the outfit…" />}
      {step === "fixing" && <Loading text="Generating the fix and trying it on you…" />}

      {(step === "results" || step === "fixed") && result && (
        <ResultsStep
          result={result}
          outfitImage={outfit}
          fix={step === "fixed" ? fix : null}
          onFix={runFix}
          onReset={reset}
          styleResult={styleResult}
          styleLoading={styleLoading}
          onRestyle={runRestyle}
        />
      )}
    </main>
  );
}

function CaptureStep({
  face,
  outfit,
  setFace,
  setOutfit,
  onAnalyze,
  onDemo,
}: {
  face: string | null;
  outfit: string | null;
  setFace: (v: string) => void;
  setOutfit: (v: string) => void;
  onAnalyze: () => void;
  onDemo: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Uploader
          label="1. Face scan"
          hint="Close-up, front-facing, good light. Tap to upload or take a photo."
          capture="user"
          value={face}
          onChange={setFace}
        />
        <Uploader
          label="2. Outfit shot"
          hint="Upper body, facing forward. Tap to upload or capture."
          capture="environment"
          value={outfit}
          onChange={setOutfit}
        />
      </div>
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={onAnalyze}
          disabled={!face || !outfit}
          className="w-full max-w-sm rounded-full bg-zinc-900 px-6 py-3 font-medium text-white transition-opacity disabled:opacity-40 dark:bg-white dark:text-black"
        >
          Analyze my outfit
        </button>
        <button
          onClick={onDemo}
          className="text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          Use demo photos
        </button>
      </div>
    </div>
  );
}

function ResultsStep({
  result,
  outfitImage,
  fix,
  onFix,
  onReset,
  styleResult,
  styleLoading,
  onRestyle,
}: {
  result: AnalyzeResult;
  outfitImage: string | null;
  fix: FixResult | null;
  onFix: () => void;
  onReset: () => void;
  styleResult: RestyleResult | null;
  styleLoading: StyleDirection | null;
  onRestyle: (direction: StyleDirection) => void;
}) {
  const { season, score } = result;
  const shownScore = fix ? fix.newScore : score;

  return (
    <div className="flex flex-col gap-8">
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      {/* Left: imagery + season */}
      <div className="flex flex-col gap-5">
        {result.demo && (
          <figure className="flex flex-col gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={DEMO_ASSETS.face}
              alt="Face scan"
              className="w-full max-h-[220px] rounded-2xl object-cover object-top bg-zinc-100 dark:bg-zinc-800"
            />
            <figcaption className="text-center text-xs text-zinc-500">
              Face scan (color + redness)
            </figcaption>
          </figure>
        )}

        {fix ? (
          <BeforeAfter
            before={outfitImage}
            after={fix.resultUrl}
          />
        ) : (
          outfitImage && (
            <figure className="flex flex-col gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={outfitImage}
                alt="Your outfit"
                className="w-full min-h-[280px] max-h-[420px] rounded-2xl object-cover object-top bg-zinc-100 dark:bg-zinc-800"
              />
              {result.demo && (
                <figcaption className="text-center text-xs text-zinc-500">
                  Outfit shot
                </figcaption>
              )}
            </figure>
          )
        )}

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Your season
          </div>
          <div className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {season.season}
          </div>
          <PaletteStrip colors={season.palette} />
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {season.rationale}
          </p>
        </div>
      </div>

      {/* Right: score + verdicts */}
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-center rounded-2xl border border-zinc-200 bg-white py-6 dark:border-zinc-800 dark:bg-zinc-900">
          <ScoreRing
            value={shownScore.overall}
            from={fix ? fix.previousOverall : undefined}
            label={fix ? "after fix" : "match"}
          />
        </div>

        <div className="flex flex-col gap-3">
          {shownScore.verdicts.map((v) => (
            <VerdictCard
              key={v.id}
              verdict={v}
              highlighted={!fix && v.id === score.worstClash.id}
            />
          ))}
        </div>

        {!fix && score.suggestion && (
          <button
            onClick={onFix}
            className="rounded-full bg-zinc-900 px-6 py-3 font-medium text-white dark:bg-white dark:text-black"
          >
            Fix the worst clash → {score.worstClash.label}
          </button>
        )}
        {fix && (
          <div className="rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
            Fixed: swapped to a {season.season} palette tone. Match climbed{" "}
            {fix.previousOverall} → {fix.newScore.overall}.
          </div>
        )}
        <button
          onClick={onReset}
          className="text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          Start over
        </button>
      </div>
    </div>

    <StylePlayground
      outfitImage={outfitImage}
      styleResult={styleResult}
      styleLoading={styleLoading}
      onRestyle={onRestyle}
    />
    </div>
  );
}

function StylePlayground({
  outfitImage,
  styleResult,
  styleLoading,
  onRestyle,
}: {
  outfitImage: string | null;
  styleResult: RestyleResult | null;
  styleLoading: StyleDirection | null;
  onRestyle: (direction: StyleDirection) => void;
}) {
  const directions: { key: StyleDirection; label: string }[] = [
    { key: "edgier", label: "Make it edgier" },
    { key: "classier", label: "Make it classier" },
  ];
  return (
    <section className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-900/40">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-zinc-500">
          Style playground
        </span>
        <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-medium uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          experimental
        </span>
      </div>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Shift the outfit along measured style axes — kept inside your palette.
      </p>

      <div className="flex flex-wrap gap-3">
        {directions.map((d) => (
          <button
            key={d.key}
            onClick={() => onRestyle(d.key)}
            disabled={styleLoading !== null}
            className="rounded-full border border-zinc-300 bg-white px-5 py-2 text-sm font-medium text-zinc-800 transition-opacity disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {styleLoading === d.key ? "Restyling…" : d.label}
          </button>
        ))}
      </div>

      {styleResult && (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <BeforeAfter before={outfitImage} after={styleResult.resultUrl} />
          <div className="flex flex-col gap-2">
            <div className="text-sm font-semibold capitalize text-zinc-900 dark:text-zinc-50">
              {styleResult.direction}
            </div>
            <div className="flex flex-wrap gap-2">
              {styleResult.plan.changes.map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-zinc-200 px-2.5 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {c}
                </span>
              ))}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
              target tone
              <span
                className="inline-block h-4 w-4 rounded-full border border-zinc-300 dark:border-zinc-600"
                style={{ backgroundColor: styleResult.plan.targetColor }}
              />
              {styleResult.plan.targetColor}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function BeforeAfter({
  before,
  after,
}: {
  before: string | null;
  after: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <figure className="flex flex-col gap-1">
        {before && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={before} alt="Before" className="w-full min-h-[200px] max-h-[320px] rounded-xl object-cover object-top bg-zinc-100 dark:bg-zinc-800" />
        )}
        <figcaption className="text-center text-xs text-zinc-500">Before</figcaption>
      </figure>
      <figure className="flex flex-col gap-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after} alt="After" className="w-full min-h-[200px] max-h-[320px] rounded-xl object-cover object-top bg-zinc-100 dark:bg-zinc-800" />
        <figcaption className="text-center text-xs text-zinc-500">After</figcaption>
      </figure>
    </div>
  );
}

function Loading({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-20">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-white" />
      <p className="text-zinc-600 dark:text-zinc-400">{text}</p>
    </div>
  );
}
