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

export const sampleScan: Scan = { ...(data.scan as unknown as Scan), id: SAMPLE_SCAN_ID, profileId: SAMPLE_PROFILE_ID, stylePick: { hair: "medium-curls-subtle-taper", beard: "faded-italian" },
  review: {
    status: "approved",
    checks: Object.fromEntries(["capture", "face-lm", "body-lm", "side-lm", "scores", "bodyfat", "plan", "clinical", "style", "baseline", "after", "after-fidelity", "body-visuals"].map((k) => [k, true])),
    hiddenItems: [],
    itemNotes: { haircut: "Grow the top to 7–8 cm first (about 2 months), then ask for the swept-back cut. Bring the after image to your barber." },
    note: "Reviewed your photos, measurements and plan. Start with sleep, protein and the training plan — they drive most of the change you see in the after image.",
    realism: { pass: true, at: "2026-11-08T19:00:00.000Z", worst: "Eye spacing −2.2%" },
    updatedAt: "2026-11-08T19:00:00.000Z",
    approvedAt: "2026-11-08T19:00:00.000Z",
  } };

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
  styles: [{ name: "Swept-back medium curls · faded Italian beard (reviewer pick)", front: S + "face_after.jpg" }, { name: "Swept-back curls · taper fade · faded beard", front: S + "face_after_alt.jpg" }],
};
