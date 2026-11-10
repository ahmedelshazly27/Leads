import type { Pt } from "../types";
import type { MarkerValue } from "./frontal";

/*
 * Side-profile markers from the outline of the face
 * (research_notes/marker_catalogue/profile_smile_neck_ear.md, rows marked OUT).
 *
 * The person is separated from the backdrop with a segmentation mask; the
 * facing-side outline is traced and the soft-tissue landmarks are located on
 * it: glabella (G), soft-tissue nasion (N'), pronasale (Prn), columella (Cm),
 * subnasale (Sn), labrale superius (Ls), stomion (Sto), labrale inferius
 * (Li), mentolabial sulcus (Sm), soft-tissue pogonion (Pg'), gnathion (Gn'),
 * menton (Me') and cervical point (C).
 *
 * Assumes the camera was level (true vertical = image vertical), as the
 * capture instructions ask. Markers under a beard or a fringe are not
 * measured.
 */

export interface Mask {
  data: Uint8Array; // category per pixel (0 = background, 1 = hair, …)
  width: number;
  height: number;
}

export interface ProfilePoints {
  facing: "left" | "right";
  G: Pt; N: Pt; Prn: Pt; Cm: Pt; Sn: Pt; A: Pt; Ls: Pt; Sto: Pt; Li: Pt; Sm: Pt; Pg: Pt; Gn: Pt; Me: Pt; C: Pt | null; neck: Pt | null; dorsum: Pt;
}

export interface ProfileResult {
  points: ProfilePoints;
  /** traced facing-side outline, image px, top to bottom */
  outline: Pt[];
  markers: Record<string, MarkerValue>;
  flags: { beard: boolean; fringe: boolean };
  /** mm per image px when a scale was supplied */
  mmPerPx: number | null;
}

const BG = 0;
const HAIR = 1;
const CLOTHES = 4;

const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const len = (a: Pt) => Math.hypot(a[0], a[1]);
const dist = (a: Pt, b: Pt) => len(sub(a, b));
const deg = (r: number) => (r * 180) / Math.PI;
function angleBetween(u: Pt, v: Pt) {
  const c = (u[0] * v[0] + u[1] * v[1]) / (len(u) * len(v) || 1);
  return deg(Math.acos(Math.max(-1, Math.min(1, c))));
}
/** interior angle at v between a and b */
const angleAt = (v: Pt, a: Pt, b: Pt) => angleBetween(sub(a, v), sub(b, v));

export interface Pixels {
  data: Uint8ClampedArray; // RGBA
  width: number;
  height: number;
}

/**
 * The segmenter runs at 256 px, so its outline is too soft for lips and the
 * nose tip. The edge is taken from the photo instead: pixels that differ from
 * the plain backdrop, kept only near the segmenter's person region. The
 * segmenter still tells hair from skin.
 */
export function analyseProfile(mask: Mask, px: Pixels, mmPerPx: number | null = null): ProfileResult | null {
  const W = px.width;
  const H = px.height;
  const sx = 1;
  const sy = 1;
  const mx = mask.width / W;
  const my = mask.height / H;
  const cat = (x: number, y: number) => mask.data[Math.min(mask.height - 1, Math.floor(y * my)) * mask.width + Math.min(mask.width - 1, Math.floor(x * mx))];
  // backdrop colour from the image border
  const border: number[][] = [];
  const pix = (x: number, y: number) => { const i = (y * W + x) * 4; return [px.data[i], px.data[i + 1], px.data[i + 2]]; };
  for (let x = 0; x < W; x += 3) { border.push(pix(x, 0), pix(x, 1)); }
  for (let y = 0; y < H; y += 3) { border.push(pix(0, y), pix(W - 1, y)); }
  const med = [0, 1, 2].map((c) => border.map((b) => b[c]).sort((a, b) => a - b)[border.length >> 1]);
  // near-person band from the segmenter (dilated), so a busy wall far away is ignored
  const R = Math.round(Math.max(W, H) * 0.012);
  const segFg = (x: number, y: number) => {
    for (let dy = -R; dy <= R; dy += R) for (let dx = -R; dx <= R; dx += R) {
      const xx = Math.min(W - 1, Math.max(0, x + dx)), yy = Math.min(H - 1, Math.max(0, y + dy));
      if (cat(xx, yy) !== BG) return true;
    }
    return false;
  };
  const fgMap = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [r, g, b] = pix(x, y);
    const d = Math.hypot(r - med[0], g - med[1], b - med[2]);
    fgMap[y * W + x] = d > 30 && segFg(x, y) ? 1 : 0;
  }
  const at = (x: number, y: number) => cat(x, y);
  const fg = (x: number, y: number) => fgMap[y * W + x] === 1;

  // rows that contain the person
  let top = -1;
  let bottom = -1;
  for (let y = 0; y < H; y++) {
    let any = false;
    for (let x = 0; x < W; x++) if (fg(x, y)) { any = true; break; }
    if (any) { if (top < 0) top = y; bottom = y; }
  }
  const dbg = (globalThis as { __profileDebug?: (...a: unknown[]) => void }).__profileDebug;
  dbg?.("rows", top, bottom, H);
  if (top < 0 || bottom - top < H * 0.3) return null;

  // extreme foreground x per row, both sides
  const left: number[] = [];
  const right: number[] = [];
  for (let y = 0; y < H; y++) {
    let l = -1, r = -1;
    for (let x = 0; x < W; x++) if (fg(x, y)) { l = x; break; }
    for (let x = W - 1; x >= 0; x--) if (fg(x, y)) { r = x; break; }
    left.push(l); right.push(r);
  }
  // facing side = the bumpier outline (nose and lips) in the face rows
  const span = bottom - top;
  const rough = (xs: number[]) => {
    let s = 0;
    for (let y = top + Math.round(span * 0.15); y < top + Math.round(span * 0.55); y++) if (xs[y - 1] >= 0 && xs[y] >= 0 && xs[y + 1] >= 0) s += Math.abs(xs[y + 1] - 2 * xs[y] + xs[y - 1]);
    return s;
  };
  const facing: "left" | "right" = rough(left) >= rough(right) ? "left" : "right";
  const fx = facing === "left" ? -1 : 1; // anterior direction in x
  const ext = facing === "left" ? left : right;

  // anterior coordinate per row (bigger = more forward), lightly smoothed
  const A0 = ext.map((x) => (x < 0 ? -Infinity : fx * x));
  const A = A0.map((_, y) => {
    let s = 0, n = 0;
    for (let k = -2; k <= 2; k++) { const v = A0[y + k]; if (v !== undefined && Number.isFinite(v)) { s += v; n++; } }
    return n ? s / n : -Infinity;
  });
  const P = (y: number): Pt => [ext[y] * sx, y * sy];
  const argmax = (a: number, b: number) => { let best = a; for (let y = a; y <= b; y++) if (A[y] > A[best]) best = y; return best; };
  const argmin = (a: number, b: number) => { let best = a; for (let y = a; y <= b; y++) if (A[y] < A[best]) best = y; return best; };

  // head and neck end where the shoulders start (outline width jumps)
  const width = (y: number) => (left[y] >= 0 && right[y] >= 0 ? right[y] - left[y] : 0);
  const headW = [...Array(Math.round(span * 0.2)).keys()].map((k) => width(top + Math.round(span * 0.1) + k)).sort((a, b) => a - b)[Math.round(span * 0.1)] || W * 0.3;
  let shoulder = bottom;
  for (let y = top + Math.round(span * 0.3); y < bottom; y++) if (width(y) > headW * 1.6 || at(ext[y], y) === CLOTHES) { shoulder = y; break; }
  const L = shoulder - top;

  // nose tip: the most forward point of the upper face; other windows scale with its height
  const Prn = argmax(top + Math.round(L * 0.25), top + Math.round(L * 0.7));
  const d = Prn - top;
  const lim = (y: number) => Math.min(shoulder - 1, y);
  const Sn = argmin(Prn + 1, lim(Prn + Math.round(d * 0.2)));
  const Ls = argmax(Sn + 1, lim(Sn + Math.round(d * 0.18)));
  const Sto = argmin(Ls + 1, lim(Ls + Math.round(d * 0.1)));
  const Li = argmax(Sto + 1, lim(Sto + Math.round(d * 0.14)));
  const Sm = argmin(Li + 1, lim(Li + Math.round(d * 0.2)));
  const Pg = argmax(Sm + 1, lim(Sm + Math.round(d * 0.25)));
  // chin bottom: where the outline has fallen a third of the way back towards the neck
  const neckMin = A[argmin(Pg, shoulder - 1)];
  let chinEnd = Pg;
  for (let y = Pg; y < shoulder; y++) if (A[y] < A[Pg] - (A[Pg] - neckMin) / 3) { chinEnd = y; break; }
  dbg?.("facing", facing, "shoulder", shoulder, "Prn", Prn, "Pg", Pg, "chinEnd", chinEnd);
  if (chinEnd <= Pg) return null;
  // nasion: the most pronounced dip between the brow ridge and the nasal
  // dorsum (a local minimum of the forward outline, scored by how much the
  // outline rises on both sides of it)
  const win = Math.max(4, Math.round(d * 0.15));
  let N = Prn - Math.round(d * 0.3);
  let best = -Infinity;
  for (let y = Math.max(top + win, Prn - Math.round(d * 0.55)); y < Prn - Math.round(d * 0.1); y++) {
    let up = -Infinity, down = -Infinity;
    for (let k = 1; k <= win; k++) { up = Math.max(up, A[y - k]); down = Math.max(down, A[Math.min(Prn, y + k)]); }
    const prominence = Math.min(up, down) - A[y];
    if (prominence > best) { best = prominence; N = y; }
  }
  // glabella: the most forward point of the brow ridge just above nasion
  const G = argmax(Math.max(top, N - Math.round(d * 0.22)), N - 1);
  const Cm = Sn - Math.round((Sn - Prn) * 0.35);
  const Ad = argmin(Sn, Ls); // deepest point of the upper-lip concavity (A')
  const dors = N + Math.round((Prn - N) * 0.35);

  // under the chin: walk back from the chin front along the submental surface
  const xPg = ext[Pg];
  const neckRows: number[] = [];
  for (let y = chinEnd + 4; y < shoulder; y++) neckRows.push(y);
  const neckFront = neckRows.length ? Math.max(...neckRows.map((y) => A[y])) : -Infinity;
  const sub_: Pt[] = [];
  let C: Pt | null = null;
  if (Number.isFinite(neckFront)) {
    const xEnd = fx * neckFront; // x of the neck front
    const step = fx * -1;
    for (let x = xPg; fx * x > fx * xEnd; x += step) {
      // first background pixel below the chin in this column
      let y = Pg;
      while (y < H - 1 && fg(x, y)) y++;
      if (y >= shoulder) break; // reached the neck: no gap under this column
      sub_.push([x * sx, y * sy]);
    }
    if (sub_.length > 2) C = sub_[sub_.length - 1];
  }
  const MeP: Pt = sub_.length ? sub_.reduce((best, p) => (p[1] > best[1] ? p : best), sub_[0]) : P(chinEnd);
  const GnP: Pt = [(P(Pg)[0] + MeP[0]) / 2, (P(Pg)[1] + MeP[1]) / 2];
  // a lower neck point, for the neck tangent
  const neckY = C ? Math.min(bottom - 1, Math.round(C[1] / sy + L * 0.25)) : -1;
  const neck: Pt | null = C && neckY > 0 && ext[neckY] >= 0 ? P(neckY) : null;

  // flags: a beard turns the chin outline into hair; a fringe covers glabella
  // the segmenter labels beards as skin, so compare brightness just inside
  // the outline: chin vs the skin beside the nose
  const inside = (y: number) => {
    const v: number[] = [];
    for (let k = Math.round(W * 0.012); k < Math.round(W * 0.035); k++) {
      const x = ext[y] - fx * k;
      if (x < 0 || x >= W) continue;
      const [r, g, b] = pix(x, y);
      v.push(0.299 * r + 0.587 * g + 0.114 * b);
    }
    v.sort((a, b) => a - b);
    return v.length ? v[v.length >> 1] : 0;
  };
  const band = (a: number, b: number) => { const v: number[] = []; for (let y = a; y <= b; y++) v.push(inside(y)); v.sort((x, y) => x - y); return v[v.length >> 1] ?? 0; };
  const skinRef = band(N, Prn);
  const chinLum = band(Sm, chinEnd);
  let hairChin = 0, rowsChin = 0;
  for (let y = Sm; y <= chinEnd; y++) { rowsChin++; if (at(ext[y], y) === HAIR) hairChin++; }
  const beard = (rowsChin > 0 && hairChin / rowsChin > 0.3) || (skinRef > 0 && chinLum < skinRef * 0.6);
  const fringe = at(ext[G], G) === HAIR;
  // clothing at the throat means the neck is hidden
  const collar = C ? at(Math.round(C[0] / sx), Math.min(H - 1, Math.round(C[1] / sy) + 2)) === CLOTHES : false;

  const pts: ProfilePoints = {
    facing,
    G: P(G), N: P(N), Prn: P(Prn), Cm: P(Cm), Sn: P(Sn), A: P(Ad), Ls: P(Ls), Sto: P(Sto), Li: P(Li), Sm: P(Sm), Pg: P(Pg), Gn: GnP, Me: MeP, C, neck, dorsum: P(dors),
  };

  const f: Pt = [fx, 0];
  const back: Pt = [-fx, 0];
  /** signed perpendicular distance of p from line a→b, + = in front of the line */
  const signed = (p: Pt, a: Pt, b: Pt) => {
    const d = sub(b, a);
    let n: Pt = [-d[1], d[0]];
    const nl = len(n) || 1;
    n = [n[0] / nl, n[1] / nl];
    if (n[0] * f[0] + n[1] * f[1] < 0) n = [-n[0], -n[1]];
    const v = sub(p, a);
    return v[0] * n[0] + v[1] * n[1];
  };
  const horiz = (a: Pt, b: Pt) => fx * (b[0] - a[0]); // + = b ahead of a
  const mm = (px: number) => (mmPerPx ? px * mmPerPx : NaN);
  const out: Record<string, MarkerValue> = {};
  // markers that use the chin (Pg', Gn', Me', Sm, C): not measurable through a beard
  const CHIN = new Set([
    "prof-facial-convexity-g-sn-pg", "prof-total-convexity-n-prn-pg", "prof-softtissue-profile-n-sn-pg", "prof-holdaway-st-facial-angle",
    "prof-merrifield-z-angle", "prof-mandibular-prognathism", "prof-vertical-height-ratio", "prof-nasal-to-gnathic-third", "prof-lower-face-percent",
    "nose-nasofacial-angle", "nose-nasomental-angle", "lips-ricketts-eline-upper", "lips-ricketts-eline-lower", "lips-steiner-sline",
    "lips-burstone-bline", "lips-holdaway-h-angle", "lips-lower-lip-h-line", "lips-sn-h-line", "lips-vertical-lip-chin-ratio",
    // a moustache covers the upper-lip outline
    "lips-superior-sulcus-depth", "lips-upper-lip-inclination",
  ]);
  const put = (id: string, value: number, unit: MarkerValue["unit"]) => {
    if (beard && CHIN.has(id)) return;
    if (Number.isFinite(value)) out[id] = { value, unit };
  };
  const p = pts;

  // overall profile (forehead points skipped under a fringe)
  if (!fringe) {
    put("prof-facial-convexity-g-sn-pg", 180 - angleAt(p.Sn, p.G, p.Pg), "°");
    put("prof-maxillary-prognathism", mm(horiz(p.G, p.Sn)), "mm");
    put("prof-mandibular-prognathism", mm(horiz(p.G, p.Pg)), "mm");
    put("prof-vertical-height-ratio", (p.Sn[1] - p.G[1]) / (p.Me[1] - p.Sn[1]), "ratio");
    put("prof-glabella-projection", mm(horiz(p.N, p.G)), "mm");
    put("nose-nasofrontal-angle", angleAt(p.N, p.G, p.dorsum), "°");
    put("nose-nasofacial-angle", angleBetween(sub(p.Pg, p.G), sub(p.Prn, p.N)), "°");
    put("nose-radix-depth", mm(-signed(p.N, p.G, p.Prn)), "mm");
  }
  put("prof-total-convexity-n-prn-pg", angleAt(p.Prn, p.N, p.Pg), "°");
  put("prof-softtissue-profile-n-sn-pg", angleAt(p.Sn, p.N, p.Pg), "°");
  put("prof-holdaway-st-facial-angle", angleBetween(back, sub(p.Pg, p.N)), "°");
  const lip = signed(p.Ls, p.Sn, p.Pg) >= signed(p.Li, p.Sn, p.Pg) ? p.Ls : p.Li;
  put("prof-merrifield-z-angle", angleBetween(back, sub(p.Pg, lip)), "°");
  put("prof-nasal-to-gnathic-third", (dist(p.N, p.Sn) / dist(p.Sn, p.Me)) * 100, "index");
  put("prof-lower-face-percent", ((p.Me[1] - p.Sn[1]) / (p.Me[1] - p.N[1])) * 100, "%");
  // nose
  put("nose-nasolabial-angle", angleAt(p.Sn, p.Cm, p.Ls), "°");
  put("nose-nasomental-angle", angleAt(p.Prn, p.N, p.Pg), "°");
  put("nose-tip-projection-simons", dist(p.Sn, p.Prn) / dist(p.Sn, p.Ls), "ratio");
  put("nose-tip-projection-baum-powell", dist(p.N, p.Sn) / Math.abs(signed(p.Prn, p.N, p.Sn) || 1), "ratio");
  put("nose-tip-projection-angle", angleBetween(back, sub(p.Prn, p.N)), "°");
  put("nose-nasal-length", mm(dist(p.N, p.Prn)), "mm");
  put("nose-nasal-height", mm(dist(p.N, p.Sn)), "mm");
  put("nose-nasal-prominence", angleAt(p.N, p.Prn, p.Sn), "°");
  {
    // dorsal hump: largest forward bulge of the outline between N' and Prn
    let maxDev = 0;
    for (let y = N + 1; y < Prn; y++) maxDev = Math.max(maxDev, signed(P(y), p.N, p.Prn));
    put("nose-dorsal-hump", (maxDev / dist(p.N, p.Prn)) * 100, "%");
  }
  // lips
  put("lips-ricketts-eline-upper", mm(signed(p.Ls, p.Prn, p.Pg)), "mm");
  put("lips-ricketts-eline-lower", mm(signed(p.Li, p.Prn, p.Pg)), "mm");
  const sMid: Pt = [(p.Cm[0] + p.Sn[0]) / 2, (p.Cm[1] + p.Sn[1]) / 2];
  put("lips-steiner-sline", mm(signed(p.Ls, sMid, p.Pg)), "mm");
  put("lips-burstone-bline", mm(signed(p.Ls, p.Sn, p.Pg)), "mm");
  put("lips-holdaway-h-angle", angleBetween(sub(p.N, p.Pg), sub(p.Ls, p.Pg)), "°");
  put("lips-lower-lip-h-line", mm(signed(p.Li, p.Pg, p.Ls)), "mm");
  put("lips-sn-h-line", mm(-signed(p.Sn, p.Pg, p.Ls)), "mm");
  put("lips-upper-lip-inclination", angleBetween(back, sub(p.Ls, p.Sn)), "°");
  put("lips-superior-sulcus-depth", mm(-signed(p.A, p.Sn, p.Ls)), "mm");
  put("lips-vertical-lip-chin-ratio", (p.Sto[1] - p.Sn[1]) / (p.Me[1] - p.Sto[1]), "ratio");
  // chin and neck: not under a beard
  if (!beard) {
    put("chin-labiomental-angle", angleAt(p.Sm, p.Li, p.Pg), "°");
    put("chin-mentolabial-sulcus-depth", mm(-signed(p.Sm, p.Li, p.Pg)), "mm");
    put("chin-zero-meridian", mm(horiz(p.N, p.Pg)), "mm");
    put("chin-lip-chin-prominence-angle", angleBetween([0, 1], sub(p.Pg, p.Li)) * Math.sign(horiz(p.Li, p.Pg) || 1), "°");
    put("chin-legan-prognathism", mm(horiz(p.G, p.Pg)), "mm");
    if (p.C && !collar) {
      if (p.neck) put("neck-cervicomental-angle", angleBetween(sub(p.Me, p.C), sub(p.neck, p.C)), "°");
      put("neck-mentocervical-angle", angleBetween(sub(p.Pg, p.G), sub(p.C, p.Me)), "°");
      put("neck-lower-face-throat-angle", angleAt(p.Gn, p.Sn, p.C), "°");
      put("neck-lower-height-depth-ratio", dist(p.Sn, p.Gn) / dist(p.C, p.Gn), "ratio");
      put("neck-submental-length", dist(p.Me, p.C) / (p.Me[1] - p.Sn[1]), "ratio");
      if (sub_.length > 4) {
        let dev = 0;
        for (const q of sub_) dev = Math.max(dev, -signed(q, p.Me, p.C) * -1);
        put("neck-submental-fullness", (dev / dist(p.Me, p.C)) * 100, "%");
      }
    }
  }

  const outline: Pt[] = [];
  for (let y = top; y <= chinEnd; y += 2) if (ext[y] >= 0) outline.push(P(y));
  outline.push(...sub_);
  return { points: pts, outline, markers: out, flags: { beard, fringe }, mmPerPx };
}
