import { BackendError, backendMode, callFunction, check, invalidate, sb } from "./client";
import { mock } from "./mock";
import { getMyProfile, requireUserId, signOut } from "./auth";
import { signedPhotoUrls } from "./scans";
import type { ScanPhotoRow, ScanRow } from "./types";

/**
 * Everything we hold about the signed-in user, as JSON (GDPR access /
 * portability). Photos are included as time-limited download links, not
 * embedded.
 */
export async function exportMyData(): Promise<Record<string, unknown>> {
  if (backendMode === "mock") return { exported_at: new Date().toISOString(), ...(await mock.exportData()) };
  const uid = requireUserId();
  const c = sb();
  const [profile, consents, orders, subscriptions, payments, scans] = await Promise.all([
    getMyProfile(),
    c.from("consents").select("*").eq("user_id", uid).then(check),
    c.from("orders").select("*").eq("user_id", uid).then(check),
    c.from("subscriptions").select("*").eq("user_id", uid).then(check),
    c.from("payments").select("*").eq("user_id", uid).then(check),
    c.from("scans").select("*").eq("user_id", uid).then(check),
  ]);
  const scanRows = (scans ?? []) as ScanRow[];
  const orderIds = ((orders ?? []) as { id: string }[]).map((o) => o.id);
  const [photos, reviews] = await Promise.all([
    scanRows.length ? c.from("scan_photos").select("*").in("scan_id", scanRows.map((s) => s.id)).then(check) : Promise.resolve([]),
    orderIds.length ? c.from("reviews").select("*").in("order_id", orderIds).then(check) : Promise.resolve([]),
  ]);
  const photoRows = (photos ?? []) as ScanPhotoRow[];
  const links: Record<string, Record<string, string>> = {};
  for (const s of scanRows) {
    if (s.photos_deleted_at) continue;
    const urls = await signedPhotoUrls(photoRows.filter((p) => p.scan_id === s.id), 24 * 3600).catch(() => ({}));
    links[s.id] = urls as Record<string, string>;
  }
  return {
    exported_at: new Date().toISOString(),
    profile,
    consents,
    orders,
    subscriptions,
    payments,
    scans: scanRows,
    scan_photos: photoRows,
    photo_download_links_valid_24h: links,
    reviews,
  };
}

/** Download the export as a .json file in the browser. */
export async function downloadMyData(filename = "my-data.json"): Promise<void> {
  const data = await exportMyData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/**
 * Permanently delete the account: photos, visuals, scans and generations are
 * deleted; orders and payments are anonymised (kept for accounting); the
 * sign-in is removed. Signs out afterwards.
 *
 * Call it only from the confirmation dialog, as `deleteMyData({ confirm: true })`.
 */
export async function deleteMyData(opts: { confirm: true }): Promise<void> {
  if (opts?.confirm !== true) throw new BackendError("Please confirm that you want to delete your data.", "confirm_required");
  if (backendMode === "mock") return mock.deleteData(opts);
  requireUserId();
  await callFunction("delete-my-data", { confirm: true });
  await signOut().catch(() => {});
}

/**
 * Withdraw photo consent (GDPR art. 7(3), 17(1)(b)): deletes the user's photos
 * and the measurements and health answers taken from them, and marks the
 * consent withdrawn (withdraw-photo-consent function).
 *
 * Orders whose photos were already submitted but not delivered are cancelled:
 * the review cannot continue. Refunds for those are handled by our team under
 * the refund policy (full if the review had not started, otherwise less the
 * work already done). Orders still waiting for photos stay open: the customer
 * can give the consent again and submit. Delivered reports keep their visuals.
 *
 * Returns how many scans were cleared and photo files deleted, and the ids of
 * cancelled orders.
 */
export async function withdrawPhotoConsent(): Promise<{ scans: number; files: number; cancelledOrders?: string[] }> {
  if (backendMode === "mock") return mock.withdrawPhotoConsent();
  requireUserId();
  const res = await callFunction<{ scans?: number; files?: number; cancelled_orders?: string[] }>("withdraw-photo-consent", {});
  invalidate();
  return { scans: res?.scans ?? 0, files: res?.files ?? 0, cancelledOrders: res?.cancelled_orders ?? [] };
}
