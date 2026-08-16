"use client";

import { useRef } from "react";

interface UploaderProps {
  label: string;
  hint: string;
  /** front camera for face, rear for outfit (mobile hint). */
  capture?: "user" | "environment";
  value: string | null;
  onChange: (dataUrl: string) => void;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function Uploader({ label, hint, capture, value, onChange }: UploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </span>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="group relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={label} className="h-full w-full object-cover" />
        ) : (
          <span className="px-4 text-center text-sm text-zinc-500">{hint}</span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture={capture}
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) onChange(await fileToDataUrl(file));
        }}
      />
    </div>
  );
}
