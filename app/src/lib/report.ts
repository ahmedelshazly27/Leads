import type { BodyMetrics, FaceResult, Intake, Scan, SkinRegionKey } from "./types";
import { clamp, closeness, mean, sigmoid } from "./geometry";

/* ------------------------------------------------------------------ */
/*  Derived, user-facing scores (0..100, higher = better)              */
/*  These are OUR composites of literature-based measures (weights   */
/*  and cut-offs are ours) — not validated clinical scores.          */
/* ------------------------------------------------------------------ */

export const SCORE_NOTE =
  "Composite score: our weighted combination of literature-based measures, for tracking change over time. Not a validated clinical or attractiveness scale, and not a population percentile.";

export type ScoreKey = "skin" | "leanness" | "rested" | "symmetry" | "harmony" | "body" | "posture" | "core";

export const SCORE_LABEL: Record<ScoreKey, string> = {
  skin: "Skin quality",
  leanness: "Facial leanness",
  rested: "Rested look",
  symmetry: "Symmetry",
  harmony: "Proportional harmony",
  body: "Body composition & shape",
  posture: "Posture",
  core: "Core & waist",
};

/** Which scores habits can change. Bone-driven scores stay fixed in projections. */
export const MODIFIABLE: Record<ScoreKey, boolean> = {
  skin: true,
  leanness: true,
  rested: true,
  symmetry: false,
  harmony: false,
  body: true,
  posture: true,
  core: true,
};

export function regionOf(face: FaceResult, key: SkinRegionKey) {
  return face.skin.find((s) => s.key === key);
}

export function restedScore(face: FaceResult) {
  const ue = regionOf(face, "underEye");
  if (!ue) return 60;
  return clamp(100 - ue.coverage * 320 - Math.max(0, 70 - ue.evenness) * 0.6, 10, 98);
}

/** Facial leanness: prefers body-fat data when available, else facial adiposity. */
export function leannessScore(face: FaceResult | null, body: BodyMetrics | null, intake: Intake): number | null {
  const bf = body?.bodyFatEstimate;
  if (bf != null) {
    const ideal = intake.gender === "female" ? 21 : intake.gender === "male" ? 12 : 16;
    return clamp(100 - Math.max(0, bf - ideal) * 3.2 - Math.max(0, ideal - 6 - bf) * 4, 15, 98);
  }
  // close-range selfies narrow the face, so facial adiposity is not trustworthy there
  if (face && !face.capture?.closeRange) return clamp(100 - Math.max(0, face.metrics.adiposity - 30) * 1.2, 15, 98);
  return null;
}

/**
 * Proportional harmony: closeness to published averages, not neoclassical
 * canons (which fail in Saudi samples, Al-Sebaei 2015). Nose and mouth use
 * Saudi sex-specific means; eye spacing is left out until the mesh's eye
 * corners are validated against clinical canthi.
 */
export function harmonyScore(face: FaceResult, gender: string = "male") {
  const m = face.metrics;
  const female = gender === "female";
  return clamp(
    mean([
      closeness(m.midToLowerThird, 1, 0.12),
      closeness(m.noseWidthToIntercanthal, female ? 1.08 : 1.22, face.capture?.closeRange ? 0.3 : 0.18),
      closeness(m.mouthToNoseWidth, female ? 1.43 : 1.31, 0.2),
      closeness(m.lipChinRatio, 0.5, 0.1),
      m.averageness,
    ]),
    10,
    99,
  );
}

export function currentScores(scan: Scan, intake: Intake): Partial<Record<ScoreKey, number>> {
  const s: Partial<Record<ScoreKey, number>> = {};
  if (scan.face) {
    s.skin = scan.face.metrics.skinScore;
    s.rested = restedScore(scan.face);
    s.symmetry = scan.face.metrics.symmetry;
    s.harmony = harmonyScore(scan.face, intake.gender);
  }
  const lean = leannessScore(scan.face, scan.body?.metrics ?? null, intake);
  if (lean != null) s.leanness = lean;
  if (scan.body) {
    s.body = clamp(scan.body.metrics.proportionScore * 0.5 + scan.body.metrics.compositionScore * 0.5);
    s.posture = scan.body.metrics.postureScore;
  }
  if (scan.bodySide) {
    const side = scan.bodySide.metrics;
    s.posture = s.posture != null ? (s.posture + side.postureScore) / 2 : side.postureScore;
    s.core = side.coreScore;
  }
  return s;
}

const WEIGHTS: Record<ScoreKey, number> = {
  skin: 1.2,
  leanness: 1.2,
  rested: 0.8,
  symmetry: 0.8,
  harmony: 1,
  body: 1,
  posture: 0.6,
  core: 0.8,
};

export function overall(scores: Partial<Record<ScoreKey, number>>) {
  let w = 0, t = 0;
  for (const [k, v] of Object.entries(scores) as [ScoreKey, number][]) {
    w += WEIGHTS[k];
    t += WEIGHTS[k] * v;
  }
  return w ? t / w : 0;
}

export function band(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 72) return "Good";
  // fixed cut-offs on our own scale, not population percentiles — so no "average" wording
  if (score >= 58) return "Fair";
  if (score >= 45) return "Developing";
  return "Needs work";
}

/* ------------------------------------------------------------------ */
/*  First-impression trait indices (0..1 on a bipolar axis)            */
/* ------------------------------------------------------------------ */

export interface Trait {
  key: string;
  name: string;
  value: number; // 0..1
  axis: [string, string, string];
  features: string[];
  text: string;
}

export function traits(face: FaceResult): Trait[] {
  const m = face.metrics;
  const trust = sigmoid(m.mouthCornerTilt / 3 + (m.symmetry - 80) / 15 + (m.browEyeDistance - 0.75) / 0.15);
  const open = sigmoid((m.eyeAspect - 0.32) / 0.04 + (m.browEyeDistance - 0.75) / 0.2);
  const dominance = sigmoid((m.fWHR - 1.85) / 0.12 + (m.jawToFaceWidth - 0.8) / 0.05 - (m.browEyeDistance - 0.75) / 0.2);
  const conf = sigmoid((m.symmetry - 80) / 12 + (m.canthalTilt - 2) / 4 + (dominance - 0.5) * 1.5);
  const pct = (v: number) => (v > 0.62 ? "toward the upper end" : v < 0.38 ? "toward the lower end" : "in the middle");
  return [
    {
      key: "trust",
      name: "Trust index",
      value: trust,
      axis: ["Guarded", "Neutral", "Warm"],
      features: ["Mouth corners", "Symmetry", "Brow height"],
      text: `Trustworthiness judgements lean on upturned mouth corners, symmetry and relaxed brows. Your face reads ${pct(trust)} of the range; smiling faces are rated more sincere and sociable (Reis 1990). This index is our own combination of these cues.`,
    },
    {
      key: "openness",
      name: "Openness index",
      value: open,
      axis: ["Reserved", "Neutral", "Open"],
      features: ["Eyes", "Lids", "Brows"],
      text: `This index is our own combination of eye openness and brow-to-lid distance. Yours sits ${pct(open)}. Sleep loss makes eyelids look more hanging and eyes more swollen (Sundelin 2013), so rest can open up the eye area.`,
    },
    {
      key: "confidence",
      name: "Confidence index",
      value: conf,
      axis: ["Hesitant", "Neutral", "Assured"],
      features: ["Symmetry", "Canthal tilt", "Structure"],
      text: `This index is our own combination of symmetry, eye-shape and structure cues; it has not been validated against how confident people are rated. Your face reads ${pct(conf)}.`,
    },
    {
      key: "dominance",
      name: "Dominance index",
      value: dominance,
      axis: ["Soft", "Balanced", "Dominant"],
      features: ["fWHR", "Jaw", "Brow depth"],
      text: `Higher facial width-to-height ratio is reliably perceived as more dominant (Geniole 2015 meta-analysis); this index also adds jaw width and brow height (our combination). Yours sits ${pct(dominance)}.`,
    },
  ];
}

export function impressionWords(t: Trait[]): { word: string; on: boolean }[] {
  const v = Object.fromEntries(t.map((x) => [x.key, x.value]));
  return [
    { word: "Soft", on: v.dominance < 0.4 },
    { word: "Strong", on: v.dominance > 0.55 },
    { word: "Balanced", on: Math.abs(v.dominance - 0.5) < 0.15 },
    { word: "Serious", on: v.trust < 0.4 },
    { word: "Warm", on: v.trust > 0.6 },
    { word: "Open", on: v.openness > 0.6 },
    { word: "Intense", on: v.openness < 0.4 },
    { word: "Assured", on: v.confidence > 0.6 },
  ];
}
