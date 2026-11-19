import { BackendError, backendMode, callFunction, check, invalidate, newId, sb, useBackendQuery } from "./client";
import { mock } from "./mock";
import { getMyProfile, requireUserId, useSession } from "./auth";
import { activeConsents, listMyConsents } from "./consents";
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

/** Submissions in progress, per order: a second call (double click) joins the first. */
const inFlight = new Map<string, Promise<{ scanId: string; dueAt: string | null }>>();

/*
 * When submit-scan fails without a definite answer (network error, timeout,
 * 5xx), it may still have gone through. The scan id is kept for this tab so a
 * retry reuses it (same storage paths, same rows) instead of uploading a new
 * set, and a "wrong_status" reply on that retry means the first try worked.
 */
const RETRY_KEY = "facet-scan-retry";
function readRetry(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(RETRY_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}
function writeRetry(orderId: string, scanId: string | null) {
  try {
    const m = readRetry();
    if (scanId) m[orderId] = scanId;
    else delete m[orderId];
    if (Object.keys(m).length) sessionStorage.setItem(RETRY_KEY, JSON.stringify(m));
    else sessionStorage.removeItem(RETRY_KEY);
  } catch {
    /* storage blocked */
  }
}

const ACCEPTS_PHOTOS = new Set(["awaiting_photos", "changes_requested"]);
export const WAIVER_MESSAGE = "Please confirm that we may start your review now, within the 14-day withdrawal period.";

/**
 * Upload a local scan for review: photos to the private `photos` bucket, the
 * `scans` + `scan_photos` rows, then `submit-scan` (sets the order in review,
 * due in 72 hours, and assigns a reviewer).
 *
 * Before anything is uploaded it checks that the order is waiting for photos,
 * that the photo consent and the withdrawal waiver are given and that the
 * profile has a gender, and stops with a clear error (codes: wrong_status,
 * photo_consent_required, withdrawal_waiver_required, profile_incomplete).
 * `withdrawal_waiver_required` (also what submit-scan answers, HTTP 409) means:
 * record it with recordConsents(["withdrawal_waiver"]) and call submitScan
 * again with the same scan; nothing was uploaded or lost. If submit-scan then refuses the scan, the uploaded
 * photos are removed again.
 *
 * `photos` maps photo kinds to Blobs or URL strings; use `localScanPhotos(scan.id)`
 * for a scan made on this device.
 */
export function submitScan(
  orderId: string,
  scan: Scan,
  photos: Partial<Record<PhotoKind, PhotoInput>>,
  opts: SubmitScanOptions = {},
): Promise<{ scanId: string; dueAt: string | null }> {
  const running = inFlight.get(orderId);
  if (running) return running;
  const p = doSubmitScan(orderId, scan, photos, opts).finally(() => inFlight.delete(orderId));
  inFlight.set(orderId, p);
  return p;
}

async function doSubmitScan(
  orderId: string,
  scan: Scan,
  photos: Partial<Record<PhotoKind, PhotoInput>>,
  opts: SubmitScanOptions,
): Promise<{ scanId: string; dueAt: string | null }> {
  const entries = (Object.entries(photos) as [PhotoKind, PhotoInput | undefined][]).filter((e): e is [PhotoKind, PhotoInput] => !!e[1]);
  if (!entries.some(([k]) => k === "face")) throw new BackendError("The front face photo is required.", "photo_missing");
  const results = stripPhotoData(scan);
  const intake = opts.intake ? stripPhotoData(opts.intake) : null;
  const appVersion = opts.appVersion ?? ((import.meta.env.VITE_APP_VERSION as string | undefined) || "web");

  const retryScanId = backendMode === "supabase" ? readRetry()[orderId] : undefined;

  // Checks before any photo leaves the device.
  const order = await getOrder(orderId);
  if (!order) throw new BackendError("Order not found.", "not_found");
  if (!ACCEPTS_PHOTOS.has(order.status)) {
    if (retryScanId && order.status === "in_review") {
      // An earlier try that looked failed did go through.
      writeRetry(orderId, null);
      invalidate();
      return { scanId: retryScanId, dueAt: order.due_at };
    }
    throw new BackendError("This order is not waiting for photos.", "wrong_status");
  }
  if (backendMode === "supabase") {
    const [consents, profile] = await Promise.all([listMyConsents(), getMyProfile()]);
    const active = activeConsents(consents);
    if (!active.photos) throw new BackendError("Please agree to the photo consent first.", "photo_consent_required");
    // submit-scan refuses the photos without it (409); check before uploading.
    if (!active.withdrawal_waiver) throw new BackendError(WAIVER_MESSAGE, "withdrawal_waiver_required", 409);
    if (!profile?.gender) throw new BackendError("Please complete your profile first.", "profile_incomplete");
  }
  const kind: ScanKind = opts.kind ?? (order.product === "checkin" ? "checkin" : "baseline");

  const blobs: { view: ScanPhotoView; blob: Blob }[] = [];
  for (const [view, p] of entries) blobs.push({ view, blob: await toBlob(p) });

  if (backendMode === "mock") {
    opts.onProgress?.(blobs.length, blobs.length);
    return mock.submitScan({ orderId, kind, intake, results, appVersion, photos: blobs });
  }

  const uid = requireUserId();
  const client = sb();
  const scanId = retryScanId ?? newId();
  const uploaded: string[] = [];
  const removeUploaded = async () => {
    if (uploaded.length) await client.storage.from(PHOTO_BUCKET).remove(uploaded).catch(() => {});
  };

  try {
    let done = 0;
    for (const { view, blob } of blobs) {
      const path = photoPath(uid, scanId, view);
      const { error } = await client.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: true, cacheControl: "0" });
      if (error) throw new BackendError(`Photo upload failed: ${error.message}`, "upload_failed");
      uploaded.push(path);
      opts.onProgress?.(++done, blobs.length);
    }
    const existing = retryScanId ? check(await client.from("scans").select("id").eq("id", scanId).maybeSingle()) : null;
    if (!existing) check(await client.from("scans").insert({ id: scanId, user_id: uid, order_id: orderId, kind, intake, results, app_version: appVersion }));
    check(
      await client
        .from("scan_photos")
        .upsert(blobs.map(({ view }) => ({ scan_id: scanId, view, storage_path: photoPath(uid, scanId, view) })), { onConflict: "scan_id,view" }),
    );
  } catch (e) {
    await removeUploaded();
    throw e;
  }

  let res: { order?: { due_at?: string | null } | null; due_at?: string | null } | null;
  try {
    res = await callFunction<{ order?: { due_at?: string | null } | null; due_at?: string | null }>("submit-scan", { order_id: orderId, scan_id: scanId });
  } catch (e) {
    const status = e instanceof BackendError ? e.status : undefined;
    const code = e instanceof BackendError ? e.code : "";
    if (retryScanId && code === "wrong_status") {
      // The earlier try went through; this was a repeat of it.
      writeRetry(orderId, null);
      invalidate();
      const fresh = await getOrder(orderId).catch(() => null);
      return { scanId, dueAt: fresh?.due_at ?? null };
    }
    if (status !== undefined && status >= 400 && status < 500) {
      // Refused: do not keep photos that were not accepted.
      await removeUploaded();
      writeRetry(orderId, null);
    } else {
      // No definite answer: keep the photos and reuse this scan id on retry.
      writeRetry(orderId, scanId);
    }
    throw e;
  }
  writeRetry(orderId, null);
  invalidate();
  return { scanId, dueAt: res?.order?.due_at ?? res?.due_at ?? null };
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

/**
 * The scan of an order plus signed photo URLs (empty once photos are deleted):
 * the one submit-scan accepted (orders.scan_id), or else the latest one.
 */
export async function getScanForOrder(orderId: string): Promise<{ scan: ScanRow; photos: PhotoUrls } | null> {
  if (backendMode === "mock") return mock.getScanForOrder(orderId);
  const client = sb();
  // Tolerates a database without orders.scan_id yet (falls back to the latest scan).
  const accepted = await client
    .from("orders")
    .select("scan_id")
    .eq("id", orderId)
    .maybeSingle()
    .then((r) => (r.error ? null : ((r.data as { scan_id?: string | null } | null)?.scan_id ?? null)));
  let scan: ScanRow | null = null;
  if (accepted) scan = check(await client.from("scans").select("*").eq("id", accepted).maybeSingle()) as ScanRow | null;
  scan ??= check(await client.from("scans").select("*").eq("order_id", orderId).order("created_at", { ascending: false }).limit(1).maybeSingle()) as ScanRow | null;
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
