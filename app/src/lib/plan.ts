import type { Intake, Scan } from "./types";
import type { EvidenceGrade } from "./science";
import { MODIFIABLE, currentScores, overall, regionOf, type ScoreKey } from "./report";
import { clamp } from "./geometry";

/* ------------------------------------------------------------------ */
/*  Glow-up plan engine                                                */
/*                                                                    */
/*  Every item is triggered by a measurement or an intake answer,     */
/*  carries an evidence grade + references, a phase, costs, and the  */
/*  score gains it can plausibly produce within 12 months.           */
/* ------------------------------------------------------------------ */

export type Category =
  | "Skin"
  | "Body composition"
  | "Training"
  | "Sleep & recovery"
  | "Nutrition"
  | "Grooming"
  | "Hair"
  | "Posture"
  | "Lifestyle"
  | "Clinical (optional)";

export interface Task {
  id: string;
  label: string;
  cadence: "daily" | "weekly" | "once" | "monthly";
}

export interface PlanItem {
  id: string;
  category: Category;
  title: string;
  why: string; // personalised, references a measurement
  how: string[];
  grade: EvidenceGrade;
  refs: string[];
  phase: 1 | 2 | 3; // 1: weeks 0-4, 2: months 1-3, 3: months 3-12
  timeToVisible: string;
  monthly: [number, number]; // EUR range
  oneOff: [number, number];
  impact: Partial<Record<ScoreKey, number>>; // points at 12 months with good adherence
  drivenBy: string[];
  priority: 1 | 2 | 3; // 1 = highest
  tasks: Task[];
  /** shown in the "after" image */
  visual?: string;
  clinical?: boolean;
}

export interface Myth {
  title: string;
  verdict: string;
  refs: string[];
}

export const MYTHS: Myth[] = [
  {
    title: "Mewing to reshape the jaw",
    verdict: "No controlled studies show adult jaw or facial bone changes from tongue posture. Not included.",
    refs: [],
  },
  {
    title: "Jawline exerciser gum / devices",
    verdict: "No evidence for visible jawline change; heavy chewing can aggravate the jaw joint (TMJ). Not included.",
    refs: [],
  },
  {
    title: "Face yoga for lifting",
    verdict: "Only a small uncontrolled pilot (n=16) suggests modest cheek fullness changes. Optional, low priority.",
    refs: ["alam2018"],
  },
];

export interface Plan {
  items: PlanItem[];
  current: Partial<Record<ScoreKey, number>>;
  projected: Partial<Record<ScoreKey, number>>;
  overallNow: number;
  overallProjected: number;
  targetBodyFat: number | null;
  monthsToTarget: number | null;
  goal: { headline: [string, string]; summary: string };
  improvements: string[];
  drivers: string[];
}

const fmtPct = (x: number) => `${(x * 100).toFixed(1)}%`;

export function buildPlan(scan: Scan, intake: Intake): Plan {
  const items: PlanItem[] = [];
  const face = scan.face;
  const body = scan.body?.metrics ?? null;
  const male = intake.gender === "male";
  const female = intake.gender === "female";
  const drivers = new Set<string>();

  /* ------------------------------ Skin ------------------------------ */
  items.push({
    id: "spf",
    category: "Skin",
    title: "Daily broad-spectrum SPF 30+",
    why: "Sun exposure drives most visible skin ageing and uneven pigmentation; daily sunscreen is the single best-supported prevention step.",
    how: ["Apply ~1/4 teaspoon to face and neck every morning as the last skincare step", "Reapply when outdoors for more than 2 hours"],
    grade: "A",
    refs: ["hughes2013"],
    phase: 1,
    timeToVisible: "Prevents further damage; tone evens over 3–6 months",
    monthly: [8, 15],
    oneOff: [0, 0],
    impact: { skin: 4 },
    drivenBy: ["Skin evenness"],
    priority: 1,
    tasks: [{ id: "spf-am", label: "Apply SPF 30+ in the morning", cadence: "daily" }],
  });

  if (face) {
    const cov = face.skin.reduce((s, r) => s + r.coverage, 0) / Math.max(1, face.skin.length);
    const tex = face.skin.reduce((s, r) => s + r.texture, 0) / Math.max(1, face.skin.length);
    const worst = [...face.skin].sort((a, b) => b.coverage - a.coverage)[0];
    if (intake.activeAcne || cov > 0.03) {
      drivers.add("Uneven skin");
      items.push({
        id: "acne",
        category: "Skin",
        title: intake.activeAcne ? "Clear active acne: benzoyl peroxide + adapalene" : "Retinoid for texture and marks",
        why: `Flagged pigment/redness covers ${fmtPct(cov)} of measured skin on average${worst ? `, highest in the ${labelRegion(worst.key)} (${fmtPct(worst.coverage)})` : ""}. Topical retinoids and benzoyl peroxide are first-line, guideline-recommended treatments.`,
        how: [
          "Evening: pea-sized adapalene 0.1% gel on dry skin, start 3 nights/week, build to nightly",
          intake.activeAcne ? "Morning: benzoyl peroxide 2.5–5% wash on acne-prone areas" : "Morning: gentle cleanser, moisturiser, SPF",
          "Expect dryness for 2–4 weeks; moisturise; don't combine with other exfoliating acids at first",
          "See a dermatologist if no improvement after 12 weeks or if acne is nodular/scarring",
        ],
        grade: "A",
        refs: ["zaenglein2016", "weiss1988"],
        phase: 1,
        timeToVisible: "8–12 weeks",
        monthly: [10, 20],
        oneOff: [0, 0],
        impact: { skin: intake.activeAcne ? 14 : 9 },
        drivenBy: ["Skin coverage", "Texture"],
        priority: 1,
        tasks: [
          { id: "acne-pm", label: "Retinoid (adapalene) at night", cadence: "daily" },
          ...(intake.activeAcne ? [{ id: "acne-am", label: "Benzoyl peroxide wash (AM)", cadence: "daily" as const }] : []),
        ],
        visual: "active acne and post-acne marks resolved, natural pores and skin texture kept",
      });
    } else if (intake.age >= 25 || tex > 45) {
      items.push({
        id: "retinol",
        category: "Skin",
        title: "Night-time retinoid for texture and fine lines",
        why: `Skin texture index ${tex.toFixed(0)}/100. Retinoids are the best-evidenced topical for photo-ageing.`,
        how: ["Retinol 0.3–0.5% or adapalene 0.1% at night, 3×/week building to nightly", "Always pair with daily SPF"],
        grade: "A",
        refs: ["weiss1988", "mukherjee2006"],
        phase: 2,
        timeToVisible: "12–24 weeks",
        monthly: [10, 25],
        oneOff: [0, 0],
        impact: { skin: 6 },
        drivenBy: ["Texture"],
        priority: 2,
        tasks: [{ id: "retinol-pm", label: "Retinoid at night", cadence: "daily" }],
        visual: "smoother, more refined skin texture with natural pores",
      });
    }
    const red = face.skin.reduce((s, r) => s + r.redness, 0) / Math.max(1, face.skin.length);
    if (red > 45 || cov > 0.02) {
      items.push({
        id: "niacinamide",
        category: "Skin",
        title: "Niacinamide 4–5% serum",
        why: `Redness index ${red.toFixed(0)}/100 and pigment coverage ${fmtPct(cov)}. Niacinamide reduced blotchiness, redness and hyperpigmentation vs. vehicle in a controlled trial.`,
        how: ["Morning and/or evening on clean skin, before moisturiser"],
        grade: "B",
        refs: ["bissett2005"],
        phase: 1,
        timeToVisible: "8–12 weeks",
        monthly: [6, 12],
        oneOff: [0, 0],
        impact: { skin: 4 },
        drivenBy: ["Redness", "Pigmentation"],
        priority: 2,
        tasks: [{ id: "nia", label: "Niacinamide serum", cadence: "daily" }],
        visual: "redness calmed and skin tone evened",
      });
    }
  }

  /* ------------------------------ Sleep ----------------------------- */
  const rested = face ? regionOf(face, "underEye") : undefined;
  if (intake.sleepHours < 7 || (rested && rested.coverage > 0.06)) {
    drivers.add("Tired eye area");
    items.push({
      id: "sleep",
      category: "Sleep & recovery",
      title: "7–9 hours of sleep, fixed schedule",
      why: `You report ~${intake.sleepHours} h/night${rested ? ` and under-eye discolouration covers ${fmtPct(rested.coverage)}` : ""}. Sleep-deprived faces are rated less healthy and attractive, with darker under-eyes and hanging lids.`,
      how: ["Same wake time 7 days a week", "Screens off 45 min before bed; bedroom cool and dark", "Caffeine before 14:00 only"],
      grade: "B",
      refs: ["watson2015", "axelsson2010", "sundelin2017"],
      phase: 1,
      timeToVisible: "1–2 weeks",
      monthly: [0, 0],
      oneOff: [0, 0],
      impact: { rested: 18, skin: 2 },
      drivenBy: ["Under-eye", "Sleep"],
      priority: 1,
      tasks: [{ id: "sleep-7", label: "In bed for 7.5+ h, same wake time", cadence: "daily" }],
      visual: "rested eyes with less under-eye darkness and puffiness, eyelids slightly less heavy",
    });
  }

  /* ------------------------- Body composition ----------------------- */
  const bf = body?.bodyFatEstimate ?? null;
  const targetBF = male ? 12 : female ? 22 : 17;
  let monthsToTarget: number | null = null;
  const faceFull = face ? face.metrics.adiposity > 45 && !face.capture?.closeRange : false;
  const overTarget = bf != null ? bf > targetBF + 2 : faceFull;
  if (overTarget || (body && body.compositionScore < 65)) {
    drivers.add("Facial fullness");
    let pace = "";
    if (bf != null && intake.weightKg) {
      const fatToLose = (intake.weightKg * (bf - targetBF)) / 100 / (1 - targetBF / 100);
      const perWeek = intake.weightKg * 0.007; // 0.7% bodyweight/week
      monthsToTarget = clamp(Math.ceil(fatToLose / perWeek / 4.3), 1, 24);
      pace = ` Reaching ~${targetBF}% means losing ~${fatToLose.toFixed(1)} kg of fat — about ${monthsToTarget} months at 0.7% of body weight per week.`;
    }
    items.push({
      id: "fatloss",
      category: "Body composition",
      title: `Lean out toward ~${targetBF}% body fat`,
      why: `${bf != null ? `Estimated body fat ${bf.toFixed(0)}%.` : "Facial fullness is above the reference range."} Facial adiposity tracks body fat and is a strong cue to perceived health and attractiveness; losing fat reveals your existing cheekbones and jawline.${pace}`,
      how: [
        "Eat ~300–500 kcal/day below maintenance",
        "Aim to lose 0.5–1% of body weight per week; re-check monthly",
        "Keep protein high (see Nutrition) and keep lifting to protect muscle",
        "Walk 8–10k steps daily",
      ],
      grade: "A",
      refs: ["hall2011", "helms2014", "coetzee2009"],
      phase: 1,
      timeToVisible: "Face changes visible after ~4–5 kg of fat loss",
      monthly: [0, 0],
      oneOff: [0, 0],
      impact: { leanness: 30, body: 14, rested: 3 },
      drivenBy: ["Body fat", "Facial adiposity"],
      priority: 1,
      tasks: [
        { id: "kcal", label: "Hit calorie target", cadence: "daily" },
        { id: "steps", label: "8–10k steps", cadence: "daily" },
        { id: "weigh", label: "Weekly average weigh-in", cadence: "weekly" },
      ],
      visual: `lower body fat (about ${targetBF}%): reduced cheek and under-chin fullness so his own cheekbones and jawline read more clearly, fat loss only, same bone structure and jaw width`,
    });
  }
  items.push({
    id: "protein",
    category: "Nutrition",
    title: `Protein ~1.6 g/kg/day${intake.weightKg ? ` (~${Math.round(intake.weightKg * 1.6)} g)` : ""}`,
    why: "A meta-analysis found protein up to ~1.6 g/kg/day maximises resistance-training gains in lean mass, and high protein protects muscle during fat loss.",
    how: ["Spread over 3–5 meals, 25–40 g each", "Prioritise whole-food sources; whey is a convenient top-up"],
    grade: "A",
    refs: ["morton2018", "helms2014"],
    phase: 1,
    timeToVisible: "Supports visible change over 3–6 months",
    monthly: [15, 35],
    oneOff: [0, 0],
    impact: { body: 4 },
    drivenBy: ["Body composition"],
    priority: 2,
    tasks: [{ id: "protein", label: "Hit protein target", cadence: "daily" }],
  });
  items.push({
    id: "carotenoids",
    category: "Nutrition",
    title: "5+ portions of fruit & vegetables daily",
    why: "Raising fruit and vegetable intake produced perceptibly healthier, more attractive skin colour within ~6 weeks.",
    how: ["Add a portion at every meal; prioritise orange/red/green produce (carrots, peppers, tomatoes, spinach)"],
    grade: "B",
    refs: ["whitehead2012", "stephen2011"],
    phase: 1,
    timeToVisible: "6 weeks",
    monthly: [10, 25],
    oneOff: [0, 0],
    impact: { skin: 3 },
    drivenBy: ["Skin colour"],
    priority: 3,
    tasks: [{ id: "veg", label: "5 portions of fruit & veg", cadence: "daily" }],
    visual: "subtle healthy warm glow in the skin",
  });

  /* ------------------------------ Training -------------------------- */
  const swr = body?.shoulderToWaist ?? null;
  items.push({
    id: "lifting",
    category: "Training",
    title:
      male && swr != null && swr < 1.55
        ? "Resistance training 3–4×/week with shoulder & back emphasis"
        : "Resistance training 3–4×/week, full body",
    why:
      male && swr != null
        ? `Your shoulder-to-waist ratio is ${swr.toFixed(2)} (reference ≈ 1.6). Perceived upper-body strength explains most of the variance in men's bodily attractiveness; training each muscle 2×/week with ≥10 weekly sets maximises growth.`
        : "Training each muscle group at least twice weekly with ≥10 weekly sets maximises muscle gain and improves body shape and composition.",
    how: [
      `Currently ${intake.trainingDays} day(s)/week — build to 3–4`,
      "Each muscle 2×/week, 10–20 hard sets/week, 6–15 reps, 1–3 reps short of failure",
      ...(male ? ["Extra lateral raises, pull-ups/rows and overhead press for shoulder width"] : ["Include glute and back work for shape and posture"]),
      "Progressive overload: add reps or load each week",
    ],
    grade: "A",
    refs: ["schoenfeld2016", "schoenfeld2017", ...(male ? ["sell2017"] : [])],
    phase: 1,
    timeToVisible: "8–12 weeks",
    monthly: [25, 45],
    oneOff: [0, 0],
    impact: { body: 12, posture: 4 },
    drivenBy: swr != null ? ["Shoulder-to-waist ratio"] : ["Body composition"],
    priority: 1,
    tasks: [{ id: "train", label: "Training session", cadence: "weekly" }],
  });
  if (swr != null && male && swr < 1.55) drivers.add("Narrow V-taper");

  /* ------------------------------ Posture --------------------------- */
  if (body && (Math.abs(body.shoulderTilt) > 2 || Math.abs(body.hipTilt) > 2 || Math.abs(body.headOffset) > 6)) {
    drivers.add("Uneven posture");
    items.push({
      id: "posture",
      category: "Posture",
      title: "Frontal alignment routine",
      why: `Shoulder line tilt ${body.shoulderTilt.toFixed(1)}°, pelvis ${body.hipTilt.toFixed(1)}°. Reference standing alignment is level. Evidence that exercise corrects static asymmetry is limited; strength work and awareness are low-risk.`,
      how: ["Unilateral exercises (split squats, single-arm rows) 2×/week", "Check bag/phone habits that load one side", "Physio assessment if pain is present"],
      grade: "C",
      refs: ["kendall2005"],
      phase: 2,
      timeToVisible: "8–12 weeks",
      monthly: [0, 0],
      oneOff: [0, 0],
      impact: { posture: 10 },
      drivenBy: ["Shoulder tilt", "Pelvic tilt"],
      priority: 3,
      tasks: [{ id: "posture", label: "Unilateral strength work", cadence: "weekly" }],
    });
  }

  /* ------------------------------ Grooming -------------------------- */
  items.push({
    id: "brows",
    category: "Grooming",
    title: "Brow tidy — keep thickness",
    why: "Eyebrows are among the most important features for expression and recognition; thick brows are a masculine cue, so only stray hairs should go.",
    how: ["Remove hairs between the brows only (glabella)", "Trim long hairs with brow scissors; don't thin or reshape the arch"],
    grade: "C",
    refs: ["sadr2003"],
    phase: 1,
    timeToVisible: "Immediate",
    monthly: [0, 5],
    oneOff: [5, 15],
    impact: {},
    drivenBy: ["Brows"],
    priority: 3,
    tasks: [{ id: "brows", label: "Brow tidy", cadence: "monthly" }],
    visual: "only stray hairs between the brows tidied, same natural thickness, shape and position",
  });
  if (male) {
    const patchy = intake.facialHair === "patchy";
    items.push({
      id: "beard",
      category: "Grooming",
      title: patchy ? "Even heavy stubble with a defined neckline" : "Groomed heavy stubble or short beard",
      why: "Heavy stubble was rated most attractive in a large rating study; a clean neckline also sharpens the visible jaw line.",
      how: [
        "Trim to 3–5 mm every 3–4 days with a guard",
        "Neckline: one finger above the Adam's apple, curving up to behind the jaw angle",
        "Cheek line: natural, just tidy strays",
        ...(patchy ? ["Patchy areas often fill in with age; 3–6 months of growth shows your real coverage"] : []),
      ],
      grade: "B",
      refs: ["dixson2013"],
      phase: 1,
      timeToVisible: "2–3 weeks",
      monthly: [0, 5],
      oneOff: [40, 80],
      impact: {},
      drivenBy: ["Facial hair"],
      priority: 2,
      tasks: [{ id: "beard", label: "Trim stubble & neckline", cadence: "weekly" }],
      visual: "even, well-groomed heavy stubble (about 10 days) with a crisp neckline above the Adam's apple and a clean natural cheek line",
    });
    if (patchy && intake.preferences !== "non-invasive") {
      items.push({
        id: "beard-minox",
        category: "Clinical (optional)",
        title: "Topical minoxidil for beard density",
        why: "A small placebo-controlled trial found minoxidil modestly increased beard hair count over 16 weeks.",
        how: ["Discuss with a doctor first", "Typically applied once or twice daily to sparse areas; results fade if stopped"],
        grade: "B",
        refs: ["ingprasert2016"],
        phase: 2,
        timeToVisible: "16+ weeks",
        monthly: [10, 20],
        oneOff: [0, 0],
        impact: {},
        drivenBy: ["Patchy beard"],
        priority: 3,
        tasks: [{ id: "minox", label: "Minoxidil application", cadence: "daily" }],
        clinical: true,
      });
    }
  }

  /* ------------------------------ Hair ------------------------------ */
  const reach = intake.hairLengthCm + 12;
  items.push({
    id: "haircut",
    category: "Hair",
    title: hairAdvice(intake, face?.faceShape ?? null).title,
    why: `${hairAdvice(intake, face?.faceShape ?? null).why} Hair grows ~1 cm/month, so styles up to ~${reach} cm on top are reachable within 12 months. Evidence for specific cuts is limited — treat as grooming guidance.`,
    how: hairAdvice(intake, face?.faceShape ?? null).how,
    grade: "C",
    refs: ["saitoh1970"],
    phase: 1,
    timeToVisible: "Immediate at the barber",
    monthly: [20, 35],
    oneOff: [0, 0],
    impact: {},
    drivenBy: ["Face shape", "Hair type"],
    priority: 2,
    tasks: [{ id: "barber", label: "Barber / shape-up", cadence: "monthly" }],
    visual: hairAdvice(intake, face?.faceShape ?? null).visual,
  });
  if (intake.hairLoss !== "none") {
    items.push({
      id: "hairloss",
      category: "Clinical (optional)",
      title: "Treat androgenetic hair loss early",
      why: `You reported ${intake.hairLoss} hair loss. Finasteride and 5% minoxidil both have long-term randomised evidence; early treatment preserves more hair.`,
      how: ["See a GP or dermatologist to confirm the diagnosis", "Options: topical minoxidil 5%, oral/topical finasteride (prescription)"],
      grade: "A",
      refs: ["kaufman1998", "olsen2002"],
      phase: 1,
      timeToVisible: "6–12 months",
      monthly: [15, 40],
      oneOff: [60, 150],
      impact: {},
      drivenBy: ["Hair loss"],
      priority: 1,
      tasks: [{ id: "hairloss", label: "Hair-loss treatment", cadence: "daily" }],
      clinical: true,
    });
  }

  /* ------------------------------ Lifestyle ------------------------- */
  if (intake.smoking !== "no") {
    items.push({
      id: "smoking",
      category: "Lifestyle",
      title: "Stop smoking",
      why: "Smoking accelerates skin ageing by breaking down collagen and reducing its synthesis.",
      how: ["Set a quit date; nicotine replacement or GP support doubles success rates"],
      grade: "B",
      refs: ["morita2007"],
      phase: 1,
      timeToVisible: "Skin tone improves within months",
      monthly: [0, 0],
      oneOff: [0, 0],
      impact: { skin: 6, rested: 3 },
      drivenBy: ["Smoking"],
      priority: 1,
      tasks: [{ id: "smoke", label: "Smoke-free day", cadence: "daily" }],
    });
  }
  if (intake.drinking === "weekly" || intake.drinking === "daily") {
    items.push({
      id: "alcohol",
      category: "Lifestyle",
      title: "Cut alcohol to ≤ 2 drinks/week",
      why: "Heavier drinking is associated with under-eye puffiness, mid-face volume loss and visible vessels.",
      how: ["Alcohol-free weekdays", "Alternate with water when drinking"],
      grade: "B",
      refs: ["goodman2019"],
      phase: 1,
      timeToVisible: "2–4 weeks for puffiness",
      monthly: [0, 0],
      oneOff: [0, 0],
      impact: { rested: 6, leanness: 4 },
      drivenBy: ["Alcohol"],
      priority: 2,
      tasks: [{ id: "alcohol", label: "Alcohol-free day", cadence: "daily" }],
    });
  }

  if (intake.preferences === "non-invasive") {
    for (let i = items.length - 1; i >= 0; i--) if (items[i].clinical && items[i].id !== "hairloss") items.splice(i, 1);
  }
  items.sort((a, b) => a.priority - b.priority || a.phase - b.phase);

  /* ---------------------------- Projections ------------------------- */
  const current = currentScores(scan, intake);
  const gains: Partial<Record<ScoreKey, number>> = {};
  for (const it of items) for (const [k, v] of Object.entries(it.impact) as [ScoreKey, number][]) gains[k] = (gains[k] ?? 0) + v;
  const projected: Partial<Record<ScoreKey, number>> = {};
  for (const [k, v] of Object.entries(current) as [ScoreKey, number][]) {
    const g = MODIFIABLE[k] ? gains[k] ?? 0 : 0;
    // diminishing returns: gains shrink as the score approaches 100
    projected[k] = clamp(v + (g * (100 - v)) / 60, 0, 97);
  }

  const improvements = [
    current.skin != null && "Clearer, more even skin",
    (current.leanness ?? 100) < 80 && "Leaner face: visible cheekbones and jawline",
    (current.rested ?? 100) < 80 && "More rested, open eye area",
    body && "Stronger, better-proportioned physique",
    "Sharper grooming that frames the face",
  ].filter(Boolean) as string[];

  const fat = items.some((i) => i.id === "fatloss");
  return {
    items,
    current,
    projected,
    overallNow: overall(current),
    overallProjected: overall(projected),
    targetBodyFat: fat ? targetBF : null,
    monthsToTarget,
    goal: {
      headline: fat ? ["Reveal the structure", "you already have."] : ["Sharpen what's", "already working."],
      summary:
        "Every step below is triggered by one of your measurements and backed by published research. Bone structure isn't changed by habits — the plan focuses on what skin, body fat, sleep, training and grooming can realistically change within 12 months.",
    },
    improvements,
    drivers: [...drivers],
  };
}

function labelRegion(k: string) {
  return { forehead: "forehead", leftCheek: "left cheek", rightCheek: "right cheek", nose: "nose", underEye: "under-eye area", chin: "chin" }[k] ?? k;
}

export function hairAdvice(intake: Intake, shape: string | null) {
  const curly = intake.hairType === "curly" || intake.hairType === "coily";
  const wideFace = shape === "Round" || shape === "Square";
  const longFace = shape === "Oblong";
  if (intake.gender === "female") {
    return {
      title: "Face-framing cut with movement",
      why: `For a ${shape?.toLowerCase() ?? "balanced"} face, layers that start near the cheekbones balance width and add movement.`,
      how: ["Long layers starting at cheekbone level", "Trim every 8–10 weeks to keep ends healthy"],
      visual: "same hair colour and length, freshly cut with face-framing layers and healthy, glossy ends",
    };
  }
  const top = curly ? "defined curls" : intake.hairType === "wavy" ? "textured waves" : "texture";
  return {
    title: longFace ? `Medium length with fuller sides and ${top}` : `Tidy sides with ${top} and height on top`,
    why: longFace
      ? "With a longer face shape, keeping some width at the sides avoids exaggerating length."
      : wideFace
        ? "With a wider face, tighter sides and height on top lengthen the face visually."
        : "Tidy sides with volume on top keep the face looking balanced and sharp.",
    how: [
      longFace ? "Ask for scissor-cut sides kept medium, not faded high" : "Low or mid taper on the sides and back",
      `Keep ${Math.max(5, Math.min(10, intake.hairLengthCm))}–${Math.min(intake.hairLengthCm + 4, 15)} cm on top`,
      curly ? "Curl cream on damp hair, scrunch, air-dry or diffuse; avoid brushing dry curls" : "Matte paste or sea-salt spray for texture",
      "Shape-up every 4–6 weeks",
    ],
    visual: `same hair colour and natural ${intake.hairType} texture, freshly cut: ${longFace ? "medium sides" : "tapered sides"} with ${top} and natural volume on top, same hairline`,
  };
}

/* ------------------------------------------------------------------ */
/*  "After" image prompt — only plan-achievable changes                */
/* ------------------------------------------------------------------ */

export function afterPrompt(plan: Plan, intake: Intake): string {
  const changes = plan.items.filter((i) => i.visual).map((i, n) => `${n + 1}) ${i.visual}`);
  return [
    "Edit the first image (baseline studio portrait). Keep the exact same person, camera angle, framing, clothing, slate blue-grey studio background (#A9BDC4) and lighting so it lines up 1:1 as a before/after pair. Any further images are identity references only.",
    `Show the result of a realistic 12-month, evidence-based self-improvement plan, changing ONLY these things: ${changes.join("; ")}.`,
    "Must remain unmistakably the same person: identical eyes, eye shape, nose, lips, ears, bone structure, ethnicity and skin tone (do not lighten the skin). No surgery-like changes.",
    `Neutral relaxed expression, closed lips. Photorealistic, no makeup${intake.gender === "female" ? " beyond the person's usual" : ""}, no beauty filter, natural skin texture.`,
  ].join(" ");
}

export const BASELINE_PROMPT =
  "Clinical standardized portrait of the exact same person from the reference photos (first image frontal; any others are profiles used only to keep true face shape, nose and jaw accurate). Strictly preserve identity: identical face shape, bone structure, nose, eyes, eyelids, brows, lips, ears, hairline, hair, facial hair, same skin tone and texture including blemishes. Do not beautify, slim, smooth or idealize anything. Re-photograph as a neutral baseline: facing the camera straight on, head level, eyes into the lens, neutral relaxed expression with closed lips, shoulders square, plain black crew-neck t-shirt. Remove close-range selfie lens distortion as if shot from 1.5 m with an 85 mm lens. Plain seamless studio background in flat muted slate blue-grey (#A9BDC4), soft even frontal studio lighting. Head and upper chest framing. Photorealistic, no makeup, no retouching.";
