import type { Scan } from "../../lib/types";

export interface Check {
  id: string;
  section: "capture" | "measure" | "plan" | "style" | "visuals";
  label: string;
}

const ALL: (Check & { when?: (s: Scan) => boolean })[] = [
  { id: "capture", section: "capture", label: "Photos are usable: frontal, sharp, even light, nothing covering the face", when: (s) => s.hasFacePhoto },
  { id: "face-lm", section: "capture", label: "Face mesh sits on the eyes, brows, nose, lips and jaw outline", when: (s) => !!s.face },
  { id: "body-lm", section: "capture", label: "Body skeleton points sit on the joints (shoulders, hips, knees)", when: (s) => !!s.body },
  { id: "side-lm", section: "capture", label: "Side-view ear, shoulder and hip points are correct", when: (s) => !!s.bodySide },
  { id: "scores", section: "measure", label: "Scores are plausible for what you see in the photos" },
  { id: "bodyfat", section: "measure", label: "Body-fat estimate is plausible", when: (s) => !!s.body },
  { id: "plan", section: "plan", label: "Every plan item fits this person; irrelevant items removed" },
  { id: "clinical", section: "plan", label: "Clinical items checked against allergies, limitations and preferences" },
  { id: "style", section: "style", label: "Hair and beard choice suits the face and hair type", when: (s) => !!s.face },
  { id: "baseline", section: "visuals", label: "Studio model is unmistakably the same person", when: (s) => s.hasFacePhoto },
  { id: "after", section: "visuals", label: "After image passes the realism check and looks achievable", when: (s) => s.hasFacePhoto },
  { id: "body-visuals", section: "visuals", label: "Body before/after match the person and the plan", when: (s) => !!s.body },
];

export function checklistFor(s: Scan): Check[] {
  return ALL.filter((c) => !c.when || c.when(s));
}
