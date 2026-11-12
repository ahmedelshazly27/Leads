import { makeFrame } from "../../lib/faceAnalysis";
import { frontalMarkers, type MarkerValue } from "../../lib/markers/frontal";
import { place, type Status } from "../../lib/markers/norms";
import { sigmoid } from "../../lib/geometry";
import { harmonyScore, regionOf } from "../../lib/report";
import type { FaceResult, FaceView, Gender, Intake, Scan } from "../../lib/types";

/*
 * Data helpers for the printable report. Labels and cut-points mirror the
 * in-app analysis pages (src/pages/analysis/*) so the PDF never disagrees with
 * the app. Keep them in sync when those pages change.
 */

/* ------------------------------------------------------------------ */
/*  Marker catalogue (mirrors analysis/AllMarkers.tsx)                 */
/* ------------------------------------------------------------------ */

export interface MarkerRow {
  id: string;
  region: string;
  name: string;
  definition?: string;
  photo?: string;
  formula?: string;
  normMale?: string;
  normFemale?: string;
  norms?: string;
  ethnicNorms?: string;
  perception?: string;
  sources?: string;
  methodKind: "auto" | "semi" | "review";
  catalogue: "frontal" | "profile" | "skin";
}

export const REGION_ORDER = ["proportions", "eyes", "eyebrows", "nose", "lips", "cheeks", "jaw & chin", "ears", "profile", "neck", "smile", "45° view", "skin", "eye appearance", "global constructs"];
export const REGION_LABEL: Record<string, string> = {
  proportions: "Proportions",
  eyes: "Eyes",
  eyebrows: "Eyebrows",
  nose: "Nose",
  lips: "Lips & mouth",
  cheeks: "Cheeks & midface",
  "jaw & chin": "Jaw & chin",
  ears: "Ears",
  profile: "Side profile",
  neck: "Neck",
  smile: "Smile",
  "45° view": "Three-quarter view",
  skin: "Skin",
  "eye appearance": "Eye appearance",
  "global constructs": "Overall impressions",
};

export type MarkerState = "measured" | "photo" | "covered" | "review" | "soon";
export const STATE_LABEL: Record<MarkerState, string> = {
  measured: "Measured",
  photo: "Needs a photo",
  covered: "Hidden by facial hair",
  review: "Reviewer grade",
  soon: "In development",
};
export const STATE_NOTE: Record<MarkerState, string> = {
  measured: "Computed from your photos",
  photo: "Needs the profile, 45° or smile photo",
  covered: "A beard or moustache covers the skin outline",
  review: "Judged by a person against published scales",
  soon: "Automatable, not yet built",
};

export function needsView(photo = ""): FaceView | null {
  const p = photo.toLowerCase();
  if (p.includes("45") || p.includes("three-quarter") || p.includes("oblique")) return "face45";
  if (p.includes("profile")) return "faceLeft";
  if (p.includes("smile")) return "smile";
  if (p.includes("frown")) return "frown";
  if (p.includes("raise")) return "browRaise";
  return null;
}
export const VIEW_NEED_LABEL: Record<FaceView, string> = {
  faceLeft: "profile photo",
  faceRight: "profile photo",
  face45: "45° photo",
  smile: "smile photo",
  frown: "frown photo",
  browRaise: "raised-brow photo",
};

export const fmtMarker = (v: MarkerValue) => {
  if (v.text) return v.text;
  const n = v.unit === "ratio" ? v.value.toFixed(2) : v.value.toFixed(1);
  return v.unit === "ratio" || v.unit === "index" ? n : v.unit === "°" ? `${n}°` : `${n} ${v.unit}`;
};
export const PLACE_LABEL: Record<Status, string> = { typical: "Typical", above: "Above typical", below: "Below typical", reference: "Reference", none: "No norm" };

/** All marker values computed for a scan (frontal from landmarks, plus profile and smile). */
export function markerValues(scan: Scan): Record<string, MarkerValue> {
  const f = scan.face;
  const prof = { ...(scan.profileFace?.markers ?? {}), ...(scan.smileFace?.markers ?? {}) } as Record<string, MarkerValue>;
  if (!f?.landmarks) return { ...prof };
  const P = makeFrame(f.landmarks, f.imageAspect * 1000, 1000).P;
  const out = frontalMarkers(P);
  out["eye-canthal-tilt"] = { value: f.metrics.canthalTilt, unit: "°" };
  out["gen-symmetry"] = { value: f.metrics.symmetry, unit: "index", text: `${Math.round(f.metrics.symmetry)}/100` };
  out["gen-iris-mm-scale"] = { value: 11.7, unit: "mm", text: "In use · iris taken as 11.7 mm" };
  return { ...out, ...prof };
}

export interface MarkerEntry {
  r: MarkerRow;
  state: MarkerState;
  value?: MarkerValue;
  placed?: ReturnType<typeof place>;
  grade?: string;
  view: FaceView | null;
}

export function markerEntries(rows: MarkerRow[], scan: Scan, sex: Gender): MarkerEntry[] {
  const values = markerValues(scan);
  const views = new Set<FaceView>(scan.views ?? []);
  return rows.map((r) => {
    const v = needsView(r.photo);
    const value = values[r.id];
    let state: MarkerState;
    if (value) state = "measured";
    else if (v && !views.has(v)) state = "photo";
    else if (v === "faceLeft" && scan.profileFace?.flags.beard && r.catalogue === "profile" && r.methodKind === "auto") state = "covered";
    else if (r.methodKind === "review") state = "review";
    else state = "soon";
    return { r, state, value, view: v, placed: value ? place(r.id, value.value, sex) : undefined, grade: scan.markerGrades?.[r.id] };
  });
}

export const normText = (r: MarkerRow, sex: Gender) => (sex === "female" ? r.normFemale ?? r.norms : r.normMale ?? r.norms);

/* ------------------------------------------------------------------ */
/*  Face labels (mirror analysis/Features.tsx, Eyebrows.tsx,           */
/*  Assessments.tsx)                                                   */
/* ------------------------------------------------------------------ */

type M = FaceResult["metrics"];
export const eyeType = (m: M) => (m.canthalTilt > 4 ? "Positive canthal tilt" : m.canthalTilt > 0.5 ? "Mild positive tilt" : m.canthalTilt > -2 ? "Neutral tilt" : "Negative canthal tilt");
export const noseType = (m: M) => (m.noseWidthToIntercanthal > 1.2 ? "Wide base" : m.noseWidthToIntercanthal < 0.92 ? "Narrow base" : "Balanced width");
export const lipType = (m: M) => (m.lipFullness > 0.38 ? "Full lips" : m.lipFullness > 0.29 ? "Medium fullness" : "Thin lips");
export const cheekType = (m: M) => (m.adiposity < 35 ? "Defined cheekbones" : m.adiposity < 55 ? "Soft definition" : "Full cheeks");
export const jawType = (m: M) => (m.jawToFaceWidth > 0.86 ? "Broad jaw" : m.jawToFaceWidth > 0.77 ? "Moderate jaw" : "Tapered jaw");
export const chinType = (m: M) => (m.chinWidthToMouth > 0.62 ? "Broad chin" : m.chinWidthToMouth > 0.44 ? "Balanced chin" : "Narrow chin");
export function browType(arch: number) {
  if (arch > 0.19) return "High arch";
  if (arch > 0.13) return "Arched";
  if (arch > 0.08) return "Soft arch";
  return "Straight";
}
export const typicalLabel = (v: number) => (v >= 82 ? "Very typical" : v >= 68 ? "Quite typical" : v >= 52 ? "Moderately distinctive" : "Distinctive");
export const symmetryLabel = (v: number) => (v >= 88 ? "Highly symmetric" : v >= 78 ? "Quite symmetric" : v >= 65 ? "Moderately symmetric" : "Noticeably asymmetric");
export const neotenyLabel = (v: number) => (v >= 75 ? "Very youthful" : v >= 58 ? "Youthful" : v >= 42 ? "Balanced" : "Mature");
export const adiposityLabel = (v: number) => (v >= 60 ? "Full" : v >= 42 ? "Moderate" : v >= 28 ? "Lean" : "Very lean");
export const contrastLabel = (v: number) => (v >= 75 ? "High contrast" : v >= 50 ? "Moderate contrast" : "Low contrast");
export function dimorphismLabel(d: number, gender: Gender) {
  return gender === "female"
    ? d < 0.3 ? "Strongly feminine" : d < 0.45 ? "Typically feminine" : d < 0.6 ? "Balanced" : "Stronger than typical for women"
    : d > 0.7 ? "Strongly masculine" : d > 0.55 ? "Typically masculine" : d > 0.4 ? "Balanced" : "Softer than typical for men";
}
export const dimorphismCues = (m: M) => [
  { name: "Jaw width", value: m.jawToFaceWidth.toFixed(2), masc: m.jawToFaceWidth > 0.8 },
  { name: "Brow-to-eye distance", value: m.browEyeDistance.toFixed(2), masc: m.browEyeDistance < 0.75 },
  { name: "Facial width (fWHR)", value: m.fWHR.toFixed(2), masc: m.fWHR > 1.9 },
  { name: "Lip fullness", value: m.lipFullness.toFixed(2), masc: m.lipFullness < 0.3 },
  { name: "Eye openness", value: m.eyeAspect.toFixed(2), masc: m.eyeAspect < 0.33 },
];

/** Population means used by the averageness score (mirrors Assessments.tsx). */
export const AVG_NORMS: { key: keyof M; label: string; mean: number; sd: number }[] = [
  { key: "faceWHR", label: "Face width-to-height", mean: 0.86, sd: 0.06 },
  { key: "midToLowerThird", label: "Middle-to-lower third", mean: 0.95, sd: 0.09 },
  { key: "lipChinRatio", label: "Lip-to-chin height", mean: 0.5, sd: 0.08 },
  { key: "eyeSpacingRatio", label: "Eye spacing", mean: 1.08, sd: 0.1 },
  { key: "eyeWidthToFace", label: "Eye width", mean: 0.205, sd: 0.016 },
  { key: "noseWidthToIntercanthal", label: "Nose width", mean: 1.05, sd: 0.12 },
  { key: "mouthToNoseWidth", label: "Mouth-to-nose width", mean: 1.45, sd: 0.15 },
  { key: "lipRatio", label: "Upper-to-lower lip", mean: 0.72, sd: 0.18 },
  { key: "jawToFaceWidth", label: "Jaw width", mean: 0.8, sd: 0.06 },
  { key: "foreheadToFaceWidth", label: "Forehead width", mean: 0.82, sd: 0.06 },
];

/** Classical proportion ratios (mirrors Assessments.tsx RATIOS). */
export const RATIOS: { key: keyof M; label: string; norm: number; lo: number; hi: number; labels: [string, string, string]; note: string }[] = [
  { key: "midToLowerThird", label: "Middle : lower third", norm: 1, lo: 0.75, hi: 1.25, labels: ["Long lower", "Equal", "Long middle"], note: "Classical canon: equal thirds" },
  { key: "lipChinRatio", label: "Upper lip : chin height", norm: 0.5, lo: 0.3, hi: 0.7, labels: ["Short lip", "1 : 2", "Long lip"], note: "Ideal ≈ 1 : 2" },
  { key: "eyeSpacingRatio", label: "Eye spacing : eye width", norm: 1.05, lo: 0.8, hi: 1.3, labels: ["Close-set", "≈ 1 eye", "Wide-set"], note: "Classical canon ≈ 1; in Saudi adults the eye is usually wider than the gap" },
  { key: "eyeWidthToFace", label: "Eye width : face width", norm: 0.205, lo: 0.17, hi: 0.24, labels: ["Small", "≈ 1/5", "Large"], note: "Rule of fifths ≈ 0.2" },
  { key: "noseWidthToIntercanthal", label: "Nose : eye spacing", norm: 1.05, lo: 0.8, hi: 1.4, labels: ["Narrow", "≈ 1", "Wide"], note: "Canon ≈ 1; Saudi averages 1.22 men, 1.08 women" },
  { key: "mouthToNoseWidth", label: "Mouth : nose width", norm: 1.5, lo: 1.1, hi: 1.9, labels: ["Narrow", "≈ 1.5", "Wide"], note: "Neoclassical ≈ 1.5" },
];

export const SHAPE_TEXT: Record<FaceResult["faceShape"], string> = {
  Oval: "Length slightly exceeds width, with a forehead a little wider than the jaw and softly rounded contours. Oval faces suit most hairstyles.",
  Round: "Width and length are similar with soft, curved contours. Height on top and tidier sides visually lengthen the face.",
  Square: "A broad, angular jaw roughly as wide as the cheekbones. Softer textures on top balance the strong jaw line.",
  Heart: "A wider forehead and cheekbones tapering to a narrower chin. Some volume at jaw level (beard or hair length) balances the taper.",
  Oblong: "Length clearly exceeds width with fairly straight sides. Keeping some width at the sides and avoiding extra height balances length.",
  Diamond: "Cheekbones are the widest point, with a narrower forehead and jaw. Fringe or fuller sides at the temples balance the cheekbones.",
};

/** Feature-summary rows (mirrors Features.tsx FeaturesSummary). */
export function featureRows(m: M) {
  const fmt = (n: number, d = 2) => n.toFixed(d);
  const deg = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}°`;
  return [
    { name: "Canthal tilt", v: deg(m.canthalTilt), norm: "Varies by ethnicity", ok: m.canthalTilt >= -2 },
    { name: "Eye spacing : eye width", v: fmt(m.eyeSpacingRatio), norm: "≈ 1.0", ok: Math.abs(m.eyeSpacingRatio - 1.05) < 0.15 },
    { name: "Nose : intercanthal width", v: fmt(m.noseWidthToIntercanthal), norm: "≈ 1.0", ok: Math.abs(m.noseWidthToIntercanthal - 1.05) < 0.15 },
    { name: "Mouth : nose width", v: fmt(m.mouthToNoseWidth), norm: "≈ 1.5", ok: Math.abs(m.mouthToNoseWidth - 1.5) < 0.2 },
    { name: "Upper : lower lip", v: fmt(m.lipRatio), norm: "≈ 0.5–0.95", ok: m.lipRatio > 0.45 && m.lipRatio < 0.95 },
    { name: "Upper lip : chin", v: fmt(m.lipChinRatio), norm: "≈ 0.5", ok: Math.abs(m.lipChinRatio - 0.5) < 0.1 },
    { name: "Middle : lower third", v: fmt(m.midToLowerThird), norm: "≈ 1.0", ok: Math.abs(m.midToLowerThird - 1) < 0.12 },
    { name: "Jaw : cheek width", v: fmt(m.jawToFaceWidth), norm: "0.75–0.85", ok: m.jawToFaceWidth > 0.74 && m.jawToFaceWidth < 0.88 },
    { name: "fWHR", v: fmt(m.fWHR), norm: "1.7–2.1", ok: m.fWHR > 1.7 && m.fWHR < 2.1 },
    { name: "Symmetry", v: `${Math.round(m.symmetry)}/100`, norm: "> 80", ok: m.symmetry > 80 },
  ];
}

export const SKIN_LABEL = { forehead: "Forehead", leftCheek: "Left cheek", rightCheek: "Right cheek", nose: "Nose", underEye: "Under-eye", chin: "Chin" } as const;
export const SKIN_ORDER = ["leftCheek", "rightCheek", "forehead", "nose", "underEye", "chin"] as const;
export const skinLevel = (pct: number) => (pct < 3 ? "Minimal" : pct < 7 ? "Mild" : pct < 14 ? "Moderate" : "Marked");

export { harmonyScore, regionOf };

/* ------------------------------------------------------------------ */
/*  Body (mirrors analysis/BodyDetail.tsx, Body.tsx)                   */
/* ------------------------------------------------------------------ */

export function bmiBand(b: number) {
  if (b < 18.5) return "Underweight (WHO)";
  if (b < 25) return "Healthy range (WHO)";
  if (b < 30) return "Overweight (WHO)";
  return "Obesity (WHO)";
}

export function physique(scan: Scan, intake: Intake) {
  const m = scan.body!.metrics;
  const side = scan.bodySide?.metrics ?? null;
  const female = intake.gender === "female";
  const swrRef = female ? 1.35 : 1.5;
  const strength = sigmoid((m.shoulderToWaist - swrRef) / 0.08 + (m.armToShoulder - 0.21) / 0.02);
  const leanness = side ? sigmoid(-(side.waistToChestDepth - 0.88) / 0.05 - (side.bellyProtrusion - 2) / 3) : sigmoid(-(m.waistWidth / m.shoulderWidth - 0.66) / 0.04);
  const postureV = (side ? (side.postureScore + m.postureScore) / 2 : m.postureScore) / 100;
  return { strength, leanness, postureV };
}

export const bodySymmetryScore = (lrBalance: number) => Math.max(0, Math.min(100, 100 - lrBalance * 6));

export function headLabel(headForward: number) {
  return headForward <= 5 ? "Stacked over shoulder" : headForward <= 10 ? "Slightly forward" : headForward <= 18 ? "Forward" : "Markedly forward";
}

export const tiltText = (d: number) => (Math.abs(d) < 1.5 ? "Level" : `${Math.abs(d).toFixed(1)}° ${d > 0 ? "right side lower" : "left side lower"}`);
