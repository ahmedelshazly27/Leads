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
 */

export interface RealismRow {
  key: string;
  label: string;
  bone: boolean;
  before: number;
  after: number;
  changePct: number;
  tolerancePct: number;
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
  { key: "lower", label: "Lower-face height", tol: 3, note: "Bone", f: (P) => d(P[2], P[152]) },
];

async function measure(url: string) {
  const img = await loadImage(url);
  const det = await detectFace(img);
  if (!det) return null;
  const P = makeFrame(det.landmarks, img.naturalWidth, img.naturalHeight, det.z).P;
  const ipd = d(P[468], P[473]);
  return Object.fromEntries(METRICS.map((m) => [m.key, m.f(P) / ipd])) as Record<string, number>;
}

export async function realismCheck(beforeUrl: string, afterUrl: string): Promise<{ rows: RealismRow[]; pass: boolean } | null> {
  const [a, b] = await Promise.all([measure(beforeUrl), measure(afterUrl)]);
  if (!a || !b) return null;
  const rows = METRICS.map((m) => {
    const changePct = (b[m.key] / a[m.key] - 1) * 100;
    // widening bone is never plausible; narrowing within tolerance is (soft tissue)
    const pass = m.key === "jaw" || m.key === "zyg" ? changePct <= 1 && changePct >= -m.tol : Math.abs(changePct) <= m.tol;
    return { key: m.key, label: m.label, bone: true, before: a[m.key], after: b[m.key], changePct, tolerancePct: m.tol, pass, note: m.note };
  });
  return { rows, pass: rows.every((r) => r.pass) };
}
