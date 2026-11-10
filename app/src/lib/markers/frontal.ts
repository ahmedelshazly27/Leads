import type { Pt } from "../types";

/*
 * Front-view markers from the literature catalogue
 * (research_notes/marker_catalogue/frontal.md). Each id matches a catalogue
 * row; landmark indices follow the catalogue's MediaPipe mapping.
 *
 * Input: the pose-corrected frontal frame (faceAnalysis.makeFrame().P), in
 * image pixels. Millimetres use the iris as a ruler: the visible iris is
 * about 11.7 mm across in adults (catalogue gen-iris-mm-scale).
 */

export const IRIS_MM = 11.7;

export interface MarkerValue {
  value: number;
  unit: "ratio" | "%" | "°" | "mm" | "index";
  /** shown instead of the number when the marker has several parts */
  text?: string;
}

const d = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const dy = (a: Pt, b: Pt) => Math.abs(a[1] - b[1]);
const dx = (a: Pt, b: Pt) => Math.abs(a[0] - b[0]);
const deg = (r: number) => (r * 180) / Math.PI;

function angleAt(v: Pt, a: Pt, b: Pt) {
  const a1 = Math.atan2(a[1] - v[1], a[0] - v[0]);
  const b1 = Math.atan2(b[1] - v[1], b[0] - v[0]);
  let x = Math.abs(deg(a1 - b1));
  if (x > 180) x = 360 - x;
  return x;
}

function polyArea(pts: Pt[]) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

const pathLen = (P: Pt[], ids: number[]) => ids.slice(1).reduce((s, id, i) => s + d(P[ids[i]], P[id]), 0);

// MediaPipe face-mesh rings used below
const OUTER_LIP = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
const BROW_LOWER_L = [46, 53, 52, 65, 55];
const BROW_LOWER_R = [276, 283, 282, 295, 285];

export function frontalMarkers(P: Pt[]): Record<string, MarkerValue> {
  // anthropometric points (L = image-left = subject's right)
  const enL = P[133], enR = P[362], exL = P[33], exR = P[263];
  const puL = P[468], puR = P[473];
  const zyL = P[234], zyR = P[454], goL = P[172], goR = P[397], ftL = P[54], ftR = P[284];
  const n = P[168], g = P[9], sn = P[2], me = P[152];
  const chL = P[61], chR = P[291], ls = P[0], li = P[17];
  const sto = mid(P[13], P[14]);
  const alW = Math.max(d(P[129], P[358]), d(P[64], P[294]));

  const irisPx = (d(P[469], P[471]) + d(P[474], P[476])) / 2;
  const mm = IRIS_MM / irisPx;
  const zy = d(zyL, zyR);
  const go = d(goL, goR);
  const enEn = d(enL, enR);
  const exEx = d(exL, exR);
  const pfl = (d(enL, exL) + d(enR, exR)) / 2;
  const pfh = (d(P[159], P[145]) + d(P[386], P[374])) / 2;
  const ipd = d(puL, puR);
  const mouth = d(chL, chR);
  const nme = d(n, me);
  const snme = d(sn, me);
  const nsn = d(n, sn);

  // horizontal fifths at eye level, % of face width
  const fifths = [d(zyL, exL), d(exL, enL), enEn, d(enR, exR), d(exR, zyR)];
  const fsum = fifths.reduce((a, b) => a + b, 0);
  const fifthsPct = fifths.map((x) => (x / fsum) * 100);

  // lower third area (face outline below subnasale) vs lip area
  const below = FACE_OVAL.map((i) => P[i]).filter((p) => p[1] > sn[1]);
  const lowerThird: Pt[] = [[zyL[0], sn[1]], ...below.sort((a, b) => Math.atan2(a[1] - sn[1], a[0] - sn[0]) - Math.atan2(b[1] - sn[1], b[0] - sn[0])), [zyR[0], sn[1]]];
  const lipArea = polyArea(OUTER_LIP.map((i) => P[i]));

  // width at mouth level (face outline near the commissures)
  const mouthLevel = FACE_OVAL.map((i) => P[i]).sort((a, b) => Math.abs(a[1] - sto[1]) - Math.abs(b[1] - sto[1]));
  const atMouth = Math.abs(mouthLevel[0][0] - mouthLevel.find((p) => Math.sign(p[0] - n[0]) !== Math.sign(mouthLevel[0][0] - n[0]))![0]);
  const eyeY = (puL[1] + puR[1]) / 2;

  const r = (value: number, unit: MarkerValue["unit"] = "ratio"): MarkerValue => ({ value, unit });

  return {
    // general / proportions
    "gen-iris-mm-scale": { value: mm, unit: "mm", text: `${(mm * 100).toFixed(2)} mm per 100 px` },
    "gen-mid-to-lower-third": r(nsn / snme),
    "gen-morph-facial-index": r(nme / zy),
    "gen-fwhr": r(zy / dy(mid(P[52], P[282]), ls)),
    "gen-horizontal-fifths": { value: fifthsPct[2], unit: "%", text: fifthsPct.map((x) => x.toFixed(0)).join(" · ") + " %" },
    "gen-forehead-width": r(d(ftL, ftR) / zy),
    "gen-ipd-face-width": r(ipd / zy),
    "gen-eme-angle": r(angleAt(sto, puL, puR), "°"),
    "gen-vertical-dystopia": r(dy(puL, puR) * mm, "mm"),
    // eyes
    "eye-pfl": r(pfl * mm, "mm"),
    "eye-pfh": r(pfh * mm, "mm"),
    "eye-pf-index": r(pfh / pfl),
    "eye-intercanthal": r(enEn * mm, "mm"),
    "eye-orbital-canon": r(enEn / pfl),
    "eye-canthal-index": r((enEn / exEx) * 100, "index"),
    "eye-ipd": r(ipd * mm, "mm"),
    "eye-biocular-to-face": r(exEx / zy),
    "eye-mrd1": r(((dy(puL, P[159]) + dy(puR, P[386])) / 2) * mm, "mm"),
    "eye-scleral-show": r(Math.max(0, ((P[145][1] - (puL[1] + irisPx / 2) + (P[374][1] - (puR[1] + irisPx / 2))) / 2) * mm), "mm"),
    "eye-iris-to-pfl": r(irisPx / pfl),
    // brows
    "brow-height-midpupil": r(((dy(P[52], P[159]) + dy(P[282], P[386])) / 2) * mm, "mm"),
    "brow-medial-height": r(((d(P[55], enL) + d(P[285], enR)) / 2) * mm, "mm"),
    "brow-tail-height": r(((d(P[46], exL) + d(P[276], exR)) / 2) * mm, "mm"),
    "brow-length": r(((pathLen(P, BROW_LOWER_L) + pathLen(P, BROW_LOWER_R)) / 2) * mm, "mm"),
    "brow-tail-endpoint": r(((dx(P[46], exL) + dx(P[276], exR)) / 2) * mm, "mm"),
    "brow-medial-start": r(((dx(P[55], enL) + dx(P[285], enR)) / 2) / pfl),
    "brow-interbrow": r(d(P[55], P[285]) / enEn),
    // nose
    "nose-alar-width": r(alW * mm, "mm"),
    "nose-alar-intercanthal": r(alW / enEn),
    "nose-alar-face-width": r(alW / zy),
    "nose-nasal-index": r((alW / nsn) * 100, "index"),
    "nose-length-face": r(nsn / nme),
    "nose-deviation": r(deg(Math.atan2(sn[0] - n[0], sn[1] - n[1])), "°"),
    // lips
    "lip-mouth-width": r(mouth * mm, "mm"),
    "lip-mouth-nose": r(mouth / alW),
    "lip-mouth-intercanthal": r(mouth / enEn),
    "lip-mouth-ipd": r(mouth / ipd),
    "lip-mouth-face": r(mouth / zy),
    "lip-upper-vermilion": r(d(ls, P[13]) * mm, "mm"),
    "lip-lower-vermilion": r(d(P[14], li) * mm, "mm"),
    "lip-vermilion-ratio": r(d(ls, P[13]) / d(P[14], li)),
    "lip-vermilion-mouth": r(d(ls, li) / mouth),
    "lip-upper-lip-height": r(d(sn, sto) / d(sto, me)),
    "lip-philtrum-length": r(d(sn, ls) * mm, "mm"),
    "lip-upper-vermilion-to-lip": r(d(ls, sto) / d(sn, sto)),
    "lip-lower-vermilion-to-chin": r(d(sto, li) / d(sto, me)),
    "lip-area-lower-third": r((lipArea / polyArea(lowerThird)) * 100, "%"),
    // cheeks / midface
    "cheek-bizygomatic": r(zy * mm, "mm"),
    "cheek-midface-index": r((d(g, sn) / d(g, me)) * 100, "%"),
    "cheek-prominence": r(zy / ((d(ftL, ftR) + atMouth) / 2)),
    "cheek-cheekbone-height": r(((zyL[1] + zyR[1]) / 2 - eyeY) / (sto[1] - eyeY)),
    // jaw / chin
    "jaw-bigonial": r(go * mm, "mm"),
    "jaw-to-cheek": r(go / zy),
    "jaw-mandible-biocular": r(go / exEx),
    "jaw-lowerface-mandible": r(snme / go),
    "jaw-height-to-bigonial": r(nme / go),
    "jaw-lowerface-index": r(snme / nme),
    "chin-height": r(d(li, me) / snme),
  };
}
