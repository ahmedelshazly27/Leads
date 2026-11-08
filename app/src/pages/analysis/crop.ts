import type { Pt } from "../../lib/types";

/**
 * Crop rectangle (normalized x, y, w, h) around the face landmarks.
 * `zoom` > 1 adds margin; the crop keeps a 4:5 portrait shape.
 */
export function faceCrop(lm: Pt[], aspect: number, zoom = 1.6, shape = 0.8): [number, number, number, number] {
  const xs = lm.map((p) => p[0]);
  const ys = lm.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  // work in "aspect-corrected" units where both axes share a scale
  const faceH = Math.max(...ys) - Math.min(...ys);
  let h = faceH * zoom * 1.25;
  let w = (h * shape) / aspect;
  if (w > 1) {
    w = 1;
    h = (w * aspect) / shape;
  }
  h = Math.min(h, 1);
  const x = Math.min(Math.max(cx - w / 2, 0), 1 - w);
  const y = Math.min(Math.max(cy - h * 0.46, 0), 1 - h);
  return [x, y, w, h];
}
