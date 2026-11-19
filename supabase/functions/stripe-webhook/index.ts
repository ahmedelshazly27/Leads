// Stripe webhook. Verifies the signature, then handles each event once
// (event ids are stored in stripe_events; a failed event is retried by Stripe
// and processed again because processed_at stays empty).
//
// Events to enable on the endpoint:
//   checkout.session.completed, checkout.session.async_payment_succeeded,
//   checkout.session.async_payment_failed, checkout.session.expired,
//   customer.subscription.created, customer.subscription.updated,
//   customer.subscription.deleted, invoice.paid, invoice.payment_failed,
//   charge.refunded
import { HttpError, json, requireEnv, serve } from "../_shared/http.ts";
import { admin, audit, must } from "../_shared/supabase.ts";
import { cryptoProvider, fromMinor, type Stripe, stripe } from "../_shared/stripe.ts";

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const idOf = (v: string | { id: string } | null | undefined): string | null =>
  v == null ? null : typeof v === "string" ? v : v.id;

// ---------------------------------------------------------------------------
// Fees: read the balance transaction of the charge. Stripe settles a Dutch
// account in EUR, so convert the fee back to the charge currency with the
// rate Stripe used, and keep the settled values as well.
// ---------------------------------------------------------------------------
interface FeeInfo {
  chargeId: string | null;
  fee: number | null;
  net: number | null;
  settlementCurrency: string | null;
  settlementFee: number | null;
  settlementNet: number | null;
}

async function feeForCharge(chargeId: string | null): Promise<FeeInfo> {
  const empty: FeeInfo = { chargeId, fee: null, net: null, settlementCurrency: null, settlementFee: null, settlementNet: null };
  if (!chargeId) return empty;
  const charge = await stripe().charges.retrieve(chargeId, { expand: ["balance_transaction"] });
  const bt = charge.balance_transaction;
  if (!bt || typeof bt === "string") return empty;
  const cur = charge.currency.toUpperCase();
  const sCur = bt.currency.toUpperCase();
  const sFee = fromMinor(bt.fee, sCur);
  const sNet = fromMinor(bt.net, sCur);
  const rate = cur === sCur ? 1 : bt.exchange_rate ?? null;
  return {
    chargeId,
    fee: rate ? round3(sFee / rate) : null,
    net: rate ? round3(sNet / rate) : null,
    settlementCurrency: sCur,
    settlementFee: sFee,
    settlementNet: sNet,
  };
}

async function chargeIdForPaymentIntent(piId: string | null): Promise<string | null> {
  if (!piId) return null;
  const pi = await stripe().paymentIntents.retrieve(piId);
  return idOf(pi.latest_charge);
}

// ---------------------------------------------------------------------------
// Payments (one row per provider reference; a fee cost row the first time)
// ---------------------------------------------------------------------------
interface PaymentInput {
  ref: string;
  chargeId: string | null;
  orderId: string | null;
  subscriptionId: string | null;
  userId: string | null;
  amountMinor: number;
  currency: string;
  status: "succeeded" | "refunded" | "failed";
  withFee: boolean;
}

async function recordPayment(p: PaymentInput): Promise<void> {
  const db = admin();
  const currency = p.currency.toUpperCase();
  const existing = must(
    await db.from("payments").select("id, status").eq("provider", "stripe").eq("provider_ref", p.ref).maybeSingle(),
    "payment lookup",
  );
  if (existing && existing.status === p.status) return;

  const fee = p.withFee ? await feeForCharge(p.chargeId) : null;
  const row = {
    provider: "stripe",
    provider_ref: p.ref,
    provider_charge: p.chargeId,
    order_id: p.orderId,
    subscription_id: p.subscriptionId,
    user_id: p.userId,
    amount: fromMinor(p.amountMinor, currency),
    currency,
    fee: fee?.fee ?? null,
    net: fee?.net ?? null,
    settlement_currency: fee?.settlementCurrency ?? null,
    settlement_fee: fee?.settlementFee ?? null,
    settlement_net: fee?.settlementNet ?? null,
    status: p.status,
  };
  must(await db.from("payments").upsert(row, { onConflict: "provider,provider_ref" }), "payment upsert");

  if (!existing && fee) {
    // Fee in KWD when Stripe gave a rate, otherwise in the settlement currency.
    const amount = fee.fee ?? fee.settlementFee;
    const feeCurrency = fee.fee != null ? currency : fee.settlementCurrency;
    if (amount && amount > 0 && feeCurrency && ["KWD", "USD", "EUR"].includes(feeCurrency)) {
      must(
        await db.from("costs").insert({
          order_id: p.orderId,
          user_id: p.userId,
          category: "payment_fee",
          amount,
          currency: feeCurrency,
          note: `stripe fee ${p.chargeId ?? p.ref}`,
        }),
        "fee cost",
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------
function mapSubStatus(s: Stripe.Subscription.Status): "trialing" | "active" | "past_due" | "canceled" {
  switch (s) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return "past_due"; // past_due, unpaid, incomplete, paused
  }
}

const toIso = (secs: number | null | undefined) => (secs ? new Date(secs * 1000).toISOString() : null);

async function userIdForCustomer(customerId: string | null): Promise<string | null> {
  if (!customerId) return null;
  const row = must(
    await admin().from("profiles").select("id").eq("stripe_customer_id", customerId).maybeSingle(),
    "profile by customer",
  );
  return (row?.id as string | undefined) ?? null;
}

async function upsertSubscription(sub: Stripe.Subscription): Promise<{ id: string; userId: string | null }> {
  const db = admin();
  const customerId = idOf(sub.customer);
  const userId = sub.metadata?.user_id || (await userIdForCustomer(customerId));
  const item = sub.items.data[0];
  const price = item?.price;
  const interval = price?.recurring?.interval;
  const plan = interval === "year" || sub.metadata?.plan?.endsWith("yearly") ? "yearly" : "monthly";
  const currency = (price?.currency ?? sub.currency ?? "kwd").toUpperCase();
  // The period end moved from the subscription to its items in newer API versions.
  const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end ??
    (item as unknown as { current_period_end?: number } | undefined)?.current_period_end;

  const row: Record<string, unknown> = {
    // Left out when unknown so an update never clears an existing owner.
    ...(userId ? { user_id: userId } : {}),
    provider: "stripe",
    provider_sub_id: sub.id,
    provider_customer_id: customerId,
    plan,
    status: mapSubStatus(sub.status),
    amount: price?.unit_amount != null ? fromMinor(price.unit_amount, currency) : null,
    currency,
    current_period_end: toIso(periodEnd),
    trial_end: toIso(sub.trial_end),
    cancel_at: toIso(sub.cancel_at) ?? (sub.cancel_at_period_end ? toIso(periodEnd) : null),
    canceled_at: toIso(sub.canceled_at),
  };
  const saved = must(
    await db.from("subscriptions").upsert(row, { onConflict: "provider,provider_sub_id" }).select("id, user_id").single(),
    "subscription upsert",
  );
  const id = saved.id as string;
  const ownerId = (saved.user_id as string | null) ?? null;

  if (userId && customerId) {
    await db.from("profiles").update({ stripe_customer_id: customerId }).eq("id", userId).is("stripe_customer_id", null);
  }
  const orderId = sub.metadata?.order_id;
  if (orderId) {
    await db.from("orders").update({ subscription_id: id }).eq("id", orderId).is("subscription_id", null);
  }
  return { id, userId: ownerId };
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
async function markOrderPaid(orderId: string): Promise<void> {
  const db = admin();
  const now = new Date().toISOString();
  // Two steps so the audit log shows paid -> awaiting_photos.
  must(
    await db.from("orders").update({ status: "paid", paid_at: now }).eq("id", orderId).eq("status", "pending_payment"),
    "order paid",
  );
  must(
    await db.from("orders").update({ status: "awaiting_photos" }).eq("id", orderId).eq("status", "paid"),
    "order awaiting photos",
  );
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------
async function onCheckoutCompleted(s: Stripe.Checkout.Session): Promise<void> {
  if (s.payment_status === "unpaid") return; // async method: wait for async_payment_succeeded
  const orderId = s.metadata?.order_id ?? null;
  const userId = s.metadata?.user_id ?? null;
  const customerId = idOf(s.customer);

  if (userId && customerId) {
    await admin().from("profiles").update({ stripe_customer_id: customerId }).eq("id", userId).is("stripe_customer_id", null);
  }
  if (orderId) await markOrderPaid(orderId);

  if (s.mode === "payment") {
    const piId = idOf(s.payment_intent);
    if (piId) {
      const pi = await stripe().paymentIntents.retrieve(piId);
      await recordPayment({
        ref: pi.id,
        chargeId: idOf(pi.latest_charge),
        orderId,
        subscriptionId: null,
        userId,
        amountMinor: pi.amount_received || pi.amount,
        currency: pi.currency,
        status: "succeeded",
        withFee: true,
      });
    }
  } else if (s.mode === "subscription") {
    const subId = idOf(s.subscription);
    if (subId) await upsertSubscription(await stripe().subscriptions.retrieve(subId));
    // The payment itself is recorded from invoice.paid.
  }
}

async function onCheckoutFailed(s: Stripe.Checkout.Session): Promise<void> {
  const orderId = s.metadata?.order_id;
  if (!orderId) return;
  must(
    await admin().from("orders").update({ status: "cancelled" }).eq("id", orderId).eq("status", "pending_payment"),
    "order cancelled",
  );
}

function invoiceSubscriptionId(inv: Stripe.Invoice): string | null {
  const legacy = idOf((inv as unknown as { subscription?: string | { id: string } | null }).subscription);
  if (legacy) return legacy;
  const parent = (inv as unknown as {
    parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null;
  }).parent;
  return idOf(parent?.subscription_details?.subscription);
}

async function invoiceChargeId(inv: Stripe.Invoice): Promise<string | null> {
  const legacy = inv as unknown as { charge?: string | { id: string } | null; payment_intent?: string | { id: string } | null };
  const direct = idOf(legacy.charge);
  if (direct) return direct;
  const pi = idOf(legacy.payment_intent);
  if (pi) return await chargeIdForPaymentIntent(pi);
  // Newer API versions list payments on the invoice instead.
  try {
    const res = await stripe().rawRequest("GET", `/v1/invoice_payments?invoice=${inv.id}&limit=1`);
    const pay = (res as unknown as { data?: Array<{ payment?: { payment_intent?: string; charge?: string } }> }).data?.[0]?.payment;
    if (pay?.charge) return pay.charge;
    if (pay?.payment_intent) return await chargeIdForPaymentIntent(pay.payment_intent);
  } catch (err) {
    console.warn("invoice_payments lookup failed", (err as Error).message);
  }
  return null;
}

async function onInvoicePaid(inv: Stripe.Invoice): Promise<void> {
  if (!inv.amount_paid || inv.amount_paid <= 0) return; // trial or zero invoices
  const subId = invoiceSubscriptionId(inv);
  if (!subId || !inv.id) return;
  const db = admin();

  const existing = must(
    await db.from("payments").select("id, status").eq("provider", "stripe").eq("provider_ref", inv.id).maybeSingle(),
    "invoice payment lookup",
  );
  if (existing?.status === "succeeded") return;

  const sub = await stripe().subscriptions.retrieve(subId);
  const { id: subscriptionId, userId } = await upsertSubscription(sub);
  const currency = inv.currency.toUpperCase();

  let orderId: string | null = null;
  const reportOrder = sub.metadata?.order_id;
  if (inv.billing_reason === "subscription_create" && reportOrder) {
    // First invoice of "report + membership": this is the report payment.
    orderId = reportOrder;
    await markOrderPaid(reportOrder);
  } else if (userId) {
    // Membership period paid: one check-in (re-scan) order.
    const order = must(
      await db
        .from("orders")
        .insert({
          user_id: userId,
          product: "checkin",
          status: "awaiting_photos",
          amount: fromMinor(inv.amount_paid, currency),
          currency,
          provider: "stripe",
          provider_ref: inv.id,
          subscription_id: subscriptionId,
          paid_at: new Date().toISOString(),
        })
        .select("id")
        .single(),
      "checkin order",
    );
    orderId = order.id as string;
  }

  await recordPayment({
    ref: inv.id,
    chargeId: await invoiceChargeId(inv),
    orderId,
    subscriptionId,
    userId,
    amountMinor: inv.amount_paid,
    currency,
    status: "succeeded",
    withFee: true,
  });
}

async function onInvoiceFailed(inv: Stripe.Invoice): Promise<void> {
  const subId = invoiceSubscriptionId(inv);
  if (!subId || !inv.id) return;
  const db = admin();
  const existing = must(
    await db.from("payments").select("id").eq("provider", "stripe").eq("provider_ref", inv.id).maybeSingle(),
    "invoice payment lookup",
  );
  if (existing) return;
  const sub = must(
    await db.from("subscriptions").select("id, user_id").eq("provider", "stripe").eq("provider_sub_id", subId).maybeSingle(),
    "subscription lookup",
  );
  await recordPayment({
    ref: inv.id,
    chargeId: null,
    orderId: null,
    subscriptionId: (sub?.id as string | undefined) ?? null,
    userId: (sub?.user_id as string | undefined) ?? null,
    amountMinor: inv.amount_due,
    currency: inv.currency,
    status: "failed",
    withFee: false,
  });
}

async function onChargeRefunded(charge: Stripe.Charge): Promise<void> {
  const db = admin();
  let original = must(
    await db.from("payments").select("order_id, user_id, subscription_id").eq("provider", "stripe")
      .eq("provider_charge", charge.id).gt("amount", 0).limit(1).maybeSingle(),
    "payment by charge",
  );
  if (!original) {
    const refs = [idOf(charge.payment_intent), idOf((charge as unknown as { invoice?: string | null }).invoice)]
      .filter(Boolean) as string[];
    if (refs.length) {
      original = must(
        await db.from("payments").select("order_id, user_id, subscription_id").eq("provider", "stripe")
          .in("provider_ref", refs).gt("amount", 0).limit(1).maybeSingle(),
        "payment by ref",
      );
    }
  }

  const refunds = await stripe().refunds.list({ charge: charge.id, limit: 100 });
  for (const r of refunds.data) {
    if (r.status !== "succeeded") continue;
    const currency = r.currency.toUpperCase();
    const exists = must(
      await db.from("payments").select("id").eq("provider", "stripe").eq("provider_ref", r.id).maybeSingle(),
      "refund lookup",
    );
    if (exists) continue;
    must(
      await db.from("payments").insert({
        provider: "stripe",
        provider_ref: r.id,
        provider_charge: charge.id,
        order_id: original?.order_id ?? null,
        subscription_id: original?.subscription_id ?? null,
        user_id: original?.user_id ?? null,
        amount: -fromMinor(r.amount, currency),
        currency,
        status: "refunded",
      }),
      "refund insert",
    );
  }

  if (charge.refunded && original?.order_id) {
    must(
      await db.from("orders").update({ status: "refunded" }).eq("id", original.order_id).neq("status", "refunded"),
      "order refunded",
    );
  }
}

// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method !== "POST") throw new HttpError(405, "method_not_allowed", "Use POST.");
  const signature = req.headers.get("stripe-signature");
  if (!signature) throw new HttpError(400, "no_signature", "Missing Stripe signature.");
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(
      raw,
      signature,
      requireEnv("STRIPE_WEBHOOK_SECRET"),
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    console.warn("stripe signature check failed", (err as Error).message);
    throw new HttpError(400, "bad_signature", "Invalid signature.");
  }

  const db = admin();
  const seen = must(
    await db.from("stripe_events").select("processed_at").eq("id", event.id).maybeSingle(),
    "event lookup",
  );
  if (seen?.processed_at) return json(req, { received: true, duplicate: true });
  if (!seen) {
    must(
      await db.from("stripe_events").upsert({ id: event.id, type: event.type }, { onConflict: "id", ignoreDuplicates: true }),
      "event insert",
    );
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired":
      await onCheckoutFailed(event.data.object as Stripe.Checkout.Session);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await upsertSubscription(event.data.object as Stripe.Subscription);
      break;
    case "invoice.paid":
      await onInvoicePaid(event.data.object as Stripe.Invoice);
      break;
    case "invoice.payment_failed":
      await onInvoiceFailed(event.data.object as Stripe.Invoice);
      break;
    case "charge.refunded":
      await onChargeRefunded(event.data.object as Stripe.Charge);
      break;
    default:
      // Not used; acknowledged so Stripe stops retrying.
      break;
  }

  must(
    await db.from("stripe_events").update({ processed_at: new Date().toISOString() }).eq("id", event.id),
    "event processed",
  );
  if (event.type === "charge.refunded") {
    await audit("stripe.refund", "charge", (event.data.object as Stripe.Charge).id, { event: event.id });
  }
  return json(req, { received: true });
});
