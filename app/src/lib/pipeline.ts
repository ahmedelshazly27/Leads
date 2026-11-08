import type { Intake, Scan } from "./types";
import { imageData, loadImage } from "./image";
import { detectFace, detectPose } from "./vision";
import { analyseFace } from "./faceAnalysis";
import { analyseBody } from "./bodyAnalysis";
import { uid } from "./store";

export type Stage = "loading-models" | "face" | "skin" | "body" | "plan" | "done";

export class ScanError extends Error {}

export async function runScan(
  profileId: string,
  intake: Intake,
  facePhoto: string | null,
  bodyPhoto: string | null,
  onStage: (s: Stage) => void,
): Promise<Scan> {
  const scan: Scan = {
    id: uid(),
    profileId,
    createdAt: new Date().toISOString(),
    face: null,
    body: null,
    hasFacePhoto: !!facePhoto,
    hasBodyPhoto: !!bodyPhoto,
  };
  onStage("loading-models");

  if (facePhoto) {
    const img = await loadImage(facePhoto);
    onStage("face");
    const lm = await detectFace(img);
    if (!lm) throw new ScanError("We couldn't find a face in the portrait. Use a front-facing photo with your whole face visible.");
    onStage("skin");
    await tick();
    scan.face = analyseFace(lm, imageData(img), intake.gender);
  }
  if (bodyPhoto) {
    const img = await loadImage(bodyPhoto);
    onStage("body");
    const det = await detectPose(img);
    if (!det) throw new ScanError("We couldn't detect a full body. Use a head-to-toe photo, standing, facing the camera.");
    const needed = [11, 12, 23, 24, 27, 28];
    if (needed.some((i) => det.visibility[i] < 0.4))
      throw new ScanError("Shoulders, hips and ankles must all be visible in the body photo.");
    scan.body = analyseBody(det, intake, img.naturalWidth, img.naturalHeight);
  }
  onStage("plan");
  await tick(400);
  onStage("done");
  return scan;
}

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
