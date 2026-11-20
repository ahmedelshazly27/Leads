// Membership helpers shared by create-checkout, stripe-webhook and
// manage-membership.
//
// Yearly plan: the yearly price for the first 12 months, then month to month
// at the monthly price of the same currency (terms, section 6 and 7; prices
// per currency in prices.json, e.g. KWD 45 then KWD 5, SAR 549 then SAR 59).
// Stripe has no "price after N cycles" setting, so a subscription schedule
// does it: the current phase (the 30-day trial when the membership came with
// the report, or the paid year), then one yearly phase after a trial, then the
// monthly price, and the schedule is released so the subscription simply
// continues monthly. Cancelling releases the schedule first (Stripe does not
// allow changing cancellation on a scheduled subscription); resuming creates
// it again.
import { chargeAmount, type Stripe, stripe } from "./stripe.ts";
import { priceOf } from "./prices.ts";

const idOf = (v: string | { id: string } | null | undefined): string | null =>
  v == null ? null : typeof v === "string" ? v : v.id;

export const isYearly = (sub: Stripe.Subscription): boolean => sub.items.data[0]?.price?.recurring?.interval === "year";

/** Lookup key of a membership price: membership_monthly_sar, membership_yearly_kwd, ... */
export const membershipLookupKey = (interval: "monthly" | "yearly", currency: string): string =>
  `membership_${interval}_${currency.toLowerCase()}`;

// Price ids already checked by this instance (they do not change while it runs).
const priceCache = new Map<string, string>();

function matches(p: Stripe.Price, currency: string, minor: number, interval: "monthly" | "yearly"): boolean {
  return p.active && p.currency === currency.toLowerCase() && p.unit_amount === minor &&
    p.recurring?.interval === (interval === "monthly" ? "month" : "year") && p.tax_behavior !== "exclusive";
}

/** Prices made before tax_behavior was set are switched to inclusive (Stripe allows setting it once). */
async function inclusive(p: Stripe.Price): Promise<string> {
  if (p.tax_behavior === "unspecified" || p.tax_behavior == null) {
    await stripe().prices.update(p.id, { tax_behavior: "inclusive" });
  }
  return p.id;
}

/**
 * Price id for a membership in a currency, at the amount in prices.json.
 *   1. STRIPE_PRICE_MONTHLY_SAR / STRIPE_PRICE_YEARLY_SAR ... when set (the
 *      older STRIPE_PRICE_MONTHLY / STRIPE_PRICE_YEARLY count for KWD only),
 *      but only if that price has the amount in the table;
 *   2. otherwise the active price with lookup key membership_<interval>_<cur>;
 *   3. otherwise (none yet, or the table changed) a new price is created and
 *      takes over the lookup key, so subscriptions already running keep
 *      their old price and new ones get the new one.
 */
export async function membershipPriceId(interval: "monthly" | "yearly", currency: string): Promise<string> {
  const cur = currency.toUpperCase();
  const minor = chargeAmount(priceOf(interval, cur), cur);
  const key = membershipLookupKey(interval, cur);
  const cacheKey = `${key}:${minor}`;
  const cached = priceCache.get(cacheKey);
  if (cached) return cached;
  const s = stripe();

  const envName = `STRIPE_PRICE_${interval.toUpperCase()}`;
  const configured = Deno.env.get(`${envName}_${cur}`) ?? (cur === "KWD" ? Deno.env.get(envName) : undefined);
  if (configured) {
    try {
      const p = await s.prices.retrieve(configured);
      if (matches(p, cur, minor, interval)) {
        const id = await inclusive(p);
        priceCache.set(cacheKey, id);
        return id;
      }
      console.warn(
        `${envName}(_${cur}) does not match prices.json (${minor} ${cur}/${interval}); using the lookup key`,
      );
    } catch (err) {
      console.warn(`${envName}(_${cur}) could not be read`, (err as Error).message);
    }
  }

  const found = (await s.prices.list({ lookup_keys: [key], active: true, limit: 1 })).data[0];
  if (found && matches(found, cur, minor, interval)) {
    const id = await inclusive(found);
    priceCache.set(cacheKey, id);
    return id;
  }
  const created = await s.prices.create(
    {
      currency: cur.toLowerCase(),
      unit_amount: minor,
      tax_behavior: "inclusive",
      recurring: { interval: interval === "monthly" ? "month" : "year" },
      ...(found
        ? { product: idOf(found.product)! }
        : { product_data: { name: interval === "monthly" ? "Membership (monthly)" : "Membership (yearly)" } }),
      lookup_key: key,
      transfer_lookup_key: true,
      metadata: { purpose: "membership", interval },
    },
    { idempotencyKey: `price-${key}-${minor}` },
  );
  priceCache.set(cacheKey, created.id);
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

  // Same currency as the subscription: a SAR yearly plan continues at the SAR monthly price.
  const currency = (sub.items.data[0]?.price?.currency ?? sub.currency ?? "kwd").toUpperCase();
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
