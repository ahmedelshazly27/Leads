// POST { order_id, status: "in_review" | "changes_requested", message? } -> { order, emailed }
// Reviewer/admin only (the assigned reviewer, or an admin). Moves an order
// between in_review and changes_requested (the only change a reviewer may make
// outside approve-delivery). On changes_requested the customer gets an email
// in their language with a link to the order page (/orders/:id, or
// /ar/orders/:id), where they retake and resend the photos; `message` (the
// reviewer's note on what to retake, optional, at most 2000 characters) is
// included in that email. Logged in audit_log as 'orders.changes_requested'
// (the note itself is not stored there).
// Setting the status it already has does nothing and sends no email. At most
// 3 changes-requested emails per order per hour (then emailed: false).
import { HttpError, json, readJson, requireUuid, serve } from "../_shared/http.ts";
import { requireRole } from "../_shared/auth.ts";
import { admin, audit, customerContact, must } from "../_shared/supabase.ts";
import { changesRequestedEmail, customerUrl, sendEmail } from "../_shared/email.ts";

const STATUSES = ["in_review", "changes_requested"] as const;
type Status = typeof STATUSES[number];

serve(async (req) => {
  const { user, profile } = await requireRole(req, ["reviewer", "admin"]);
  const body = await readJson<{ order_id?: string; status?: string; message?: unknown }>(req);
  const orderId = requireUuid(body.order_id, "order_id");
  const status = body.status as Status;
  if (!STATUSES.includes(status)) {
    throw new HttpError(400, "bad_status", "status must be in_review or changes_requested.");
  }
  if (body.message != null && typeof body.message !== "string") {
    throw new HttpError(400, "bad_request", "message must be text.");
  }
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
  const db = admin();

  const order = must(
    await db.from("orders").select("id, user_id, status, assigned_reviewer").eq("id", orderId).maybeSingle(),
    "order",
  );
  if (!order) throw new HttpError(404, "not_found", "Order not found.");
  if (profile.role !== "admin" && order.assigned_reviewer !== user.id) {
    throw new HttpError(403, "forbidden", "This order is not assigned to you.");
  }
  if (!STATUSES.includes(order.status as Status)) {
    throw new HttpError(409, "wrong_status", "Only orders in review can be changed here.");
  }
  if (order.status === status) {
    const same = must(await db.from("orders").select("*").eq("id", orderId).single(), "order reload");
    return json(req, { order: same, emailed: false, unchanged: true });
  }

  const updated = must(
    await db.from("orders").update({ status }).eq("id", orderId).eq("status", order.status as string)
      .select("*").maybeSingle(),
    "order update",
  );
  if (!updated) throw new HttpError(409, "wrong_status", "The order changed in the meantime. Please reload.");

  let emailed = false;
  // At most 3 of these emails per order per hour, so toggling the status back
  // and forth cannot flood the customer's inbox.
  let throttled = false;
  if (status === "changes_requested" && order.user_id) {
    const rl = await db.rpc("hit_rate_limit", { p_key: `changes_email:${orderId}`, p_window_seconds: 3600, p_max: 3 });
    if (rl.error) console.warn("rate limit check failed", rl.error.message);
    throttled = rl.data === false;
  }
  if (status === "changes_requested" && order.user_id && !throttled) {
    try {
      const to = await customerContact(order.user_id as string);
      if (to) {
        const msg = changesRequestedEmail({
          locale: to.locale,
          name: to.name,
          link: customerUrl(to.locale, `/orders/${orderId}`),
          message: message || null,
        });
        const res = await sendEmail({ to: to.email, ...msg });
        emailed = res.ok;
        if (!res.ok) console.warn("changes-requested email not sent:", res.error);
      }
    } catch (err) {
      // The status change stands; the reviewer sees emailed: false.
      console.error("changes-requested email failed", (err as Error).message);
    }
  }

  if (status === "changes_requested") {
    await audit("orders.changes_requested", "orders", orderId, {
      from: order.status,
      emailed,
      with_message: !!message,
      ...(throttled ? { throttled: true } : {}),
    }, user.id);
  }

  return json(req, { order: updated, emailed });
});
