# Facet — facial & body analysis + glow-up plan

A browser app that measures the face (478 landmarks) and body (pose + silhouette) from photos,
explains every metric with published research, and builds an evidence-graded 12-month glow-up plan.
All analysis runs on-device; data is stored in the browser (IndexedDB).

## Run

```bash
npm install      # also copies the MediaPipe runtime and downloads the two models
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## How it works

| Layer | Where |
| --- | --- |
| Landmark detection (face, pose + segmentation) | `src/lib/vision.ts` |
| Face metrics, pose correction, capture checks, skin (CIELAB) | `src/lib/faceAnalysis.ts` |
| Body widths, ratios, posture, BMI / Navy / Deurenberg body fat | `src/lib/bodyAnalysis.ts` |
| Derived scores and first-impression indices | `src/lib/report.ts` |
| Glow-up plan, projections, image prompts | `src/lib/plan.ts` |
| References, methods, limitations | `src/lib/science.ts` |

The "before" (standardized model) and "after" images come from an image model. In-app generation
needs a backend; until then the Visualization page provides the evidence-based prompts to copy and
lets you upload the generated images. Tested pipeline: FLUX 3 for the baseline, Nano Banana Pro
for the after.

## Dev helpers

Put test photos in `public/__test/` (git-ignored). In the dev console:
`__seed(faceUrl, bodyUrl?, name?, intakeOverrides?)` runs a real scan; `__seedMe()` seeds the
reference profile from `public/__test/me_front.jpg`, `me_body.jpg` and `visuals/`.
