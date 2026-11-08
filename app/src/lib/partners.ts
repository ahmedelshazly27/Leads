/**
 * Partner directory. Every entry below is a FICTIONAL demo partner used to
 * build and test the booking flow — replace with real, contracted partners.
 */

export type PartnerCategory = "nutrition" | "aesthetic" | "dermatology" | "bodycomp" | "trainer" | "barber";
export type City = "Dubai" | "Abu Dhabi" | "Riyadh" | "Jeddah";

export const CATEGORY_LABEL: Record<PartnerCategory, string> = {
  nutrition: "Meal plans & dietitians",
  aesthetic: "Aesthetic clinics",
  dermatology: "Dermatology",
  bodycomp: "Body-composition scans",
  trainer: "Personal trainers",
  barber: "Barbers & grooming",
};

export const CLINICAL: PartnerCategory[] = ["aesthetic", "dermatology"];

/** What each partner type may receive, with the user's consent. Photos are never shared automatically. */
export const SHAREABLE: Record<PartnerCategory, { macros?: boolean; training?: boolean; allergies?: boolean; planSection?: boolean }> = {
  nutrition: { macros: true, allergies: true },
  trainer: { training: true },
  aesthetic: { planSection: true },
  dermatology: { planSection: true, allergies: true },
  bodycomp: {},
  barber: {},
};

export interface PartnerService {
  id: string;
  name: string;
  priceFrom: number;
  currency: "AED" | "SAR";
  duration: string;
}

export interface Partner {
  id: string;
  name: string;
  category: PartnerCategory;
  city: City;
  blurb: string;
  licence?: string;
  services: PartnerService[];
  demo: true;
}

const aed = (id: string, name: string, priceFrom: number, duration: string): PartnerService => ({ id, name, priceFrom, currency: "AED", duration });
const sar = (id: string, name: string, priceFrom: number, duration: string): PartnerService => ({ id, name, priceFrom, currency: "SAR", duration });

export const PARTNERS: Partner[] = [
  {
    id: "meridian-meals",
    name: "Meridian Meal Labs",
    category: "nutrition",
    city: "Dubai",
    blurb: "Macro-matched meal delivery built from your calorie and protein targets.",
    services: [aed("mm-week", "Macro-matched meals · 1 week (2 meals/day)", 420, "7 days"), aed("mm-month", "Macro-matched meals · 4 weeks", 1490, "28 days"), aed("mm-consult", "Dietitian consult (video)", 250, "30 min")],
    demo: true,
  },
  {
    id: "saffron-fit",
    name: "Saffron Fit Kitchen",
    category: "nutrition",
    city: "Riyadh",
    blurb: "Gulf-style home cooking, portioned to your macros.",
    services: [sar("sf-week", "Meal plan · 1 week (3 meals/day)", 520, "7 days"), sar("sf-diet", "Clinical dietitian session", 300, "45 min")],
    demo: true,
  },
  {
    id: "corniche-nutrition",
    name: "Corniche Nutrition Clinic",
    category: "nutrition",
    city: "Abu Dhabi",
    blurb: "Registered dietitians; plans for fat loss and lean gain.",
    licence: "DOH-licensed (demo placeholder)",
    services: [aed("cn-initial", "Initial dietitian assessment", 350, "60 min"), aed("cn-follow", "Monthly follow-up", 200, "30 min")],
    demo: true,
  },
  {
    id: "lumen-aesthetics",
    name: "Lumen Aesthetics",
    category: "aesthetic",
    city: "Dubai",
    blurb: "Non-surgical aesthetic medicine. Consultation first, always.",
    licence: "DHA-licensed physicians (demo placeholder)",
    services: [aed("la-consult", "Aesthetic consultation", 300, "30 min"), aed("la-skin", "Skin-quality assessment", 250, "30 min")],
    demo: true,
  },
  {
    id: "noor-clinic",
    name: "Noor Skin & Aesthetics",
    category: "aesthetic",
    city: "Riyadh",
    blurb: "Physician-led non-surgical treatments; suitability assessed in person.",
    licence: "MOH-licensed (demo placeholder)",
    services: [sar("nc-consult", "Aesthetic consultation", 300, "30 min")],
    demo: true,
  },
  {
    id: "dermacare-jeddah",
    name: "Red Sea Dermatology",
    category: "dermatology",
    city: "Jeddah",
    blurb: "Acne, scarring and pigmentation — prescription care and procedures.",
    licence: "MOH-licensed dermatologists (demo placeholder)",
    services: [sar("rs-acne", "Acne consultation", 350, "30 min"), sar("rs-scar", "Acne-scar assessment (microneedling / peels)", 400, "45 min")],
    demo: true,
  },
  {
    id: "marina-derm",
    name: "Marina Dermatology Centre",
    category: "dermatology",
    city: "Dubai",
    blurb: "Medical dermatology for acne, marks and texture.",
    licence: "DHA-licensed dermatologists (demo placeholder)",
    services: [aed("md-acne", "Acne consultation", 400, "30 min"), aed("md-peel", "Chemical peel assessment", 350, "30 min")],
    demo: true,
  },
  {
    id: "scanpoint-dxb",
    name: "ScanPoint Body Lab",
    category: "bodycomp",
    city: "Dubai",
    blurb: "InBody and DXA body-composition scans.",
    services: [aed("sp-inbody", "InBody scan", 120, "15 min"), aed("sp-dxa", "DXA body-composition scan", 450, "20 min")],
    demo: true,
  },
  {
    id: "scanpoint-ruh",
    name: "ScanPoint Body Lab",
    category: "bodycomp",
    city: "Riyadh",
    blurb: "InBody body-composition scans.",
    services: [sar("spr-inbody", "InBody scan", 120, "15 min")],
    demo: true,
  },
  {
    id: "atlas-coaching",
    name: "Atlas Strength Coaching",
    category: "trainer",
    city: "Dubai",
    blurb: "Coaches who run your plan's training split, in-gym or online.",
    services: [aed("at-assess", "Assessment + programme walkthrough", 300, "60 min"), aed("at-pack", "8 coached sessions", 2000, "4 weeks")],
    demo: true,
  },
  {
    id: "dune-pt",
    name: "Dune Personal Training",
    category: "trainer",
    city: "Jeddah",
    blurb: "Beginner-friendly strength coaching with posture focus.",
    services: [sar("du-intro", "Intro session", 250, "60 min"), sar("du-month", "Monthly coaching (online)", 800, "4 weeks")],
    demo: true,
  },
  {
    id: "fade-studio",
    name: "Fade & Form Studio",
    category: "barber",
    city: "Abu Dhabi",
    blurb: "Cuts and beard shaping matched to your plan's style preview.",
    services: [aed("ff-cut", "Haircut + beard shaping", 150, "45 min")],
    demo: true,
  },
];
