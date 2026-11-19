// Copies the MediaPipe WASM runtime into public/ and downloads the
// face + pose + segmentation models. Runs automatically on `npm install`.
//
// Both folders are served with immutable caching (vercel.json), so every URL
// carries a version and a change always gets a new URL:
//   public/wasm/<@mediapipe/tasks-vision version>/   (follows the package)
//   public/models/<MODELS_VERSION>/                  (bump when a model changes,
//                                                     together with src/lib/vision.ts)
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MODELS_VERSION = "v1";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = join(root, "node_modules/@mediapipe/tasks-vision");
const wasmSrc = join(pkgDir, "wasm");
const wasmRoot = join(root, "public/wasm");
const modelsRoot = join(root, "public/models");
const modelsDst = join(modelsRoot, MODELS_VERSION);

/** Remove loose files left by older, unversioned layouts so they are not deployed. */
function dropLooseFiles(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isFile()) rmSync(p);
  }
}

mkdirSync(modelsDst, { recursive: true });
dropLooseFiles(wasmRoot);
dropLooseFiles(modelsRoot);

if (existsSync(wasmSrc)) {
  const { version } = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
  const wasmDst = join(wasmRoot, version);
  mkdirSync(wasmDst, { recursive: true });
  cpSync(wasmSrc, wasmDst, { recursive: true });
}

const MODELS = {
  "face_landmarker.task":
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  "pose_landmarker_heavy.task":
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task",
  "selfie_multiclass_256x256.tflite":
    "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite",
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
