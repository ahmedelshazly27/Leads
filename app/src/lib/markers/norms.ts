/*
 * Numeric norms used to place a value, taken from the catalogue rows
 * (research_notes/marker_catalogue/frontal.md). Saudi norms are preferred
 * where the catalogue has them (Gulf launch); otherwise the best-documented
 * group. sd = null means the source gives only a group mean ("ratio of
 * means"): the value is shown as a reference, never as high/low.
 */

export interface Norm {
  mean: number;
  sd: number | null;
  /** who the norm describes, e.g. "Saudi adults, 3D (n = 50)" */
  group: string;
}

type Pair = { m?: Norm; f?: Norm };
const N = (mean: number, sd: number | null, group: string): Norm => ({ mean, sd, group });
const both = (n: Norm): Pair => ({ m: n, f: n });

export const NORMS: Record<string, Pair> = {
  "gen-mid-to-lower-third": { m: N(0.9, 0.09, "Saudi adults, 3D (n = 50)"), f: N(0.97, 0.13, "Saudi adults, 3D (n = 44)") },
  "gen-morph-facial-index": { m: N(0.9, 0.08, "Saudi adults, 3D (n = 50)"), f: N(0.87, 0.14, "Saudi adults, 3D (n = 44)") },
  "gen-fwhr": { m: N(1.86, 0.13, "Adults, mostly Caucasian (n = 37)"), f: N(1.8, 0.1, "Adults (n = 51)") },
  "gen-horizontal-fifths": { f: N(20.85, 1.35, "Egyptian women, middle fifth (n = 300)") },
  "gen-forehead-width": { m: N(0.83, null, "North American white adults"), f: N(0.86, null, "North American white adults") },
  "gen-ipd-face-width": { f: N(0.46, null, "Most attractive in a study of women’s faces") },
  "gen-vertical-dystopia": both(N(1.57, 1.1, "Korean adults (n = 76)")),
  "eye-pfl": { m: N(32.85, 2.73, "Saudi adults (n = 75)"), f: N(32.41, 3.44, "Saudi adults (n = 93)") },
  "eye-pfh": { m: N(11.61, 1.02, "Caucasian adults, 3D"), f: N(11.63, 1.04, "Caucasian adults, 3D") },
  "eye-pf-index": { m: N(0.37, 0.03, "Caucasian adults, 3D"), f: N(0.39, 0.03, "Caucasian adults, 3D") },
  "eye-canthal-tilt": { m: N(6.51, 2.67, "Attractive male celebrities (n = 21)"), f: N(8.5, 2.1, "Attractive female celebrities (n = 21)") },
  "eye-intercanthal": { m: N(30.3, 3.1, "Saudi adults (n = 75)"), f: N(30.32, 2.4, "Saudi adults (n = 93)") },
  "eye-orbital-canon": { m: N(0.92, null, "Saudi adults"), f: N(0.94, null, "Saudi adults") },
  "eye-canthal-index": { m: N(36.1, null, "Saudi adults, 3D"), f: N(34.1, null, "Saudi adults, 3D") },
  "eye-ipd": { m: N(63.93, 3.25, "Caucasian adults, 3D"), f: N(60.36, 2.86, "Caucasian adults, 3D") },
  "eye-biocular-to-face": { m: N(0.71, null, "Saudi adults, 3D"), f: N(0.7, null, "Saudi adults, 3D") },
  "eye-mrd1": { m: N(2.5, 0.56, "Attractive male celebrities"), f: N(3.3, 0.94, "Attractive female celebrities") },
  "eye-scleral-show": both(N(0, null, "None showed it in attractive celebrities")),
  "eye-iris-to-pfl": { m: N(0.39, null, "Caucasian adults"), f: N(0.4, null, "Caucasian adults") },
  "brow-height-midpupil": { m: N(9.48, 2.22, "Caucasian adults, 3D"), f: N(10.93, 2.32, "Caucasian adults, 3D") },
  "brow-medial-height": { m: N(17.36, 1.99, "Caucasian adults, 3D"), f: N(17.52, 2.32, "Caucasian adults, 3D") },
  "brow-tail-height": { m: N(15.92, 2.89, "Caucasian adults, 3D"), f: N(18.53, 2.86, "Caucasian adults, 3D") },
  "brow-length": { m: N(69.54, 5.79, "Caucasian adults, 3D"), f: N(61.37, 6.1, "Caucasian adults, 3D") },
  "brow-tail-endpoint": { m: N(18.4, 2.2, "Celebrities"), f: N(18.7, 2.4, "Celebrities") },
  "nose-alar-width": { m: N(36.85, 3.16, "Saudi adults (n = 75)"), f: N(32.87, 3.29, "Saudi adults (n = 93)") },
  "nose-alar-intercanthal": { m: N(1.22, null, "Saudi adults"), f: N(1.08, null, "Saudi adults") },
  "nose-alar-face-width": { m: N(0.29, null, "Saudi adults, 3D"), f: N(0.26, null, "Saudi adults, 3D") },
  "nose-nasal-index": { m: N(68.1, null, "Saudi adults"), f: N(61.8, null, "Saudi adults") },
  "nose-length-face": { m: N(0.48, null, "Saudi adults, 3D"), f: N(0.5, null, "Saudi adults, 3D") },
  "lip-mouth-width": { m: N(49.88, 4.15, "Saudi adults, 3D (n = 50)"), f: N(48.75, 3.51, "Saudi adults, 3D (n = 44)") },
  "lip-mouth-nose": { m: N(1.31, null, "Saudi adults, 3D"), f: N(1.43, null, "Saudi adults, 3D") },
  "lip-mouth-intercanthal": { m: N(1.48, 0.16, "Saudi adults, 3D (n = 50)"), f: N(1.59, 0.13, "Saudi adults, 3D (n = 44)") },
  "lip-mouth-ipd": { m: N(0.77, null, "Yemeni adults"), f: N(0.76, null, "Yemeni adults") },
  "lip-mouth-face": { m: N(0.38, null, "Saudi adults, 3D"), f: N(0.38, null, "Saudi adults, 3D") },
  "lip-vermilion-ratio": { m: N(0.84, null, "North American white adults"), f: N(0.93, null, "North American white adults") },
  "lip-vermilion-mouth": { m: N(0.33, 0.07, "Saudi adults, 3D"), f: N(0.38, 0.06, "Saudi adults, 3D") },
  "lip-upper-lip-height": { f: N(0.47, null, "Egyptian women") },
  "lip-philtrum-length": { m: N(15.9, null, "North American white adults"), f: N(13.8, null, "North American white adults") },
  "lip-upper-vermilion-to-lip": { m: N(0.35, null, "North American white adults"), f: N(0.43, null, "North American white adults") },
  "lip-area-lower-third": { f: N(9.6, null, "Most attractive in a study of women’s faces") },
  "cheek-bizygomatic": { m: N(131.42, 11.21, "Saudi adults, 3D"), f: N(128.94, 8.23, "Saudi adults, 3D") },
  "cheek-midface-index": { f: N(45.53, 1.76, "Egyptian women (n = 300)") },
  "jaw-bigonial": { m: N(124.27, 9.79, "Saudi adults, 3D"), f: N(116.26, 9.68, "Saudi adults, 3D") },
  "jaw-to-cheek": { m: N(0.887, null, "Attractive male celebrities"), f: N(0.852, null, "Attractive female celebrities") },
  "jaw-mandible-biocular": { m: N(1.33, 0.095, "Saudi adults, 3D (n = 50)"), f: N(1.29, 0.091, "Saudi adults, 3D (n = 44)") },
  "jaw-lowerface-mandible": { m: N(0.51, 0.05, "Saudi adults, 3D"), f: N(0.51, 0.05, "Saudi adults, 3D") },
  "jaw-lowerface-index": { m: N(0.54, null, "Saudi adults, 3D"), f: N(0.52, null, "Saudi adults, 3D") },
};

/**
 * Markers whose mesh points only approximate the clinical landmark (the
 * catalogue marks them "≈"): eye corners sit inside the true canthi, 168 is
 * below soft-tissue nasion, 172/397 are not gonion. Their values are shown,
 * but not called high or low until the mesh is validated against
 * hand-placed landmarks.
 */
export const APPROX = new Set([
  "gen-mid-to-lower-third",
  "eye-pfl",
  "eye-pfh",
  "eye-pf-index",
  "eye-orbital-canon",
  "eye-iris-to-pfl",
  "eye-biocular-to-face",
  "eye-canthal-index",
  "brow-length",
  "brow-tail-endpoint",
  "brow-medial-height",
  "brow-height-midpupil",
  "jaw-bigonial",
  "jaw-to-cheek",
  "jaw-lowerface-mandible",
  "jaw-height-to-bigonial",
  "nose-length-face",
  "nose-nasal-index",
]);

export type Status = "typical" | "above" | "below" | "reference" | "none";

/** Place a value against its norm: within 1 SD = typical. */
export function place(id: string, value: number, sex: "male" | "female" | string): { status: Status; norm?: Norm; z?: number } {
  const pair = NORMS[id];
  const norm = sex === "female" ? pair?.f ?? pair?.m : pair?.m ?? pair?.f;
  if (!norm) return { status: "none" };
  if (norm.sd == null || norm.sd === 0 || APPROX.has(id)) return { status: "reference", norm };
  const z = (value - norm.mean) / norm.sd;
  return { status: Math.abs(z) <= 1 ? "typical" : z > 0 ? "above" : "below", norm, z };
}
