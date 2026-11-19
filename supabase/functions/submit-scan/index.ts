// POST { order_id, scan_id } -> { order }
// Called after the customer has uploaded photos and inserted the scan and
// scan_photos rows. Moves the order to in_review with a 72-hour due time and
// assigns a gender-matched reviewer (least open orders first). The accepted
// scan is recorded on the order (orders.scan_id), so the reviewer and the
// report always use the scan that was submitted, not a later stray upload.
import { HttpError, json, readJson, requireUuid, serve } from "../_shared/http.ts";
import { requireUser } from "../_shared/auth.ts";
import { admin, audit, must, mustOne } from "../_shared/supabase.ts";

const REVIEW_HOURS = 72;

serve(async (req) => {
  const { user, profile } = await requireUser(req);
  const body = await readJson<{ order_id?: string; scan_id?: string }>(req);
  const orderId = requireUuid(body.order_id, "order_id");
  const scanId = requireUuid(body.scan_id, "scan_id");
  const db = admin();

  const order = must(
    await db.from("orders").select("id, user_id, status, product, assigned_reviewer").eq("id", orderId).maybeSingle(),
    "order",
  );
  if (!order || order.user_id !== user.id) throw new HttpError(404, "not_found", "Order not found.");
  if (!["awaiting_photos", "changes_requested"].includes(order.status as string)) {
    throw new HttpError(409, "wrong_status", "This order is not waiting for photos.");
  }

  const scan = must(
    await db.from("scans").select("id, user_id, order_id").eq("id", scanId).maybeSingle(),
    "scan",
  );
  if (!scan || scan.user_id !== user.id || scan.order_id !== orderId) {
    throw new HttpError(404, "not_found", "Scan not found for this order.");
  }

  const photos = must(await db.from("scan_photos").select("view, storage_path").eq("scan_id", scanId), "photos");
  const views = new Set((photos ?? []).map((p) => p.view as string));
  if (!views.has("face")) throw new HttpError(400, "photos_missing", "The front face photo is missing.");
  for (const p of photos ?? []) {
    if (!(p.storage_path as string).startsWith(`${user.id}/${scanId}/`)) {
      throw new HttpError(400, "bad_photo_path", "A photo was stored in the wrong place. Please retake it.");
    }
  }

  const photoConsent = must(
    await db.from("consents").select("id").eq("user_id", user.id).eq("kind", "photos").is("withdrawn_at", null).limit(
      1,
    ),
    "photo consent",
  );
  if (!photoConsent?.length) {
    throw new HttpError(403, "photo_consent_required", "Please agree to the photo consent first.");
  }
  const waiver = must(
    await db.from("consents").select("id").eq("user_id", user.id).eq("kind", "withdrawal_waiver").is(
      "withdrawn_at",
      null,
    ).limit(1),
    "withdrawal waiver",
  );

  if (!profile.gender) throw new HttpError(400, "profile_incomplete", "Please complete your profile first.");

  const now = new Date();
  const updated = must(
    await db
      .from("orders")
      .update({
        status: "in_review",
        scan_id: scanId,
        submitted_at: now.toISOString(),
        due_at: new Date(now.getTime() + REVIEW_HOURS * 3600_000).toISOString(),
      })
      .eq("id", orderId)
      .in("status", ["awaiting_photos", "changes_requested"])
      .select("id")
      .maybeSingle(),
    "order update",
  );
  if (!updated) throw new HttpError(409, "wrong_status", "This order was already submitted.");

  let reviewer = order.assigned_reviewer as string | null;
  if (!reviewer) {
    const res = await db.rpc("assign_reviewer", { p_order: orderId });
    if (res.error) console.error("assign_reviewer failed", res.error.message);
    reviewer = (res.data as string | null) ?? null;
  }

  await audit("orders.submitted", "orders", orderId, {
    scan_id: scanId,
    views: [...views],
    reviewer,
    withdrawal_waiver: !!waiver?.length,
  }, user.id);
  if (!reviewer) {
    console.warn(`No ${profile.gender} reviewer available for order ${orderId}; an admin must assign one.`);
  }

  const fresh = mustOne(
    await db.from("orders").select("id, status, product, submitted_at, due_at, assigned_reviewer").eq("id", orderId)
      .single(),
    "order reload",
  );
  const { assigned_reviewer, ...rest } = fresh;
  return json(req, { order: { ...rest, assigned: !!assigned_reviewer } });
});
