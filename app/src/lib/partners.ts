/**
 * Partner directory. Every entry below is a FICTIONAL demo partner used to
 * build and test the booking flow — replace with real, contracted partners.
 */

export type PartnerCategory = "nutrition" | "aesthetic" | "dermatology" | "bodycomp" | "trainer" | "barber";
export type City = "Kuwait City" | "Salmiya" | "Hawalli" | "Jahra";

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
  currency: "KWD";
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

const kwd = (id: string, name: string, priceFrom: number, duration: string): PartnerService => ({ id, name, priceFrom, currency: "KWD", duration });

export const PARTNERS: Partner[] = [
  {
    id: "meridian-meals",
    name: "Meridian Meal Labs",
    category: "nutrition",
    city: "Kuwait City",
    blurb: "Macro-matched meal delivery built from your calorie and protein targets.",
    services: [kwd("mm-week", "Macro-matched meals · 1 week (2 meals/day)", 35, "7 days"), kwd("mm-month", "Macro-matched meals · 4 weeks", 124, "28 days"), kwd("mm-consult", "Dietitian consult (video)", 21, "30 min")],
    demo: true,
  },
  {
    id: "saffron-fit",
    name: "Saffron Fit Kitchen",
    category: "nutrition",
    city: "Hawalli",
    blurb: "Kuwaiti home cooking, portioned to your macros.",
    services: [kwd("sf-week", "Meal plan · 1 week (3 meals/day)", 42, "7 days"), kwd("sf-diet", "Clinical dietitian session", 24, "45 min")],
    demo: true,
  },
  {
    id: "corniche-nutrition",
    name: "Corniche Nutrition Clinic",
    category: "nutrition",
    city: "Salmiya",
    blurb: "Registered dietitians; plans for fat loss and lean gain.",
    licence: "DOH-licensed (demo placeholder)",
    services: [kwd("cn-initial", "Initial dietitian assessment", 29, "60 min"), kwd("cn-follow", "Monthly follow-up", 17, "30 min")],
    demo: true,
  },
  {
    id: "lumen-aesthetics",
    name: "Lumen Aesthetics",
    category: "aesthetic",
    city: "Kuwait City",
    blurb: "Non-surgical aesthetic medicine. Consultation first, always.",
    licence: "Kuwait MOH-licensed physicians (demo placeholder)",
    services: [kwd("la-consult", "Aesthetic consultation", 25, "30 min"), kwd("la-skin", "Skin-quality assessment", 21, "30 min")],
    demo: true,
  },
  {
    id: "noor-clinic",
    name: "Noor Skin & Aesthetics",
    category: "aesthetic",
    city: "Hawalli",
    blurb: "Physician-led non-surgical treatments; suitability assessed in person.",
    licence: "Kuwait MOH-licensed (demo placeholder)",
    services: [kwd("nc-consult", "Aesthetic consultation", 24, "30 min")],
    demo: true,
  },
  {
    id: "dermacare-jeddah",
    name: "Red Sea Dermatology",
    category: "dermatology",
    city: "Jahra",
    blurb: "Acne, scarring and pigmentation — prescription care and procedures.",
    licence: "Kuwait MOH-licensed dermatologists (demo placeholder)",
    services: [kwd("rs-acne", "Acne consultation", 28, "30 min"), kwd("rs-scar", "Acne-scar assessment (microneedling / peels)", 33, "45 min")],
    demo: true,
  },
  {
    id: "marina-derm",
    name: "Marina Dermatology Centre",
    category: "dermatology",
    city: "Kuwait City",
    blurb: "Medical dermatology for acne, marks and texture.",
    licence: "Kuwait MOH-licensed dermatologists (demo placeholder)",
    services: [kwd("md-acne", "Acne consultation", 33, "30 min"), kwd("md-peel", "Chemical peel assessment", 29, "30 min")],
    demo: true,
  },
  {
    id: "scanpoint-dxb",
    name: "ScanPoint Body Lab",
    category: "bodycomp",
    city: "Kuwait City",
    blurb: "InBody and DXA body-composition scans.",
    services: [kwd("sp-inbody", "InBody scan", 10, "15 min"), kwd("sp-dxa", "DXA body-composition scan", 38, "20 min")],
    demo: true,
  },
  {
    id: "scanpoint-ruh",
    name: "ScanPoint Body Lab",
    category: "bodycomp",
    city: "Hawalli",
    blurb: "InBody body-composition scans.",
    services: [kwd("spr-inbody", "InBody scan", 10, "15 min")],
    demo: true,
  },
  {
    id: "atlas-coaching",
    name: "Atlas Strength Coaching",
    category: "trainer",
    city: "Kuwait City",
    blurb: "Coaches who run your plan's training split, in-gym or online.",
    services: [kwd("at-assess", "Assessment + programme walkthrough", 25, "60 min"), kwd("at-pack", "8 coached sessions", 167, "4 weeks")],
    demo: true,
  },
  {
    id: "dune-pt",
    name: "Dune Personal Training",
    category: "trainer",
    city: "Jahra",
    blurb: "Beginner-friendly strength coaching with posture focus.",
    services: [kwd("du-intro", "Intro session", 20, "60 min"), kwd("du-month", "Monthly coaching (online)", 65, "4 weeks")],
    demo: true,
  },
  {
    id: "fade-studio",
    name: "Fade & Form Studio",
    category: "barber",
    city: "Salmiya",
    blurb: "Cuts and beard shaping matched to your plan's style preview.",
    services: [kwd("ff-cut", "Haircut + beard shaping", 12, "45 min")],
    demo: true,
  },
];
