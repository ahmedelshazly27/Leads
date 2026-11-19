// Membership helpers shared by stripe-webhook and manage-membership.
//
// Yearly plan: 45 KWD for the first 12 months, then month to month at 5 KWD
// (terms, section 6 and 7). Stripe has no "price after N cycles" setting, so a
// subscription schedule does it: the current phase (the 30-day trial when the
// membership came with the report, or the paid year), then one yearly phase
// after a trial, then the monthly price, and the schedule is released so the
// subscription simply continues monthly. Cancelling releases the schedule
// first (Stripe does not allow changing cancellation on a scheduled
// subscription); resuming creates it again.
import { PRICES_KWD, type Stripe, stripe, toMinor } from "./stripe.ts";

const idOf = (v: string | { id: string } | null | undefined): string | null =>
  v == null ? null : typeof v === "string" ? v : v.id;

export const isYearly = (sub: Stripe.Subscription): boolean => sub.items.data[0]?.price?.recurring?.interval === "year";

/** Price id for a membership interval: STRIPE_PRICE_* when set, otherwise a price found or created by lookup key. */
export async function membershipPriceId(interval: "monthly" | "yearly", currency = "KWD"): Promise<string> {
  const configured = Deno.env.get(interval === "monthly" ? "STRIPE_PRICE_MONTHLY" : "STRIPE_PRICE_YEARLY");
  if (configured) return configured;
  const cur = currency.toLowerCase();
  const key = `membership_${interval}_${cur}`;
  const found = await stripe().prices.list({ lookup_keys: [key], active: true, limit: 1 });
  if (found.data[0]) return found.data[0].id;
  const created = await stripe().prices.create(
    {
      currency: cur,
      unit_amount: toMinor(interval === "monthly" ? PRICES_KWD.monthly : PRICES_KWD.yearly, currency),
      recurring: { interval: interval === "monthly" ? "month" : "year" },
      product_data: { name: interval === "monthly" ? "Membership (monthly)" : "Membership (yearly)" },
      lookup_key: key,
    },
    { idempotencyKey: `price-${key}` },
  );
  return created.id;
}

/**
 * Puts a yearly subscription on a schedule that continues it monthly after the
 * first year. Does nothing for monthly plans, subscriptions that already have
 * a schedule, and ones that are cancelling or ended. Returns the schedule id.
 */
export async function ensureYearlyThenMonthly(subscriptionId: string): Promise<string | null> {
  const s = stripe();
  const sub = await s.subscriptions.retrieve(subscriptionId);
  if (!isYearly(sub)) return null;
  if (sub.schedule) return idOf(sub.schedule);
  if (sub.cancel_at_period_end || sub.cancel_at || !["trialing", "active"].includes(sub.status)) return null;

  const currency = (sub.items.data[0]?.price?.currency ?? "kwd").toUpperCase();
  const [monthly, yearly] = await Promise.all([
    membershipPriceId("monthly", currency),
    sub.status === "trialing" ? membershipPriceId("yearly", currency) : Promise.resolve(null),
  ]);

  const schedule = await s.subscriptionSchedules.create({ from_subscription: sub.id });
  const p0 = schedule.phases[0];
  const phases: Stripe.SubscriptionScheduleUpdateParams.Phase[] = [
    {
      items: p0.items.map((i) => ({ price: idOf(i.price)!, quantity: i.quantity ?? 1 })),
      start_date: p0.start_date,
      end_date: p0.end_date,
      ...(p0.trial_end ? { trial_end: p0.trial_end } : {}),
      proration_behavior: "none",
    },
  ];
  if (yearly) phases.push({ items: [{ price: yearly, quantity: 1 }], iterations: 1, proration_behavior: "none" });
  phases.push({ items: [{ price: monthly, quantity: 1 }], iterations: 1, proration_behavior: "none" });

  try {
    await s.subscriptionSchedules.update(schedule.id, {
      phases,
      end_behavior: "release",
      metadata: { purpose: "yearly_then_monthly" },
    });
  } catch (err) {
    // Leave the subscription as it was rather than on a half-made schedule.
    await s.subscriptionSchedules.release(schedule.id).catch(() => {});
    throw err;
  }
  return schedule.id;
}

/** Releases the schedule of a subscription (if any), so its cancellation can be changed. */
export async function releaseSchedule(sub: Stripe.Subscription): Promise<void> {
  const id = idOf(sub.schedule);
  if (!id) return;
  const sched = await stripe().subscriptionSchedules.retrieve(id);
  if (sched.status === "active" || sched.status === "not_started") {
    await stripe().subscriptionSchedules.release(id);
  }
}
