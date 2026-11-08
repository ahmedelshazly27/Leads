import {
  FaceLandmarker,
  FilesetResolver,
  PoseLandmarker,
  type ImageSource,
} from "@mediapipe/tasks-vision";
import type { Pt } from "./types";

const VERSION = "0.10.18";
const BASE = import.meta.env.BASE_URL;

const LOCAL = {
  wasm: `${BASE}wasm`,
  face: `${BASE}models/face_landmarker.task`,
  pose: `${BASE}models/pose_landmarker_lite.task`,
};
const REMOTE = {
  wasm: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`,
  face: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  pose: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
};

async function exists(url: string) {
  try {
    const r = await fetch(url, { method: "HEAD" });
    const type = r.headers.get("content-type") ?? "";
    // Vite's dev server answers unknown paths with index.html
    return r.ok && !type.includes("text/html");
  } catch {
    return false;
  }
}

let filesetP: ReturnType<typeof FilesetResolver.forVisionTasks> | null = null;
async function fileset() {
  if (!filesetP) {
    filesetP = (async () => {
      const local = await exists(`${LOCAL.wasm}/vision_wasm_internal.js`);
      return FilesetResolver.forVisionTasks(local ? LOCAL.wasm : REMOTE.wasm);
    })();
  }
  return filesetP;
}

let faceP: Promise<FaceLandmarker> | null = null;
let poseP: Promise<PoseLandmarker> | null = null;

function getFace() {
  faceP ??= (async () => {
    const fs = await fileset();
    const path = (await exists(LOCAL.face)) ? LOCAL.face : REMOTE.face;
    return FaceLandmarker.createFromOptions(fs, {
      baseOptions: { modelAssetPath: path, delegate: "CPU" },
      runningMode: "IMAGE",
      numFaces: 1,
    });
  })();
  return faceP;
}

function getPose() {
  poseP ??= (async () => {
    const fs = await fileset();
    const path = (await exists(LOCAL.pose)) ? LOCAL.pose : REMOTE.pose;
    return PoseLandmarker.createFromOptions(fs, {
      baseOptions: { modelAssetPath: path, delegate: "CPU" },
      runningMode: "IMAGE",
      numPoses: 1,
      outputSegmentationMasks: true,
    });
  })();
  return poseP;
}

export async function detectFace(img: ImageSource): Promise<Pt[] | null> {
  const lm = await getFace();
  const res = lm.detect(img);
  const pts = res.faceLandmarks?.[0];
  if (!pts?.length) return null;
  return pts.map((p) => [p.x, p.y] as Pt);
}

export interface PoseDetection {
  landmarks: Pt[];
  visibility: number[];
  mask: { data: Float32Array; width: number; height: number } | null;
}

export async function detectPose(img: ImageSource): Promise<PoseDetection | null> {
  const lm = await getPose();
  const res = lm.detect(img);
  const pts = res.landmarks?.[0];
  if (!pts?.length) {
    res.segmentationMasks?.forEach((m) => m.close());
    return null;
  }
  let mask: PoseDetection["mask"] = null;
  const m = res.segmentationMasks?.[0];
  if (m) {
    mask = { data: new Float32Array(m.getAsFloat32Array()), width: m.width, height: m.height };
  }
  res.segmentationMasks?.forEach((x) => x.close());
  return {
    landmarks: pts.map((p) => [p.x, p.y] as Pt),
    visibility: pts.map((p) => p.visibility ?? 1),
    mask,
  };
}

/** Warm the models while the user is filling in the intake form. */
export function preloadVision() {
  getFace().catch(() => {});
  getPose().catch(() => {});
}
