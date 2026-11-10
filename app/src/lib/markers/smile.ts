import type { Pt } from "../types";
import { IRIS_MM, type MarkerValue } from "./frontal";

/*
 * Smile markers (research_notes/marker_catalogue/profile_smile_neck_ear.md,
 * section 8) from a frontal natural-smile photo: face mesh for lips, eyes and
 * pupils; teeth found as bright, low-saturation pixels inside the inner lip
 * outline. Millimetres use the iris as a ruler, as in the front portrait.
 */

export interface Rgba {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

// inner lip ring (MediaPipe)
const INNER = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
const LOWER_INNER = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308];

const d = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const deg = (r: number) => (r * 180) / Math.PI;

function inside(p: Pt, poly: Pt[]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** least-squares y = a·x² + b·x + c; returns a (curvature, + = sagging down in image) */
function curvature(pts: Pt[]) {
  if (pts.length < 5) return NaN;
  const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const q = pts.map(([x, y]) => [x - mx, y] as Pt);
  let s0 = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0, t0 = 0, t1 = 0, t2 = 0;
  for (const [x, y] of q) {
    s0++; s1 += x; s2 += x * x; s3 += x ** 3; s4 += x ** 4;
    t0 += y; t1 += x * y; t2 += x * x * y;
  }
  // solve the 3×3 normal equations by Cramer's rule
  const M = [[s4, s3, s2], [s3, s2, s1], [s2, s1, s0]];
  const T = [t2, t1, t0];
  const det3 = (m: number[][]) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det3(M);
  if (!D) return NaN;
  const Ma = M.map((r, i) => [T[i], r[1], r[2]]);
  return det3(Ma) / D;
}

/**
 * @param L     face-mesh landmarks of the smile photo, in image pixels
 * @param img   smile photo pixels
 * @param neutralEyeAspect  eye height ÷ width from the neutral portrait (for the Duchenne proxy)
 */
export function smileMarkers(L: Pt[], img: Rgba, neutralEyeAspect: number | null): Record<string, MarkerValue> {
  const out: Record<string, MarkerValue> = {};
  const put = (id: string, value: number, unit: MarkerValue["unit"], text?: string) => {
    if (Number.isFinite(value)) out[id] = { value, unit, ...(text ? { text } : {}) };
  };
  const iris = (d(L[469], L[471]) + d(L[474], L[476])) / 2;
  const mm = IRIS_MM / iris;
  const chL = L[61], chR = L[291];
  const chch = d(chL, chR);
  const puL = L[468], puR = L[473];

  // teeth pixels inside the inner lip ring
  const poly = INNER.map((i) => L[i]);
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const [x0, x1] = [Math.floor(Math.min(...xs)), Math.ceil(Math.max(...xs))];
  const [y0, y1] = [Math.floor(Math.min(...ys)), Math.ceil(Math.max(...ys))];
  const teethCols = new Map<number, { top: number; bottom: number }>();
  let gum = 0;
  let mouthPx = 0;
  for (let y = Math.max(0, y0); y <= Math.min(img.height - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(img.width - 1, x1); x++) {
      if (!inside([x, y], poly)) continue;
      mouthPx++;
      const i = (y * img.width + x) * 4;
      const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const v = mx / 255;
      const s = mx ? (mx - mn) / mx : 0;
      if (v > 0.55 && s < 0.32) {
        // keep only the first continuous run from the top: the upper teeth
        const c = teethCols.get(x);
        if (!c) teethCols.set(x, { top: y, bottom: y });
        else if (y - c.bottom <= 2) c.bottom = y;
      } else if (r > g * 1.25 && r > b * 1.15 && v > 0.35 && y < (L[13][1] + L[14][1]) / 2) gum++;
    }
  }
  // keep columns with a real run of teeth (drop specular glints on the lips)
  const cols = [...teethCols.entries()].filter(([, c]) => c.bottom - c.top >= 3).sort((a, b) => a[0] - b[0]);
  if (cols.length > 10 && mouthPx > 0) {
    const teethW = cols[cols.length - 1][0] - cols[0][0];
    put("smile-buccal-corridor-ratio", ((chch - teethW) / chch) * 100, "%", `${(((chch - teethW) / chch) * 100).toFixed(0)}% corridor · teeth fill ${((teethW / chch) * 100).toFixed(0)}% of the smile`);
    // teeth display: tallest run near the midline
    const midX = (L[13][0] + L[14][0]) / 2;
    const central = cols.filter(([x]) => Math.abs(x - midX) < chch * 0.08);
    if (central.length) {
      const top = Math.min(...central.map(([, c]) => c.top));
      const bottom = Math.max(...central.map(([, c]) => c.bottom));
      put("smile-incisor-display-smile", (bottom - top) * mm, "mm");
      // gum show: gap between the inner upper lip and the top of the teeth, when pink tissue is there
      const lipInner = L[13][1];
      const gap = (top - lipInner) * mm;
      const gumShows = gum > mouthPx * 0.01 && gap > 0.5;
      put("smile-gingival-display", gumShows ? gap : 0, "mm", gumShows ? `${gap.toFixed(1)} mm of gum` : "No gum showing");
      // smile arc: curvature of the upper incisal edges vs the lower lip's inner border
      const raw = cols.filter(([x]) => Math.abs(x - midX) < chch * 0.25).map(([x, c]) => [x, c.bottom] as Pt);
      // median-smooth the edge so single-column glints don't bend the curve
      const edge = raw.map((p, i) => {
        const w = raw.slice(Math.max(0, i - 3), i + 4).map((q) => q[1]).sort((a, b) => a - b);
        return [p[0], w[w.length >> 1]] as Pt;
      });
      const lip = LOWER_INNER.map((i) => L[i]).filter((p) => Math.abs(p[0] - midX) < chch * 0.45);
      const ka = curvature(edge);
      const kl = curvature(lip);
      if (Number.isFinite(ka) && Number.isFinite(kl)) {
        // image y points down, so a smiling curve (centre lower than the ends) has negative curvature
        const kL = -kl, kA = -ka;
        const cls = kL > 0 && kA > kL * 0.35 ? "Consonant" : kA < -Math.abs(kL) * 0.2 ? "Reverse" : "Flat";
        put("smile-arc", cls === "Consonant" ? 1 : cls === "Flat" ? 0 : -1, "index", `${cls}${cls === "Consonant" ? " (follows the lower lip)" : ""}`);
      }
      // incisal plane cant vs the pupil line
      if (edge.length > 6) {
        // slope of a straight line fitted through the edge (the curve itself is symmetric)
        const n = edge.length;
        const mx = edge.reduce((a, p) => a + p[0], 0) / n;
        const my = edge.reduce((a, p) => a + p[1], 0) / n;
        const slope = edge.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0) / (edge.reduce((a, p) => a + (p[0] - mx) ** 2, 0) || 1);
        const cant = deg(Math.atan(slope) - Math.atan2(puR[1] - puL[1], puR[0] - puL[0]));
        put("smile-incisal-plane-cant", Math.abs(cant), "°");
      }
    }
  }
  // smile width ÷ interlabial height
  const gapH = d(L[13], L[14]);
  if (gapH > 2) put("smile-index", chch / gapH, "ratio");
  // symmetry: commissure line vs pupil line
  const tilt = deg(Math.atan2(chR[1] - chL[1], chR[0] - chL[0]) - Math.atan2(puR[1] - puL[1], puR[0] - puL[0]));
  put("smile-symmetry", Math.abs(chR[1] - chL[1]) * mm, "mm", `${(Math.abs(chR[1] - chL[1]) * mm).toFixed(1)} mm · ${Math.abs(tilt).toFixed(1)}°`);
  // upper lip curvature: corners above or below the upper lip's centre
  const up = (L[13][1] - (chL[1] + chR[1]) / 2) * mm;
  put("smile-upper-lip-curvature", up, "mm", up > 1 ? "Upward (corners above the centre)" : up < -1 ? "Downward" : "Straight");
  // Duchenne proxy: eyes narrow in a genuine smile (cheeks raise the lower lids)
  if (neutralEyeAspect) {
    const eyeAspect = (d(L[159], L[145]) / d(L[33], L[133]) + d(L[386], L[374]) / d(L[362], L[263])) / 2;
    const narrowing = (1 - eyeAspect / neutralEyeAspect) * 100;
    put("smile-duchenne-marker", narrowing, "%", `${narrowing >= 15 ? "Likely" : "Unclear"} · eyes ${narrowing.toFixed(0)}% narrower than at rest`);
  }
  return out;
}
