import type { Verdict } from "@/lib/types";

const STYLES: Record<
  Verdict["level"],
  { badge: string; ring: string; icon: string }
> = {
  pass: {
    badge: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
    ring: "border-green-300 dark:border-green-800",
    icon: "✓",
  },
  warn: {
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    ring: "border-amber-300 dark:border-amber-800",
    icon: "!",
  },
  fail: {
    badge: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    ring: "border-red-300 dark:border-red-800",
    icon: "✕",
  },
};

export function VerdictCard({
  verdict,
  highlighted,
}: {
  verdict: Verdict;
  highlighted?: boolean;
}) {
  const s = STYLES[verdict.level];
  return (
    <div
      className={`rounded-xl border p-4 ${s.ring} ${
        highlighted ? "ring-2 ring-offset-2 ring-red-400 dark:ring-offset-black" : ""
      } bg-white dark:bg-zinc-900`}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {verdict.label}
        </span>
        <span
          className={`flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-sm font-bold ${s.badge}`}
        >
          {s.icon}
        </span>
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
        {verdict.score}
        <span className="text-sm font-normal text-zinc-400">/100</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {verdict.reason}
      </p>
    </div>
  );
}
