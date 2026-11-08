import type { Intake, Scan } from "./types";
import type { Plan } from "./plan";
import type { EvidenceGrade } from "./science";

/* ------------------------------------------------------------------ */
/*  Analysis-driven training plan                                      */
/*                                                                    */
/*  Each muscle's priority comes from a measurement (body ratios,     */
/*  side posture, composition). Weekly volume follows the dose-       */
/*  response evidence: more sets for priority muscles.                */
/* ------------------------------------------------------------------ */

export type Priority = "focus" | "build" | "maintain";

export type MuscleId =
  | "neck"
  | "traps"
  | "frontDelts"
  | "sideDelts"
  | "rearDelts"
  | "lats"
  | "chest"
  | "biceps"
  | "triceps"
  | "forearms"
  | "abs"
  | "obliques"
  | "glutes"
  | "quads"
  | "hamstrings"
  | "calves";

export interface Exercise {
  name: string;
  sets: number;
  reps: string;
  note?: string;
}

export interface MusclePlan {
  id: MuscleId;
  name: string;
  region: "front" | "back" | "both";
  zone: "upper" | "lower" | "core" | "neck";
  priority: Priority;
  corrective?: boolean; // daily low-load work rather than hypertrophy volume
  weeklySets: [number, number];
  reasons: string[];
  exercises: Exercise[];
  refs: string[];
  grade: EvidenceGrade;
}

export interface DayExercise extends Exercise {
  muscle: MuscleId;
  priority: Priority;
}

export interface TrainingDay {
  name: string;
  exercises: DayExercise[];
}

export interface Training {
  muscles: MusclePlan[];
  split: TrainingDay[];
  rampUp: TrainingDay[] | null; // 3-day full body for weeks 1–4 when starting from ≤ 2 days/week
  daily: Exercise[]; // corrective work done daily
  rules: string[];
  projection: {
    swrNow: number | null;
    swrRange: [number, number] | null;
    waistDropCm: [number, number] | null;
    leanGainKg: [number, number] | null;
    targetBodyFat: number | null;
    note: string;
  };
  refs: string[];
  notes: string[];
}

export const VOLUME: Record<Priority, [number, number]> = {
  focus: [14, 20],
  build: [10, 14],
  maintain: [6, 10],
};

const LIB: Record<MuscleId, { name: string; region: MusclePlan["region"]; zone: MusclePlan["zone"]; ex: Exercise[] }> = {
  neck: {
    name: "Deep neck flexors",
    region: "front",
    zone: "neck",
    ex: [
      { name: "Chin tucks", sets: 3, reps: "10 · 3 s hold", note: "Daily, slow, no strain" },
      { name: "Supine chin-tuck head lift", sets: 2, reps: "8–10", note: "Keep the chin tucked" },
      { name: "Wall angels", sets: 2, reps: "10", note: "Thoracic extension + lower-trap activation" },
    ],
  },
  traps: {
    name: "Mid & lower traps",
    region: "back",
    zone: "upper",
    ex: [
      { name: "Chest-supported row", sets: 3, reps: "8–12" },
      { name: "Prone Y-raise", sets: 3, reps: "12–15", note: "Thumbs up, slow" },
      { name: "Wide-grip seated cable row", sets: 3, reps: "10–12" },
    ],
  },
  frontDelts: {
    name: "Front delts",
    region: "front",
    zone: "upper",
    ex: [
      { name: "Overhead press", sets: 3, reps: "6–10" },
      { name: "Seated DB shoulder press", sets: 3, reps: "8–12" },
      { name: "Landmine press", sets: 3, reps: "10–12" },
    ],
  },
  sideDelts: {
    name: "Side delts",
    region: "both",
    zone: "upper",
    ex: [
      { name: "Cable lateral raise", sets: 3, reps: "12–20" },
      { name: "DB lateral raise", sets: 3, reps: "12–20", note: "Lead with the elbow" },
      { name: "Machine lateral raise", sets: 3, reps: "12–20" },
    ],
  },
  rearDelts: {
    name: "Rear delts",
    region: "back",
    zone: "upper",
    ex: [
      { name: "Reverse pec deck", sets: 3, reps: "12–20" },
      { name: "Face pull", sets: 3, reps: "15", note: "Pull to the forehead, externally rotate" },
      { name: "Rear-delt cable fly", sets: 3, reps: "12–20" },
    ],
  },
  lats: {
    name: "Lats",
    region: "back",
    zone: "upper",
    ex: [
      { name: "Pull-up / assisted pull-up", sets: 3, reps: "6–10" },
      { name: "Lat pulldown", sets: 3, reps: "8–12" },
      { name: "Single-arm cable row (lat bias)", sets: 3, reps: "10–12" },
    ],
  },
  chest: {
    name: "Chest",
    region: "front",
    zone: "upper",
    ex: [
      { name: "Incline DB press", sets: 3, reps: "8–12" },
      { name: "Machine or flat bench press", sets: 3, reps: "6–10" },
      { name: "Cable fly", sets: 3, reps: "12–15" },
    ],
  },
  biceps: {
    name: "Biceps",
    region: "front",
    zone: "upper",
    ex: [
      { name: "Incline DB curl", sets: 3, reps: "10–12" },
      { name: "Cable curl", sets: 3, reps: "12–15" },
      { name: "Hammer curl", sets: 3, reps: "10–12" },
    ],
  },
  triceps: {
    name: "Triceps",
    region: "back",
    zone: "upper",
    ex: [
      { name: "Overhead cable extension", sets: 3, reps: "10–15" },
      { name: "Rope pushdown", sets: 3, reps: "12–15" },
      { name: "Close-grip press or dips", sets: 3, reps: "8–10" },
    ],
  },
  forearms: {
    name: "Forearms",
    region: "both",
    zone: "upper",
    ex: [
      { name: "Covered by rows, curls and carries", sets: 0, reps: "—" },
      { name: "Farmer's carry (optional)", sets: 2, reps: "30–40 m" },
      { name: "Wrist curl (optional)", sets: 2, reps: "15–20" },
    ],
  },
  abs: {
    name: "Core (anti-extension)",
    region: "front",
    zone: "core",
    ex: [
      { name: "Dead bug", sets: 3, reps: "10 / side" },
      { name: "RKC plank", sets: 3, reps: "20–30 s" },
      { name: "Ab-wheel rollout", sets: 3, reps: "8–12" },
    ],
  },
  obliques: {
    name: "Obliques",
    region: "front",
    zone: "core",
    ex: [
      { name: "Pallof press", sets: 3, reps: "12 / side", note: "Anti-rotation, no added waist bulk" },
      { name: "Side plank", sets: 2, reps: "30 s / side" },
      { name: "Suitcase carry", sets: 2, reps: "30 m / side" },
    ],
  },
  glutes: {
    name: "Glutes",
    region: "back",
    zone: "lower",
    ex: [
      { name: "Hip thrust", sets: 3, reps: "8–12" },
      { name: "Romanian deadlift", sets: 3, reps: "8–10" },
      { name: "Bulgarian split squat", sets: 3, reps: "10 / leg" },
    ],
  },
  quads: {
    name: "Quads",
    region: "front",
    zone: "lower",
    ex: [
      { name: "Squat or leg press", sets: 3, reps: "6–10" },
      { name: "Leg extension", sets: 3, reps: "12–15" },
      { name: "Walking lunge", sets: 3, reps: "10 / leg" },
    ],
  },
  hamstrings: {
    name: "Hamstrings",
    region: "back",
    zone: "lower",
    ex: [
      { name: "Seated or lying leg curl", sets: 3, reps: "10–15" },
      { name: "Romanian deadlift", sets: 3, reps: "8–10" },
      { name: "45° back extension", sets: 3, reps: "12–15" },
    ],
  },
  calves: {
    name: "Calves",
    region: "both",
    zone: "lower",
    ex: [
      { name: "Standing calf raise", sets: 3, reps: "10–15", note: "Full stretch at the bottom" },
      { name: "Seated calf raise", sets: 3, reps: "12–20" },
      { name: "Leg-press calf raise", sets: 3, reps: "12–15" },
    ],
  },
};

const ORDER: MuscleId[] = [
  "sideDelts",
  "lats",
  "rearDelts",
  "traps",
  "chest",
  "frontDelts",
  "biceps",
  "triceps",
  "glutes",
  "quads",
  "hamstrings",
  "calves",
  "abs",
  "obliques",
  "forearms",
  "neck",
];

const RANK: Record<Priority, number> = { focus: 0, build: 1, maintain: 2 };
const up = (a: Priority, b: Priority): Priority => (RANK[a] <= RANK[b] ? a : b);

interface Draft {
  priority: Priority;
  reasons: string[];
  refs: Set<string>;
  grade: EvidenceGrade;
}

/* ------------------------------------------------------------------ */
/*  Priorities from the analysis                                       */
/* ------------------------------------------------------------------ */

function priorities(scan: Scan, intake: Intake) {
  const body = scan.body?.metrics ?? null;
  const side = scan.bodySide?.metrics ?? null;
  const male = intake.gender === "male";
  const female = intake.gender === "female";
  const d = {} as Record<MuscleId, Draft>;
  for (const id of ORDER) d[id] = { priority: "maintain", reasons: [], refs: new Set(["schoenfeld2017"]), grade: "A" };
  const set = (id: MuscleId, p: Priority, reason: string, refs: string[] = [], grade?: EvidenceGrade) => {
    d[id].priority = up(d[id].priority, p);
    if (reason && !d[id].reasons.includes(reason)) d[id].reasons.push(reason);
    refs.forEach((r) => d[id].refs.add(r));
    if (grade && (grade > d[id].grade)) d[id].grade = grade; // keep the weakest grade that applies
  };

  // Defaults
  if (male) set("chest", "build", "Default for balanced upper-body development");
  if (female) set("glutes", "focus", "Glute development shapes the waist-to-hip silhouette (WHR ≈ 0.7 is most preferred)", ["singh1993"]);
  set("quads", "maintain", "");
  set("hamstrings", "maintain", "");

  // V-taper
  const swr = body?.shoulderToWaist ?? null;
  if (swr != null && (male ? swr < 1.55 : swr < 1.35)) {
    const ref = female ? "1.35" : "1.6";
    const r = `Shoulder : waist ${swr.toFixed(2)} vs ≈${ref} reference`;
    set("sideDelts", "focus", r, ["sell2017"]);
    set("lats", "focus", `${r} — wider lats add upper-body width`, ["sell2017"]);
    set("rearDelts", "build", "Rounds out the shoulder from the side and back", ["sell2017"]);
  }

  // Arms
  const arm = body?.armToShoulder ?? null;
  if (arm != null && arm < 0.22) {
    const p: Priority = arm < 0.19 ? "focus" : "build";
    const r = `Upper-arm width ${(arm * 100).toFixed(0)}% of shoulder width (≈22%+ in trained men)`;
    set("biceps", p, r);
    set("triceps", p, `${r} — triceps are ~⅔ of upper-arm mass`);
  }

  // Forward head / rounded shoulders
  if (side && (side.headForward > 8 || side.earShoulderAngle < 76)) {
    const r = `Head ${side.headForward.toFixed(0)}% of torso length in front of the shoulder (ear–shoulder ${side.earShoulderAngle.toFixed(0)}°)`;
    set("neck", "focus", r, ["sheikhhoseini2018", "yip2008"], "B");
    set("traps", "focus", `${r} — mid/lower traps hold the shoulders back`, ["sheikhhoseini2018"], "B");
    set("rearDelts", "focus", `${r} — balance pressing with rear-delt work`, ["sheikhhoseini2018"], "B");
    d.chest.priority = "maintain";
    d.chest.reasons = ["Kept at maintenance while posture improves (avoid excess pressing)"];
    d.frontDelts.priority = "maintain";
  }
  if (side && side.shoulderForward > 6) {
    const r = `Shoulders ${side.shoulderForward.toFixed(0)}% of torso length ahead of the hips`;
    set("traps", "focus", r, ["kendall2005"], "C");
    set("rearDelts", "focus", r, ["kendall2005"], "C");
    d.chest.priority = "maintain";
  }

  // Lower back / belly
  if (side && (side.lumbarCurve > 12 || side.bellyProtrusion > 4)) {
    const r =
      side.bellyProtrusion > 4
        ? `Belly ${side.bellyProtrusion.toFixed(0)}% of torso length in front of the chest line`
        : `Lower-back curve ${side.lumbarCurve.toFixed(0)}% of torso length (descriptive)`;
    set("glutes", "build", `${r} — strong glutes support pelvic position`, ["kendall2005"], "C");
    set("abs", "build", `${r} — anti-extension core work. It doesn't burn belly fat; fat loss does (Vispute 2011)`, ["vispute2011"], "C");
  }

  // Central fat → no waist hypertrophy
  const bf = body?.bodyFatEstimate ?? null;
  const centralFat = (side && side.waistToChestDepth > 0.95) || (bf != null && bf > (female ? 26 : 18));
  if (centralFat) {
    d.obliques.priority = "maintain";
    d.obliques.reasons = [
      `${side ? `Navel depth ${(side.waistToChestDepth * 100).toFixed(0)}% of chest depth` : `Body fat ≈${bf?.toFixed(0)}%`} — no oblique hypertrophy (it widens the waist); anti-rotation only`,
    ];
  }

  // Legs not measured
  if (body && !body.feetVisible) {
    for (const id of ["quads", "hamstrings", "calves"] as const) {
      if (d[id].priority === "maintain") d[id].reasons = ["Legs not measured (feet out of frame) — balanced volume"];
    }
  }

  return d;
}

/** Top focus muscles, for use in the plan text (no dependency on Plan). */
export function focusMuscles(scan: Scan, intake: Intake, n = 3) {
  const d = priorities(scan, intake);
  return ORDER.filter((id) => d[id].priority === "focus")
    .slice(0, n)
    .map((id) => LIB[id].name);
}

/* ------------------------------------------------------------------ */
/*  Weekly split                                                       */
/* ------------------------------------------------------------------ */

const target = (p: Priority) => Math.round((VOLUME[p][0] + VOLUME[p][1]) / 2);

function buildSplit(muscles: MusclePlan[]): TrainingDay[] {
  const days: TrainingDay[] = [
    { name: "Upper A", exercises: [] },
    { name: "Lower A", exercises: [] },
    { name: "Upper B", exercises: [] },
    { name: "Lower B", exercises: [] },
  ];
  const dayIdx = (zone: MusclePlan["zone"], half: 0 | 1) => (zone === "upper" ? (half ? 2 : 0) : half ? 3 : 1);
  for (const m of muscles) {
    if (m.corrective || m.id === "forearms") continue;
    const total = target(m.priority);
    const halves = [Math.ceil(total / 2), Math.floor(total / 2)];
    halves.forEach((sets, half) => {
      const day = days[dayIdx(m.zone, half as 0 | 1)];
      const primary = m.exercises[half];
      const extra = m.exercises[2];
      if (sets > 5) {
        const a = Math.ceil(sets / 2);
        day.exercises.push({ ...primary, sets: a, muscle: m.id, priority: m.priority });
        day.exercises.push({ ...extra, sets: sets - a, muscle: m.id, priority: m.priority });
      } else {
        day.exercises.push({ ...primary, sets, muscle: m.id, priority: m.priority });
      }
    });
  }
  for (const day of days) day.exercises.sort((a, b) => RANK[a.priority] - RANK[b.priority]);
  return days;
}

function buildRampUp(muscles: MusclePlan[]): TrainingDay[] {
  const pick = muscles.filter((m) => !m.corrective && m.id !== "forearms" && m.id !== "obliques");
  return ["Full body 1", "Full body 2", "Full body 3"].map((name, i) => ({
    name,
    exercises: pick
      .filter((m) => m.priority !== "maintain" || ["quads", "hamstrings", "chest"].includes(m.id) || i === 1)
      .map((m) => ({ ...m.exercises[i % 3], sets: m.priority === "focus" ? 3 : 2, muscle: m.id, priority: m.priority }))
      .sort((a, b) => RANK[a.priority] - RANK[b.priority])
      .slice(0, 8),
  }));
}

/* ------------------------------------------------------------------ */
/*  Build                                                              */
/* ------------------------------------------------------------------ */

export function buildTraining(scan: Scan, intake: Intake, plan: Plan): Training {
  const d = priorities(scan, intake);
  const muscles: MusclePlan[] = ORDER.map((id): MusclePlan => {
    const lib = LIB[id];
    const corrective = id === "neck";
    return {
      id,
      name: lib.name,
      region: lib.region,
      zone: lib.zone,
      priority: d[id].priority,
      corrective,
      weeklySets: corrective ? [7, 7] : VOLUME[d[id].priority],
      reasons: d[id].reasons.length ? d[id].reasons : ["No measurement flagged — maintenance volume"],
      exercises: lib.ex,
      refs: [...d[id].refs],
      grade: d[id].grade,
    };
  }).sort((a, b) => RANK[a.priority] - RANK[b.priority]);

  const neck = muscles.find((m) => m.id === "neck")!;
  const daily = neck.priority === "focus" ? neck.exercises : [];
  const split = buildSplit(muscles);
  const rampUp = intake.trainingDays <= 2 ? buildRampUp(muscles) : null;

  /* ---- projection (honest ranges) ---- */
  const body = scan.body?.metrics ?? null;
  const bw = intake.weightKg ?? null;
  const bf = body?.bodyFatEstimate ?? null;
  const targetBF = plan.targetBodyFat ?? bf;
  const deficitMonths = Math.min(12, plan.monthsToTarget ?? 0);
  const restMonths = 12 - deficitMonths;
  let leanGainKg: [number, number] | null = null;
  if (bw) {
    // Year-one natural gains are commonly cited at ~0.5–1% of body weight per month
    // in a surplus/maintenance; roughly half that while in a deficit (grade C).
    const lo = bw * (0.0025 * deficitMonths + 0.005 * restMonths);
    const hi = bw * (0.005 * deficitMonths + 0.01 * restMonths);
    leanGainKg = [Math.round(lo * 2) / 2, Math.min(9, Math.round(hi * 2) / 2)];
  }
  let waistDropCm: [number, number] | null = null;
  let swrRange: [number, number] | null = null;
  const swrNow = body?.shoulderToWaist ?? null;
  if (body && bw && bf != null && targetBF != null && bf > targetBF) {
    const fatKg = (bw * (bf - targetBF)) / 100 / (1 - targetBF / 100);
    // ~0.8–1.2 cm of waist per kg of fat lost (rule of thumb, grade C)
    waistDropCm = [Math.round(fatKg * 0.8), Math.round(fatKg * 1.2)];
    const waistCm = body.waistEstCm ?? (intake.heightCm ? intake.heightCm * 0.53 : 90);
    const shrink = (cm: number) => Math.max(0.75, (waistCm - cm) / waistCm);
    if (swrNow) {
      swrRange = [
        Math.round(((swrNow * 1.03) / shrink(waistDropCm[0])) * 100) / 100,
        Math.round(((swrNow * 1.05) / shrink(waistDropCm[1])) * 100) / 100,
      ];
    }
  } else if (swrNow) {
    swrRange = [Math.round(swrNow * 1.03 * 100) / 100, Math.round(swrNow * 1.05 * 100) / 100];
  }

  const rules = [
    "Warm up: 5 min easy cardio, then 1–2 lighter sets of the first exercise",
    "Work sets 1–3 reps short of failure (RIR 1–3)",
    "Double progression: hit the top of the rep range on all sets → add 2.5–5% load next session",
    "Train each muscle twice a week; priority muscles first in the session",
    "Deload every 6–8 weeks: one week at ~half the sets",
    "Track sessions — progress shows in the log before the mirror",
  ];

  const notes = [
    "Face and jaw muscles are not trained here: jawline 'exercises' have no evidence for visible change — fat loss reveals the jaw.",
    "Indirect volume counts: rows add rear-delt and biceps work; presses add front-delt and triceps work.",
  ];
  if (rampUp) notes.unshift(`You train ${intake.trainingDays}×/week now: weeks 1–4 use a 3-day full-body plan to build the habit and technique, then move to the 4-day split.`);

  return {
    muscles,
    split,
    rampUp,
    daily,
    rules,
    projection: {
      swrNow,
      swrRange,
      waistDropCm,
      leanGainKg,
      targetBodyFat: targetBF ?? null,
      note: "Ranges, not promises: natural year-one gains vary 2× between people. Waist change uses ~0.8–1.2 cm per kg of fat lost; shoulder width +3–5% from delt and lat growth.",
    },
    refs: ["schoenfeld2016", "schoenfeld2017", "sell2017", "sheikhhoseini2018", "morton2018", "vispute2011"],
    notes,
  };
}
