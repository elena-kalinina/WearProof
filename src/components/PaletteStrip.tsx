import type { Hex } from "@/lib/types";

export function PaletteStrip({ colors }: { colors: Hex[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {colors.map((c) => (
        <div
          key={c}
          title={c}
          className="h-8 w-8 rounded-md border border-black/10 dark:border-white/10"
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}
