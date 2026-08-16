"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UploaderProps {
  label: string;
  hint: string;
  /** front camera for the face scan, rear for the outfit shot. */
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

export function Uploader({
  label,
  hint,
  capture = "user",
  value,
  onChange,
}: UploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setLive(false);
  }, []);

  // Releasing the track is what turns the recording indicator off, so this has
  // to run on unmount too, not just when the user cancels.
  useEffect(() => stopCamera, [stopCamera]);

  // The <video> only exists once `live` flips, so the stream is attached here
  // rather than at the point it is acquired.
  useEffect(() => {
    if (live && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [live]);

  async function startCamera() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera needs https or localhost. Upload a photo instead.");
      return;
    }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        // Not an `exact` constraint: laptops have no rear camera and should
        // quietly fall back to the only one they have.
        video: { facingMode: capture, width: { ideal: 1280 }, height: { ideal: 1706 } },
        audio: false,
      });
      setLive(true);
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setError(
        name === "NotAllowedError"
          ? "Camera blocked — allow access in the address bar, then retry."
          : "No camera found. Upload a photo instead.",
      );
    }
  }

  function takePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    onChange(canvas.toDataURL("image/jpeg", 0.92));
    stopCamera();
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </span>

      <div className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
        {live ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            // Mirrored preview only — people expect a mirror when framing
            // themselves, but the captured frame stays true to the sensor.
            className={`h-full w-full object-cover ${capture === "user" ? "scale-x-[-1]" : ""}`}
          />
        ) : value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={label} className="h-full w-full object-cover object-top" />
        ) : (
          <span className="px-4 text-center text-sm text-zinc-500">{hint}</span>
        )}
      </div>

      {live ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={takePhoto}
            className="flex-1 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            Take photo
          </button>
          <button
            type="button"
            onClick={stopCamera}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex-1 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-100"
          >
            Upload
          </button>
          <button
            type="button"
            onClick={startCamera}
            className="flex-1 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-100"
          >
            {value ? "Retake" : "Use camera"}
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) onChange(await fileToDataUrl(file));
        }}
      />
    </div>
  );
}
