"use client";

import { useEffect, useState } from "react";

interface ScoreRingProps {
  /** target score 0..100 */
  value: number;
  /** optional starting value to animate from (for the fix climb) */
  from?: number;
  size?: number;
  label?: string;
}

function colorFor(score: number): string {
  if (score >= 75) return "#16a34a"; // green
  if (score >= 50) return "#d97706"; // amber
  return "#dc2626"; // red
}

export function ScoreRing({ value, from, size = 140, label }: ScoreRingProps) {
  const [display, setDisplay] = useState(from ?? value);

  useEffect(() => {
    const start = from ?? value;
    const startTime = performance.now();
    const duration = 900;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(start + (value - start) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, from]);

  const stroke = 12;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - display / 100);
  const color = colorFor(display);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-zinc-200 dark:text-zinc-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke 0.3s" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold tabular-nums" style={{ color }}>
          {display}
        </span>
        {label && (
          <span className="text-xs uppercase tracking-wide text-zinc-500">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
