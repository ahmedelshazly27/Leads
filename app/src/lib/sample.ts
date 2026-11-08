import type { FaceMetrics, Profile, Scan, SkinRegion } from "./types";
import { derived } from "./faceAnalysis";

export const sampleProfile: Profile = {
  id: "sample",
  createdAt: "2026-09-01T10:00:00.000Z",
  sample: true,
  intake: {
    name: "Sample Profile",
    age: 34,
    gender: "female",
    ethnicity: "East Asian",
    heightCm: 165,
    weightKg: 61,
    location: "United Kingdom",
    preferences: "non-invasive",
    budget: "medium",
    smoking: "no",
    drinking: "occasional",
    sleepHours: 6.5,
    trainingDays: 1,
    skinTone: 3,
    limitations: "None reported",
    allergies: "None reported",
    profession: "Works in finance",
    goals: ["Even skin tone", "Look more rested", "Improve posture"],
  },
};

const base = {
  faceWHR: 0.88,
  fWHR: 1.86,
  midToLowerThird: 0.97,
  lipChinRatio: 0.47,
  eyeSpacingRatio: 1.1,
  eyeWidthToFace: 0.2,
  noseWidthToIntercanthal: 1.08,
  noseLengthToFace: 0.32,
  mouthToNoseWidth: 1.42,
  lipRatio: 0.66,
  lipFullness: 0.31,
  jawToFaceWidth: 0.8,
  chinWidthToMouth: 0.92,
  foreheadToFaceWidth: 0.84,
  canthalTilt: 3.4,
  browTilt: 4.1,
  mouthCornerTilt: 1.2,
  headRoll: 0.4,
  browArch: 0.11,
  browPeak: 0.68,
  browThickness: 0.11,
  browEyeDistance: 0.62,
  eyeAspect: 0.33,
  symmetry: 84,
};

const metrics: FaceMetrics = { ...base, ...derived(base, "female"), contrast: 46, skinScore: 78 };

const region = (key: SkinRegion["key"], coverage: number, evenness: number, redness: number, texture: number): SkinRegion => ({
  key, coverage, evenness, redness, texture, polygons: [],
});

export const sampleScan: Scan = {
  id: "sample-scan",
  profileId: "sample",
  createdAt: "2026-09-01T10:05:00.000Z",
  hasFacePhoto: false,
  hasBodyPhoto: false,
  face: {
    landmarks: null,
    imageAspect: 0.8,
    metrics,
    faceShape: "Oval",
    skin: [
      region("forehead", 0.09, 74, 18, 31),
      region("leftCheek", 0.06, 80, 24, 26),
      region("rightCheek", 0.07, 78, 22, 27),
      region("nose", 0.05, 82, 30, 22),
      region("underEye", 0.11, 70, 12, 24),
      region("chin", 0.04, 84, 20, 21),
    ],
  },
  body: {
    landmarks: null,
    imageAspect: 0.5,
    lines: null,
    metrics: {
      shoulderWidth: 0.235,
      waistWidth: 0.165,
      hipWidth: 0.215,
      shoulderToWaist: 1.42,
      waistToHip: 0.77,
      legToHeight: 0.47,
      torsoToLeg: 0.62,
      shoulderTilt: 2.1,
      hipTilt: 0.8,
      headOffset: 3,
      armSymmetry: 92,
      bmi: 22.4,
      bodyFatEstimate: 29.3,
      postureScore: 77,
      proportionScore: 68,
      compositionScore: 66,
      bodyScore: 70,
    },
  },
};
