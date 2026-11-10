import type { FaceView, Intake, Scan } from "./types";
import { imageData, loadImage } from "./image";
import { detectFace, detectPose, segmentPerson } from "./vision";
import { analyseFace, makeFrame } from "./faceAnalysis";
import { analyseProfile } from "./markers/profile";
import { IRIS_MM } from "./markers/frontal";
import { analyseBody, analyseSide } from "./bodyAnalysis";
import { uid } from "./store";

export type Stage = "loading-models" | "face" | "skin" | "profile" | "body" | "plan" | "done";

export class ScanError extends Error {}

export async function runScan(
  profileId: string,
  intake: Intake,
  facePhoto: string | null,
  bodyPhoto: string | null,
  onStage: (s: Stage) => void,
  sidePhoto: string | null = null,
  views: Partial<Record<FaceView, string>> = {},
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
    scan.face = analyseFace(det.landmarks, det.z, imageData(img), intake.gender, intake.frontCapture);
  }
  const profilePhoto = views.faceLeft ?? views.faceRight;
  if (profilePhoto) {
    onStage("profile");
    scan.profileFace = await profileFromPhoto(profilePhoto, scan);
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

/**
 * Side profile: outline traced from the photo, millimetres borrowed from the
 * front portrait by matching nasion–subnasale height (the iris gives the
 * front photo its scale).
 */
export async function profileFromPhoto(url: string, scan: Pick<Scan, "face">) {
  const img = await loadImage(url);
  const mask = await segmentPerson(img);
  if (!mask) return null;
  const px = imageData(img);
  let mmPerPx: number | null = null;
  const first = analyseProfile(mask, px, null);
  if (!first) return null;
  const f = scan.face;
  if (f?.landmarks) {
    const P = makeFrame(f.landmarks, f.imageAspect * 1000, 1000).P;
    const iris = (Math.hypot(P[469][0] - P[471][0], P[469][1] - P[471][1]) + Math.hypot(P[474][0] - P[476][0], P[474][1] - P[476][1])) / 2;
    const nsnMm = Math.hypot(P[168][0] - P[2][0], P[168][1] - P[2][1]) * (IRIS_MM / iris);
    const nsnPx = Math.hypot(first.points.N[0] - first.points.Sn[0], first.points.N[1] - first.points.Sn[1]);
    if (nsnPx > 0) mmPerPx = nsnMm / nsnPx;
  }
  const r = mmPerPx ? analyseProfile(mask, px, mmPerPx) ?? first : first;
  return { markers: r.markers, flags: r.flags, points: { ...r.points } as Record<string, unknown>, mmPerPx: r.mmPerPx };
}

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
