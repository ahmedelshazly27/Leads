import type { Pt } from "./types";
import { loadImage } from "./image";
import { detectFace } from "./vision";
import { makeFrame } from "./faceAnalysis";

/*
 * Realism / identity check for generated "after" images.
 *
 * Habits (fat loss, skin care, grooming) cannot change bone. So proportions
 * set by the skeleton — jaw width at the angle, cheekbone width, face height,
 * eye spacing, nose width — must stay the same between the baseline and the
 * after. All are expressed relative to the inter-pupillary distance, so
 * image scale doesn't matter. Landmarks sit on skin, so fat loss can narrow
 * soft-tissue widths a little; tolerances allow for that.
 *
 * The most common complaint about competitors' projections (Reddit buyer
 * accounts, 2025–26) is that the "after" quietly changes things the plan never
 * touched: skin tone, eye colour, lips. So lips and colour are checked too.
 * Lips may only change when a lip item is in the plan (none is today).
 */

export interface RealismRow {
  key: string;
  label: string;
  bone: boolean;
  before: number;
  after: number;
  changePct: number;
  tolerancePct: number;
  /** "%" = proportion change; "dE" = colour difference (CIE76 ΔE*ab), before/after hold L* */
  unit: "%" | "dE";
  pass: boolean;
  note: string;
}

const d = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

const METRICS: { key: string; label: string; tol: number; note: string; f: (P: Pt[]) => number }[] = [
  { key: "jaw", label: "Jaw width at the angle", tol: 3, note: "Bone — fat loss may narrow it slightly, never widen it", f: (P) => d(P[172], P[397]) },
  { key: "zyg", label: "Cheekbone width", tol: 3, note: "Bone", f: (P) => d(P[234], P[454]) },
  { key: "height", label: "Face height", tol: 3, note: "Bone", f: (P) => d(P[10], P[152]) },
  { key: "eyes", label: "Eye spacing (inner corners)", tol: 2.5, note: "Bone — identity marker", f: (P) => d(P[133], P[362]) },
  { key: "nose", label: "Nose width", tol: 2.5, note: "Cartilage — identity marker", f: (P) => Math.max(d(P[129], P[358]), d(P[64], P[294])) },
  { key: "lower", label: "Lower-face height", tol: 3, note: "Bone — chin point; a new beard can shift it slightly", f: (P) => d(P[2], P[152]) },
  { key: "mouth", label: "Mouth width", tol: 6, note: "Soft tissue — a slight smirk moves one corner; more than this is a different mouth", f: (P) => d(P[61], P[291]) },
  { key: "lips", label: "Lip fullness (height)", tol: 6, note: "No filler look: fuller is flagged at +6%; closed, pressed lips may read up to 12% thinner", f: (P) => d(P[0], P[17]) },
];

/* ---------------- colour: skin tone and iris ---------------- */

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function lab([r, g, b]: number[]): [number, number, number] {
  const [R, G, B] = [r, g, b].map((v) => lin(v / 255));
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[s.length >> 1] : 0;
};

/** median RGB of pixels in annuli (r0..r1) around centres, in image pixels */
function sample(ctx: CanvasRenderingContext2D, centres: Pt[], r0: number, r1: number) {
  const ch: number[][] = [[], [], []];
  for (const [cx, cy] of centres) {
    const x0 = Math.max(0, Math.floor(cx - r1));
    const y0 = Math.max(0, Math.floor(cy - r1));
    const w = Math.ceil(r1 * 2);
    const { data } = ctx.getImageData(x0, y0, w, w);
    for (let y = 0; y < w; y++)
      for (let x = 0; x < w; x++) {
        const dd = Math.hypot(x0 + x - cx, y0 + y - cy);
        if (dd < r0 || dd > r1) continue;
        const i = (y * w + x) * 4;
        // skip specular highlights and deep shadow
        const lum = data[i] + data[i + 1] + data[i + 2];
        if (lum > 720 || lum < 30) continue;
        ch[0].push(data[i]);
        ch[1].push(data[i + 1]);
        ch[2].push(data[i + 2]);
      }
  }
  return lab(ch.map(median));
}

const COLOUR = [
  { key: "skin", label: "Skin tone (cheeks + forehead)", tol: 6, note: "Same light and skin colour — no tan, redness or lightening" },
  { key: "iris", label: "Eye colour", tol: 15, note: "Identity marker — small area, so the tolerance is wider" },
] as const;

async function measure(url: string) {
  const img = await loadImage(url);
  const det = await detectFace(img);
  if (!det) return null;
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const P = makeFrame(det.landmarks, W, H, det.z).P;
  const ipd = d(P[468], P[473]);
  const ratios = Object.fromEntries(METRICS.map((m) => [m.key, m.f(P) / ipd])) as Record<string, number>;
  // colour is sampled in raw image pixels
  const px = det.landmarks.map(([x, y]) => [x * W, y * H] as Pt);
  const ipdPx = d(px[468], px[473]);
  const irisR = (d(px[469], px[471]) + d(px[474], px[476])) / 4;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const colour = {
    skin: sample(ctx, [px[117], px[346], px[151]], 0, ipdPx * 0.1),
    iris: sample(ctx, [px[468], px[473]], irisR * 0.45, irisR * 0.85),
  };
  return { ratios, colour };
}

export async function realismCheck(beforeUrl: string, afterUrl: string): Promise<{ rows: RealismRow[]; pass: boolean } | null> {
  const [a, b] = await Promise.all([measure(beforeUrl), measure(afterUrl)]);
  if (!a || !b) return null;
  const rows: RealismRow[] = METRICS.map((m) => {
    const changePct = (b.ratios[m.key] / a.ratios[m.key] - 1) * 100;
    // widening bone is never plausible; narrowing within tolerance is (soft tissue)
    const pass =
      m.key === "jaw" || m.key === "zyg"
        ? changePct <= 1 && changePct >= -m.tol
        : m.key === "lips"
          ? changePct <= m.tol && changePct >= -12 // filler adds height; expression only compresses
          : Math.abs(changePct) <= m.tol;
    return { key: m.key, label: m.label, bone: !["mouth", "lips"].includes(m.key), before: a.ratios[m.key], after: b.ratios[m.key], changePct, tolerancePct: m.tol, unit: "%", pass, note: m.note };
  });
  for (const c of COLOUR) {
    const [A, B] = [a.colour[c.key], b.colour[c.key]];
    const dE = Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
    rows.push({ key: c.key, label: c.label, bone: false, before: A[0], after: B[0], changePct: dE, tolerancePct: c.tol, unit: "dE", pass: dE <= c.tol, note: c.note });
  }
  return { rows, pass: rows.every((r) => r.pass) };
}
