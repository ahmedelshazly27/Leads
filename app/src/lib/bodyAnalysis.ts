import type { BodyMetrics, BodyResult, Intake, Pt } from "./types";
import type { PoseDetection } from "./vision";
import { clamp, closeness, deg, dist, mean, mid } from "./geometry";

/* MediaPipe Pose indices */
const B = {
  nose: 0,
  lShoulder: 11, rShoulder: 12,
  lElbow: 13, rElbow: 14,
  lWrist: 15, rWrist: 16,
  lHip: 23, rHip: 24,
  lKnee: 25, rKnee: 26,
  lAnkle: 27, rAnkle: 28,
  lHeel: 29, rHeel: 30,
  lFoot: 31, rFoot: 32,
};

export function bmiOf(intake: Intake) {
  if (!intake.heightCm || !intake.weightKg) return null;
  const m = intake.heightCm / 100;
  return intake.weightKg / (m * m);
}

/** Deurenberg et al. (1991) body-fat prediction from BMI, age and sex. */
export function deurenberg(bmi: number | null, age: number, gender: Intake["gender"]) {
  if (bmi == null) return null;
  const sex = gender === "male" ? 1 : gender === "female" ? 0 : 0.5;
  return clamp(1.2 * bmi + 0.23 * age - 10.8 * sex - 5.4, 3, 60);
}

/** Hodgdon & Beckett (1984) US Navy circumference method, metric units. */
export function navyBodyFat(intake: Intake) {
  const { heightCm: h, waistCm: w, neckCm: n, hipCm: hip, gender } = intake;
  if (!h || !w || !n) return null;
  if (gender === "female") {
    if (!hip || w + hip - n <= 0) return null;
    return clamp(495 / (1.29579 - 0.35004 * Math.log10(w + hip - n) + 0.221 * Math.log10(h)) - 450, 3, 60);
  }
  if (w - n <= 0) return null;
  return clamp(495 / (1.0324 - 0.19077 * Math.log10(w - n) + 0.15456 * Math.log10(h)) - 450, 3, 60);
}

export function bodyFat(intake: Intake): { value: number | null; method: "navy" | "deurenberg" | null } {
  const navy = navyBodyFat(intake);
  if (navy != null) return { value: navy, method: "navy" };
  const d = deurenberg(bmiOf(intake), intake.age, intake.gender);
  return { value: d, method: d == null ? null : "deurenberg" };
}

export function compositionScore(bf: number | null, bmi: number | null, gender: Intake["gender"]) {
  if (bf == null || bmi == null) return 60;
  const ideal = gender === "male" ? 14 : gender === "female" ? 23 : 18;
  return clamp(closeness(bf, ideal, 7) * 0.7 + closeness(bmi, 22, 3.5) * 0.3, 10, 99);
}

export function proportionScore(swr: number, whr: number, gender: Intake["gender"]) {
  if (gender === "male") return clamp(closeness(swr, 1.6, 0.18) * 0.75 + closeness(whr, 0.9, 0.08) * 0.25, 10, 99);
  if (gender === "female") return clamp(closeness(whr, 0.72, 0.07) * 0.75 + closeness(swr, 1.35, 0.18) * 0.25, 10, 99);
  return clamp((closeness(swr, 1.45, 0.2) + closeness(whr, 0.8, 0.09)) / 2, 10, 99);
}

export function postureScore(shoulderTilt: number, hipTilt: number, headOffset: number) {
  return clamp(100 - Math.abs(shoulderTilt) * 7 - Math.abs(hipTilt) * 7 - Math.abs(headOffset) * 1.1, 15, 99);
}

/** Width of the contiguous silhouette run through (cx, y) in mask pixels. */
function runAt(
  mask: NonNullable<PoseDetection["mask"]>,
  cx: number,
  y: number,
  limits?: [number | null, number | null, number],
): [number, number] | null {
  const { data, width, height } = mask;
  const yy = Math.round(y);
  if (yy < 0 || yy >= height) return null;
  let x = Math.round(cx);
  if (x < 0 || x >= width) return null;
  const on = (xx: number) => data[yy * width + xx] > 0.5;
  if (!on(x)) {
    // search a little either side for the body
    let found = -1;
    for (let k = 1; k < width * 0.05 && found < 0; k++) {
      if (x - k >= 0 && on(x - k)) found = x - k;
      else if (x + k < width && on(x + k)) found = x + k;
    }
    if (found < 0) return null;
    x = found;
  }
  let l = x, r = x;
  while (l > 0 && on(l - 1)) l--;
  while (r < width - 1 && on(r + 1)) r++;
  // limits = [leftArmCentre, rightArmCentre, armHalfWidth]; only clip when the
  // silhouette run actually extends into an arm (arm touching the torso).
  if (limits) {
    const [la, ra, half] = limits;
    if (la != null && l < la) l = Math.round(la + half);
    if (ra != null && r > ra) r = Math.round(ra - half);
  }
  return [l, r];
}

export function analyseBody(det: PoseDetection, intake: Intake, imgW: number, imgH: number): BodyResult {
  const L = det.landmarks;
  const mask = det.mask;
  const mw = mask?.width ?? imgW;
  const mh = mask?.height ?? imgH;
  const P = L.map(([x, y]) => [x * mw, y * mh] as Pt);

  const sh = mid(P[B.lShoulder], P[B.rShoulder]);
  const hp = mid(P[B.lHip], P[B.rHip]);
  const vis = det.visibility;
  const hasLegs = [B.lAnkle, B.rAnkle].every((i) => vis[i] > 0.5 && L[i][1] < 0.99);
  const feetY = Math.max(...[B.lHeel, B.rHeel, B.lFoot, B.rFoot, B.lAnkle, B.rAnkle].map((i) => P[i][1]));
  const ankleY = mean([P[B.lAnkle][1], P[B.rAnkle][1]]);

  // top of head: first silhouette row near the nose column
  let headTop = P[B.nose][1] - dist(P[B.lShoulder], P[B.rShoulder]) * 0.6;
  if (mask) {
    const cx = Math.round(P[B.nose][0]);
    for (let y = 0; y < P[B.nose][1]; y++) {
      if (mask.data[y * mask.width + cx] > 0.5) {
        headTop = y;
        break;
      }
    }
  }
  const height = hasLegs ? Math.max(1, feetY - headTop) : null;
  const torso = Math.max(1, hp[1] - sh[1]);
  const lmShoulder = dist(P[B.lShoulder], P[B.rShoulder]);
  const lmHip = dist(P[B.lHip], P[B.rHip]);
  const xAt = (y: number) => sh[0] + ((hp[0] - sh[0]) * (y - sh[1])) / torso;

  // Where the arms are at a given row, so a silhouette run can stop at the
  // inner edge of an arm that touches the torso.
  const armX = (y: number, sIdx: number, eIdx: number, wIdx: number) => {
    const segs: [Pt, Pt][] = [[P[sIdx], P[eIdx]], [P[eIdx], P[wIdx]]];
    for (const [a, b] of segs) {
      const lo = Math.min(a[1], b[1]), hi = Math.max(a[1], b[1]);
      if (y >= lo && y <= hi && hi > lo) return a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]);
    }
    return null;
  };
  const armHalf = lmShoulder * 0.11;
  const limitsAt = (y: number): [number | null, number | null, number] => {
    const xs = [armX(y, B.lShoulder, B.lElbow, B.lWrist), armX(y, B.rShoulder, B.rElbow, B.rWrist)];
    const c = xAt(y);
    let lo: number | null = null, hi: number | null = null;
    for (const x of xs) {
      if (x == null) continue;
      if (x < c) lo = Math.max(lo ?? -Infinity, x);
      else hi = Math.min(hi ?? Infinity, x);
    }
    return [lo, hi, armHalf];
  };

  let shoulderRun: [number, number] = [sh[0] - lmShoulder * 0.6, sh[0] + lmShoulder * 0.6];
  let waistRun: [number, number] = [hp[0] - lmHip * 0.75, hp[0] + lmHip * 0.75];
  let waistY = sh[1] + torso * 0.7;
  let hipRun: [number, number] = [hp[0] - lmHip * 0.95, hp[0] + lmHip * 0.95];
  let hipY = hp[1] + torso * 0.05;

  if (mask) {
    const sy = sh[1] + torso * 0.08;
    const s = runAt(mask, xAt(sy), sy);
    // deltoid-inclusive width; cap so arms resting on the torso don't inflate it
    if (s) {
      const w = Math.min(s[1] - s[0], lmShoulder * 1.45);
      const c = (s[0] + s[1]) / 2;
      shoulderRun = [c - w / 2, c + w / 2];
    }
    if (intake.gender === "female") {
      // natural waist: narrowest point between ribs and pelvis (Singh 1993)
      let best = Infinity;
      for (let t = 0.5; t <= 0.85; t += 0.02) {
        const y = sh[1] + torso * t;
        const r = runAt(mask, xAt(y), y, limitsAt(y));
        if (r && r[1] - r[0] < best && r[1] - r[0] > lmHip * 0.8) {
          best = r[1] - r[0];
          waistRun = r;
          waistY = y;
        }
      }
    } else {
      // WHO site: midway between lowest rib and iliac crest (~72% of acromion → hip joint)
      const rows = [0.7, 0.72, 0.74].map((t) => {
        const y = sh[1] + torso * t;
        return { y, r: runAt(mask, xAt(y), y, limitsAt(y)) };
      }).filter((x) => x.r);
      if (rows.length) {
        const avgW = mean(rows.map((x) => x.r![1] - x.r![0]));
        const mid = rows[Math.floor(rows.length / 2)];
        const c = (mid.r![0] + mid.r![1]) / 2;
        waistRun = [c - avgW / 2, c + avgW / 2];
        waistY = mid.y;
      }
    }
    let widest = 0;
    for (let t = -0.02; t <= 0.25; t += 0.02) {
      const y = hp[1] + torso * t;
      if (y >= mh - 2) break;
      const r = runAt(mask, xAt(y), y, limitsAt(y));
      if (r && r[1] - r[0] > widest && r[1] - r[0] < lmHip * 2.2) {
        widest = r[1] - r[0];
        hipRun = r;
        hipY = y;
      }
    }
  }

  const shoulderW = shoulderRun[1] - shoulderRun[0];
  const waistW = waistRun[1] - waistRun[0];
  const hipW = hipRun[1] - hipRun[0];

  const lineTilt = (a: Pt, b: Pt) => {
    const [left, right] = a[0] < b[0] ? [a, b] : [b, a];
    return deg(Math.atan2(right[1] - left[1], right[0] - left[0]));
  };
  const shoulderTilt = lineTilt(P[B.lShoulder], P[B.rShoulder]);
  const hipTilt = lineTilt(P[B.lHip], P[B.rHip]);
  const headOffset = ((P[B.nose][0] - mean([sh[0], hp[0]])) / lmShoulder) * 100;

  const armLen = (s: number, e: number, w: number) => dist(P[s], P[e]) + dist(P[e], P[w]);
  const la = armLen(B.lShoulder, B.lElbow, B.lWrist);
  const ra = armLen(B.rShoulder, B.rElbow, B.rWrist);
  const armSymmetry = clamp(100 - (Math.abs(la - ra) / mean([la, ra])) * 400);

  const bmi = bmiOf(intake);
  const bf = bodyFat(intake);
  const bodyFatEstimate = bf.value;
  const whrTape = intake.waistCm && intake.hipCm ? intake.waistCm / intake.hipCm : null;
  const whtr = intake.waistCm && intake.heightCm ? intake.waistCm / intake.heightCm : null;
  const swr = shoulderW / waistW;
  const whr = waistW / hipW;

  const pScore = proportionScore(swr, whrTape ?? whr, intake.gender);
  const postScore = postureScore(shoulderTilt, hipTilt, headOffset);
  const cScore = compositionScore(bodyFatEstimate, bmi, intake.gender);

  const metrics: BodyMetrics = {
    shoulderWidth: shoulderW / torso,
    waistWidth: waistW / torso,
    hipWidth: hipW / torso,
    shoulderToWaist: swr,
    waistToHip: whr,
    legToHeight: height ? (ankleY - hp[1]) / height : null,
    torsoToLeg: hasLegs ? torso / Math.max(1, ankleY - hp[1]) : null,
    shoulderTilt,
    hipTilt,
    headOffset,
    armSymmetry,
    bmi,
    bodyFatEstimate,
    bodyFatMethod: bf.method,
    whrTape,
    whtr,
    feetVisible: hasLegs,
    postureScore: postScore,
    proportionScore: pScore,
    compositionScore: cScore,
    bodyScore: clamp(pScore * 0.4 + postScore * 0.25 + cScore * 0.35),
  };

  const n = (x: number, y: number): Pt => [x / mw, y / mh];
  const sy = sh[1] + torso * 0.08;
  return {
    landmarks: L,
    imageAspect: imgW / imgH,
    metrics,
    lines: {
      shoulder: [n(shoulderRun[0], sy), n(shoulderRun[1], sy)],
      waist: [n(waistRun[0], waistY), n(waistRun[1], waistY)],
      hip: [n(hipRun[0], hipY), n(hipRun[1], hipY)],
    },
  };
}
