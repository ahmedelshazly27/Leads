import {
  FaceLandmarker,
  FilesetResolver,
  ImageSegmenter,
  PoseLandmarker,
  type ImageSource,
} from "@mediapipe/tasks-vision";
import type { Pt } from "./types";

const VERSION = "0.10.18";
const BASE = import.meta.env.BASE_URL;

const LOCAL = {
  wasm: `${BASE}wasm`,
  face: `${BASE}models/face_landmarker.task`,
  pose: `${BASE}models/pose_landmarker_heavy.task`,
  seg: `${BASE}models/selfie_multiclass_256x256.tflite`,
};
const REMOTE = {
  wasm: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`,
  face: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  pose: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task",
  seg: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite",
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
    // Segmentation masks need the GPU (WebGL) graph; MediaPipe's CPU mask path aborts.
    try {
      return await PoseLandmarker.createFromOptions(fs, {
        baseOptions: { modelAssetPath: path, delegate: "GPU" },
        runningMode: "IMAGE",
        numPoses: 1,
        outputSegmentationMasks: true,
      });
    } catch (e) {
      console.warn("GPU pose unavailable; falling back to landmark-only CPU", e);
      return PoseLandmarker.createFromOptions(fs, {
        baseOptions: { modelAssetPath: path, delegate: "CPU" },
        runningMode: "IMAGE",
        numPoses: 1,
        outputSegmentationMasks: false,
      });
    }
  })();
  return poseP;
}

let segP: Promise<ImageSegmenter> | null = null;
function getSegmenter() {
  segP ??= (async () => {
    const fs = await fileset();
    const path = (await exists(LOCAL.seg)) ? LOCAL.seg : REMOTE.seg;
    return ImageSegmenter.createFromOptions(fs, {
      baseOptions: { modelAssetPath: path, delegate: "CPU" },
      runningMode: "IMAGE",
      outputCategoryMask: true,
      outputConfidenceMasks: false,
    });
  })();
  return segP;
}

/** Categories of the multiclass selfie segmenter. */
export const SEG = { background: 0, hair: 1, bodySkin: 2, faceSkin: 3, clothes: 4, other: 5 } as const;

/** Per-pixel category mask (0–5) at the mask's own resolution. */
export async function segmentPerson(img: ImageSource): Promise<{ data: Uint8Array; width: number; height: number } | null> {
  const seg = await getSegmenter();
  const res = seg.segment(img);
  const m = res.categoryMask;
  if (!m) return null;
  const out = { data: new Uint8Array(m.getAsUint8Array()), width: m.width, height: m.height };
  res.close();
  return out;
}

export interface FaceDetection {
  landmarks: Pt[];
  /** relative depth per landmark, same scale as normalized x */
  z: number[];
}

export async function detectFace(img: ImageSource): Promise<FaceDetection | null> {
  const lm = await getFace();
  const res = lm.detect(img);
  const pts = res.faceLandmarks?.[0];
  if (!pts?.length) return null;
  return { landmarks: pts.map((p) => [p.x, p.y] as Pt), z: pts.map((p) => p.z) };
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
    try {
      mask = { data: readMask(m), width: m.width, height: m.height };
    } catch (e) {
      console.warn("segmentation mask unavailable; using landmark-only widths", e);
    }
  }
  res.segmentationMasks?.forEach((x) => x.close());
  return {
    landmarks: pts.map((p) => [p.x, p.y] as Pt),
    visibility: pts.map((p) => p.visibility ?? 1),
    mask,
  };
}

/** Read a segmentation mask as a 1-channel float array, whatever its backing. */
function readMask(m: { width: number; height: number; hasFloat32Array(): boolean; hasUint8Array(): boolean; getAsFloat32Array(): Float32Array; getAsUint8Array(): Uint8Array }) {
  const n = m.width * m.height;
  if (!m.hasFloat32Array() && m.hasUint8Array()) {
    const u = m.getAsUint8Array();
    const step = u.length / n;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = u[i * step] / 255;
    return out;
  }
  const f = m.getAsFloat32Array();
  if (f.length === n) return new Float32Array(f);
  const step = f.length / n;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = f[i * step];
  return out;
}

/** Warm the models while the user is filling in the intake form. */
export function preloadVision() {
  getFace().catch(() => {});
  getPose().catch(() => {});
}
