import { addScan, createProfile, getState, setVisuals } from "./lib/store";
import { runScan } from "./lib/pipeline";
import { sampleProfile } from "./lib/sample";
import type { Intake } from "./lib/types";

const toData = async (u: string | null) => {
  if (!u) return null;
  const b = await (await fetch(u)).blob();
  return new Promise<string>((r) => {
    const fr = new FileReader();
    fr.onload = () => r(fr.result as string);
    fr.readAsDataURL(b);
  });
};

/**
 * Dev-only helpers (photos live in the git-ignored public/__test folder):
 *   window.__seed(faceUrl, bodyUrl?, name?, intakeOverrides?)  -> runs a real scan
 *   window.__seedMe()                                          -> the reference profile
 */
export function installDevHooks() {
  const w = window as unknown as Record<string, unknown>;
  w.__seed = async (face: string | null, body: string | null, name = "Test Profile", over: Partial<Intake> = {}, side: string | null = null) => {
    const f = await toData(face);
    const bd = await toData(body);
    const sd = await toData(side);
    const p = createProfile({ ...sampleProfile.intake, name, ...over });
    const scan = await runScan(p.id, p.intake, f, bd, () => {}, sd);
    await addScan(scan, f, bd, sd);
    return scan.id;
  };
  w.__seedMe = async () => {
    if (getState().profiles.some((p) => p.intake.name === "You")) return "exists";
    const id = (await (w.__seed as (...a: unknown[]) => Promise<string>)("/__test/me_front.jpg", "/__test/body_front.jpg", "You", {
      gender: "male",
      age: 20,
      ethnicity: "Middle Eastern",
      heightCm: 175,
      weightKg: 82,
      waistCm: null,
      hipCm: null,
      neckCm: null,
      location: "Netherlands",
      sleepHours: 6.5,
      trainingDays: 1,
      skinTone: 3,
      drinking: "occasional",
      profession: "",
      goals: ["Leaner face", "Clear skin", "Better physique"],
      hairType: "curly",
      hairLengthCm: 8,
      hairLoss: "none",
      facialHair: "patchy",
      activeAcne: true,
      limitations: "None reported",
      allergies: "None reported",
    } satisfies Partial<Intake>, "/__test/body_side_l.jpg")) as string;
    const v = "/__test/visuals/";
    setVisuals(id, {
      baseline: v + "baseline.jpg",
      after: v + "after.jpg",
      body: { front: v + "body_front.jpg", side: v + "body_side.jpg", afterFront: v + "body_after_front.jpg", afterSide: v + "body_after_side.jpg" },
      styles: [
        { name: "Loose waves (chosen)", front: v + "after.jpg", left: v + "after_left.jpg", right: v + "after_right.jpg" },
        { name: "Natural curls", front: v + "curls_front.jpg", left: v + "curls_left.jpg", right: v + "curls_right.jpg" },
        { name: "Wavy slick back · Italian beard", front: v + "italian_front.jpg", left: v + "italian_left.jpg", right: v + "italian_right.jpg" },
        { name: "Flowing curly slick back", front: v + "flow_front.jpg", left: v + "flow_left.jpg", right: v + "flow_right.jpg" },
      ],
    });
    return id;
  };
}
