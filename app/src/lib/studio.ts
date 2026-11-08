import { useEffect, useState } from "react";
import type { BodyResult, Intake, Pt, Scan, SideResult, Visuals } from "./types";
import { loadImage } from "./image";
import { detectFace, detectPose } from "./vision";
import { makeFrame, skinPolygons } from "./faceAnalysis";
import { analyseBody, analyseSide } from "./bodyAnalysis";

/*
 * "Studio" display: the standardized model images are shown instead of the
 * raw photos. Landmarks are re-detected on the studio image so overlays line
 * up, but every number still comes from the ORIGINAL photos — generated
 * images are never measured.
 */

interface StudioFace { landmarks: Pt[]; z: number[]; w: number; h: number }

const faceCache = new Map<string, Promise<StudioFace | null>>();
const bodyCache = new Map<string, Promise<BodyResult | null>>();
const sideCache = new Map<string, Promise<SideResult | null>>();

function studioFace(url: string) {
  if (!faceCache.has(url))
    faceCache.set(
      url,
      (async () => {
        const img = await loadImage(url);
        const d = await detectFace(img);
        return d ? { landmarks: d.landmarks, z: d.z, w: img.naturalWidth, h: img.naturalHeight } : null;
      })().catch(() => null),
    );
  return faceCache.get(url)!;
}

function studioBody(url: string, intake: Intake) {
  if (!bodyCache.has(url))
    bodyCache.set(
      url,
      (async () => {
        const img = await loadImage(url);
        const d = await detectPose(img);
        return d ? analyseBody(d, intake, img.naturalWidth, img.naturalHeight) : null;
      })().catch(() => null),
    );
  return bodyCache.get(url)!;
}

function studioSide(url: string) {
  if (!sideCache.has(url))
    sideCache.set(
      url,
      (async () => {
        const img = await loadImage(url);
        const d = await detectPose(img);
        return d ? analyseSide(d, img.naturalWidth, img.naturalHeight) : null;
      })().catch(() => null),
    );
  return sideCache.get(url)!;
}

export interface DisplayScan {
  scan: Scan;
  facePhoto: string | null;
  bodyPhoto: string | null;
  sidePhoto: string | null;
  studio: { face: boolean; body: boolean; side: boolean };
  available: boolean; // any studio image exists
  loading: boolean;
}

export function useDisplayScan(
  scan: Scan | null,
  visuals: Visuals,
  intake: Intake | null,
  photos: { face: string | null; body: string | null; side: string | null },
  mode: "studio" | "original",
): DisplayScan | null {
  // only re-detect when the studio image is actually a different picture (saves ~34 MB of models)
  const diff = (u: string | undefined, orig: string | null) => (u && u !== orig ? u : undefined);
  const urls = { face: diff(visuals.baseline, photos.face), body: diff(visuals.body?.front, photos.body), side: diff(visuals.body?.side, photos.side) };
  const available = !!(urls.face || urls.body || urls.side);
  const [res, setRes] = useState<{ key: string; face: StudioFace | null; body: BodyResult | null; side: SideResult | null } | null>(null);
  const key = `${scan?.id}|${urls.face}|${urls.body}|${urls.side}`;
  const want = mode === "studio" && available && !!scan && !!intake;

  useEffect(() => {
    if (!want || !intake) return;
    let alive = true;
    Promise.all([
      urls.face && scan?.face ? studioFace(urls.face) : null,
      urls.body && scan?.body ? studioBody(urls.body, intake) : null,
      urls.side && scan?.bodySide ? studioSide(urls.side) : null,
    ]).then(([face, body, side]) => alive && setRes({ key, face, body, side }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, want]);

  if (!scan) return null;
  const original: DisplayScan = {
    scan,
    facePhoto: photos.face,
    bodyPhoto: photos.body,
    sidePhoto: photos.side,
    studio: { face: false, body: false, side: false },
    available,
    loading: false,
  };
  if (!want) return original;
  if (!res || res.key !== key) return { ...original, loading: true };

  const out: Scan = { ...scan };
  const studio = { face: false, body: false, side: false };
  if (res.face && scan.face) {
    const f = makeFrame(res.face.landmarks, res.face.w, res.face.h, res.face.z);
    const polys = skinPolygons(f);
    out.face = {
      ...scan.face,
      landmarks: res.face.landmarks,
      imageAspect: res.face.w / res.face.h,
      skin: scan.face.skin.map((r) => ({ ...r, polygons: polys[r.key] })),
    };
    studio.face = true;
  }
  if (res.body && scan.body) {
    out.body = { ...scan.body, landmarks: res.body.landmarks, imageAspect: res.body.imageAspect, lines: res.body.lines };
    studio.body = true;
  }
  if (res.side && scan.bodySide) {
    out.bodySide = { ...scan.bodySide, landmarks: res.side.landmarks, imageAspect: res.side.imageAspect, lines: res.side.lines };
    studio.side = true;
  }
  return {
    scan: out,
    facePhoto: studio.face ? urls.face! : photos.face,
    bodyPhoto: studio.body ? urls.body! : photos.body,
    sidePhoto: studio.side ? urls.side! : photos.side,
    studio,
    available,
    loading: false,
  };
}
