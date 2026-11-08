import type { FaceResult, Intake } from "./types";

/*
 * Hairstyle & beard trend library.
 *
 * Styles are not invented by the image model: every "after" picks from this
 * curated list. The founder reviews it periodically (see REVIEWED_AT) using
 * barber/industry sources; `status` drives what gets offered.
 */

export const REVIEWED_AT = "2026-11";

export const TREND_SOURCES = [
  { name: "Behind the Chair — what men ask hairdressers for in 2026", url: "https://behindthechair.com/articles/what-men-are-actually-asking-their-hairdressers-for-in-2026/" },
  { name: "Style My Fade — 7 cuts barbers recommend (2026)", url: "https://stylemyfade.com/blog/mens-hair-trends-2026-the-cuts-barbers-are-actually-recommending" },
  { name: "Daimon Barber — men's hairstyles 2026", url: "https://www.daimonbarber.com/blogs/journal/men-s-hairstyles-2026-modern-cuts-fades-styling-tips" },
  { name: "Jason Makki (Dubai) — short haircuts trending in Dubai 2026", url: "https://www.jasonmakki.com/post/short-haircuts-men-dubai" },
  { name: "VIP Haircut for Men (UAE) — trending styles 2026", url: "https://vip-haircut-for-men.ae/blog/trending-mens-hairstyles-2026" },
  { name: "Beardbrand — best beard styles 2026", url: "https://www.beardbrand.com/blogs/urbanbeardsman/beard-styles" },
];

export type TrendStatus = "trending" | "classic" | "fading";
export type HairType = Intake["hairType"];

export interface HairStyle {
  id: string;
  name: string;
  status: TrendStatus;
  gender: "male" | "female" | "any";
  hairTypes: HairType[];
  faceShapes: FaceResult["faceShape"][] | "any";
  topCm: [number, number]; // length needed on top
  heatFriendly: boolean; // Gulf climate
  maintenanceWeeks: number; // barber visit interval
  barber: string; // what to ask for
  prompt: string; // image-model description (no identity changes)
}

export const HAIRSTYLES: HairStyle[] = [
  {
    id: "textured-crop-low-taper",
    name: "Textured crop · low taper",
    status: "trending",
    gender: "male",
    hairTypes: ["straight", "wavy", "curly"],
    faceShapes: "any",
    topCm: [3, 6],
    heatFriendly: true,
    maintenanceWeeks: 3,
    barber: "Low taper, softly blended (no harsh skin line). 4–5 cm on top, point-cut for choppy texture, short textured fringe. Matte clay.",
    prompt:
      "2026 textured crop with a soft low taper fade: sides softly blended (no harsh skin line), 4-5 cm of choppy, piece-y matte texture on top pushed slightly forward into a short, uneven textured fringe, natural matte clay finish, no shine, no tall quiff",
  },
  {
    id: "french-crop-mid-taper",
    name: "French crop · soft mid taper",
    status: "trending",
    gender: "male",
    hairTypes: ["straight", "wavy"],
    faceShapes: ["Oval", "Oblong", "Diamond", "Heart", "Square"],
    topCm: [3, 5],
    heatFriendly: true,
    maintenanceWeeks: 3,
    barber: "Soft mid taper, 3–4 cm on top brushed forward, short blunt-textured fringe.",
    prompt:
      "2026 French crop with a soft mid taper: sides softly blended, short textured top 3-4 cm brushed forward into a short blunt-textured fringe, matte natural finish",
  },
  {
    id: "curly-crop-taper",
    name: "Curly crop · taper",
    status: "trending",
    gender: "male",
    hairTypes: ["curly", "coily"],
    faceShapes: "any",
    topCm: [4, 8],
    heatFriendly: true,
    maintenanceWeeks: 3,
    barber: "Low or mid taper, keep 5–7 cm of curl on top, shape the curls round, light fringe.",
    prompt: "2026 curly crop: low taper fade, defined natural curls 5-7 cm on top shaped round with a light curly fringe, curl cream, matte",
  },
  {
    id: "middle-part-flow",
    name: "Middle part · flow",
    status: "trending",
    gender: "male",
    hairTypes: ["straight", "wavy"],
    faceShapes: ["Oval", "Square", "Diamond", "Heart"],
    topCm: [10, 15],
    heatFriendly: false,
    maintenanceWeeks: 6,
    barber: "Grow to 10–15 cm, soft middle part, light layers, scissor-cut sides tucked behind the ears.",
    prompt: "2026 middle-part flow: 10-15 cm of soft layered hair parted in the middle, falling as curtains to the temples, sides tucked behind the ears, natural texture, matte",
  },
  {
    id: "buzz-cut-soft-fade",
    name: "Buzz cut · soft fade",
    status: "trending",
    gender: "male",
    hairTypes: ["straight", "wavy", "curly", "coily"],
    faceShapes: ["Oval", "Square", "Diamond"],
    topCm: [0.5, 1.5],
    heatFriendly: true,
    maintenanceWeeks: 2,
    barber: "Guard #2–3 on top, soft fade to #1 on the sides, shaped hairline.",
    prompt: "2026 buzz cut: even #3 guard length on top with a soft blended fade on the sides, natural hairline",
  },
  {
    id: "messy-quiff",
    name: "Soft messy quiff",
    status: "classic",
    gender: "male",
    hairTypes: ["straight", "wavy"],
    faceShapes: ["Round", "Square"],
    topCm: [6, 9],
    heatFriendly: true,
    maintenanceWeeks: 4,
    barber: "Low taper, 6–8 cm on top, textured — styled up loosely, not slick.",
    prompt: "soft messy quiff: low taper, 6-8 cm textured top lifted loosely at the front, matte, not slick or glossy",
  },
  {
    id: "glossy-pompadour",
    name: "High, glossy quiff / pompadour",
    status: "fading",
    gender: "male",
    hairTypes: ["straight", "wavy"],
    faceShapes: "any",
    topCm: [8, 12],
    heatFriendly: false,
    maintenanceWeeks: 4,
    barber: "—",
    prompt: "",
  },
];

export interface BeardStyle {
  id: string;
  name: string;
  status: TrendStatus;
  needsDensity: "any" | "medium" | "full";
  prompt: string;
}

export const BEARDS: BeardStyle[] = [
  {
    id: "short-boxed",
    name: "Short boxed beard",
    status: "trending",
    needsDensity: "medium",
    prompt: "short boxed beard about 6-8 mm, filled and even, with a shadow fade into the sideburns, clean natural cheek line and a neckline one finger above the Adam's apple",
  },
  {
    id: "shadow-fade",
    name: "Shadow-fade beard",
    status: "trending",
    needsDensity: "any",
    prompt: "heavy stubble to short beard 4-6 mm, fading shorter up the cheeks into the sideburns, crisp neckline",
  },
  {
    id: "refined-full",
    name: "Refined short full beard",
    status: "trending",
    needsDensity: "full",
    prompt: "refined short full beard about 1 cm, even and dense, softly faded at the sideburns, clean cheek line and neckline",
  },
  {
    id: "heavy-stubble",
    name: "Heavy stubble",
    status: "classic",
    needsDensity: "any",
    prompt: "even heavy stubble about 3-5 mm with a crisp neckline",
  },
];

/** Pick up to `n` styles that fit the person, preferring trending, then classic. */
export function suggestHair(intake: Intake, face: FaceResult | null, n = 3): HairStyle[] {
  const shape = face && !face.capture?.closeRange ? face.faceShape : null;
  const g = intake.gender === "female" ? "female" : "male";
  const reachTop = intake.hairLengthCm + 12; // ~1 cm/month (Saitoh 1970)
  const rank = (s: HairStyle) =>
    (s.status === "trending" ? 0 : 1) * 10 +
    (shape && s.faceShapes !== "any" && !s.faceShapes.includes(shape) ? 5 : 0) +
    (s.heatFriendly ? 0 : 1);
  return HAIRSTYLES.filter(
    (s) =>
      s.status !== "fading" &&
      (s.gender === "any" || s.gender === g) &&
      s.hairTypes.includes(intake.hairType) &&
      s.topCm[0] <= reachTop,
  )
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, n);
}

export function suggestBeard(intake: Intake): BeardStyle | null {
  if (intake.gender !== "male") return null;
  // patchy growth: a shadow fade or boxed beard hides gaps best; full beards need density
  const density = intake.facialHair === "full" ? "full" : intake.facialHair === "patchy" ? "medium" : "any";
  return BEARDS.find((b) => b.status === "trending" && (b.needsDensity === "any" || b.needsDensity === density)) ?? BEARDS[0];
}
