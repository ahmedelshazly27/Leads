import type { CaptureQuality, FaceMetrics, FaceResult, Gender, Pt, SkinRegion, SkinRegionKey } from "./types";
import { add, clamp, deg, dist, lerp, mean, mid, pointInPolygon, sigmoid } from "./geometry";

/* MediaPipe Face Mesh indices. "L" = image-left (subject's right). */
export const IDX = {
  top: 10,
  glabella: 9,
  nasion: 168,
  noseTip: 1,
  subnasale: 2,
  upperLipTop: 0,
  upperLipInner: 13,
  lowerLipInner: 14,
  lowerLipBottom: 17,
  menton: 152,
  zygL: 234,
  zygR: 454,
  gonL: 172,
  gonR: 397,
  chinL: 148,
  chinR: 377,
  templeL: 54,
  templeR: 284,
  mouthL: 61,
  mouthR: 291,
  eyeL: { outer: 33, inner: 133, top: 159, bottom: 145 },
  eyeR: { outer: 263, inner: 362, top: 386, bottom: 374 },
  // inner → outer
  browL: { upper: [107, 66, 105, 63, 70], lower: [55, 65, 52, 53, 46] },
  browR: { upper: [336, 296, 334, 293, 300], lower: [285, 295, 282, 283, 276] },
  irisL: 468,
  irisR: 473,
};

export const PAIRS: [number, number][] = [
  [33, 263], [133, 362], [159, 386], [145, 374], [70, 300], [105, 334], [107, 336],
  [61, 291], [129, 358], [234, 454], [172, 397], [148, 377], [116, 345], [50, 280],
  [58, 288], [127, 356], [93, 323],
];

const MIDLINE = [10, 9, 168, 6, 1, 2, 0, 17, 152];

/** Population reference values used for averageness (Farkas-style norms). */
const NORMS: { key: keyof FaceMetrics; mean: number; sd: number }[] = [
  { key: "faceWHR", mean: 0.86, sd: 0.06 },
  { key: "midToLowerThird", mean: 0.95, sd: 0.09 },
  { key: "lipChinRatio", mean: 0.5, sd: 0.08 },
  { key: "eyeSpacingRatio", mean: 1.08, sd: 0.1 },
  { key: "eyeWidthToFace", mean: 0.205, sd: 0.016 },
  { key: "noseWidthToIntercanthal", mean: 1.05, sd: 0.12 },
  { key: "mouthToNoseWidth", mean: 1.45, sd: 0.15 },
  { key: "lipRatio", mean: 0.72, sd: 0.18 },
  { key: "jawToFaceWidth", mean: 0.8, sd: 0.06 },
  { key: "foreheadToFaceWidth", mean: 0.82, sd: 0.06 },
];

export interface FaceFrame {
  /** landmarks frontalised: head roll, yaw and pitch removed (pixel units) */
  P: Pt[];
  /** map a frontal-space point back to normalized image coords */
  toNorm: (p: Pt) => Pt;
  w: number;
  h: number;
  roll: number; // radians
  yaw: number; // degrees
  pitch: number; // degrees
  faceWidth: number;
  eyeW: number;
}

type V3 = [number, number, number];
const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale3 = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const norm3 = (a: V3): V3 => scale3(a, 1 / Math.hypot(a[0], a[1], a[2]));
const cross3 = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * Build a head-aligned frame. With depth (z) available, the face is rotated
 * into a frontal pose (removing roll, yaw and pitch) so that ratios and
 * symmetry are not distorted by a turned or tilted head.
 */
export function makeFrame(landmarks: Pt[], w: number, h: number, z?: number[]): FaceFrame {
  const p3 = landmarks.map(([x, y], i) => [x * w, y * h, (z?.[i] ?? 0) * w] as V3);
  const avg = (ids: number[]) => scale3(ids.reduce((s, i) => [s[0] + p3[i][0], s[1] + p3[i][1], s[2] + p3[i][2]] as V3, [0, 0, 0]), 1 / ids.length);
  // horizontal axis: from image-left to image-right side of the face (eyes + cheeks)
  const left = avg([IDX.eyeL.outer, IDX.eyeL.inner, IDX.zygL]);
  const right = avg([IDX.eyeR.outer, IDX.eyeR.inner, IDX.zygR]);
  const X = norm3(sub3(right, left));
  // vertical axis: chin → forehead (image "up" is −y)
  const up = sub3(p3[IDX.top], p3[IDX.menton]);
  const Y = norm3(sub3(up, scale3(X, dot3(up, X))));
  const Z = cross3(X, Y);
  const c = avg([IDX.eyeL.inner, IDX.eyeR.inner, IDX.noseTip, IDX.menton, IDX.top]);
  const P = p3.map((p) => {
    const q = sub3(p, c);
    return [c[0] + dot3(q, X), c[1] - dot3(q, Y)] as Pt;
  });
  const toNorm = (p: Pt): Pt => {
    const a = p[0] - c[0];
    const b = -(p[1] - c[1]);
    const r = [c[0] + a * X[0] + b * Y[0], c[1] + a * X[1] + b * Y[1]];
    return [r[0] / w, r[1] / h];
  };
  const roll = Math.atan2(X[1], X[0]);
  const yaw = deg(Math.asin(Math.max(-1, Math.min(1, X[2]))));
  const pitch = deg(Math.asin(Math.max(-1, Math.min(1, -Y[2]))));
  const faceWidth = dist(P[IDX.zygL], P[IDX.zygR]);
  const eyeW = mean([dist(P[IDX.eyeL.outer], P[IDX.eyeL.inner]), dist(P[IDX.eyeR.outer], P[IDX.eyeR.inner])]);
  void Z;
  return { P, toNorm, w, h, roll, yaw, pitch, faceWidth, eyeW };
}

/** Capture-quality checks that tell the user which numbers to trust. */
export function captureQuality(f: FaceFrame, captureHint?: "selfie" | "distance"): CaptureQuality {
  const faceWidthFrac = f.faceWidth / f.w;
  const warnings: string[] = [];
  const affected = new Set<string>();
  // Framing alone can't separate a tight crop from a selfie, so the user's answer wins.
  const closeRange = captureHint ? captureHint === "selfie" : faceWidthFrac > 0.42;
  if (closeRange) {
    warnings.push(
      "Your face fills most of the frame, which usually means a close-range selfie. At ~30 cm the nose appears ~30% wider and the face narrower than at 1.5 m. Retake from 1.5 m with zoom, or crop a photo taken from further away.",
    );
    ["noseWidthToIntercanthal", "mouthToNoseWidth", "faceWHR", "fWHR", "adiposity", "averageness", "dimorphism", "neoteny"].forEach((k) => affected.add(k));
  }
  if (Math.abs(f.yaw) > 8) {
    warnings.push(`Head turned ~${Math.abs(f.yaw).toFixed(0)}° to the side. Pose correction was applied, but symmetry is most reliable under 5°.`);
    affected.add("symmetry");
  }
  if (Math.abs(f.pitch) > 10) {
    warnings.push(`Head tilted ~${Math.abs(f.pitch).toFixed(0)}° ${f.pitch > 0 ? "up" : "down"}. Keep the camera at eye level so facial thirds are measured correctly.`);
    ["midToLowerThird", "lipChinRatio", "faceWHR"].forEach((k) => affected.add(k));
  }
  return { yaw: f.yaw, pitch: f.pitch, roll: deg(f.roll), faceWidthFrac, closeRange, warnings, affected: [...affected] };
}

/* ------------------------------------------------------------------ */
/*  Geometry                                                           */
/* ------------------------------------------------------------------ */

function browStats(P: Pt[], upper: number[], lower: number[], eyeTop: number, eyeW: number) {
  const pts = upper.map((i) => P[i]);
  const inner = mid(P[upper[0]], P[lower[0]]);
  const outer = mid(P[upper[upper.length - 1]], P[lower[lower.length - 1]]);
  const a = pts[0];
  const b = pts[pts.length - 1];
  const len = dist(a, b);
  const ux = (b[0] - a[0]) / len;
  const uy = (b[1] - a[1]) / len;
  // project each upper point onto the chord: t along (0..1), h above (+ = up)
  const ts: number[] = [];
  const hs: number[] = [];
  pts.forEach((p) => {
    const vx = p[0] - a[0];
    const vy = p[1] - a[1];
    ts.push((vx * ux + vy * uy) / len);
    hs.push(-(vy * ux - vx * uy) * Math.sign(ux || 1));
  });
  // least-squares parabola h = c2 t^2 + c1 t + c0 → continuous peak position
  const n = ts.length;
  const S = (f: (i: number) => number) => Array.from({ length: n }, (_, i) => f(i)).reduce((x, y) => x + y, 0);
  const s0 = n, s1 = S((i) => ts[i]), s2 = S((i) => ts[i] ** 2), s3 = S((i) => ts[i] ** 3), s4 = S((i) => ts[i] ** 4);
  const y0 = S((i) => hs[i]), y1 = S((i) => hs[i] * ts[i]), y2 = S((i) => hs[i] * ts[i] ** 2);
  const det3 = (m: number[][]) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const M = [[s4, s3, s2], [s3, s2, s1], [s2, s1, s0]];
  const D = det3(M) || 1e-9;
  const c2 = det3([[y2, s3, s2], [y1, s2, s1], [y0, s1, s0]]) / D;
  const c1 = det3([[s4, y2, s2], [s3, y1, s1], [s2, y0, s0]]) / D;
  const peak = c2 < 0 ? clamp(-c1 / (2 * c2), 0, 1) : ts[hs.indexOf(Math.max(...hs))];
  // Arch = how far the brow rises from its head to its highest point,
  // relative to brow length (a drooping tail must not inflate it).
  const headY = pts[0][1];
  const rise = Math.max(0, ...pts.map((p) => headY - p[1]));

  const thickness = mean(upper.map((u, i) => dist(P[u], P[lower[i]]))) / len;
  const tilt = deg(Math.atan2(inner[1] - outer[1], Math.abs(outer[0] - inner[0])));
  const lowerMid = P[lower[2]];
  // measured from the canthal line, which doesn't move with eyelid opening
  const canthusY = (P[eyeTop === IDX.eyeL.top ? IDX.eyeL.inner : IDX.eyeR.inner][1] + P[eyeTop === IDX.eyeL.top ? IDX.eyeL.outer : IDX.eyeR.outer][1]) / 2;
  const browEye = (canthusY - lowerMid[1]) / eyeW;
  return { arch: rise / len, peak, thickness, tilt, browEye };
}

export function computeShape(f: FaceFrame, gender: Gender) {
  const { P, faceWidth, eyeW } = f;
  const d = (a: number, b: number) => dist(P[a], P[b]);
  const faceHeight = d(IDX.top, IDX.menton);
  const browLowY = mean([P[52][1], P[282][1]]);
  const upperFace = P[IDX.upperLipTop][1] - browLowY;
  const intercanthal = d(IDX.eyeL.inner, IDX.eyeR.inner);
  const noseW = Math.max(d(129, 358), d(64, 294), d(98, 327));
  const mouthW = d(IDX.mouthL, IDX.mouthR);
  const upperLip = d(IDX.upperLipTop, IDX.upperLipInner);
  const lowerLip = d(IDX.lowerLipInner, IDX.lowerLipBottom);

  const tilt = (outer: number, inner: number) =>
    deg(Math.atan2(P[inner][1] - P[outer][1], Math.abs(P[outer][0] - P[inner][0])));
  const lipCenter = mid(P[IDX.upperLipInner], P[IDX.lowerLipInner]);
  const half = mouthW / 2;
  const cornerTilt = mean([
    deg(Math.atan2(lipCenter[1] - P[IDX.mouthL][1], half)),
    deg(Math.atan2(lipCenter[1] - P[IDX.mouthR][1], half)),
  ]);

  const bL = browStats(P, IDX.browL.upper, IDX.browL.lower, IDX.eyeL.top, eyeW);
  const bR = browStats(P, IDX.browR.upper, IDX.browR.lower, IDX.eyeR.top, eyeW);

  // symmetry
  const midX = mean(MIDLINE.map((i) => P[i][0]));
  const asym = mean(
    PAIRS.map(([a, b]) => {
      const mirrored: Pt = [2 * midX - P[b][0], P[b][1]];
      return dist(P[a], mirrored) / faceWidth;
    }),
  );
  const symmetry = clamp(100 - asym * 1100, 35, 99);

  const m = {
    faceWHR: faceWidth / faceHeight,
    fWHR: faceWidth / upperFace,
    midToLowerThird: d(IDX.glabella, IDX.subnasale) / d(IDX.subnasale, IDX.menton),
    lipChinRatio: d(IDX.subnasale, IDX.upperLipInner) / d(IDX.lowerLipInner, IDX.menton),
    eyeSpacingRatio: intercanthal / eyeW,
    eyeWidthToFace: eyeW / faceWidth,
    noseWidthToIntercanthal: noseW / intercanthal,
    noseLengthToFace: d(IDX.nasion, IDX.subnasale) / faceHeight,
    mouthToNoseWidth: mouthW / noseW,
    lipRatio: upperLip / Math.max(1e-6, lowerLip),
    lipFullness: (upperLip + lowerLip) / mouthW,
    jawToFaceWidth: d(IDX.gonL, IDX.gonR) / faceWidth,
    chinWidthToMouth: d(IDX.chinL, IDX.chinR) / mouthW,
    foreheadToFaceWidth: d(IDX.templeL, IDX.templeR) / faceWidth,
    canthalTilt: mean([tilt(IDX.eyeL.outer, IDX.eyeL.inner), tilt(IDX.eyeR.outer, IDX.eyeR.inner)]),
    browTilt: mean([bL.tilt, bR.tilt]),
    mouthCornerTilt: cornerTilt,
    headRoll: deg(f.roll),
    browArch: mean([bL.arch, bR.arch]),
    browPeak: mean([bL.peak, bR.peak]),
    browThickness: mean([bL.thickness, bR.thickness]),
    browEyeDistance: mean([bL.browEye, bR.browEye]),
    eyeAspect: mean([
      d(IDX.eyeL.top, IDX.eyeL.bottom) / d(IDX.eyeL.outer, IDX.eyeL.inner),
      d(IDX.eyeR.top, IDX.eyeR.bottom) / d(IDX.eyeR.outer, IDX.eyeR.inner),
    ]),
    symmetry,
  };

  return { ...m, ...derived(m, gender) };
}

/** Composite indices derived from raw ratios (also used for sample data). */
export function derived(
  m: Pick<
    FaceMetrics,
    | "faceWHR" | "fWHR" | "midToLowerThird" | "lipChinRatio" | "eyeSpacingRatio" | "eyeWidthToFace"
    | "noseWidthToIntercanthal" | "mouthToNoseWidth" | "lipRatio" | "jawToFaceWidth" | "foreheadToFaceWidth"
    | "browEyeDistance" | "lipFullness" | "eyeAspect" | "noseLengthToFace"
  >,
  _gender: Gender,
) {
  const zs = NORMS.map((n) => Math.abs(((m as Record<string, number>)[n.key] - n.mean) / n.sd));
  const avgZ = mean(zs.map((z) => Math.min(z, 3)));
  const averageness = clamp(100 * Math.exp(-0.5 * avgZ * avgZ) + 8, 20, 98);

  // + = masculine
  const dimZ =
    (m.jawToFaceWidth - 0.8) / 0.05 +
    -(m.browEyeDistance - 0.55) / 0.12 +
    (m.fWHR - 1.9) / 0.15 +
    -(m.lipFullness - 0.3) / 0.06 +
    -(m.eyeAspect - 0.33) / 0.05;
  const dimorphism = sigmoid(dimZ / 3);

  const neotenyZ =
    (m.eyeWidthToFace - 0.205) / 0.015 +
    (m.midToLowerThird - 0.95) / 0.08 +
    -(m.noseLengthToFace - 0.33) / 0.03 +
    (m.lipFullness - 0.3) / 0.06;
  const neoteny = clamp(50 + neotenyZ * 9, 5, 98);

  const adiposity = clamp(45 + ((m.faceWHR - 0.86) / 0.05) * 12 + ((m.jawToFaceWidth - 0.8) / 0.05) * 6, 5, 95);
  return { averageness, dimorphism, neoteny, adiposity };
}

export function classifyFaceShape(m: FaceMetrics): FaceResult["faceShape"] {
  const r = m.faceWHR;
  if (r < 0.78) return "Oblong";
  if (m.foreheadToFaceWidth > m.jawToFaceWidth + 0.12 && m.chinWidthToMouth < 0.95) return "Heart";
  if (m.foreheadToFaceWidth < 0.78 && m.jawToFaceWidth < 0.78) return "Diamond";
  if (m.jawToFaceWidth > 0.86 && r > 0.84) return "Square";
  if (r > 0.92 && m.jawToFaceWidth <= 0.86) return "Round";
  return "Oval";
}

/* ------------------------------------------------------------------ */
/*  Skin & contrast (pixel analysis in CIELAB)                         */
/* ------------------------------------------------------------------ */

function srgbToLab(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const R = lin(r), G = lin(g), B = lin(b);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export interface RegionPixels {
  bbox: [number, number, number, number]; // x0,y0,x1,y1 in pixels (unrotated)
  flagged: Uint8Array; // 1 = flagged, size (x1-x0)*(y1-y0)
  inside: Uint8Array;
  coverage: number;
  evenness: number;
  redness: number;
  texture: number;
  meanL: number;
}

/** Analyse a polygon (normalized coords) of the image. */
export function analyseRegion(img: ImageData, polyNorm: Pt[], faceWidthPx: number): RegionPixels {
  const W = img.width, H = img.height;
  const poly = polyNorm.map(([x, y]) => [x * W, y * H] as Pt);
  const x0 = Math.max(0, Math.floor(Math.min(...poly.map((p) => p[0]))));
  const y0 = Math.max(0, Math.floor(Math.min(...poly.map((p) => p[1]))));
  const x1 = Math.min(W, Math.ceil(Math.max(...poly.map((p) => p[0]))));
  const y1 = Math.min(H, Math.ceil(Math.max(...poly.map((p) => p[1]))));
  const bw = Math.max(1, x1 - x0), bh = Math.max(1, y1 - y0);
  const L = new Float32Array(bw * bh);
  const A = new Float32Array(bw * bh);
  const inside = new Uint8Array(bw * bh);
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const i = y * bw + x;
      const px = ((y + y0) * W + (x + x0)) * 4;
      const [l, a] = srgbToLab(img.data[px], img.data[px + 1], img.data[px + 2]);
      L[i] = l;
      A[i] = a;
      inside[i] = pointInPolygon(x + x0 + 0.5, y + y0 + 0.5, poly) ? 1 : 0;
    }
  }
  // integral images for local mean of L (inside pixels only)
  const S = new Float64Array((bw + 1) * (bh + 1));
  const N = new Float64Array((bw + 1) * (bh + 1));
  for (let y = 0; y < bh; y++) {
    let rs = 0, rn = 0;
    for (let x = 0; x < bw; x++) {
      const i = y * bw + x;
      if (inside[i]) { rs += L[i]; rn += 1; }
      S[(y + 1) * (bw + 1) + x + 1] = S[y * (bw + 1) + x + 1] + rs;
      N[(y + 1) * (bw + 1) + x + 1] = N[y * (bw + 1) + x + 1] + rn;
    }
  }
  const r = Math.max(2, Math.round(faceWidthPx * 0.025));
  const box = (arr: Float64Array, x: number, y: number) => {
    const ax = Math.max(0, x - r), ay = Math.max(0, y - r);
    const bx = Math.min(bw, x + r + 1), by = Math.min(bh, y + r + 1);
    const s = bw + 1;
    return arr[by * s + bx] - arr[ay * s + bx] - arr[by * s + ax] + arr[ay * s + ax];
  };

  const insideA: number[] = [];
  const insideL: number[] = [];
  for (let i = 0; i < inside.length; i++) if (inside[i]) { insideA.push(A[i]); insideL.push(L[i]); }
  const n = insideA.length || 1;
  const sorted = [...insideA].sort((a, b) => a - b);
  const medA = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const meanL = insideL.reduce((s, v) => s + v, 0) / n;

  const flagged = new Uint8Array(bw * bh);
  let count = 0, hf = 0;
  const local: number[] = [];
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const i = y * bw + x;
      if (!inside[i]) continue;
      const lm = box(S, x, y) / Math.max(1, box(N, x, y));
      local.push(lm);
      const diff = L[i] - lm;
      hf += diff * diff;
      if (diff < -5.5 || A[i] > medA + 7) {
        flagged[i] = 1;
        count++;
      }
    }
  }
  const lowStd = Math.sqrt(local.reduce((s, v) => s + (v - meanL) ** 2, 0) / n);
  const hfStd = Math.sqrt(hf / n);
  return {
    bbox: [x0, y0, x1, y1],
    flagged,
    inside,
    coverage: count / n,
    evenness: clamp(100 - lowStd * 6),
    redness: clamp((medA - 4) * 4),
    texture: clamp(hfStd * 18),
    meanL,
  };
}

export function skinPolygons(f: FaceFrame): Record<SkinRegionKey, Pt[][]> {
  const { P, eyeW, toNorm } = f;
  const N = (pts: Pt[]) => pts.map(toNorm);
  const k = eyeW;
  const ic = (P[IDX.eyeR.inner][0] - P[IDX.eyeL.inner][0]) / 2;
  const cheek = (side: "L" | "R") => {
    const e = side === "L" ? IDX.eyeL : IDX.eyeR;
    const zyg = side === "L" ? IDX.zygL : IDX.zygR;
    const gon = side === "L" ? 58 : 288;
    const mouth = side === "L" ? IDX.mouthL : IDX.mouthR;
    const ala = side === "L" ? 129 : 358;
    const s = side === "L" ? -1 : 1;
    return N([
      add(lerp(P[e.inner], P[e.bottom], 0.6), 0, 0.45 * k),
      add(lerp(P[e.outer], P[zyg], 0.35), 0, 0.45 * k),
      add(lerp(P[zyg], P[gon], 0.45), -s * 0.18 * k, 0),
      add(lerp(P[gon], P[mouth], 0.4), 0, -0.1 * k),
      add(P[mouth], s * 0.18 * k, -0.15 * k),
      add(P[ala], s * 0.2 * k, 0),
    ]);
  };
  const underEye = (e: typeof IDX.eyeL) => {
    const o = P[e.outer], i = P[e.inner];
    return N([
      add(lerp(o, i, 0.1), 0, 0.12 * k),
      add(lerp(o, i, 0.9), 0, 0.12 * k),
      add(lerp(o, i, 0.85), 0, 0.5 * k),
      add(lerp(o, i, 0.15), 0, 0.5 * k),
    ]);
  };
  const browTop = Math.min(...[...IDX.browL.upper, ...IDX.browR.upper].map((i) => P[i][1]));
  const topY = Math.min(P[IDX.top][1] + 0.15 * k, browTop - 0.2 * k);
  return {
    forehead: [
      N([
        [P[IDX.browL.upper[3]][0], topY],
        [P[IDX.browR.upper[3]][0], topY],
        [P[IDX.browR.upper[3]][0], browTop - 0.18 * k],
        [P[IDX.browL.upper[3]][0], browTop - 0.18 * k],
      ]),
    ],
    leftCheek: [cheek("R")], // subject's left = image right
    rightCheek: [cheek("L")],
    nose: [
      N([
        add(P[6], -0.45 * ic, 0),
        add(P[6], 0.45 * ic, 0),
        add(P[358], -0.05 * k, -0.1 * k),
        add(P[IDX.subnasale], 0, -0.12 * k),
        add(P[129], 0.05 * k, -0.1 * k),
      ]),
    ],
    underEye: [underEye(IDX.eyeL), underEye(IDX.eyeR)],
    chin: [
      N([
        add(P[IDX.lowerLipBottom], -0.5 * k, 0.15 * k),
        add(P[IDX.lowerLipBottom], 0.5 * k, 0.15 * k),
        add(P[IDX.chinR], -0.1 * k, -0.15 * k),
        add(P[IDX.menton], 0, -0.2 * k),
        add(P[IDX.chinL], 0.1 * k, -0.15 * k),
      ]),
    ],
  };
}

function regionMeanL(img: ImageData, polys: Pt[][], fw: number) {
  return mean(polys.map((p) => analyseRegion(img, p, fw).meanL));
}

export function analyseFace(landmarks: Pt[], z: number[] | undefined, img: ImageData, gender: Gender, captureHint?: "selfie" | "distance"): FaceResult {
  const f = makeFrame(landmarks, img.width, img.height, z);
  const shape = computeShape(f, gender);
  const polys = skinPolygons(f);

  const skin: SkinRegion[] = (Object.keys(polys) as SkinRegionKey[]).map((key) => {
    const parts = polys[key].map((p) => analyseRegion(img, p, f.faceWidth));
    const w = parts.map((p) => p.inside.reduce((s, v) => s + v, 0));
    const tw = w.reduce((s, v) => s + v, 0) || 1;
    const avg = (sel: (r: RegionPixels) => number) => parts.reduce((s, p, i) => s + sel(p) * w[i], 0) / tw;
    return {
      key,
      coverage: avg((p) => p.coverage),
      evenness: avg((p) => p.evenness),
      redness: avg((p) => p.redness),
      texture: avg((p) => p.texture),
      polygons: polys[key],
    };
  });

  const skinScore = clamp(
    mean(skin.map((s) => 100 - s.coverage * 260 - s.texture * 0.15 - s.redness * 0.1)) + 6,
    10,
    99,
  );

  // facial contrast: features vs. surrounding skin
  const { P, toNorm } = f;
  const feat = (ids: number[], pad = 0) => [ids.map((i) => toNorm(add(P[i], 0, pad)))];
  const browL = regionMeanL(img, feat([...IDX.browL.upper, ...[...IDX.browL.lower].reverse()]), f.faceWidth);
  const browR = regionMeanL(img, feat([...IDX.browR.upper, ...[...IDX.browR.lower].reverse()]), f.faceWidth);
  const lips = regionMeanL(img, feat([61, 40, 37, 0, 267, 270, 291, 321, 314, 17, 84, 91]), f.faceWidth);
  const eyes = regionMeanL(img, feat([33, 160, 158, 133, 153, 144]), f.faceWidth);
  const skinL = regionMeanL(img, [...polys.leftCheek, ...polys.rightCheek], f.faceWidth);
  const c = (x: number) => (skinL - x) / Math.max(1, skinL);
  const contrast = clamp(100 * (1 - Math.exp(-Math.max(0, mean([c(browL), c(browR), c(lips), c(eyes)])) / 0.28)), 3, 97);

  const metrics: FaceMetrics = { ...shape, contrast, skinScore };
  return {
    landmarks,
    imageAspect: img.width / img.height,
    metrics,
    skin,
    faceShape: classifyFaceShape(metrics),
    capture: captureQuality(f, captureHint),
  };
}
