// POST { action } -> { subscription, refund? }
// The signed-in customer manages their own Stripe membership (terms section 7,
// refund policy section 5):
//   cancel   stop at the end of the current period (the trial included with
//            the report, the paid month, or the paid year). Benefits stay
//            until then; nothing more is charged.
//   resume   undo a cancel while the period is still running.
//   end_now  yearly plan only, after the year has been paid: end today and
//            refund the full months that are left (price / 12 per month).
//            The refund goes to the card through Stripe; stripe-webhook
//            records it from charge.refunded.
// Withdrawal within 14 days of starting a membership (full refund) is handled
// by hand on request, as the terms describe.
import { HttpError, json, readJson, serve } from "../_shared/http.ts";
import { requireUser } from "../_shared/auth.ts";
import { admin, audit, must } from "../_shared/supabase.ts";
import { fromMinor, type Stripe, stripe } from "../_shared/stripe.ts";
import { ensureYearlyThenMonthly, isYearly, releaseSchedule } from "../_shared/membership.ts";

type Action = "cancel" | "resume" | "end_now";
const ACTIONS: Action[] = ["cancel", "resume", "end_now"];

const idOf = (v: string | { id: string } | null | undefined): string | null =>
  v == null ? null : typeof v === "string" ? v : v.id;
const toIso = (secs: number | null | undefined) => (secs ? new Date(secs * 1000).toISOString() : null);

function periodEnd(sub: Stripe.Subscription): number | null {
  return (sub as unknown as { current_period_end?: number }).current_period_end ??
    (sub.items.data[0] as unknown as { current_period_end?: number } | undefined)?.current_period_end ?? null;
}

/** Whole calendar months from `from` until `to` (0 when less than one is left). */
function fullMonthsLeft(from: Date, to: Date): number {
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  const probe = new Date(from);
  probe.setUTCMonth(probe.getUTCMonth() + months);
  if (probe > to) months--;
  return Math.max(0, months);
}

async function invoicePaymentIntent(inv: Stripe.Invoice): Promise<string | null> {
  const legacy = idOf((inv as unknown as { payment_intent?: string | { id: string } | null }).payment_intent);
  if (legacy) return legacy;
  try {
    const res = await stripe().rawRequest("GET", `/v1/invoice_payments?invoice=${inv.id}&limit=1`);
    const pay = (res as unknown as { data?: Array<{ payment?: { payment_intent?: string } }> }).data?.[0]?.payment;
    return pay?.payment_intent ?? null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  const { user } = await requireUser(req);
  const body = await readJson<{ action?: string }>(req);
  const action = body.action as Action;
  if (!ACTIONS.includes(action)) throw new HttpError(400, "bad_action", "Unknown action.");
  const db = admin();

  const row = must(
    await db.from("subscriptions").select("id, provider, provider_sub_id, status, plan")
      .eq("user_id", user.id).in("status", ["trialing", "active", "past_due"])
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    "subscription",
  );
  if (!row) throw new HttpError(404, "no_membership", "You do not have an active membership.");
  if (row.provider !== "stripe") throw new HttpError(409, "not_stripe", "Please contact us to change this membership.");

  const s = stripe();
  let sub = await s.subscriptions.retrieve(row.provider_sub_id as string);
  const customer = idOf(sub.customer);
  const metaUser = sub.metadata?.user_id;
  if (metaUser && metaUser !== user.id) {
    throw new HttpError(404, "no_membership", "You do not have an active membership.");
  }
  if (sub.status === "canceled" || sub.status === "incomplete_expired") {
    throw new HttpError(409, "ended", "This membership has already ended.");
  }

  let refund: { amount: number; currency: string; months: number; id: string | null; pending: boolean } | null = null;

  if (action === "cancel") {
    if (!sub.cancel_at_period_end) {
      await releaseSchedule(sub);
      sub = await s.subscriptions.update(sub.id, { cancel_at_period_end: true });
    }
  } else if (action === "resume") {
    if (sub.cancel_at_period_end || sub.cancel_at) {
      sub = await s.subscriptions.update(
        sub.id,
        { cancel_at_period_end: false, ...(sub.cancel_at ? { cancel_at: "" } : {}) } as Stripe.SubscriptionUpdateParams,
      );
    }
    if (isYearly(sub) && !sub.schedule) {
      try {
        await ensureYearlyThenMonthly(sub.id);
        sub = await s.subscriptions.retrieve(sub.id);
      } catch (err) {
        console.error("yearly schedule on resume failed", sub.id, (err as Error).message);
        await audit("stripe.schedule_failed", "subscriptions", row.id as string, {
          subscription: sub.id,
          on: "resume",
        });
      }
    }
  } else {
    // end_now
    if (!isYearly(sub)) {
      throw new HttpError(
        409,
        "not_yearly",
        "A monthly membership ends at the end of the month you have paid for, so it can only be cancelled.",
      );
    }
    if (sub.status === "trialing") {
      throw new HttpError(
        409,
        "trialing",
        "Nothing has been charged for the membership yet, so it can only be cancelled.",
      );
    }
    const end = periodEnd(sub);
    const months = end ? fullMonthsLeft(new Date(), new Date(end * 1000)) : 0;
    const invId = idOf(sub.latest_invoice);
    const inv = invId ? await s.invoices.retrieve(invId) : null;
    const currency = (inv?.currency ?? sub.currency ?? "kwd").toUpperCase();
    const unit = sub.items.data[0]?.price?.unit_amount ?? 0;
    const paid = inv?.status === "paid" ? inv.amount_paid : 0;
    const yearMinor = Math.min(unit, paid);
    // Stripe needs KWD amounts in whole 10 fils.
    let amountMinor = Math.floor((yearMinor * months) / 12);
    if (currency === "KWD") amountMinor = Math.floor(amountMinor / 10) * 10;

    await releaseSchedule(sub);
    sub = await s.subscriptions.cancel(sub.id, { prorate: false, invoice_now: false });

    if (amountMinor > 0 && inv) {
      const pi = await invoicePaymentIntent(inv);
      try {
        if (!pi) throw new Error("no payment intent on the invoice");
        const r = await s.refunds.create(
          {
            payment_intent: pi,
            amount: amountMinor,
            metadata: { reason: "yearly_ended_early", subscription: sub.id, months: String(months) },
          },
          { idempotencyKey: `yearly-end-${sub.id}` },
        );
        refund = { amount: fromMinor(amountMinor, currency), currency, months, id: r.id, pending: false };
      } catch (err) {
        console.error("yearly early-end refund failed", sub.id, (err as Error).message);
        refund = { amount: fromMinor(amountMinor, currency), currency, months, id: null, pending: true };
      }
    }
  }

  const end = periodEnd(sub);
  const update = {
    status: sub.status === "canceled" ? "canceled" : row.status,
    cancel_at: toIso(sub.cancel_at) ?? (sub.cancel_at_period_end ? toIso(end) : null),
    canceled_at: toIso(sub.canceled_at),
    current_period_end: toIso(end),
  };
  must(await db.from("subscriptions").update(update).eq("id", row.id), "subscription update");
  await audit(`membership.${action}`, "subscriptions", row.id as string, {
    subscription: sub.id,
    customer,
    ...(refund ? { refund } : {}),
  }, user.id);

  return json(req, {
    subscription: { id: row.id, plan: row.plan, ...update },
    ...(refund ? { refund } : {}),
  });
});
