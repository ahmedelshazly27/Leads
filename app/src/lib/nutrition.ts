import type { Intake, Scan } from "./types";
import type { Plan } from "./plan";

/*
 * Nutrition targets derived from the plan.
 *  - Resting energy: Mifflin–St Jeor (1990)
 *  - Total energy: activity factor from training days (estimate; recalibrate from weigh-ins)
 *  - Deficit sized to ~0.5–0.7 % body weight per week (Helms 2014), 7700 kcal ≈ 1 kg fat (Hall 2011 notes the
 *    true value drifts; we recalibrate monthly)
 *  - Protein: 2.0 g/kg in a deficit, 1.6–1.8 g/kg otherwise (Morton 2018; Helms 2014)
 */

export interface Macros {
  kcal: number;
  protein: number; // g
  fat: number; // g
  carbs: number; // g
  fibre: number; // g
  waterL: number;
}

export interface Meal {
  name: string;
  share: number; // of daily kcal
  macros: Pick<Macros, "kcal" | "protein" | "fat" | "carbs">;
  examples: string[];
}

export interface NutritionPhase {
  id: "fatloss" | "maintain" | "recomp";
  name: string;
  fromMonth: number;
  toMonth: number;
  macros: Macros;
  weeklyChangeKg: number; // negative = loss
  startWeight: number;
  endWeight: number;
  meals: Meal[];
  rationale: string;
}

export interface Nutrition {
  ok: true;
  weight: number;
  bmr: number;
  tdee: number;
  activityFactor: number;
  bodyFat: number | null;
  phases: NutritionPhase[];
  refs: string[];
  notes: string[];
}

export type NutritionResult = Nutrition | { ok: false; missing: string[] };

const round = (n: number, to = 1) => Math.round(n / to) * to;

export function mifflin(intake: Intake) {
  const { weightKg: w, heightCm: h, age, gender } = intake;
  if (!w || !h) return null;
  const s = gender === "male" ? 5 : gender === "female" ? -161 : -78;
  return 10 * w + 6.25 * h - 5 * age + s;
}

export function activityFactor(trainingDays: number) {
  if (trainingDays >= 6) return 1.725;
  if (trainingDays >= 4) return 1.55;
  if (trainingDays >= 2) return 1.465;
  return 1.375;
}

const MEAL_TEMPLATES: { name: string; share: number; examples: string[] }[] = [
  { name: "Breakfast", share: 0.25, examples: ["Eggs or egg whites with wholegrain bread", "Greek yogurt or laban with berries", "Ful medames with olive oil (small portion)"] },
  { name: "Lunch", share: 0.32, examples: ["Grilled chicken or hammour with brown rice", "Large salad / fattoush (light dressing)", "Lentil soup"] },
  { name: "Snack", share: 0.13, examples: ["Hummus with vegetables", "Whey shake or skyr", "2–3 dates with a handful of nuts"] },
  { name: "Dinner", share: 0.3, examples: ["Grilled fish or lean beef kofta", "Roasted vegetables + potatoes or freekeh", "Cottage cheese or labneh before bed"] },
];

function macrosFor(kcal: number, weight: number, proteinPerKg: number, fatShare: number): Macros {
  const protein = round(weight * proteinPerKg);
  const fat = round(Math.max(weight * 0.6, (kcal * fatShare) / 9));
  const carbs = Math.max(0, round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal: round(kcal, 10), protein, fat, carbs, fibre: round((kcal / 1000) * 14), waterL: Math.round(weight * 0.035 * 10) / 10 };
}

function meals(m: Macros): Meal[] {
  return MEAL_TEMPLATES.map((t) => ({
    name: t.name,
    share: t.share,
    macros: { kcal: round(m.kcal * t.share, 10), protein: round(m.protein * t.share), fat: round(m.fat * t.share), carbs: round(m.carbs * t.share) },
    examples: t.examples,
  }));
}

export function buildNutrition(scan: Scan, intake: Intake, plan: Plan): NutritionResult {
  const missing = [!intake.heightCm && "height", !intake.weightKg && "weight"].filter(Boolean) as string[];
  const bmr = mifflin(intake);
  if (missing.length || bmr == null) return { ok: false, missing };
  const weight = intake.weightKg!;
  const af = activityFactor(Math.max(intake.trainingDays, plan.items.some((i) => i.id === "lifting") ? 3 : 0));
  // the plan asks for 4 sessions/week; use the planned activity, not today's, once training starts
  const tdee = bmr * af;
  const bf = scan.body?.metrics.bodyFatEstimate ?? null;
  const minKcal = Math.max(bmr, intake.gender === "female" ? 1200 : 1500);
  const male = intake.gender === "male";
  const phases: NutritionPhase[] = [];
  const fatloss = plan.items.some((i) => i.id === "fatloss");

  if (fatloss && bf != null && plan.monthsToTarget) {
    const months = Math.min(12, plan.monthsToTarget);
    const weeklyLoss = weight * 0.006; // 0.6 %/week, middle of 0.5–0.7 %
    const dailyDeficit = Math.min((weeklyLoss * 7700) / 7, tdee * 0.25);
    const kcal = Math.max(minKcal, tdee - dailyDeficit);
    const actualWeekly = ((tdee - kcal) * 7) / 7700;
    const end = weight - actualWeekly * months * 4.33;
    const m1 = macrosFor(kcal, weight, 2.0, 0.27);
    phases.push({
      id: "fatloss",
      name: "Fat loss",
      fromMonth: 0,
      toMonth: months,
      macros: m1,
      weeklyChangeKg: -actualWeekly,
      startWeight: weight,
      endWeight: end,
      meals: meals(m1),
      rationale: `A ${round(tdee - kcal, 10)} kcal/day deficit targets ~${actualWeekly.toFixed(2)} kg/week (≈0.6 % of body weight). In a trial of strength-training athletes, ~0.7 %/week increased lean mass while a faster rate did not. High protein (2.0 g/kg) is recommended to help retain lean mass while you lose fat.`,
    });
    if (months < 12) {
      const tdee2 = (10 * end + 6.25 * intake.heightCm! - 5 * intake.age + (male ? 5 : intake.gender === "female" ? -161 : -78)) * af * 1.05;
      const m2 = macrosFor(tdee2, end, 1.8, 0.28);
      phases.push({
        id: "maintain",
        name: "Lean maintenance / slow gain",
        fromMonth: months,
        toMonth: 12,
        macros: m2,
        weeklyChangeKg: 0.05,
        startWeight: end,
        endWeight: end + 0.05 * (12 - months) * 4.33,
        meals: meals(m2),
        rationale: "Eat at maintenance plus ~5 % to support muscle gain while limiting fat regain (our guidance). Recalculated from your new weight.",
      });
    }
  } else {
    const m = macrosFor(tdee, weight, 1.8, 0.28);
    phases.push({
      id: "recomp",
      name: "Maintenance & recomposition",
      fromMonth: 0,
      toMonth: 12,
      macros: m,
      weeklyChangeKg: 0,
      startWeight: weight,
      endWeight: weight,
      meals: meals(m),
      rationale: "Eat at maintenance with high protein while training — body fat can slowly fall as muscle increases (recomposition); results vary between people.",
    });
  }

  return {
    ok: true,
    weight,
    bmr,
    tdee,
    activityFactor: af,
    bodyFat: bf,
    phases,
    refs: ["mifflin1990", "helms2014", "garthe2011", "morton2018", "hall2011"],
    notes: [
      "Energy needs are estimates; your real needs can differ by 10 % or more. Weigh yourself daily, compare weekly averages, and adjust by 100–150 kcal if the trend is off after 2–3 weeks.",
      "Activity assumes the plan's training schedule (3–4 sessions/week) plus daily steps.",
      "Not medical nutrition therapy. If you have a medical condition, are on medication, or have a history of disordered eating, see a registered dietitian first.",
    ],
  };
}
