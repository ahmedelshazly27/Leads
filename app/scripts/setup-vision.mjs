// Copies the MediaPipe WASM runtime into public/ and downloads the
// face + pose landmarker models. Runs automatically on `npm install`.
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wasmSrc = join(root, "node_modules/@mediapipe/tasks-vision/wasm");
const wasmDst = join(root, "public/wasm");
const modelsDst = join(root, "public/models");

mkdirSync(wasmDst, { recursive: true });
mkdirSync(modelsDst, { recursive: true });
if (existsSync(wasmSrc)) cpSync(wasmSrc, wasmDst, { recursive: true });

const MODELS = {
  "face_landmarker.task":
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  "pose_landmarker_lite.task":
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
};

for (const [name, url] of Object.entries(MODELS)) {
  const out = join(modelsDst, name);
  if (existsSync(out)) continue;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    writeFileSync(out, Buffer.from(await res.arrayBuffer()));
    console.log(`[setup-vision] downloaded ${name}`);
  } catch (err) {
    console.warn(`[setup-vision] could not download ${name}: ${err.message}`);
    console.warn("  The app will fall back to loading it from the CDN at runtime.");
  }
}
