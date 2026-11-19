// POST {} -> { scans, files, visuals, consents, cancelled_orders }
// The signed-in user withdraws their photo consent (GDPR art. 7(3) and
// 17(1)(b); privacy policy sections 8 and 9):
//   - every photo file of the user is deleted (by folder and by recorded path)
//   - scans.photos_deleted_at is set and the measurements and health answers
//     (scans.intake / scans.results) are cleared
//   - the photo consent is marked withdrawn
//   - orders whose photos were submitted but not delivered (in_review,
//     changes_requested) are cancelled and their visuals deleted: the review
//     cannot continue without the photos. Refunds are issued by hand under the
//     refund policy (section 3); each cancellation is in audit_log with
//     action 'orders.cancelled_consent_withdrawn' and what the policy suggests.
// Orders still waiting for photos stay open (the customer can consent again,
// or ask for a full refund). Visuals of delivered reports are kept, as the
// privacy policy says ("kept in your account until you delete them or your
// account"). Safe to call again: a retry finishes what a failed call left.
import { json, readJson, serve } from "../_shared/http.ts";
import { requireUser } from "../_shared/auth.ts";
import { admin, must } from "../_shared/supabase.ts";
import { listAll, removePaths } from "../_shared/storage.ts";

serve(async (req) => {
  const { user } = await requireUser(req);
  await readJson(req);
  const db = admin();
  const uid = user.id;

  // 1. Photo files.
  const scans = must(await db.from("scans").select("id").eq("user_id", uid), "scans");
  const scanIds = (scans ?? []).map((s) => s.id as string);
  const recorded = scanIds.length
    ? must(await db.from("scan_photos").select("storage_path").in("scan_id", scanIds), "scan photos")
    : [];
  const files = await removePaths("photos", [
    ...(await listAll("photos", uid)),
    ...(recorded ?? []).map((p) => p.storage_path as string),
  ]);

  // 2. Visuals of the orders that will be cancelled.
  const open = must(
    await db.from("orders").select("id").eq("user_id", uid).in("status", ["in_review", "changes_requested"]),
    "open orders",
  );
  const openIds = (open ?? []).map((o) => o.id as string);
  let visuals = 0;
  if (openIds.length) {
    const gens = must(await db.from("generations").select("output_path").in("order_id", openIds), "generations");
    const paths = (gens ?? []).map((g) => g.output_path as string | null).filter((p): p is string => !!p);
    for (const id of openIds) paths.push(...(await listAll("visuals", id)));
    visuals = await removePaths("visuals", paths);
  }

  // 3. Rows, in one transaction (see withdraw_photo_consent_records).
  const res = must(
    await db.rpc("withdraw_photo_consent_records", { p_user: uid }),
    "withdraw records",
  ) as { scans: number; consents: number; cancelled: { order_id: string; review_started: boolean }[] };

  return json(req, {
    scans: res.scans,
    files,
    visuals,
    consents: res.consents,
    cancelled_orders: (res.cancelled ?? []).map((c) => c.order_id),
  });
});
