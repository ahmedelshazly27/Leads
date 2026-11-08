export type Pt = [number, number]; // normalized image coords (0..1)

export type Gender = "female" | "male" | "other";

export interface Intake {
  name: string;
  age: number;
  gender: Gender;
  ethnicity: string;
  heightCm: number | null;
  weightKg: number | null;
  /** optional tape measurements, cm */
  waistCm: number | null;
  hipCm: number | null;
  neckCm: number | null;
  location: string;
  preferences: "non-invasive" | "open-to-clinical" | "open-to-surgical";
  budget: "low" | "medium" | "high";
  smoking: "no" | "occasionally" | "daily";
  drinking: "never" | "occasional" | "weekly" | "daily";
  sleepHours: number;
  trainingDays: number; // per week
  skinTone: 1 | 2 | 3 | 4 | 5 | 6; // Fitzpatrick
  limitations: string;
  allergies: string;
  profession: string;
  goals: string[];
  hairType: "straight" | "wavy" | "curly" | "coily";
  hairLengthCm: number; // current length on top
  hairLoss: "none" | "early" | "moderate" | "advanced"; // Norwood/Ludwig self-assessment
  facialHair: "none" | "patchy" | "full"; // men: how the beard grows when left
  activeAcne: boolean;
}

export interface Profile {
  id: string;
  createdAt: string;
  intake: Intake;
  sample?: boolean;
}

/* ------------------------------ Face ------------------------------ */

export type SkinRegionKey = "forehead" | "leftCheek" | "rightCheek" | "nose" | "underEye" | "chin";

export interface SkinRegion {
  key: SkinRegionKey;
  coverage: number; // 0..1 share of pixels flagged uneven / damaged
  evenness: number; // 0..100
  redness: number; // 0..100
  texture: number; // 0..100 (higher = rougher)
  polygons: Pt[][]; // region outline(s) for overlays, normalized coords
}

export interface FaceMetrics {
  // proportions
  faceWHR: number; // bizygomatic width / face height
  fWHR: number; // bizygomatic width / upper face height (brow → upper lip)
  midToLowerThird: number; // ideal ≈ 1
  lipChinRatio: number; // upper lip height : chin height (ideal ≈ 0.5)
  eyeSpacingRatio: number; // intercanthal / eye width (ideal ≈ 1)
  eyeWidthToFace: number; // eye width / face width (ideal ≈ 0.2)
  noseWidthToIntercanthal: number; // ideal ≈ 1
  noseLengthToFace: number;
  mouthToNoseWidth: number; // ideal ≈ 1.5
  lipRatio: number; // upper / lower vermilion height (ideal ≈ 0.62)
  lipFullness: number; // total lip height / mouth width
  jawToFaceWidth: number;
  chinWidthToMouth: number;
  foreheadToFaceWidth: number;
  // angles (degrees)
  canthalTilt: number; // + = outer corner higher
  browTilt: number;
  mouthCornerTilt: number; // + = corners up
  headRoll: number;
  // brow
  browArch: number; // arch height / brow length
  browPeak: number; // 0..1 position of peak along the brow (inner → outer)
  browThickness: number; // avg thickness / brow length
  browEyeDistance: number; // brow-to-lid distance / eye width
  // eyes
  eyeAspect: number; // height / width
  // global
  symmetry: number; // 0..100
  averageness: number; // 0..100
  dimorphism: number; // 0..1, 0 = very feminine, 1 = very masculine
  neoteny: number; // 0..100
  adiposity: number; // 0..100 (higher = more facial fullness)
  contrast: number; // 0..100
  skinScore: number; // 0..100
}

export interface FaceResult {
  landmarks: Pt[] | null; // 478 points, null for sample data
  imageAspect: number; // width / height
  metrics: FaceMetrics;
  skin: SkinRegion[];
  faceShape: "Oval" | "Round" | "Square" | "Heart" | "Oblong" | "Diamond";
  capture: CaptureQuality;
}

export interface CaptureQuality {
  yaw: number; // degrees, head turn
  pitch: number; // degrees, head nod
  roll: number; // degrees, head tilt
  faceWidthFrac: number; // face width / image width
  closeRange: boolean; // likely a close-range selfie (perspective distortion)
  warnings: string[];
  /** metrics whose values are affected by the capture issues above */
  affected: string[];
}

/* ------------------------------ Body ------------------------------ */

export interface BodyMetrics {
  shoulderWidth: number; // normalized to torso length (shoulder line → hip line)
  waistWidth: number;
  hipWidth: number;
  shoulderToWaist: number;
  waistToHip: number;
  legToHeight: number | null; // null when feet are out of frame
  torsoToLeg: number | null;
  shoulderTilt: number; // degrees, + = left shoulder (image right) lower
  hipTilt: number;
  headOffset: number; // lateral head offset vs. body midline, % of shoulder width
  armSymmetry: number; // 0..100
  bmi: number | null;
  bodyFatEstimate: number | null; // %
  bodyFatMethod: "navy" | "deurenberg" | "rfm-photo" | null;
  waistEstCm: number | null; // photo-estimated waist circumference (front width + side depth + height)
  whrTape: number | null; // circumference waist/hip (tape)
  whtr: number | null; // waist / height (tape)
  feetVisible: boolean;
  // frontal widths, normalized to torso length
  chestWidth: number;
  upperArmWidth: number; // average of both arms at mid upper-arm
  thighWidth: number | null; // average of both thighs below the crotch
  armToShoulder: number; // upper-arm width / shoulder width (muscularity cue)
  lrBalance: number; // % difference between left and right half-widths (0 = symmetric)
  lrDetail: { shoulder: number; waist: number; hip: number }; // signed %, + = image-right wider
  postureScore: number; // 0..100
  proportionScore: number; // 0..100
  compositionScore: number; // 0..100
  bodyScore: number; // 0..100
}

export interface BodyResult {
  landmarks: Pt[] | null; // 33 pose points
  imageAspect: number;
  metrics: BodyMetrics;
  lines: { shoulder: [Pt, Pt]; waist: [Pt, Pt]; hip: [Pt, Pt] } | null;
}

export interface SideMetrics {
  facing: "left" | "right";
  earShoulderAngle: number; // deg from horizontal (CVA proxy), higher = more upright head
  headForward: number; // ear ahead of shoulder, % of torso length
  shoulderForward: number; // shoulder ahead of hip, % of torso length (rounded / slumped)
  trunkLean: number; // deg of shoulder→hip line from vertical, + = leaning forward
  chestDepth: number; // normalized to torso length
  waistDepth: number;
  waistToChestDepth: number; // sagittal abdominal proxy; >1 = belly deeper than chest
  bellyProtrusion: number; // belly front ahead of chest front, % torso
  lumbarCurve: number; // depth of lower-back concavity, % torso
  upperBackCurve: number; // rounding of the upper back, % torso
  postureScore: number;
  coreScore: number;
}

export interface SideResult {
  landmarks: Pt[] | null;
  imageAspect: number;
  metrics: SideMetrics;
  lines: {
    plumb: [Pt, Pt]; // vertical through the ankle/knee or hip
    ear: Pt;
    shoulder: Pt;
    hip: Pt;
    chest: [Pt, Pt];
    waist: [Pt, Pt];
  } | null;
}

/* ------------------------------ Scans ----------------------------- */

export interface Scan {
  id: string;
  profileId: string;
  createdAt: string;
  face: FaceResult | null;
  body: BodyResult | null;
  hasFacePhoto: boolean;
  hasBodyPhoto: boolean;
  bodySide?: SideResult | null;
  hasSidePhoto?: boolean;
}

/** Generated images for a scan (baseline "model", end-of-plan "after", style previews). */
export interface Visuals {
  baseline?: string;
  after?: string;
  body?: { front?: string; side?: string; afterFront?: string; afterSide?: string };
  styles?: { name: string; front?: string; left?: string; right?: string }[];
}

export interface AppState {
  version: 1;
  profiles: Profile[];
  scans: Scan[];
  activeProfileId: string | null;
  // planItemId -> ISO date completed, per profile
  progress: Record<string, Record<string, string>>;
  settings: { units: "metric" | "imperial"; currency: "EUR" | "USD" | "GBP"; photoMode?: "studio" | "original" };
  visuals: Record<string, Visuals>; // scanId -> generated images (data URLs or https)
  bookings?: Booking[];
}

/** A partner booking request. The team confirms availability with the partner (human in the loop). */
export interface Booking {
  id: string;
  profileId: string;
  partnerId: string;
  serviceId: string;
  createdAt: string;
  preferredDate: string;
  preferredTime: "morning" | "afternoon" | "evening";
  notes: string;
  shared: { contact: boolean; macros?: boolean; training?: boolean; allergies?: boolean; planSection?: string[]; photos: false };
  payload: Record<string, unknown>;
  status: "requested" | "confirmed" | "declined" | "completed";
}
