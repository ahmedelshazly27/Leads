// POST { plan, locale, country } -> { url, order_id, session_id, currency }
// Creates the order (pending_payment) and a Stripe Checkout Session in the
// currency of the customer's country (prices.json: KW -> KWD, SA -> SAR,
// AE -> AED, QA -> QAR, BH -> BHD, OM -> OMR). The amount always comes from
// the server's price table, never from the client.
//   report                      mode=payment, the report price
//   report_membership_monthly   mode=subscription: report (one-time) + monthly, 30-day trial on the recurring price
//   report_membership_yearly    mode=subscription: report (one-time) + yearly,  30-day trial on the recurring price
//   membership_monthly/_yearly  mode=subscription, no report order (check-ins come from paid invoices);
//                               no trial, except that joining during the included month (report bought
//                               on its own) starts the trial until that month ends
// country: ISO 3166-1 alpha-2. A country we do not sell in (or not a country
// code) gets 400 "country_not_available". A request without the field (a
// page loaded before multi-currency) is treated as Kuwait, the only country
// sold before.
// Prices are VAT-inclusive (tax_behavior "inclusive"). STRIPE_AUTOMATIC_TAX=1
// turns on Stripe Tax and asks for the billing address.
// Return URLs use the customer's language: /ar/orders/:id, /ar/start, /ar/account for Arabic.
import { HttpError, json, readJson, requireEnv, serve } from "../_shared/http.ts";
import { requireUser } from "../_shared/auth.ts";
import { admin, must, mustOne } from "../_shared/supabase.ts";
import {
  automaticTax,
  chargeAmount,
  checkoutLocale,
  type Stripe,
  stripe,
  TRIAL_DAYS_WITH_REPORT,
} from "../_shared/stripe.ts";
import { currencyForCountry, hasCurrency, isSelling, normCountry, priceOf } from "../_shared/prices.ts";
import { membershipPriceId } from "../_shared/membership.ts";

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

const LEGACY_COUNTRY = "KW";
const MIN_TRIAL_MS = 49 * 3600_000;

function reportLine(locale: string, currency: string): Stripe.Checkout.SessionCreateParams.LineItem {
  // STRIPE_PRODUCT_REPORT (optional) groups every report sale under one product in Stripe.
  const product = Deno.env.get("STRIPE_PRODUCT_REPORT");
  return {
    quantity: 1,
    price_data: {
      currency: currency.toLowerCase(),
      unit_amount: chargeAmount(priceOf("report", currency), currency),
      tax_behavior: "inclusive",
      ...(product ? { product } : {
        product_data: {
          name: locale === "ar" ? "تقرير التحليل وخطة 12 شهر" : "Analysis report and 12-month plan",
        },
      }),
    },
  };
}

const isStripeError = (err: unknown, needle: string) =>
  err instanceof Error && err.message.toLowerCase().includes(needle);

serve(async (req) => {
  const { user, profile } = await requireUser(req);
  const body = await readJson<{ plan?: string; locale?: string; country?: string }>(req);
  const plan = body.plan as Plan;
  if (!PLANS.includes(plan)) throw new HttpError(400, "bad_plan", "Unknown plan.");
  const country = body.country == null || body.country === "" ? LEGACY_COUNTRY : normCountry(body.country);
  if (!country || !isSelling(country)) {
    throw new HttpError(
      400,
      "country_not_available",
      "We are not open in your country yet. Join the waitlist and we will let you know.",
    );
  }
  const currency = currencyForCountry(country);
  if (!hasCurrency(currency)) throw new HttpError(500, "price_missing", "Prices are not set for this country.");
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
          amount: priceOf("report", currency),
          currency,
          country,
          provider: "stripe",
        })
        .select("id")
        .single(),
      "create order",
    );
    orderId = order.id as string;
  }

  const metadata: Record<string, string> = {
    user_id: user.id,
    plan,
    country,
    currency,
    ...(orderId ? { order_id: orderId } : {}),
  };
  const interval = plan.endsWith("yearly") ? "yearly" : "monthly";

  // Back to the page in the customer's language (/ar/... for Arabic). A plain
  // membership is bought from the account page, so cancelling returns there.
  const base = `${siteUrl}${locale === "ar" ? "/ar" : ""}`;
  const params: Stripe.Checkout.SessionCreateParams = {
    client_reference_id: orderId ?? user.id,
    metadata,
    // Stripe Checkout has no Arabic: "auto" follows the browser where Stripe can.
    locale: checkoutLocale(locale),
    success_url: orderId ? `${base}/orders/${orderId}?checkout=success` : `${base}/account?checkout=success`,
    cancel_url: includesReport ? `${base}/start?checkout=cancelled` : `${base}/account?checkout=cancelled`,
    allow_promotion_codes: true,
  };
  if (profile.stripe_customer_id) params.customer = profile.stripe_customer_id;
  else if (user.email) params.customer_email = user.email;

  if (automaticTax()) {
    // Stripe Tax works out the VAT inside the (inclusive) price from the
    // billing address, so ask for it and keep it on the customer.
    params.automatic_tax = { enabled: true };
    params.billing_address_collection = "required";
    if (profile.stripe_customer_id) params.customer_update = { address: "auto", name: "auto" };
  }

  if (plan === "report") {
    params.mode = "payment";
    params.line_items = [reportLine(locale, currency)];
    params.payment_intent_data = { metadata };
    if (!profile.stripe_customer_id) params.customer_creation = "always";
  } else {
    params.mode = "subscription";
    // A Stripe price per currency (lookup key membership_<interval>_<cur>), the
    // same price the yearly-then-monthly schedule uses later.
    let membership: Stripe.Checkout.SessionCreateParams.LineItem;
    try {
      membership = { price: await membershipPriceId(interval, currency), quantity: 1 };
    } catch (err) {
      if (orderId) await db.from("orders").update({ status: "cancelled" }).eq("id", orderId);
      console.error("membership price lookup failed", currency, (err as Error).message);
      throw new HttpError(502, "payment_provider", "We could not start the payment. Please try again.");
    }
    params.line_items = includesReport ? [reportLine(locale, currency), membership] : [membership];
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
    // A Stripe customer keeps one currency for subscriptions while one is open.
    if (isStripeError(err, "combine currencies")) {
      throw new HttpError(
        409,
        "currency_mismatch",
        "Your account is already billed in another currency. Please choose the country you used before, or contact us.",
      );
    }
    throw new HttpError(502, "payment_provider", "We could not start the payment. Please try again.");
  }

  if (orderId) {
    must(await db.from("orders").update({ provider_ref: session.id }).eq("id", orderId), "save session id");
  }

  return json(req, { url: session.url, order_id: orderId, session_id: session.id, currency, country });
});
