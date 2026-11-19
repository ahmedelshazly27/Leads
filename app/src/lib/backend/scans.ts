import { BackendError, backendMode, callFunction, check, invalidate, newId, sb, useBackendQuery } from "./client";
import { mock } from "./mock";
import { requireUserId, useSession } from "./auth";
import { getOrder } from "./orders";
import { photoUrl } from "../store";
import { FACE_VIEWS, type Intake, type PhotoKind, type Scan } from "../types";
import type { PhotoUrls, QueryState, ScanKind, ScanPhotoRow, ScanPhotoView, ScanRow } from "./types";

export const PHOTO_BUCKET = "photos";
/** Signed photo URLs live this long (seconds). */
export const SIGNED_URL_TTL = 60 * 60;

const ALL_KINDS: PhotoKind[] = ["face", "body", "side", ...FACE_VIEWS];

/** A photo as the app holds it: a Blob, or a data:/blob:/https URL string. */
export type PhotoInput = Blob | string;

export const photoPath = (userId: string, scanId: string, view: ScanPhotoView) => `${userId}/${scanId}/${view}.jpg`;

/** The photos of a local scan, read from the on-device store (data URLs). */
export function localScanPhotos(scanId: string): Partial<Record<PhotoKind, string>> {
  const out: Partial<Record<PhotoKind, string>> = {};
  for (const k of ALL_KINDS) {
    const u = photoUrl(scanId, k);
    if (u) out[k] = u;
  }
  return out;
}

async function toBlob(p: PhotoInput): Promise<Blob> {
  if (p instanceof Blob) return p;
  const res = await fetch(p);
  if (!res.ok) throw new BackendError("A photo could not be read. Please retake it.", "photo_unreadable");
  return res.blob();
}

/**
 * Deep copy of the scan results with any embedded image data removed, so the
 * `results` JSON never carries photos (they go to private storage instead).
 * Landmarks and all measurements are kept as they are.
 */
export function stripPhotoData<T>(value: T): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return /^(data:|blob:)/.test(v) ? null : v;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) out[k] = walk(x);
      return out;
    }
    return v;
  };
  return walk(value) as T;
}

export interface SubmitScanOptions {
  /** defaults to "checkin" for check-in orders, otherwise "baseline" */
  kind?: ScanKind;
  intake?: Intake | null;
  appVersion?: string;
  /** called as each photo finishes uploading */
  onProgress?: (done: number, total: number) => void;
}

/**
 * Upload a local scan for review: photos to the private `photos` bucket, the
 * `scans` + `scan_photos` rows, then `submit-scan` (sets the order in review,
 * due in 72 hours, and assigns a reviewer).
 *
 * `photos` maps photo kinds to Blobs or URL strings; use `localScanPhotos(scan.id)`
 * for a scan made on this device.
 */
export async function submitScan(
  orderId: string,
  scan: Scan,
  photos: Partial<Record<PhotoKind, PhotoInput>>,
  opts: SubmitScanOptions = {},
): Promise<{ scanId: string; dueAt: string | null }> {
  const entries = (Object.entries(photos) as [PhotoKind, PhotoInput | undefined][]).filter((e): e is [PhotoKind, PhotoInput] => !!e[1]);
  if (!entries.some(([k]) => k === "face")) throw new BackendError("The front face photo is required.", "photo_missing");
  const results = stripPhotoData(scan);
  const intake = opts.intake ? stripPhotoData(opts.intake) : null;
  const appVersion = opts.appVersion ?? ((import.meta.env.VITE_APP_VERSION as string | undefined) || "web");

  let kind = opts.kind;
  if (!kind) {
    const order = await getOrder(orderId);
    if (!order) throw new BackendError("Order not found.", "not_found");
    kind = order.product === "checkin" ? "checkin" : "baseline";
  }

  const blobs: { view: ScanPhotoView; blob: Blob }[] = [];
  for (const [view, p] of entries) blobs.push({ view, blob: await toBlob(p) });

  if (backendMode === "mock") {
    opts.onProgress?.(blobs.length, blobs.length);
    return mock.submitScan({ orderId, kind, intake, results, appVersion, photos: blobs });
  }

  const uid = requireUserId();
  const client = sb();
  const scanId = newId();
  const uploaded: string[] = [];
  try {
    let done = 0;
    for (const { view, blob } of blobs) {
      const path = photoPath(uid, scanId, view);
      const { error } = await client.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: true, cacheControl: "0" });
      if (error) throw new BackendError(`Photo upload failed: ${error.message}`, "upload_failed");
      uploaded.push(path);
      opts.onProgress?.(++done, blobs.length);
    }
    check(await client.from("scans").insert({ id: scanId, user_id: uid, order_id: orderId, kind, intake, results, app_version: appVersion }));
    check(await client.from("scan_photos").insert(blobs.map(({ view }) => ({ scan_id: scanId, view, storage_path: photoPath(uid, scanId, view) }))));
  } catch (e) {
    if (uploaded.length) await client.storage.from(PHOTO_BUCKET).remove(uploaded).catch(() => {});
    throw e;
  }
  const res = await callFunction<{ due_at?: string | null }>("submit-scan", { order_id: orderId, scan_id: scanId });
  invalidate();
  return { scanId, dueAt: res?.due_at ?? null };
}

/** Signed URLs for a scan's photos (works for the owner, the assigned reviewer and admins). */
export async function signedPhotoUrls(rows: ScanPhotoRow[], ttl = SIGNED_URL_TTL): Promise<PhotoUrls> {
  if (!rows.length) return {};
  const { data, error } = await sb().storage.from(PHOTO_BUCKET).createSignedUrls(rows.map((r) => r.storage_path), ttl);
  if (error) throw new BackendError(error.message, "signed_url_failed");
  const out: PhotoUrls = {};
  rows.forEach((r, i) => {
    const u = data?.[i]?.signedUrl;
    if (u) out[r.view] = u;
  });
  return out;
}

/** The latest scan for an order plus signed photo URLs (empty once photos are deleted). */
export async function getScanForOrder(orderId: string): Promise<{ scan: ScanRow; photos: PhotoUrls } | null> {
  if (backendMode === "mock") return mock.getScanForOrder(orderId);
  const scan = check(await sb().from("scans").select("*").eq("order_id", orderId).order("created_at", { ascending: false }).limit(1).maybeSingle()) as ScanRow | null;
  if (!scan) return null;
  if (scan.photos_deleted_at) return { scan, photos: {} };
  const rows = (check(await sb().from("scan_photos").select("*").eq("scan_id", scan.id)) ?? []) as ScanPhotoRow[];
  return { scan, photos: await signedPhotoUrls(rows) };
}

/** The stored `Scan` object of a scan row (as uploaded by submitScan). */
export const scanResults = (row: ScanRow | null | undefined): Scan | null => (row?.results as Scan | null) ?? null;

export function useOrderScan(orderId: string | null | undefined): QueryState<{ scan: ScanRow; photos: PhotoUrls } | null> {
  const { session } = useSession();
  return useBackendQuery(session && orderId ? `scan:${orderId}` : null, () => getScanForOrder(orderId!));
}
