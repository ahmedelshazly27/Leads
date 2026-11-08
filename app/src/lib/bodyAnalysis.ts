import type { BodyMetrics, BodyResult, Intake, Pt, SideMetrics, SideResult } from "./types";
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

/** Woolcott & Bergman (2018) Relative Fat Mass: needs only height and waist. */
export function rfm(heightCm: number, waistCm: number, gender: Intake["gender"]) {
  const female = gender === "female" ? 1 : gender === "other" ? 0.5 : 0;
  return clamp(64 - 20 * (heightCm / waistCm) + 12 * female, 3, 60);
}

/**
 * Waist circumference from photos: frontal waist width + side waist depth,
 * scaled by height (shoulder-to-hip-joint length ≈ 0.30 × stature), treating
 * the waist cross-section as an ellipse (Ramanujan perimeter).
 */
export function estimateWaistCm(body: BodyMetrics, side: SideMetrics | null, heightCm: number | null) {
  if (!side || !heightCm) return null;
  const torsoCm = 0.3 * heightCm;
  const a = (body.waistWidth * torsoCm) / 2;
  const b = (side.waistDepth * torsoCm) / 2;
  const per = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
  return per > 40 && per < 200 ? per : null;
}

export function bodyFat(intake: Intake, waistEstCm: number | null = null): { value: number | null; method: "navy" | "deurenberg" | "rfm-photo" | null } {
  const navy = navyBodyFat(intake);
  if (navy != null) return { value: navy, method: "navy" };
  const d = deurenberg(bmiOf(intake), intake.age, intake.gender);
  if (waistEstCm && intake.heightCm) {
    const r = rfm(intake.heightCm, waistEstCm, intake.gender);
    return { value: d != null ? (d + r) / 2 : r, method: "rfm-photo" };
  }
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

  /* ---- extra frontal widths: chest, upper arms, thighs, left/right balance ---- */
  let chestW = shoulderW * 0.85;
  const upperArms: number[] = [];
  const thighs: number[] = [];
  if (mask) {
    const cy = sh[1] + torso * 0.3;
    const c = runAt(mask, xAt(cy), cy, limitsAt(cy));
    if (c) chestW = c[1] - c[0];
    for (const [s0, e0] of [[B.lShoulder, B.lElbow], [B.rShoulder, B.rElbow]] as const) {
      const m = mid(P[s0], P[e0]);
      const r = runAt(mask, m[0], m[1]);
      // if the arm touches the torso the run explodes; ignore those
      if (r && r[1] - r[0] < lmShoulder * 0.45) upperArms.push(r[1] - r[0]);
    }
    const ty = hp[1] + torso * 0.3;
    if (ty < mh - 2) {
      for (const h of [B.lHip, B.rHip]) {
        const knee = h === B.lHip ? B.lKnee : B.rKnee;
        const x = det.visibility[knee] > 0.5 ? P[h][0] + (P[knee][0] - P[h][0]) * 0.3 : P[h][0];
        const r = runAt(mask, x, ty);
        if (r && r[1] - r[0] < lmHip * 1.4) thighs.push(r[1] - r[0]);
      }
    }
  }
  const upperArmW = upperArms.length ? mean(upperArms) : lmShoulder * 0.28;
  const thighW = thighs.length ? mean(thighs) : null;
  const halfDiff = (run: [number, number], y: number) => {
    const midX = xAt(y);
    const l = midX - run[0];
    const r = run[1] - midX;
    return ((r - l) / Math.max(1, (l + r) / 2)) * 100;
  };
  const lrDetail = {
    shoulder: halfDiff(shoulderRun, sh[1] + torso * 0.08),
    waist: halfDiff(waistRun, waistY),
    hip: halfDiff(hipRun, hipY),
  };
  const lrBalance = mean([Math.abs(lrDetail.shoulder), Math.abs(lrDetail.waist), Math.abs(lrDetail.hip)]);

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
    waistEstCm: null,
    whrTape,
    whtr,
    feetVisible: hasLegs,
    chestWidth: chestW / torso,
    upperArmWidth: upperArmW / torso,
    thighWidth: thighW != null ? thighW / torso : null,
    armToShoulder: upperArmW / shoulderW,
    lrBalance,
    lrDetail,
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

/**
 * Body metrics that depend on intake answers (height, weight, tape measures)
 * are recomputed whenever the intake changes, so editing "About you" updates
 * BMI, body fat and scores without a new scan.
 */
export function refreshBody(body: BodyResult, intake: Intake, side: SideMetrics | null = null): BodyResult {
  const m = body.metrics;
  const bmi = bmiOf(intake);
  const waistEstCm = estimateWaistCm(m, side, intake.heightCm);
  const bf = bodyFat(intake, waistEstCm);
  const whrTape = intake.waistCm && intake.hipCm ? intake.waistCm / intake.hipCm : null;
  const waist = intake.waistCm ?? waistEstCm;
  const whtr = waist && intake.heightCm ? waist / intake.heightCm : null;
  const pScore = proportionScore(m.shoulderToWaist, whrTape ?? m.waistToHip, intake.gender);
  const cScore = compositionScore(bf.value, bmi, intake.gender);
  return {
    ...body,
    metrics: {
      ...m,
      bmi,
      bodyFatEstimate: bf.value,
      bodyFatMethod: bf.method,
      waistEstCm,
      whrTape,
      whtr,
      proportionScore: pScore,
      compositionScore: cScore,
      bodyScore: clamp(pScore * 0.4 + m.postureScore * 0.25 + cScore * 0.35),
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Side view: sagittal posture and abdominal depth                    */
/* ------------------------------------------------------------------ */

const SIDE = {
  l: { ear: 7, shoulder: 11, hip: 23, knee: 25, ankle: 27 },
  r: { ear: 8, shoulder: 12, hip: 24, knee: 26, ankle: 28 },
};

/**
 * The clinical craniovertebral angle uses C7; pose models give the shoulder joint,
 * so this proxy reads higher. Target: ear stacked over the shoulder (≈ 80–90°).
 */
export function sidePostureScore(m: Pick<SideMetrics, "earShoulderAngle" | "headForward" | "shoulderForward" | "trunkLean">) {
  return clamp(
    100 -
      Math.max(0, 80 - m.earShoulderAngle) * 1.6 -
      Math.max(0, m.headForward - 5) * 1.2 -
      Math.abs(m.shoulderForward) * 1 -
      Math.abs(m.trunkLean) * 2,
    10,
    99,
  );
}

export function coreScore(waistToChestDepth: number, bellyProtrusion: number) {
  return clamp(100 - Math.max(0, waistToChestDepth - 0.85) * 160 - Math.max(0, bellyProtrusion) * 2.5, 10, 99);
}

export function analyseSide(det: PoseDetection, imgW: number, imgH: number): SideResult {
  const L = det.landmarks;
  const mask = det.mask;
  const mw = mask?.width ?? imgW;
  const mh = mask?.height ?? imgH;
  const P = L.map(([x, y]) => [x * mw, y * mh] as Pt);
  const vis = det.visibility;
  // use whichever side of the body faces the camera more
  const sideKey = vis[SIDE.l.shoulder] + vis[SIDE.l.ear] + vis[SIDE.l.hip] >= vis[SIDE.r.shoulder] + vis[SIDE.r.ear] + vis[SIDE.r.hip] ? "l" : "r";
  const S = SIDE[sideKey];
  const ear = P[S.ear], sh = P[S.shoulder], hp = P[S.hip];
  // facing: nose relative to ear
  const facing: "left" | "right" = P[0][0] < ear[0] ? "left" : "right";
  const dir = facing === "left" ? -1 : 1; // + = towards the front of the body
  const torso = Math.max(1, hp[1] - sh[1]);

  // ear–shoulder angle from horizontal (proxy for the craniovertebral angle)
  const dx = (ear[0] - sh[0]) * dir;
  const dy = sh[1] - ear[1];
  const earShoulderAngle = deg(Math.atan2(dy, Math.max(1e-6, dx)));
  const headForward = (dx / torso) * 100;
  const shoulderForward = (((sh[0] - hp[0]) * dir) / torso) * 100;
  const trunkLean = deg(Math.atan2((sh[0] - hp[0]) * dir, torso));

  // silhouette depths
  const midX = (y: number) => sh[0] + ((hp[0] - sh[0]) * (y - sh[1])) / torso;
  const run = (y: number) => (mask ? runAt(mask, midX(y), y) : null);
  const chestY = sh[1] + torso * 0.3;
  const waistY = sh[1] + torso * 0.75;
  const chestRun = run(chestY);
  const waistRun = run(waistY);
  const front = (r: [number, number]) => (dir < 0 ? r[0] : r[1]);
  const back = (r: [number, number]) => (dir < 0 ? r[1] : r[0]);
  const chestDepth = chestRun ? chestRun[1] - chestRun[0] : torso * 0.45;
  const waistDepth = waistRun ? waistRun[1] - waistRun[0] : torso * 0.4;
  const bellyProtrusion = chestRun && waistRun ? (((front(waistRun) - front(chestRun)) * dir) / torso) * 100 : 0;

  // back-edge curvature: compare the back edge with the straight line from upper back to glutes
  let lumbarCurve = 0;
  let upperBackCurve = 0;
  if (mask) {
    const edge: { t: number; x: number }[] = [];
    for (let t = 0.1; t <= 1.15; t += 0.05) {
      const y = sh[1] + torso * t;
      if (y >= mh - 2) break;
      const r = run(y);
      if (r) edge.push({ t, x: back(r) });
    }
    if (edge.length > 6) {
      const a = edge[0], b = edge[edge.length - 1];
      const off = (e: { t: number; x: number }) => {
        const lineX = a.x + ((b.x - a.x) * (e.t - a.t)) / Math.max(1e-6, b.t - a.t);
        return ((e.x - lineX) * dir) / torso; // + = inward (towards the front)
      };
      const lower = edge.filter((e) => e.t > 0.55 && e.t < 1.0).map(off);
      const upper = edge.filter((e) => e.t > 0.15 && e.t < 0.5).map(off);
      lumbarCurve = Math.max(0, ...lower) * 100;
      upperBackCurve = Math.max(0, ...upper.map((v) => -v)) * 100;
    }
  }

  const base = { earShoulderAngle, headForward, shoulderForward, trunkLean };
  const metrics: SideMetrics = {
    facing,
    earShoulderAngle,
    headForward,
    shoulderForward,
    trunkLean,
    chestDepth: chestDepth / torso,
    waistDepth: waistDepth / torso,
    waistToChestDepth: waistDepth / chestDepth,
    bellyProtrusion,
    lumbarCurve,
    upperBackCurve,
    postureScore: sidePostureScore(base),
    coreScore: coreScore(waistDepth / chestDepth, bellyProtrusion),
  };
  const n = (p: Pt): Pt => [p[0] / mw, p[1] / mh];
  // plumb line through the ankle when visible; otherwise through the hip joint
  const ankle = vis[S.ankle] > 0.5 && L[S.ankle][1] < 0.99 ? P[S.ankle] : hp;
  return {
    landmarks: L,
    imageAspect: imgW / imgH,
    metrics,
    lines: {
      plumb: [n([ankle[0], 0]), n([ankle[0], mh])],
      ear: n(ear),
      shoulder: n(sh),
      hip: n(hp),
      chest: chestRun ? [n([chestRun[0], chestY]), n([chestRun[1], chestY])] : [n([sh[0], chestY]), n([sh[0], chestY])],
      waist: waistRun ? [n([waistRun[0], waistY]), n([waistRun[1], waistY])] : [n([hp[0], waistY]), n([hp[0], waistY])],
    },
  };
}
