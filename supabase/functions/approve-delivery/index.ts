// POST { order_id, generation_ids: string[], notes? } -> { order, emailed }
// Reviewer/admin only. Approves the chosen visuals, approves the review,
// delivers the order and emails the customer. Nothing reaches the customer
// before this runs.
import { HttpError, json, readJson, requireUuid, serve, UUID_RE } from "../_shared/http.ts";
import { requireRole } from "../_shared/auth.ts";
import { admin, audit, must } from "../_shared/supabase.ts";
import { reportReadyEmail, sendEmail } from "../_shared/email.ts";

serve(async (req) => {
  const { user, profile } = await requireRole(req, ["reviewer", "admin"]);
  const body = await readJson<{ order_id?: string; generation_ids?: unknown; notes?: string }>(req);
  const orderId = requireUuid(body.order_id, "order_id");
  const ids = Array.isArray(body.generation_ids) ? body.generation_ids : [];
  if (!ids.every((id) => typeof id === "string" && UUID_RE.test(id)) || ids.length > 20) {
    throw new HttpError(400, "bad_request", "generation_ids must be a list of up to 20 ids.");
  }
  const generationIds = [...new Set(ids as string[])];
  const db = admin();

  const order = must(
    await db.from("orders").select("id, user_id, status, assigned_reviewer").eq("id", orderId).maybeSingle(),
    "order",
  );
  if (!order) throw new HttpError(404, "not_found", "Order not found.");
  if (profile.role !== "admin" && order.assigned_reviewer !== user.id) {
    throw new HttpError(403, "forbidden", "This order is not assigned to you.");
  }
  if (order.status !== "in_review") throw new HttpError(409, "wrong_status", "Only orders in review can be delivered.");

  if (generationIds.length) {
    const gens = must(
      await db.from("generations").select("id, order_id, status").in("id", generationIds),
      "generations",
    );
    const ok = (gens ?? []).filter((g) => g.order_id === orderId && g.status === "succeeded");
    if (ok.length !== generationIds.length) {
      throw new HttpError(400, "bad_generations", "Some visuals do not belong to this order or did not finish.");
    }
  }

  const now = new Date().toISOString();

  // Approved set = exactly the chosen ids.
  must(await db.from("generations").update({ approved: false }).eq("order_id", orderId), "reset approvals");
  if (generationIds.length) {
    must(await db.from("generations").update({ approved: true }).in("id", generationIds), "approve generations");
  }

  const existingReview = must(
    await db.from("reviews").select("id, reviewer_id").eq("order_id", orderId).maybeSingle(),
    "review",
  );
  const notes = typeof body.notes === "string" ? body.notes.slice(0, 20000) : undefined;
  if (existingReview) {
    must(
      await db
        .from("reviews")
        .update({ status: "approved", approved_at: now, ...(notes !== undefined ? { notes } : {}) })
        .eq("id", existingReview.id),
      "review approve",
    );
  } else {
    must(
      await db.from("reviews").insert({
        order_id: orderId,
        reviewer_id: user.id,
        status: "approved",
        approved_at: now,
        notes: notes ?? null,
      }),
      "review insert",
    );
  }

  const delivered = must(
    await db
      .from("orders")
      .update({ status: "delivered", delivered_at: now })
      .eq("id", orderId)
      .eq("status", "in_review")
      .select("id, status, delivered_at")
      .maybeSingle(),
    "deliver",
  );
  if (!delivered) throw new HttpError(409, "wrong_status", "The order changed while approving. Please reload.");

  await audit("orders.delivered", "orders", orderId, { generation_ids: generationIds }, user.id);

  // Email (failure does not undo the delivery).
  let emailed = false;
  if (order.user_id) {
    const customer = must(
      await db.from("profiles").select("email, full_name, locale").eq("id", order.user_id).maybeSingle(),
      "customer",
    );
    if (customer?.email) {
      const site = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
      const locale = customer.locale === "ar" ? "ar" : "en";
      const firstName = (customer.full_name as string | null)?.split(/\s+/)[0] ?? null;
      const msg = reportReadyEmail({
        locale,
        name: firstName,
        link: `${site}/orders/${orderId}`,
        brand: Deno.env.get("BRAND_NAME") ?? "",
      });
      const res = await sendEmail({ to: customer.email as string, ...msg });
      emailed = res.ok;
      if (!res.ok) console.warn("report-ready email not sent:", res.error);
    }
  }

  return json(req, { order: delivered, emailed });
});
