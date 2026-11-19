/** A photo the user picked that we can't use; `message` is written for the user. */
export class PhotoError extends Error {}

export const UNREADABLE_PHOTO =
  "This photo couldn't be opened — use a JPG or PNG. On iPhone, set Settings > Camera > Formats > Most Compatible, or take a screenshot of the photo and upload that.";

/** Shorter image side below this is too small to measure reliably. */
export const MIN_SHORT_SIDE = 480;

/** Read a File, downscale it so the long edge is <= maxEdge, return a JPEG data URL. Throws PhotoError with a user-facing message. */
export async function fileToDataUrl(file: File, maxEdge = 1400, minShortSide = 0): Promise<string> {
  const src = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new PhotoError(UNREADABLE_PHOTO));
    r.readAsDataURL(file);
  });
  let img: HTMLImageElement;
  try {
    img = await loadImage(src);
  } catch {
    throw new PhotoError(UNREADABLE_PHOTO);
  }
  if (!img.naturalWidth || !img.naturalHeight) throw new PhotoError(UNREADABLE_PHOTO);
  if (minShortSide && Math.min(img.naturalWidth, img.naturalHeight) < minShortSide)
    throw new PhotoError(
      `This photo is too small (${img.naturalWidth} × ${img.naturalHeight} pixels). Use the original photo from your camera — at least ${minShortSide} pixels on the shorter side, not a thumbnail or a cropped screenshot.`,
    );
  // shrink so the long edge fits maxEdge, but never push the short side below minShortSide
  const shortSide = Math.min(img.naturalWidth, img.naturalHeight);
  const scale = Math.min(1, Math.max(maxEdge / Math.max(img.naturalWidth, img.naturalHeight), minShortSide ? minShortSide / shortSide : 0));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.drawImage(img, 0, 0, w, h);
  return c.toDataURL("image/jpeg", 0.9);
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

export function imageData(img: HTMLImageElement): ImageData {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}
