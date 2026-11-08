import type { Intake, Scan } from "./types";
import { imageData, loadImage } from "./image";
import { detectFace, detectPose } from "./vision";
import { analyseFace } from "./faceAnalysis";
import { analyseBody, analyseSide } from "./bodyAnalysis";
import { uid } from "./store";

export type Stage = "loading-models" | "face" | "skin" | "body" | "plan" | "done";

export class ScanError extends Error {}

export async function runScan(
  profileId: string,
  intake: Intake,
  facePhoto: string | null,
  bodyPhoto: string | null,
  onStage: (s: Stage) => void,
  sidePhoto: string | null = null,
): Promise<Scan> {
  const scan: Scan = {
    id: uid(),
    profileId,
    createdAt: new Date().toISOString(),
    face: null,
    body: null,
    hasFacePhoto: !!facePhoto,
    hasBodyPhoto: !!bodyPhoto,
    hasSidePhoto: !!sidePhoto,
    bodySide: null,
  };
  onStage("loading-models");

  if (facePhoto) {
    const img = await loadImage(facePhoto);
    onStage("face");
    const det = await detectFace(img);
    if (!det) throw new ScanError("We couldn't find a face in the portrait. Use a front-facing photo with your whole face visible.");
    onStage("skin");
    await tick();
    scan.face = analyseFace(det.landmarks, det.z, imageData(img), intake.gender);
  }
  if (bodyPhoto) {
    const img = await loadImage(bodyPhoto);
    onStage("body");
    const det = await detectPose(img);
    if (!det) throw new ScanError("We couldn't detect a full body. Use a head-to-toe photo, standing, facing the camera.");
    const needed = [11, 12, 23, 24];
    if (needed.some((i) => det.visibility[i] < 0.4))
      throw new ScanError("Shoulders and hips must be visible in the body photo. Stand facing the camera, ideally head to toe.");
    scan.body = analyseBody(det, intake, img.naturalWidth, img.naturalHeight);
  }
  if (sidePhoto) {
    const img = await loadImage(sidePhoto);
    onStage("body");
    const det = await detectPose(img);
    if (!det) throw new ScanError("We couldn't detect a body in the side photo. Stand side-on to the camera, whole body in frame.");
    scan.bodySide = analyseSide(det, img.naturalWidth, img.naturalHeight);
  }
  onStage("plan");
  await tick(400);
  onStage("done");
  return scan;
}

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
