// POST { plan, locale } -> { url, order_id }
// Creates the order (pending_payment) and a Stripe Checkout Session in KWD.
//   report                      mode=payment, one 20.000 KWD line
//   report_membership_monthly   mode=subscription: report (one-time) + monthly, 30-day trial on the recurring price
//   report_membership_yearly    mode=subscription: report (one-time) + yearly,  30-day trial on the recurring price
//   membership_monthly/_yearly  mode=subscription, no report order (check-ins come from paid invoices);
//                               no trial, except that joining during the included month (report bought
//                               on its own) starts the trial until that month ends
// Return URLs use the customer's language: /ar/orders/:id, /ar/start, /ar/account for Arabic.
import { HttpError, json, readJson, requireEnv, serve } from "../_shared/http.ts";
import { requireUser } from "../_shared/auth.ts";
import { admin, must, mustOne } from "../_shared/supabase.ts";
import { PRICES_KWD, type Stripe, stripe, toMinor, TRIAL_DAYS_WITH_REPORT } from "../_shared/stripe.ts";

type Plan =
  | "report"
  | "report_membership_monthly"
  | "report_membership_yearly"
  | "membership_monthly"
  | "membership_yearly";

const PLANS: Plan[] = [
  "report",
  "report_membership_monthly",
  "report_membership_yearly",
  "membership_monthly",
  "membership_yearly",
];

const CURRENCY = "KWD";
const MIN_TRIAL_MS = 49 * 3600_000;

function reportLine(locale: string): Stripe.Checkout.SessionCreateParams.LineItem {
  const price = Deno.env.get("STRIPE_PRICE_REPORT");
  if (price) return { price, quantity: 1 };
  return {
    quantity: 1,
    price_data: {
      currency: CURRENCY.toLowerCase(),
      unit_amount: toMinor(PRICES_KWD.report, CURRENCY),
      product_data: {
        name: locale === "ar" ? "تقرير التحليل وخطة 12 شهر" : "Analysis report and 12-month plan",
      },
    },
  };
}

function membershipLine(interval: "monthly" | "yearly", locale: string): Stripe.Checkout.SessionCreateParams.LineItem {
  const price = Deno.env.get(interval === "monthly" ? "STRIPE_PRICE_MONTHLY" : "STRIPE_PRICE_YEARLY");
  if (price) return { price, quantity: 1 };
  return {
    quantity: 1,
    price_data: {
      currency: CURRENCY.toLowerCase(),
      unit_amount: toMinor(interval === "monthly" ? PRICES_KWD.monthly : PRICES_KWD.yearly, CURRENCY),
      recurring: { interval: interval === "monthly" ? "month" : "year" },
      product_data: {
        name: locale === "ar"
          ? (interval === "monthly" ? "العضوية الشهرية" : "العضوية السنوية")
          : (interval === "monthly" ? "Membership (monthly)" : "Membership (yearly)"),
      },
    },
  };
}

serve(async (req) => {
  const { user, profile } = await requireUser(req);
  const body = await readJson<{ plan?: string; locale?: string }>(req);
  const plan = body.plan as Plan;
  if (!PLANS.includes(plan)) throw new HttpError(400, "bad_plan", "Unknown plan.");
  const locale = body.locale === "ar" ? "ar" : body.locale === "en" ? "en" : profile.locale;
  const db = admin();

  // Business rules: men only at launch (women join the waitlist), 18+ confirmed.
  if (profile.gender === "female") {
    throw new HttpError(403, "waitlist", "We are opening for women soon. Please join the waitlist.");
  }
  if (profile.gender !== "male") {
    throw new HttpError(400, "profile_incomplete", "Please complete your profile before paying.");
  }
  const ageConsent = must(
    await db.from("consents").select("id").eq("user_id", user.id).eq("kind", "age18").is("withdrawn_at", null).limit(1),
    "age consent",
  );
  if (!ageConsent?.length) throw new HttpError(403, "age_required", "Please confirm you are 18 or older.");
  if (profile.birth_year && new Date().getUTCFullYear() - profile.birth_year < 18) {
    throw new HttpError(403, "under_18", "This service is for people aged 18 and over.");
  }

  const withMembership = plan !== "report";
  // The included month (report bought on its own) is not a paid membership:
  // joining during it is allowed, and the paid membership's trial runs until
  // the included month ends, so nothing is charged twice.
  let includedUntil: number | null = null;
  if (withMembership) {
    const open = must(
      await db.from("subscriptions").select("id, plan, current_period_end").eq("user_id", user.id).in("status", [
        "trialing",
        "active",
        "past_due",
      ]),
      "subscriptions",
    ) ?? [];
    if (open.some((s) => s.plan !== "included")) {
      throw new HttpError(409, "already_member", "You already have a membership.");
    }
    for (const s of open) {
      const end = s.current_period_end ? Date.parse(s.current_period_end as string) : NaN;
      if (Number.isFinite(end) && end > Date.now()) includedUntil = Math.max(includedUntil ?? 0, end);
    }
  }

  if (profile.locale !== locale) {
    await db.from("profiles").update({ locale }).eq("id", user.id);
  }

  const siteUrl = requireEnv("SITE_URL").replace(/\/$/, "");
  const includesReport = plan.startsWith("report");

  // Order row for anything that includes the report.
  let orderId: string | null = null;
  if (includesReport) {
    const order = mustOne(
      await db
        .from("orders")
        .insert({
          user_id: user.id,
          product: "report",
          plan,
          status: "pending_payment",
          amount: PRICES_KWD.report,
          currency: CURRENCY,
          provider: "stripe",
        })
        .select("id")
        .single(),
      "create order",
    );
    orderId = order.id as string;
  }

  const metadata: Record<string, string> = { user_id: user.id, plan, ...(orderId ? { order_id: orderId } : {}) };
  const interval = plan.endsWith("yearly") ? "yearly" : "monthly";

  // Back to the page in the customer's language (/ar/... for Arabic). A plain
  // membership is bought from the account page, so cancelling returns there.
  const base = `${siteUrl}${locale === "ar" ? "/ar" : ""}`;
  const params: Stripe.Checkout.SessionCreateParams = {
    client_reference_id: orderId ?? user.id,
    metadata,
    locale: locale === "ar" ? "auto" : "en",
    success_url: orderId ? `${base}/orders/${orderId}?checkout=success` : `${base}/account?checkout=success`,
    cancel_url: includesReport ? `${base}/start?checkout=cancelled` : `${base}/account?checkout=cancelled`,
    allow_promotion_codes: true,
  };
  if (profile.stripe_customer_id) params.customer = profile.stripe_customer_id;
  else if (user.email) params.customer_email = user.email;

  if (plan === "report") {
    params.mode = "payment";
    params.line_items = [reportLine(locale)];
    params.payment_intent_data = { metadata };
    if (!profile.stripe_customer_id) params.customer_creation = "always";
  } else {
    params.mode = "subscription";
    params.line_items = includesReport
      ? [reportLine(locale), membershipLine(interval, locale)]
      : [membershipLine(interval, locale)];
    // Nothing is charged before the included month ends (the account page
    // says so). Stripe needs a trial end at least 48 hours ahead, so a shorter
    // remainder is rounded up to 49 hours (a few free hours more).
    const trialEnd = !includesReport && includedUntil && includedUntil > Date.now()
      ? Math.floor(Math.max(includedUntil, Date.now() + MIN_TRIAL_MS) / 1000)
      : null;
    params.subscription_data = {
      metadata: trialEnd ? { ...metadata, included_until: new Date(trialEnd * 1000).toISOString() } : metadata,
      ...(includesReport ? { trial_period_days: TRIAL_DAYS_WITH_REPORT } : {}),
      ...(trialEnd ? { trial_end: trialEnd } : {}),
    };
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe().checkout.sessions.create(
      params,
      orderId ? { idempotencyKey: `checkout-${orderId}` } : undefined,
    );
  } catch (err) {
    if (orderId) await db.from("orders").update({ status: "cancelled" }).eq("id", orderId);
    console.error("stripe checkout create failed", err);
    throw new HttpError(502, "payment_provider", "We could not start the payment. Please try again.");
  }

  if (orderId) {
    must(await db.from("orders").update({ provider_ref: session.id }).eq("id", orderId), "save session id");
  }

  return json(req, { url: session.url, order_id: orderId, session_id: session.id });
});
