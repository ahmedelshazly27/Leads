import type { Intake, Profile, Scan, Visuals } from "./types";
import data from "./sampleData.json";

/*
 * Built-in sample profile: a SYNTHETIC person (AI-generated, does not exist),
 * analysed by the real pipeline (see scripts in the README). Photos live in
 * public/sample/. Used for the demo and marketing screenshots.
 */

export const SAMPLE_PROFILE_ID = "sample";
export const SAMPLE_SCAN_ID = "sample-scan";

export const sampleProfile: Profile = {
  id: SAMPLE_PROFILE_ID,
  createdAt: "2026-10-01T09:00:00.000Z",
  sample: true,
  intake: data.intake as Intake,
};

export const sampleScan: Scan = { ...(data.scan as unknown as Scan), id: SAMPLE_SCAN_ID, profileId: SAMPLE_PROFILE_ID };

const S = `${import.meta.env.BASE_URL}sample/`;

export const samplePhotos: Record<"face" | "body" | "side", string> = {
  face: S + "face.jpg",
  body: S + "body_front.jpg",
  side: S + "body_side.jpg",
};

export const sampleVisuals: Visuals = {
  baseline: S + "face.jpg",
  after: S + "face_after.jpg",
  body: { front: S + "body_front.jpg", side: S + "body_side.jpg", afterFront: S + "body_after_front.jpg", afterSide: S + "body_after_side.jpg" },
  styles: [{ name: "Textured quiff · full groomed beard", front: S + "face_after.jpg" }],
};
