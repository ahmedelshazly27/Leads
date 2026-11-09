import type { EvidenceGrade } from "./science";
import type { BodyMetrics, FaceResult, Intake, SideMetrics } from "./types";

/*
 * Feature library: every hair type, eye shape, brow, nose, lip, jaw, skin and
 * body type the platform names, with a definition, how we decide which one
 * you are, and the sources.
 *
 * Rules for this file:
 * - Cut-points for measured types are the SAME ones the report pages use
 *   (Features.tsx, Eyebrows.tsx, faceAnalysis.classifyFaceShape, plan.ts).
 *   Change them together.
 * - Types are descriptive, not grades. No type is "better"; "reads" lines only
 *   say what a cited study found.
 * - Anything a single frontal photo can't settle (eyelid crease, nose
 *   profile, hairline, chin projection, curl sub-type) is decided by the
 *   client or confirmed by the reviewer.
 */

export type Region = "face" | "eyes" | "brows" | "nose" | "lips" | "jaw" | "hair" | "facial-hair" | "skin" | "body";

export const REGIONS: { id: Region; label: string }[] = [
  { id: "face", label: "Face shape" },
  { id: "eyes", label: "Eyes" },
  { id: "brows", label: "Brows" },
  { id: "nose", label: "Nose" },
  { id: "lips", label: "Lips & mouth" },
  { id: "jaw", label: "Jaw & chin" },
  { id: "hair", label: "Hair" },
  { id: "facial-hair", label: "Facial hair" },
  { id: "skin", label: "Skin" },
  { id: "body", label: "Body" },
];

/** How a type is decided. */
export type Basis = "measured" | "you" | "reviewer";
export const BASIS_LABEL: Record<Basis, string> = {
  measured: "Measured from your photos",
  you: "From your answers",
  reviewer: "Set by your reviewer",
};

/** Parameters for the line drawing of each type (components/FeatureArt.tsx). */
export type Art =
  | { kind: "face"; shape: "oval" | "round" | "square" | "heart" | "oblong" | "diamond" }
  | { kind: "thirds"; mid: number; lower: number }
  | { kind: "eye"; h: number; tilt: number }
  | { kind: "spacing"; gap: number }
  | { kind: "lid"; lid: "double" | "hooded" | "mono" | "deep" }
  | { kind: "brow"; arch: number; peak: number; thick: number; lift?: number }
  | { kind: "nose"; w: number }
  | { kind: "profile"; dorsum: "straight" | "convex" | "concave"; tip: "level" | "up" | "down" }
  | { kind: "lips"; upper: number; lower: number; corner?: number }
  | { kind: "jaw"; jaw: number; chin: number }
  | { kind: "chin"; proj: number }
  | { kind: "curl"; amp: number; freq: number; tight?: boolean }
  | { kind: "hairline"; line: "straight" | "rounded" | "peak" | "m" | "receding" }
  | { kind: "norwood"; stage: number }
  | { kind: "beard"; beard: "none" | "patchy" | "full" }
  | { kind: "swatch"; tone: number }
  | { kind: "torso"; shoulder: number; waist: number; hip: number }
  | { kind: "posture"; head: number; shoulder: number; lumbar: number };

export interface FeatureType {
  id: string;
  name: string;
  aka?: string;
  /** what this type looks like, plainly */
  definition: string;
  /** the rule we use, e.g. "eye height < 28% of eye width" */
  criteria?: string;
  /** cross-type family (hair texture) */
  family?: string;
  art: Art;
}

export interface FeatureCategory {
  id: string;
  region: Region;
  title: string;
  /** what the feature is */
  what: string;
  /** why it matters — only what the cited sources support */
  why: string;
  /** how we decide */
  how: string;
  basis: Basis;
  grade: EvidenceGrade;
  refs: string[];
  types: FeatureType[];
  /** what you can and can't change */
  change: string;
  /** shown under the category */
  note?: string;
  gender?: "male" | "female";
  /** measured or answered classification; returns a type id or family */
  classify?: (c: Ctx) => Match | null;
}

export interface Ctx {
  face?: FaceResult | null;
  body?: BodyMetrics | null;
  side?: SideMetrics | null;
  intake: Intake;
}

export interface Match {
  /** a type id, or a family for hair texture */
  typeId?: string;
  family?: string;
  /** the client's value, e.g. "0.30" */
  value?: string;
}

const f2 = (n: number) => n.toFixed(2);
const deg = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}°`;

export const LIBRARY: FeatureCategory[] = [
  /* ------------------------------ Face ------------------------------ */
  {
    id: "face-shape",
    region: "face",
    title: "Face shape",
    what: "The outline of the face, from the ratio of face width to length and the widths of forehead, cheekbones and jaw.",
    why: "Face shape is how barbers and stylists choose cuts and beards. It is a grooming convention, not a validated anthropometric class, so we show the ratios behind it.",
    how: "Width at the cheekbones ÷ face length, plus forehead and jaw width relative to the cheekbones, from the frontal mesh.",
    basis: "measured",
    grade: "C",
    refs: ["farkas1994", "mesko2004"],
    change: "Bone sets the shape. Fat loss can sharpen the lower outline, and hair and beard shape change how the outline reads.",
    types: [
      { id: "oval", name: "Oval", definition: "Longer than wide, cheekbones widest, forehead and jaw slightly narrower, rounded chin.", criteria: "Width ÷ length 0.78–0.92 with no dominant width", art: { kind: "face", shape: "oval" } },
      { id: "round", name: "Round", definition: "Width close to length, soft jaw angles, full cheeks.", criteria: "Width ÷ length > 0.92, jaw ≤ 86% of cheekbones", art: { kind: "face", shape: "round" } },
      { id: "square", name: "Square", definition: "Broad, angular jaw about as wide as the cheekbones; short, wide face.", criteria: "Jaw > 86% of cheekbones, width ÷ length > 0.84", art: { kind: "face", shape: "square" } },
      { id: "heart", name: "Heart", definition: "Wide forehead, tapering to a narrow jaw and pointed chin.", criteria: "Forehead ≥ jaw + 12% of cheekbone width", art: { kind: "face", shape: "heart" } },
      { id: "oblong", name: "Oblong", aka: "Long / rectangular", definition: "Clearly longer than wide, with similar forehead, cheek and jaw widths.", criteria: "Width ÷ length < 0.78", art: { kind: "face", shape: "oblong" } },
      { id: "diamond", name: "Diamond", definition: "Cheekbones widest; both forehead and jaw narrow.", criteria: "Forehead and jaw both < 78% of cheekbones", art: { kind: "face", shape: "diamond" } },
    ],
    classify: ({ face }) => (face ? { typeId: face.faceShape.toLowerCase(), value: `width ÷ length ${f2(face.metrics.faceWHR)}` } : null),
  },
  {
    id: "thirds",
    region: "face",
    title: "Facial thirds",
    what: "The face split vertically into hairline–brows, brows–nose base and nose base–chin.",
    why: "The classical canon is three equal thirds. Measured populations often differ from it, so it is a reference, not a target.",
    how: "Middle third (brow to nose base) ÷ lower third (nose base to chin) on the pose-corrected mesh. The upper third depends on the hairline, so it is not used.",
    basis: "measured",
    grade: "C",
    refs: ["farkas1994"],
    change: "Bone. A beard lengthens or shortens how the lower third reads; hair can visually shorten a long upper third.",
    types: [
      { id: "long-lower", name: "Longer lower third", definition: "Nose base to chin is longer than brows to nose base.", criteria: "Middle ÷ lower < 0.95", art: { kind: "thirds", mid: 0.9, lower: 1.1 } },
      { id: "balanced", name: "Balanced thirds", definition: "Middle and lower thirds within about 5% of each other.", criteria: "Middle ÷ lower 0.95–1.05", art: { kind: "thirds", mid: 1, lower: 1 } },
      { id: "long-middle", name: "Longer middle third", definition: "Brows to nose base is longer than nose base to chin.", criteria: "Middle ÷ lower > 1.05", art: { kind: "thirds", mid: 1.1, lower: 0.9 } },
    ],
    classify: ({ face }) => {
      if (!face) return null;
      const r = face.metrics.midToLowerThird;
      return { typeId: r < 0.95 ? "long-lower" : r > 1.05 ? "long-middle" : "balanced", value: f2(r) };
    },
  },

  /* ------------------------------ Eyes ------------------------------ */
  {
    id: "eye-shape",
    region: "eyes",
    title: "Eye shape",
    what: "The outline of the eye opening (palpebral fissure): how tall it is relative to how wide.",
    why: "How open the eyes look changes how rested a face looks: after sleep deprivation, faces were rated as having more hanging eyelids and more swollen eyes.",
    how: "Average eye height ÷ eye width across both eyes, from the mesh.",
    basis: "measured",
    grade: "B",
    refs: ["farkas1994", "sundelin2013"],
    change: "Bone and lid anatomy set the shape. Sleep, less puffiness and brow grooming change how open the eye looks.",
    types: [
      { id: "narrow", name: "Narrow", definition: "A long, low opening; the lids sit close to the iris.", criteria: "Height < 28% of width", art: { kind: "eye", h: 0.24, tilt: 0 } },
      { id: "almond", name: "Almond", definition: "Wider than tall, tapering at both corners; the iris touches or nearly touches both lids.", criteria: "Height 28–35% of width", art: { kind: "eye", h: 0.31, tilt: 0 } },
      { id: "round", name: "Round", definition: "A tall opening with visible white above or below the iris.", criteria: "Height > 35% of width", art: { kind: "eye", h: 0.4, tilt: 0 } },
    ],
    classify: ({ face }) => {
      if (!face) return null;
      const a = face.metrics.eyeAspect;
      return { typeId: a < 0.28 ? "narrow" : a < 0.35 ? "almond" : "round", value: `${(a * 100).toFixed(0)}%` };
    },
  },
  {
    id: "eye-tilt",
    region: "eyes",
    title: "Eye tilt (canthal tilt)",
    what: "The angle of the line from the inner to the outer eye corner.",
    why: "Norms differ by ethnicity: attractive composites had a steeper positive tilt than average in Caucasian and African faces, but a less steep one in Asian faces. There is no single ideal.",
    how: "Inner-to-outer corner angle on each eye after correcting head roll, averaged.",
    basis: "measured",
    grade: "B",
    refs: ["rhee2012"],
    change: "Set by bone. It is never a plan target.",
    types: [
      { id: "negative", name: "Downturned", aka: "Negative tilt", definition: "Outer corner lower than the inner corner.", criteria: "Below −2°", art: { kind: "eye", h: 0.31, tilt: -6 } },
      { id: "neutral", name: "Neutral", definition: "Corners roughly level.", criteria: "−2° to +0.5°", art: { kind: "eye", h: 0.31, tilt: 0 } },
      { id: "mild", name: "Mild upturn", definition: "Outer corner slightly higher.", criteria: "+0.5° to +4°", art: { kind: "eye", h: 0.31, tilt: 3 } },
      { id: "positive", name: "Upturned", aka: "Positive tilt", definition: "Outer corner clearly higher than the inner corner.", criteria: "Above +4°", art: { kind: "eye", h: 0.31, tilt: 8 } },
    ],
    classify: ({ face }) => {
      if (!face) return null;
      const t = face.metrics.canthalTilt;
      return { typeId: t > 4 ? "positive" : t > 0.5 ? "mild" : t > -2 ? "neutral" : "negative", value: deg(t) };
    },
  },
  {
    id: "eye-spacing",
    region: "eyes",
    title: "Eye spacing",
    what: "The gap between the inner eye corners compared with the width of one eye.",
    why: "The rule of fifths puts one eye-width between the eyes. Farkas' measurements show many attractive faces depart from it.",
    how: "Intercanthal distance ÷ average eye width.",
    basis: "measured",
    grade: "C",
    refs: ["farkas1994"],
    change: "Bone. Brow shape and the inner brow start point change how close-set or wide-set eyes read.",
    types: [
      { id: "close", name: "Close-set", definition: "Less than one eye-width between the eyes.", criteria: "Ratio < 0.95", art: { kind: "spacing", gap: 0.8 } },
      { id: "balanced", name: "Balanced", definition: "About one eye-width apart.", criteria: "0.95–1.18", art: { kind: "spacing", gap: 1.05 } },
      { id: "wide", name: "Wide-set", definition: "More than one eye-width apart.", criteria: "Ratio > 1.18", art: { kind: "spacing", gap: 1.35 } },
    ],
    classify: ({ face }) => {
      if (!face) return null;
      const r = face.metrics.eyeSpacingRatio;
      return { typeId: r < 0.95 ? "close" : r > 1.18 ? "wide" : "balanced", value: f2(r) };
    },
  },
  {
    id: "eyelid",
    region: "eyes",
    title: "Eyelid type",
    what: "Whether the upper lid has a visible fold (crease), and how much skin sits over it.",
    why: "A single or double lid is normal anatomy and depends on how the lid's lifting tissue attaches and where the fat sits; single lids are common in East Asian populations. Hanging lids were one of the cues people used to judge a face as tired.",
    how: "A frontal photo can't reliably separate a low crease from hooding, so your reviewer sets this from your photos.",
    basis: "reviewer",
    grade: "B",
    refs: ["saonanon2014", "sundelin2013"],
    change: "The crease is anatomy. Sleep, less puffiness and keeping brows from sitting low change how heavy the lid looks; lid surgery is a clinician's decision.",
    types: [
      { id: "double", name: "Double crease", definition: "A visible fold a few millimetres above the lashes, with lid skin showing below it.", art: { kind: "lid", lid: "double" } },
      { id: "hooded", name: "Hooded", definition: "A crease exists, but skin from above folds down over it and part of the lid.", art: { kind: "lid", lid: "hooded" } },
      { id: "mono", name: "Single lid", aka: "Monolid", definition: "No visible crease; the lid is smooth from lashes to brow.", art: { kind: "lid", lid: "mono" } },
      { id: "deep", name: "Deep-set", definition: "The eye sits back under a prominent brow bone, so the lid is in shadow.", art: { kind: "lid", lid: "deep" } },
    ],
  },

  /* ------------------------------ Brows ------------------------------ */
  {
    id: "brow-shape",
    region: "brows",
    title: "Brow shape",
    what: "How much the brow rises to its highest point (the arch).",
    why: "Brows carry a lot of facial identity: removing them from famous faces hurt recognition more than removing the eyes.",
    how: "Arch height ÷ brow length, from the brow landmarks.",
    basis: "measured",
    grade: "B",
    refs: ["sadr2003"],
    change: "Grooming changes the arch within limits: remove strays under the arch, never lift by thinning the top edge.",
    types: [
      { id: "straight", name: "Straight", definition: "Almost flat from start to tail.", criteria: "Arch < 8% of length", art: { kind: "brow", arch: 0.04, peak: 0.6, thick: 0.13 } },
      { id: "soft", name: "Soft arch", definition: "A gentle, low rise.", criteria: "8–13%", art: { kind: "brow", arch: 0.1, peak: 0.62, thick: 0.13 } },
      { id: "arched", name: "Arched", definition: "A clear rise to a defined peak.", criteria: "13–19%", art: { kind: "brow", arch: 0.16, peak: 0.65, thick: 0.12 } },
      { id: "high", name: "High arch", definition: "A steep rise to a high, sharp peak.", criteria: "Over 19%", art: { kind: "brow", arch: 0.23, peak: 0.66, thick: 0.11 } },
    ],
    classify: ({ face }) => {
      if (!face) return null;
      const a = face.metrics.browArch;
      return { typeId: a > 0.19 ? "high" : a > 0.13 ? "arched" : a > 0.08 ? "soft" : "straight", value: `${(a * 100).toFixed(0)}%` };
    },
  },
  {
    id: "brow-thickness",
    region: "brows",
    title: "Brow thickness",
    what: "How thick the brow is relative to its length.",
    why: "Brow-to-skin contrast is part of the facial contrast that differs between the sexes; fuller, darker brows raise it.",
    how: "Average brow thickness ÷ brow length.",
    basis: "measured",
    grade: "B",
    refs: ["russell2009"],
    change: "Let brows grow in 6–8 weeks before shaping; tinting or a brow pencil adds density.",
    types: [
      { id: "fine", name: "Fine", definition: "A thin line.", criteria: "Under 10% of length", art: { kind: "brow", arch: 0.1, peak: 0.62, thick: 0.07 } },
      { id: "even", name: "Even", definition: "Medium thickness along most of the brow.", criteria: "10–17%", art: { kind: "brow", arch: 0.1, peak: 0.62, thick: 0.13 } },
      { id: "full", name: "Full", definition: "A thick, dense brow.", criteria: "Over 17%", art: { kind: "brow", arch: 0.1, peak: 0.62, thick: 0.2 } },
    ],
    classify: ({ face }) => {
      if (!face) return null;
      const t = face.metrics.browThickness;
      return { typeId: t > 0.17 ? "full" : t > 0.1 ? "even" : "fine", value: `${(t * 100).toFixed(0)}%` };
    },
  },
  {
    id: "brow-position",
    region: "brows",
    title: "Brow position",
    what: "How high the brow sits above the eye.",
    why: "Brow-to-eye distance differs on average between male and female faces: lower brows are the more male-typical pattern.",
    how: "Brow-to-lid distance ÷ eye width.",
    basis: "measured",
    grade: "C",
    refs: ["farkas1994"],
    change: "Bone and soft tissue. Shaping the underside changes it by a millimetre or two at most.",
    types: [
      { id: "low", name: "Low-set", definition: "Brow close to the lid.", criteria: "Under 42% of eye width", art: { kind: "brow", arch: 0.08, peak: 0.62, thick: 0.15, lift: -0.4 } },
      { id: "mid", name: "Moderately set", definition: "A middle position.", criteria: "42–62%", art: { kind: "brow", arch: 0.08, peak: 0.62, thick: 0.15, lift: 0 } },
      { id: "high", name: "High-set", definition: "A clear gap of lid skin under the brow.", criteria: "Over 62%", art: { kind: "brow", arch: 0.08, peak: 0.62, thick: 0.15, lift: 0.4 } },
    ],
    classify: ({ face }) => {
      if (!face) return null;
      const r = face.metrics.browEyeDistance;
      return { typeId: r < 0.42 ? "low" : r > 0.62 ? "high" : "mid", value: f2(r) };
    },
  },

  /* ------------------------------ Nose ------------------------------ */
  {
    id: "nose-width",
    region: "nose",
    title: "Nose width",
    what: "The width of the nose at the nostrils compared with the gap between the eyes.",
    why: "The anthropometric canon puts nose width equal to the intercanthal distance. It varies widely by ancestry. The classical nasal index (narrow, medium, broad) also needs nose height in millimetres, which a ratio photo can't give.",
    how: "Alar (nostril) width ÷ intercanthal distance.",
    basis: "measured",
    grade: "C",
    refs: ["farkas1994"],
    change: "Cartilage and bone; there is no habit-based change. Close-range selfies widen it, so we flag those photos.",
    types: [
      { id: "narrow", name: "Narrow base", definition: "Nostrils narrower than the gap between the eyes.", criteria: "Under 0.92", art: { kind: "nose", w: 0.8 } },
      { id: "balanced", name: "Balanced width", definition: "About as wide as the gap between the eyes.", criteria: "0.92–1.20", art: { kind: "nose", w: 1 } },
      { id: "wide", name: "Wide base", definition: "Nostrils wider than the gap between the eyes.", criteria: "Over 1.20", art: { kind: "nose", w: 1.3 } },
    ],
    classify: ({ face }) => {
      if (!face) return null;
      const r = face.metrics.noseWidthToIntercanthal;
      return { typeId: r > 1.2 ? "wide" : r < 0.92 ? "narrow" : "balanced", value: f2(r) };
    },
  },
  {
    id: "nose-profile",
    region: "nose",
    title: "Nose profile",
    what: "The line of the bridge (dorsum) and the direction of the tip, seen from the side.",
    why: "Descriptive only: these are the terms clinicians and stylists use. No profile is better.",
    how: "Read by your reviewer from a side photo.",
    basis: "reviewer",
    grade: "C",
    refs: ["farkas1994"],
    change: "Structural. Only a clinician can change it; we never recommend it.",
    types: [
      { id: "straight", name: "Straight", definition: "The bridge runs in a straight line to the tip.", art: { kind: "profile", dorsum: "straight", tip: "level" } },
      { id: "convex", name: "Convex", aka: "Dorsal hump", definition: "The bridge curves outward in the middle.", art: { kind: "profile", dorsum: "convex", tip: "level" } },
      { id: "concave", name: "Concave", aka: "Scooped", definition: "The bridge dips inward before the tip.", art: { kind: "profile", dorsum: "concave", tip: "up" } },
      { id: "up", name: "Upturned tip", definition: "The tip points up, showing more nostril from the front.", art: { kind: "profile", dorsum: "straight", tip: "up" } },
      { id: "down", name: "Downturned tip", definition: "The tip points down toward the lip.", art: { kind: "profile", dorsum: "convex", tip: "down" } },
    ],
  },

  /* ------------------------------ Lips ------------------------------ */
  {
    id: "lip-fullness",
    region: "lips",
    title: "Lip fullness",
    what: "Total lip height compared with mouth width.",
    why: "Lip fullness is one of the shape features that differ on average between male and female faces.",
    how: "Upper + lower vermilion height ÷ mouth width, lips closed.",
    basis: "measured",
    grade: "C",
    refs: ["farkas1994"],
    change: "Soft tissue. Hydration and SPF lip balm protect the vermilion; filler is a clinician's decision and never part of our plan.",
    types: [
      { id: "thin", name: "Thin", definition: "Narrow vermilion on both lips.", criteria: "Under 29% of mouth width", art: { kind: "lips", upper: 0.09, lower: 0.15 } },
      { id: "medium", name: "Medium", definition: "Moderate height on both lips.", criteria: "29–38%", art: { kind: "lips", upper: 0.13, lower: 0.2 } },
      { id: "full", name: "Full", definition: "Tall vermilion, often with a defined lip border.", criteria: "Over 38%", art: { kind: "lips", upper: 0.17, lower: 0.26 } },
    ],
    classify: ({ face }) => {
      if (!face) return null;
      const r = face.metrics.lipFullness;
      return { typeId: r > 0.38 ? "full" : r > 0.29 ? "medium" : "thin", value: `${(r * 100).toFixed(0)}%` };
    },
  },
  {
    id: "lip-balance",
    region: "lips",
    title: "Lip balance",
    what: "The height of the upper lip compared with the lower lip.",
    why: "In a quantitative study of female faces, an upper-to-lower ratio near 1 : 2 was rated most attractive.",
    how: "Upper vermilion height ÷ lower vermilion height.",
    basis: "measured",
    grade: "B",
    refs: ["popenko2017"],
    change: "Soft tissue; not a plan target.",
    types: [
      { id: "lower-led", name: "Lower-led", definition: "Lower lip about twice the upper.", criteria: "Under 0.62", art: { kind: "lips", upper: 0.1, lower: 0.22 } },
      { id: "moderate", name: "Moderately lower-led", definition: "Lower lip clearly fuller than the upper.", criteria: "0.62–0.85", art: { kind: "lips", upper: 0.13, lower: 0.19 } },
      { id: "even", name: "Even", definition: "Both lips about the same height.", criteria: "0.85–1.15", art: { kind: "lips", upper: 0.16, lower: 0.16 } },
      { id: "upper-led", name: "Upper-led", definition: "Upper lip taller than the lower.", criteria: "Over 1.15", art: { kind: "lips", upper: 0.19, lower: 0.14 } },
    ],
    classify: ({ face }) => {
      if (!face) return null;
      const r = face.metrics.lipRatio;
      return { typeId: r < 0.62 ? "lower-led" : r < 0.85 ? "moderate" : r <= 1.15 ? "even" : "upper-led", value: f2(r) };
    },
  },
  {
    id: "mouth-corners",
    region: "lips",
    title: "Mouth corners",
    what: "Whether the mouth corners sit above or below the centre of the lips at rest.",
    why: "Trustworthiness judgements of neutral faces track subtle resemblance to happy versus angry expressions, so resting mouth corners affect first impressions.",
    how: "Angle of the corners relative to the lip centre line, mouth relaxed.",
    basis: "measured",
    grade: "B",
    refs: ["oosterhof2008"],
    change: "Partly expression. A relaxed, slight smile in photos changes it most.",
    types: [
      { id: "down", name: "Downturned", definition: "Corners below the centre line.", criteria: "Below −1°", art: { kind: "lips", upper: 0.13, lower: 0.19, corner: -1 } },
      { id: "neutral", name: "Neutral", definition: "Corners level with the centre line.", criteria: "−1° to +1°", art: { kind: "lips", upper: 0.13, lower: 0.19, corner: 0 } },
      { id: "up", name: "Upturned", definition: "Corners above the centre line.", criteria: "Above +1°", art: { kind: "lips", upper: 0.13, lower: 0.19, corner: 1 } },
    ],
    classify: ({ face }) => {
      if (!face) return null;
      const t = face.metrics.mouthCornerTilt;
      return { typeId: t > 1 ? "up" : t < -1 ? "down" : "neutral", value: deg(t) };
    },
  },

  /* ------------------------------ Jaw & chin ------------------------------ */
  {
    id: "jaw-width",
    region: "jaw",
    title: "Jaw width",
    what: "The width of the jaw at its angles compared with the cheekbones.",
    why: "Jaw width is one of the shape features that differ on average between male and female faces. Facial fat hides the jaw outline, and losing it makes the outline more visible.",
    how: "Width at the jaw angles ÷ cheekbone width.",
    basis: "measured",
    grade: "B",
    refs: ["farkas1994", "coetzee2009"],
    change: "Bone sets width. Fat loss sharpens the outline; a beard can square or soften it.",
    types: [
      { id: "tapered", name: "Tapered", definition: "Jaw clearly narrower than the cheekbones.", criteria: "Under 77%", art: { kind: "jaw", jaw: 0.72, chin: 0.42 } },
      { id: "moderate", name: "Moderate", definition: "A typical adult jaw width.", criteria: "77–86%", art: { kind: "jaw", jaw: 0.82, chin: 0.5 } },
      { id: "broad", name: "Broad", definition: "Jaw nearly as wide as the cheekbones.", criteria: "Over 86%", art: { kind: "jaw", jaw: 0.92, chin: 0.6 } },
    ],
    classify: ({ face }) => {
      if (!face) return null;
      const r = face.metrics.jawToFaceWidth;
      return { typeId: r > 0.86 ? "broad" : r > 0.77 ? "moderate" : "tapered", value: `${(r * 100).toFixed(0)}%` };
    },
  },
  {
    id: "chin-width",
    region: "jaw",
    title: "Chin width",
    what: "The width of the chin compared with the mouth.",
    why: "Descriptive: chin width shapes the lower outline and how a beard should be cut.",
    how: "Chin width ÷ mouth width.",
    basis: "measured",
    grade: "C",
    refs: ["farkas1994"],
    change: "Bone. A beard shaped longer or squarer at the chin changes how it reads.",
    types: [
      { id: "narrow", name: "Narrow", definition: "A small, pointed chin.", criteria: "Under 44% of mouth width", art: { kind: "jaw", jaw: 0.82, chin: 0.36 } },
      { id: "balanced", name: "Balanced", definition: "A moderate, rounded chin.", criteria: "44–62%", art: { kind: "jaw", jaw: 0.82, chin: 0.5 } },
      { id: "broad", name: "Broad", definition: "A wide, flat-fronted chin.", criteria: "Over 62%", art: { kind: "jaw", jaw: 0.82, chin: 0.66 } },
    ],
    classify: ({ face }) => {
      if (!face) return null;
      const r = face.metrics.chinWidthToMouth;
      return { typeId: r > 0.62 ? "broad" : r > 0.44 ? "balanced" : "narrow", value: `${(r * 100).toFixed(0)}%` };
    },
  },
  {
    id: "chin-projection",
    region: "jaw",
    title: "Chin projection",
    what: "How far forward the chin sits relative to the lips, seen from the side.",
    why: "Descriptive. It decides whether a fuller beard at the chin helps balance the profile.",
    how: "Read by your reviewer from a side photo.",
    basis: "reviewer",
    grade: "C",
    refs: ["farkas1994"],
    change: "Bone. Beard length at the chin changes how the profile reads; structural change is a clinician's decision.",
    types: [
      { id: "retruded", name: "Set back", aka: "Retruded", definition: "The chin sits behind the lower lip.", art: { kind: "chin", proj: -1 } },
      { id: "balanced", name: "Balanced", definition: "The chin lines up roughly under the lower lip.", art: { kind: "chin", proj: 0 } },
      { id: "projected", name: "Forward", aka: "Projected", definition: "The chin sits ahead of the lower lip.", art: { kind: "chin", proj: 1 } },
    ],
  },

  /* ------------------------------ Hair ------------------------------ */
  {
    id: "hair-texture",
    region: "hair",
    title: "Hair texture and curl pattern",
    what: "How straight or curly each hair grows, from dead straight (1) to tight zig-zag coils (4C).",
    why: "A worldwide study measured curl directly (curve diameter, curl index, waves and twists) and found eight shape types on a continuum. The 1–4C letters are the stylists' version of the same continuum. Hairstyle alone changes how a face is judged, and a cut that fights your texture needs daily heat to hold.",
    how: "You choose the family when you sign up; your reviewer confirms the exact pattern from your photos.",
    basis: "you",
    grade: "B",
    refs: ["delamettrie2007", "mesko2004"],
    note: "Mapping to the eight measured types is approximate: 1 ≈ I, 2A–2B ≈ II–III, 2C–3A ≈ IV, 3B–3C ≈ V–VI, 4A–4C ≈ VII–VIII.",
    change: "Texture is genetic. Cut, product and drying method decide how it falls.",
    types: [
      { id: "1", family: "straight", name: "1 · Straight", definition: "No bend from root to tip; reflects light; can look flat at the root.", art: { kind: "curl", amp: 0, freq: 0 } },
      { id: "2a", family: "wavy", name: "2A · Loose wave", definition: "A slight, loose S-bend, mostly from mid-length.", art: { kind: "curl", amp: 3, freq: 1.2 } },
      { id: "2b", family: "wavy", name: "2B · Defined wave", definition: "A clear S-bend that starts nearer the root.", art: { kind: "curl", amp: 5, freq: 1.6 } },
      { id: "2c", family: "wavy", name: "2C · Strong wave", definition: "Deep S-waves, some forming loose loops; frizz-prone.", art: { kind: "curl", amp: 7, freq: 2 } },
      { id: "3a", family: "curly", name: "3A · Loose curl", definition: "Large springy loops about the width of a marker.", art: { kind: "curl", amp: 9, freq: 2.4 } },
      { id: "3b", family: "curly", name: "3B · Springy curl", definition: "Ringlets about the width of a finger.", art: { kind: "curl", amp: 10, freq: 3.2 } },
      { id: "3c", family: "curly", name: "3C · Tight curl", definition: "Dense corkscrews about the width of a pencil.", art: { kind: "curl", amp: 10, freq: 4.2 } },
      { id: "4a", family: "coily", name: "4A · Soft coil", definition: "Tight, defined S-coils; a lot of shrinkage.", art: { kind: "curl", amp: 9, freq: 5.5, tight: true } },
      { id: "4b", family: "coily", name: "4B · Z-pattern", definition: "Sharp zig-zag bends rather than curls; dense.", art: { kind: "curl", amp: 8, freq: 7, tight: true } },
      { id: "4c", family: "coily", name: "4C · Tight coil", definition: "Very tight zig-zag; little visible pattern; the most shrinkage.", art: { kind: "curl", amp: 7, freq: 9, tight: true } },
    ],
    classify: ({ intake }) => ({ family: intake.hairType }),
  },
  {
    id: "hairline",
    region: "hair",
    title: "Hairline shape",
    what: "The outline of the hair at the forehead and temples.",
    why: "A slightly higher 'mature' hairline at the temples develops in most men after their teens and is the first Norwood stage, not hair loss on its own.",
    how: "Set by your reviewer from your photos.",
    basis: "reviewer",
    grade: "B",
    refs: ["norwood1975"],
    change: "The shape is genetic. Cuts with texture at the front or a fringe change how a high or uneven hairline reads.",
    types: [
      { id: "straight", name: "Straight", aka: "Juvenile", definition: "A low, even line across the forehead.", art: { kind: "hairline", line: "straight" } },
      { id: "rounded", name: "Rounded", aka: "Bell", definition: "A soft curve that rises at the temples.", art: { kind: "hairline", line: "rounded" } },
      { id: "peak", name: "Widow's peak", definition: "A V-shaped point at the centre.", art: { kind: "hairline", line: "peak" } },
      { id: "m", name: "M-shaped", aka: "Mature", definition: "The temples sit a little higher than the centre, forming a soft M.", art: { kind: "hairline", line: "m" } },
      { id: "receding", name: "Receding", definition: "The temples have moved clearly back, leaving a deep M or an island at the front.", art: { kind: "hairline", line: "receding" } },
    ],
  },
  {
    id: "hair-loss",
    region: "hair",
    title: "Hair-loss stage",
    what: "How far pattern hair loss has progressed. Men's loss follows the Norwood scale; women's thinning over the crown follows the Ludwig scale.",
    why: "Pattern loss progresses in predictable stages. Treating early keeps more hair: finasteride and minoxidil both have trial evidence in men.",
    how: "You choose the stage when you sign up; your reviewer checks it against your photos.",
    basis: "you",
    grade: "A",
    refs: ["norwood1975", "ludwig1977", "kaufman1998", "olsen2002"],
    change: "Early stages respond to treatment prescribed by a doctor; later stages need a clinician's assessment.",
    types: [
      { id: "none", name: "None", aka: "Norwood 1 · Ludwig 0", definition: "No recession or thinning beyond a mature hairline.", art: { kind: "norwood", stage: 1 } },
      { id: "early", name: "Early", aka: "Norwood 2–3 · Ludwig I", definition: "Recession at the temples, or slight thinning at the crown or part.", art: { kind: "norwood", stage: 3 } },
      { id: "moderate", name: "Moderate", aka: "Norwood 4–5 · Ludwig II", definition: "Deep temple recession with thinning at the crown.", art: { kind: "norwood", stage: 5 } },
      { id: "advanced", name: "Advanced", aka: "Norwood 6–7 · Ludwig III", definition: "The front and crown have joined into one bald area.", art: { kind: "norwood", stage: 7 } },
    ],
    classify: ({ intake }) => ({ typeId: intake.hairLoss }),
  },

  /* ------------------------------ Facial hair ------------------------------ */
  {
    id: "beard-growth",
    region: "facial-hair",
    title: "Beard growth",
    what: "How fully the beard grows when left for a few weeks.",
    why: "Women rated heavy stubble most attractive and full beards highest for parenting ability and health. Preferences shift with what is common, so no one style is best.",
    how: "From your answers; your reviewer checks it against your photos.",
    basis: "you",
    grade: "B",
    refs: ["dixson2013", "janif2014", "ingprasert2016"],
    gender: "male",
    change: "Growth is genetic and keeps filling in into the late twenties. Minoxidil had a modest effect in one beard trial.",
    types: [
      { id: "none", name: "Minimal", definition: "Little growth even after weeks.", art: { kind: "beard", beard: "none" } },
      { id: "patchy", name: "Patchy", definition: "Gaps on the cheeks or between moustache and chin.", art: { kind: "beard", beard: "patchy" } },
      { id: "full", name: "Full", definition: "Even coverage from cheeks to neck.", art: { kind: "beard", beard: "full" } },
    ],
    classify: ({ intake }) => (intake.gender === "female" ? null : { typeId: intake.facialHair }),
  },

  /* ------------------------------ Skin ------------------------------ */
  {
    id: "fitzpatrick",
    region: "skin",
    title: "Skin type (Fitzpatrick)",
    what: "How your skin reacts to sun: how easily it burns and how well it tans. It describes sun reaction, not ethnicity.",
    why: "The six sun-reactive types are the standard dermatology scale. Clinicians use it to choose sun protection and treatment settings.",
    how: "From your answers.",
    basis: "you",
    grade: "B",
    refs: ["fitzpatrick1988"],
    change: "Fixed. Daily SPF matters for every type.",
    types: [
      { id: "1", name: "Type I", definition: "Always burns, never tans.", art: { kind: "swatch", tone: 1 } },
      { id: "2", name: "Type II", definition: "Usually burns, tans with difficulty.", art: { kind: "swatch", tone: 2 } },
      { id: "3", name: "Type III", definition: "Sometimes burns, tans gradually.", art: { kind: "swatch", tone: 3 } },
      { id: "4", name: "Type IV", definition: "Rarely burns, tans easily.", art: { kind: "swatch", tone: 4 } },
      { id: "5", name: "Type V", definition: "Very rarely burns, tans very easily.", art: { kind: "swatch", tone: 5 } },
      { id: "6", name: "Type VI", definition: "Never burns; deeply pigmented skin.", art: { kind: "swatch", tone: 6 } },
    ],
    classify: ({ intake }) => ({ typeId: String(intake.skinTone) }),
  },

  /* ------------------------------ Body ------------------------------ */
  {
    id: "frame-male",
    region: "body",
    title: "Upper-body taper",
    what: "Shoulder width compared with waist width, from the front.",
    why: "Cues of upper-body strength explained about 70% of the variance in ratings of men's bodily attractiveness.",
    how: "Shoulder width ÷ waist width from the body photo.",
    basis: "measured",
    grade: "B",
    refs: ["sell2017"],
    gender: "male",
    note: "We don't use somatotypes (ectomorph, mesomorph, endomorph): the theory behind them isn't supported.",
    change: "Shoulder and back training widens the top; fat loss narrows the waist. Shoulder bone width doesn't change.",
    types: [
      { id: "straight", name: "Straight", definition: "Shoulders not much wider than the waist.", criteria: "Under 1.35", art: { kind: "torso", shoulder: 1.2, waist: 0.95, hip: 0.95 } },
      { id: "moderate", name: "Moderate taper", definition: "A visible V from shoulders to waist.", criteria: "1.35–1.55", art: { kind: "torso", shoulder: 1.4, waist: 0.92, hip: 0.95 } },
      { id: "v", name: "V-taper", definition: "Broad shoulders over a narrow waist.", criteria: "Over 1.55", art: { kind: "torso", shoulder: 1.6, waist: 0.86, hip: 0.92 } },
    ],
    classify: ({ body }) => {
      if (!body) return null;
      const r = body.shoulderToWaist;
      return { typeId: r > 1.55 ? "v" : r >= 1.35 ? "moderate" : "straight", value: f2(r) };
    },
  },
  {
    id: "frame-female",
    region: "body",
    title: "Waist definition",
    what: "Waist width compared with hip width.",
    why: "Female figures with a waist-to-hip ratio around 0.7 were rated most attractive in a classic study. The ratio is also a health marker: WHO treats 0.85 and above as raised risk.",
    how: "Waist ÷ hip from a tape measure if you gave one; otherwise the frontal photo width (less exact).",
    basis: "measured",
    grade: "B",
    refs: ["singh1993", "who2008"],
    gender: "female",
    change: "Fat loss and glute training change the ratio; pelvis width doesn't change.",
    types: [
      { id: "defined", name: "Defined waist", definition: "A clear inward curve at the waist.", criteria: "Under 0.75", art: { kind: "torso", shoulder: 1.05, waist: 0.75, hip: 1.05 } },
      { id: "moderate", name: "Moderate", definition: "Some inward curve at the waist.", criteria: "0.75–0.85", art: { kind: "torso", shoulder: 1.02, waist: 0.84, hip: 1.02 } },
      { id: "straight", name: "Straight", definition: "Waist close to hip width.", criteria: "Over 0.85", art: { kind: "torso", shoulder: 1, waist: 0.92, hip: 1 } },
    ],
    classify: ({ body }) => {
      if (!body) return null;
      const r = body.whrTape ?? body.waistToHip;
      return { typeId: r < 0.75 ? "defined" : r <= 0.85 ? "moderate" : "straight", value: `${f2(r)}${body.whrTape ? " (tape)" : " (photo)"}` };
    },
  },
  {
    id: "posture",
    region: "body",
    title: "Posture type",
    what: "How the head, shoulders, spine and pelvis line up from the side.",
    why: "These are the standard postural types used in physiotherapy. A smaller ear–shoulder angle (forward head) is more common in people with neck pain, and targeted exercise improves it.",
    how: "Forward head and rounded shoulders are measured from your side photo; the other types are set by your reviewer.",
    basis: "measured",
    grade: "B",
    refs: ["kendall2005", "yip2008", "sheikhhoseini2018"],
    change: "Posture responds to strength and mobility work; see the posture items in your plan.",
    types: [
      { id: "neutral", name: "Neutral", definition: "Ear over shoulder over hip, with gentle spinal curves.", criteria: "Ear ≤ 8% ahead and ear–shoulder angle ≥ 76°", art: { kind: "posture", head: 0, shoulder: 0, lumbar: 0 } },
      { id: "forward-head", name: "Forward head", definition: "The ear sits in front of the shoulder.", criteria: "Ear > 8% of torso ahead, or angle < 76°", art: { kind: "posture", head: 1, shoulder: 0, lumbar: 0 } },
      { id: "rounded", name: "Rounded shoulders", definition: "The shoulders roll forward of the hips.", criteria: "Shoulder > 6% of torso ahead of the hip", art: { kind: "posture", head: 0.6, shoulder: 1, lumbar: 0 } },
      { id: "kyphotic-lordotic", name: "Kyphotic-lordotic", definition: "A rounded upper back with an exaggerated lower-back arch.", art: { kind: "posture", head: 0.6, shoulder: 0.8, lumbar: 1 } },
      { id: "sway-back", name: "Sway-back", definition: "Hips pushed forward with the upper back leaning back.", art: { kind: "posture", head: 0.5, shoulder: 0.4, lumbar: -0.6 } },
      { id: "flat-back", name: "Flat-back", definition: "Reduced curves; the lower back looks flat.", art: { kind: "posture", head: 0.3, shoulder: 0, lumbar: -1 } },
    ],
    classify: ({ side }) => {
      if (!side) return null;
      const fh = side.headForward > 8 || side.earShoulderAngle < 76;
      const rs = side.shoulderForward > 6;
      return { typeId: rs ? "rounded" : fh ? "forward-head" : "neutral", value: `ear ${side.headForward.toFixed(0)}% ahead · ${side.earShoulderAngle.toFixed(0)}°` };
    },
  },
];

export const categoriesFor = (gender: Intake["gender"]) => LIBRARY.filter((c) => !c.gender || c.gender === gender || (gender !== "female" && c.gender === "male"));

/** Classification for one category: reviewer override first, then measured/answered. */
export function matchFor(cat: FeatureCategory, ctx: Ctx, overrides?: Record<string, string>): (Match & { by: Basis }) | null {
  const o = overrides?.[cat.id];
  const auto = cat.classify?.(ctx) ?? null;
  if (o) return { ...auto, typeId: o, family: undefined, by: "reviewer" };
  if (!auto) return null;
  return { ...auto, by: cat.basis === "reviewer" ? "measured" : cat.basis };
}

export const typeCount = LIBRARY.reduce((s, c) => s + c.types.length, 0);
