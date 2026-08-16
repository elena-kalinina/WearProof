# Body-Type Detection + Outfit Recommendation — Side Project Spec

> **Status:** Side project / personal R&D. **Explicitly NOT part of the YouCam
> hackathon build.** This document exists so the idea is captured and buildable
> later without re-deriving it.

## Goal

From a single full-body photo, estimate a silhouette body-shape class
(A / H / V / T / X / 8 / O) and use it to recommend outfit strategies and drive
virtual try-on (reusing the hackathon's YouCam `cloth-v3` client).

## Non-negotiable framing note

Body-shape labeling is sensitive. Frame output as **"styling geometry,"** never
as a judgment about the person. Always:

- show the *reasoning* (the measured ratios that produced the class),
- let the user override the detected class,
- never store images without explicit consent,
- prefer soft, hedged language ("your silhouette reads closest to...") over
  hard labels.

## Pipeline

1. **Capture.** Single front-facing, full-body photo. Fitted clothing, plain
   background, arms held slightly away from the torso (a relaxed A-pose). This
   is the biggest accuracy lever — loose clothing destroys width estimates.
2. **Pose landmarks.** MediaPipe Pose (BlazePose, 33 landmarks) to locate
   shoulders, hips, and an interpolated waist band.
3. **Silhouette segmentation.** MediaPipe Image Segmenter (selfie/multiclass)
   or `rembg`/SAM for a clean body mask. Landmarks alone under-measure true body
   width; the mask gives the actual silhouette edges.
4. **Measure widths** from the mask at three horizontal bands, y-aligned to the
   landmarks:
   - `shoulder_w` — at the acromion (shoulder-joint) band
   - `waist_w`    — the narrowest band between chest and hip
   - `hip_w`      — the widest band across pelvis / upper thigh
5. **Ratios:**
   - `shoulder_to_hip = shoulder_w / hip_w`
   - `waist_definition = waist_w / min(shoulder_w, hip_w)`
6. **Classify** (thresholds to tune empirically on a labeled self-set):
   - **X / 8** — `|shoulder_w - hip_w|` small AND `waist_definition < ~0.75`
   - **H (rectangle)** — `|shoulder_w - hip_w|` small AND `waist_definition >= ~0.8`
   - **A (pear)** — `hip_w > shoulder_w` by > ~10%
   - **V / T (inverted triangle)** — `shoulder_w > hip_w` by > ~10%
   - **O (apple)** — `waist_w >= shoulder_w` and `waist_w >= hip_w`
   Emit **soft scores per class + a confidence**, never a single hard label.
7. **Recommendation map.** class -> styling goals (e.g. A: add structure at the
   shoulder, A-line hems to balance hips) -> concrete garment descriptors.
8. **VTO.** Feed the descriptors to the garment source (curated catalog or fal
   generation), then YouCam `cloth-v3` to prove the recommendation on the body.

## Accuracy guards

- Reject / ask for retake if: pose confidence low, person < 60% of frame,
  non-frontal (large shoulder-landmark z-delta), or loose/occluding clothing.
- Calibrate thresholds on a small labeled self-set (~20-30 photos) before
  trusting the classifier.
- Report confidence and **degrade to "inconclusive, please retake"** rather than
  emitting a low-confidence guess.

## Stack

- **Client, fully in-browser (no server needed):** MediaPipe Tasks
  (`@mediapipe/tasks-vision`, WASM) — Pose Landmarker + Image Segmenter.
- **Measurement + classification:** TypeScript, pure functions, unit-tested
  against synthetic width fixtures.
- **Threshold calibration (optional):** a small Python notebook over the labeled
  self-set.
- **VTO:** reuse the hackathon YouCam client.

## Milestones

1. Landmarks + segmentation mask overlay rendering on a still image.
2. Three-band width extraction + ratio readout on screen.
3. Classifier + confidence, validated against the labeled self-set.
4. Recommendation map + `cloth-v3` hook (reuse the hackathon client).

## Open questions

- **Waist without a visible waistline** (baggy clothes): mask width alone fails;
  may need a learned regressor or a fit-clothing capture requirement.
- **Single-view depth ambiguity:** front-only misses depth (bust/tummy
  projection). Consider an optional second (side) photo later.
- **Fairness / robustness** across body sizes, heights, and camera distances —
  needs a deliberately diverse calibration set, not just self-photos.
