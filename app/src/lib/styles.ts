import type { FaceResult, Intake } from "./types";

/*
 * Hairstyle & beard style library.
 *
 * Styles are not invented by the image model: every "after" picks from this
 * curated list. What is "current" is editorial judgment, not science, so it
 * is labelled that way and only weighs lightly (+4) next to face fit.
 *
 * Source policy — no SEO / GEO content. Barber, salon and product-brand blogs
 * are written to rank in search and sell services; they are not cited.
 *   1. behaviour  — search-interest data for the launch markets
 *   2. editorial  — established regional fashion/grooming desks
 *   3. practitioner — partner barbers' booking data (primary once live)
 *   4. research   — peer-reviewed work on facial-hair perception
 */

export const REVIEWED_AT = "2026-11";

export type SourceKind = "behaviour" | "editorial" | "practitioner" | "research";

export const SOURCE_KINDS: { kind: SourceKind; label: string; note: string }[] = [
  { kind: "behaviour", label: "Search behaviour", note: "What people in the launch markets actually look up" },
  { kind: "editorial", label: "Editorial", note: "Established fashion desks with a regional edition" },
  { kind: "practitioner", label: "Partner barbers", note: "Most-requested cuts from partner bookings — replaces editorial once live" },
  { kind: "research", label: "Research", note: "Peer-reviewed; shows hair and facial hair change how a face is judged and why trends cycle — not which cut is in" },
];

export const TREND_SOURCES: { kind: SourceKind; name: string; url?: string }[] = [
  { kind: "behaviour", name: "Google Trends — men's haircut searches, United Arab Emirates", url: "https://trends.google.com/trends/explore?geo=AE&q=men%20haircut" },
  { kind: "behaviour", name: "Google Trends — men's haircut searches, Saudi Arabia", url: "https://trends.google.com/trends/explore?geo=SA&q=men%20haircut" },
  { kind: "editorial", name: "GQ Middle East — The 7 best short haircuts for men in 2026", url: "https://www.gqmiddleeast.com/article/the-7-best-short-haircuts-for-men-in-2026" },
  { kind: "editorial", name: "GQ Middle East — The best beards of the year", url: "https://www.gqmiddleeast.com/article/the-best-beards-of-the-year" },
  { kind: "editorial", name: "GQ Middle East — Inside the Gulf's hyper-groomed masculinity", url: "https://www.gqmiddleeast.com/article/inside-the-gulfs-hyper-groomed-masculinity" },
  { kind: "editorial", name: "GQ Middle East — The hair styling playbook for the UAE (climate)", url: "https://www.gqmiddleeast.com/article/the-hair-styling-playbook-for-a-good-mane-in-the-uae" },
  { kind: "practitioner", name: "Partner barber request log (Dubai, Riyadh) — pending first partners" },
  { kind: "research", name: "Janif, Brooks & Dixson 2014 — facial-hair preferences are negatively frequency-dependent (Biology Letters)", url: "https://doi.org/10.1098/rsbl.2013.0958" },
  { kind: "research", name: "Dixson & Brooks 2013 — heavy stubble rated most attractive (Evolution and Human Behavior)", url: "https://doi.org/10.1016/j.evolhumbehav.2013.02.003" },
  { kind: "research", name: "Mesko & Bereczkei 2004 — hairstyle changes rated attractiveness of the same (female) faces (Human Nature)", url: "https://doi.org/10.1007/s12110-004-1008-6" },
];

/** Face-fit rules below (height/sides/fringe, beard shape) are grooming guidance — not tested in studies. */
export const FACE_FIT_NOTE =
  "Face-fit reasons are expert grooming guidance. Research shows hairstyle and facial hair change how a face is judged, but specific cut-to-face-shape rules have not been tested.";

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
  /** visual effect on face proportions, -1..1 */
  fx: { height: number; sides: number; fringe: number };
  /** natural textures this cut is built around (no daily blow-drying to fight it) */
  worksWith: HairType[];
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
    fx: { height: 0, sides: 0.3, fringe: 0.7 },
    worksWith: ["straight", "wavy"]
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
    fx: { height: -0.3, sides: 0.1, fringe: 1 },
    worksWith: ["straight"]
  },
  {
    id: "curly-crop-taper",
    name: "Neat curly crop · low taper",
    status: "trending",
    gender: "male",
    hairTypes: ["wavy", "curly", "coily"],
    faceShapes: "any",
    topCm: [4, 7],
    heatFriendly: true,
    maintenanceWeeks: 3,
    barber: "Keep 5–6 cm of curl on top, cut dry and shaped round; sides scissor-cut or #4, subtle low taper only at the sideburns and nape, clean outline around the ears. Curl cream, push up and slightly back with one or two loose curls at the front.",
    prompt: "neat, shaped curly cut: about 5-6 cm of defined, tidy natural curls on top, shaped round and pushed slightly up and back off the forehead with one or two loose curls at the front, sides short but not shaved (scissor or #4 length, subtle low taper only at the sideburns and nape), clean outline around the ears, curl cream, matte, groomed not messy",
    fx: { height: 0.3, sides: 0.3, fringe: 0.3 },
    worksWith: ["wavy", "curly", "coily"]
  },
  {
    id: "medium-curls-subtle-taper",
    name: "Swept-back medium curls · subtle taper",
    status: "trending",
    gender: "male",
    hairTypes: ["wavy", "curly"],
    faceShapes: ["Oval", "Oblong", "Diamond", "Heart", "Square"],
    topCm: [7, 10],
    heatFriendly: false,
    maintenanceWeeks: 5,
    barber: "Keep 7–9 cm of curl on top, scissor-cut sides left with some length over the ears, only a subtle low taper at the sideburns and nape (no skin). Cut curls dry, curl cream, no gel.",
    prompt:
      "medium-length wavy-curly hair about 7-8 cm on top, styled with intention — swept back and slightly to one side with soft volume and defined loose curls, the front lifted off the forehead, sides fuller and tucked, subtle low taper only at the sideburns and nape, polished matte finish, groomed not messy",
    fx: { height: 0.2, sides: 0.7, fringe: 0.5 },
    worksWith: ["wavy", "curly"]
  },
  {
    id: "swept-curls-taper-fade",
    name: "Swept-back curls · taper fade",
    status: "trending",
    gender: "male",
    hairTypes: ["wavy", "curly"],
    faceShapes: ["Oval", "Oblong", "Diamond", "Heart", "Square"],
    topCm: [6, 9],
    heatFriendly: true,
    maintenanceWeeks: 3,
    barber: "Keep 6–8 cm of curl on top, swept back and slightly to one side. Mid taper fade on the sides and back (#2 to skin at the sideburns and nape), crisp outline around the ears. Ask for the beard to be faded into the taper.",
    prompt: "swept-back wavy-curly top about 7 cm with soft volume, swept back and slightly to one side, with a clean mid taper fade on the sides and back — blended short from about #2 down to skin at the sideburns and nape, smooth gradient, crisp outline around the ears",
    fx: { height: 0.3, sides: -0.2, fringe: -0.4 },
    worksWith: ["wavy", "curly"]
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
    fx: { height: -0.2, sides: 0.8, fringe: 0.4 },
    worksWith: ["straight", "wavy"]
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
    fx: { height: -0.5, sides: -0.6, fringe: 0 },
    worksWith: ["straight", "wavy", "curly", "coily"]
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
    fx: { height: 0.8, sides: -0.2, fringe: -0.5 },
    worksWith: ["straight", "wavy"]
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
    fx: { height: 1, sides: -0.4, fringe: -1 },
    worksWith: ["straight"]
  },
];

export interface BeardStyle {
  id: string;
  name: string;
  status: TrendStatus;
  needsDensity: "any" | "medium" | "full";
  prompt: string;
  /** chin: adds length at the chin; sides: adds width on the cheeks; jaw: draws a defined jaw line; chinWidth: squares/widens the chin */
  fx: { chin: number; sides: number; jaw: number; chinWidth: number };
}

export const BEARDS: BeardStyle[] = [
  {
    id: "faded-italian",
    name: "Faded Italian beard",
    status: "trending",
    needsDensity: "medium",
    prompt: "Italian-style faded beard: short full beard about 6-10 mm, dense on the chin, moustache and along the jaw, cheeks kept low and natural, fading down shorter into the sideburns so it blends into the hair, connected moustache, clean neckline one finger above the Adam's apple",
    fx: { chin: 0, sides: 0.3, jaw: 0.9, chinWidth: 0.4 },
  },
  {
    id: "chin-forward-boxed",
    name: "Boxed beard · longer chin",
    status: "classic",
    needsDensity: "medium",
    prompt: "boxed beard kept short and tight on the cheeks with a little extra length (1.5-2 cm) at the chin, clean neckline",
    fx: { chin: 0.9, sides: -0.4, jaw: 0.7, chinWidth: 0.3 },
  },
  {
    id: "short-boxed",
    name: "Short boxed beard",
    status: "trending",
    needsDensity: "medium",
    prompt: "short boxed beard about 6-8 mm, filled and even, with a shadow fade into the sideburns, clean natural cheek line and a neckline one finger above the Adam's apple",
    fx: { chin: 0, sides: 0.6, jaw: 0.8, chinWidth: 0.6 }
  },
  {
    id: "shadow-fade",
    name: "Shadow-fade beard",
    status: "trending",
    needsDensity: "any",
    prompt: "heavy stubble to short beard 4-6 mm, fading shorter up the cheeks into the sideburns, crisp neckline",
    fx: { chin: -0.3, sides: 0.2, jaw: 0.6, chinWidth: 0.2 }
  },
  {
    id: "refined-full",
    name: "Refined short full beard",
    status: "trending",
    needsDensity: "full",
    prompt: "refined short full beard about 1 cm, even and dense, softly faded at the sideburns, clean cheek line and neckline",
    fx: { chin: 0.5, sides: 0.7, jaw: 0.7, chinWidth: 0.5 }
  },
  {
    id: "heavy-stubble",
    name: "Heavy stubble",
    status: "classic",
    needsDensity: "any",
    prompt: "even heavy stubble about 3-5 mm with a crisp neckline",
    fx: { chin: -0.5, sides: 0, jaw: 0.3, chinWidth: 0 }
  },
];

/* ------------------------------------------------------------------ */
/*  Face fit: in-style options ranked by how well they balance THIS face */
/* ------------------------------------------------------------------ */

export interface FaceNeeds {
  /** + = wide face (benefits from length/height), − = long/narrow face (benefits from width, fringe) */
  width: number;
  /** + = long lower third (keep the chin short) */
  lowerLong: number;
  /** + = wide forehead (fringe helps) */
  foreheadWide: number;
  /** + = soft jaw line (a defined beard line helps) */
  jawSoft: number;
  /** + = narrow chin (a squared beard widens it) */
  chinNarrow: number;
  notes: string[];
}

export function faceNeeds(face: FaceResult | null): FaceNeeds | null {
  if (!face || face.capture?.closeRange) return null; // selfie distortion makes width readings unreliable
  const m = face.metrics;
  const n: FaceNeeds = {
    width: (m.faceWHR - 0.86) / 0.05,
    lowerLong: (0.95 - m.midToLowerThird) / 0.06,
    foreheadWide: (m.foreheadToFaceWidth - 0.82) / 0.04,
    jawSoft: (m.adiposity - 35) / 15 + (0.8 - m.jawToFaceWidth) / 0.05,
    chinNarrow: (0.52 - m.chinWidthToMouth) / 0.05,
    notes: [],
  };
  if (n.width < -0.5) n.notes.push(`slightly long, narrow face (width ÷ height ${m.faceWHR.toFixed(2)} vs ≈0.86)`);
  if (n.width > 0.5) n.notes.push(`wider face (width ÷ height ${m.faceWHR.toFixed(2)} vs ≈0.86)`);
  if (n.lowerLong > 0.5) n.notes.push(`longer lower third (mid ÷ lower ${m.midToLowerThird.toFixed(2)} vs ≈0.95)`);
  if (n.foreheadWide > 0.5) n.notes.push(`wider forehead (${m.foreheadToFaceWidth.toFixed(2)} of face width vs ≈0.82)`);
  if (n.jawSoft > 0.5) n.notes.push("softer jaw line");
  if (n.chinNarrow > 0.5) n.notes.push("narrow chin");
  return n;
}

export interface Ranked<T> {
  item: T;
  fit: number; // 0..100
  reasons: string[];
}

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

export function rankHair(intake: Intake, face: FaceResult | null): Ranked<HairStyle>[] {
  const n = faceNeeds(face);
  const g = intake.gender === "female" ? "female" : "male";
  const reachTop = intake.hairLengthCm + 12; // ~1 cm/month (Saitoh 1970)
  return HAIRSTYLES.filter(
    (s) => s.status !== "fading" && (s.gender === "any" || s.gender === g) && s.hairTypes.includes(intake.hairType) && s.topCm[0] <= reachTop,
  )
    .map((s) => {
      const reasons: string[] = [];
      let fit = 60;
      if (n) {
        // wide face → height lengthens, side volume widens; long face → the reverse
        const h = s.fx.height * n.width * 10;
        const sd = -s.fx.sides * n.width * 10;
        const fr = s.fx.fringe * (Math.max(0, n.foreheadWide) + Math.max(0, -n.width)) * 5;
        fit += h + sd + fr;
        if (h > 3) reasons.push(s.fx.height > 0 ? "height on top lengthens a wider face" : "staying low on top avoids lengthening a long face");
        if (h < -3) reasons.push(s.fx.height > 0 ? "adds height, which would lengthen an already long face" : "no height on top, so a wide face can read wider");
        if (sd > 3) reasons.push(s.fx.sides > 0 ? "keeps some width at the sides to balance a narrower face" : "tight sides avoid widening a wide face");
        if (sd < -3) reasons.push(s.fx.sides > 0 ? "side volume would widen a wide face" : "very tight sides narrow an already narrow face");
        if (fr > 3) reasons.push(n.foreheadWide > 0.5 ? "a forward fringe balances a wider forehead and shortens the face visually" : "a forward fringe shortens the face visually");
        if (fr < -3) reasons.push("swept-back styles expose and lengthen the forehead");
      }
      // working with natural texture: the cut holds in heat/humidity without daily heat styling
      if (s.worksWith.includes(intake.hairType)) {
        fit += 5;
        if (intake.hairType !== "straight") reasons.push(`built around your natural ${intake.hairType === "wavy" ? "wave" : "curl"} — no daily blow-drying`);
      } else {
        fit -= 3;
        reasons.push(`needs blow-drying to fight your natural ${intake.hairType === "wavy" ? "wave" : "curl"}`);
      }
      if (s.heatFriendly) fit += 4;
      if (s.status === "trending") fit += 4;
      return { item: s, fit: clamp(fit), reasons };
    })
    .sort((a, b) => b.fit - a.fit);
}

export function rankBeard(intake: Intake, face: FaceResult | null): Ranked<BeardStyle>[] {
  if (intake.gender !== "male") return [];
  const n = faceNeeds(face);
  const density = intake.facialHair === "full" ? 2 : intake.facialHair === "patchy" ? 1 : 0;
  const need = { any: 0, medium: 1, full: 2 } as const;
  return BEARDS.filter((b) => b.status !== "fading")
    .map((b) => {
      const reasons: string[] = [];
      let fit = 60;
      if (n) {
        const chin = b.fx.chin * (n.width - n.lowerLong) * 8;
        const sides = b.fx.sides * -n.width * 7;
        const jaw = b.fx.jaw * Math.max(0, n.jawSoft) * 6;
        const cw = b.fx.chinWidth * Math.max(0, n.chinNarrow) * 6;
        fit += chin + sides + jaw + cw;
        if (chin > 3) reasons.push(b.fx.chin > 0 ? "extra chin length elongates a wider face" : "keeps the chin short so a long lower face doesn't lengthen");
        if (chin < -3) reasons.push(b.fx.chin > 0 ? "chin length would make a long lower face longer" : "a very short chin can make a wide face read wider");
        if (sides > 3) reasons.push(b.fx.sides > 0 ? "fuller cheeks add width to a narrower face" : "tight cheeks avoid widening a wide face");
        if (sides < -3) reasons.push(b.fx.sides > 0 ? "full sides would widen a wide face" : "tight cheeks narrow an already narrow face");
        if (jaw > 2) reasons.push("a defined lower beard line sharpens the jaw contour");
        if (cw > 2) reasons.push("a squared chin line widens a narrow chin");
      }
      // patchy growth: styles needing density are reachable only with growth time / minoxidil
      const gap = need[b.needsDensity] - density;
      if (gap > 0) {
        fit -= gap * 12;
        reasons.push("needs denser growth than you have now (time or minoxidil)");
      }
      if (b.status === "trending") fit += 4;
      return { item: b, fit: clamp(fit), reasons };
    })
    .sort((a, b) => b.fit - a.fit);
}

/** Best-fitting in-style options (kept for existing callers). */
export function suggestHair(intake: Intake, face: FaceResult | null, n = 3): HairStyle[] {
  return rankHair(intake, face).slice(0, n).map((r) => r.item);
}

export function suggestBeard(intake: Intake, face: FaceResult | null = null): BeardStyle | null {
  return rankBeard(intake, face)[0]?.item ?? null;
}

/** Put the reviewer's pick first (if it is in the library and allowed for this person); fit order otherwise. */
export function withReview<T extends { id: string }>(ranked: Ranked<T>[], id?: string): { list: Ranked<T>[]; reviewed: boolean } {
  const i = id ? ranked.findIndex((r) => r.item.id === id) : -1;
  if (i <= 0) return { list: ranked, reviewed: i === 0 };
  return { list: [ranked[i], ...ranked.slice(0, i), ...ranked.slice(i + 1)], reviewed: true };
}
