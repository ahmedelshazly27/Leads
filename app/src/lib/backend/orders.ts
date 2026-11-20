import { BackendError, backendMode, callFunction, check, num, sb, useBackendQuery } from "./client";
import { mock } from "./mock";
import { consentsFlushed, requireUserId, useSession } from "./auth";
import { currentSubscription } from "./subscription";
import { SELLING_COUNTRIES, type CheckoutPlan, type CustomerVisual, type Locale, type OrderRow, type PaymentRow, type QueryState, type ReviewRow, type SubscriptionRow } from "./types";

export { currentSubscription };

export const normOrder = (o: OrderRow): OrderRow => ({ ...o, amount: num(o.amount) });
export const normPayment = (p: PaymentRow): PaymentRow => ({ ...p, amount: num(p.amount), fee: num(p.fee), net: num(p.net) });

/** What startCheckout / redirectToCheckout take. */
export interface CheckoutRequest {
  plan: CheckoutPlan;
  /** page language: the return pages and the payment page follow it */
  locale?: Locale;
  /**
   * The customer's country (ISO-2, e.g. "SA"). The server charges that
   * country's currency and price (prices.json) and refuses countries we do
   * not sell in with "country_not_available". Left out: Kuwait (KWD), as
   * before multi-currency.
   */
  country?: string;
}

const normRequest = (a: CheckoutPlan | CheckoutRequest, locale?: Locale): Required<Pick<CheckoutRequest, "plan" | "locale">> & { country?: string } => {
  const r = typeof a === "string" ? { plan: a, locale } : a;
  const country = r.country?.trim().toUpperCase() || undefined;
  return { plan: r.plan, locale: r.locale ?? "en", ...(country ? { country } : {}) };
};

/**
 * Create the order and a hosted checkout session. Returns the URL to send the
 * customer to; `redirectToCheckout` does the redirect for you.
 *
 *   startCheckout({ plan: "report", locale: "ar", country: "SA" })
 *   startCheckout("report", "en")   // older form: Kuwait / KWD
 *
 * Errors (BackendError.code): country_not_available (400), currency_mismatch
 * (409: the Stripe customer already pays another currency), already_member,
 * waitlist, profile_incomplete, age_required, under_18, payment_provider.
 */
export async function startCheckout(req: CheckoutPlan | CheckoutRequest, locale?: Locale): Promise<{ url: string }> {
  const body = normRequest(req, locale);
  if (body.country && !SELLING_COUNTRIES.includes(body.country)) {
    // Same answer as the server, without a round trip.
    throw new BackendError("We are not open in your country yet. Join the waitlist and we will let you know.", "country_not_available", 400);
  }
  // The 18+ consent given before sign-in must be on record before checkout.
  await consentsFlushed();
  if (backendMode === "mock") return mock.startCheckout(body.plan, body.locale, body.country);
  requireUserId();
  const res = await callFunction<{ url?: string }>("create-checkout", body);
  if (!res?.url) throw new BackendError("Checkout could not be started. Please try again.", "checkout_failed");
  return { url: res.url };
}

export async function redirectToCheckout(req: CheckoutPlan | CheckoutRequest, locale?: Locale): Promise<void> {
  const { url } = await startCheckout(req, locale);
  window.location.assign(url);
}

export async function listMyOrders(): Promise<OrderRow[]> {
  if (backendMode === "mock") return mock.listMyOrders();
  const uid = requireUserId();
  const rows = check(await sb().from("orders").select("*").eq("user_id", uid).order("created_at", { ascending: false }));
  return ((rows ?? []) as OrderRow[]).map(normOrder);
}

export async function getOrder(id: string): Promise<OrderRow | null> {
  if (backendMode === "mock") return mock.getOrder(id);
  const row = check(await sb().from("orders").select("*").eq("id", id).maybeSingle());
  return row ? normOrder(row as OrderRow) : null;
}

/** The customer's current membership (see currentSubscription): a paid one, the included month, or the latest ended one. */
export async function getMySubscription(): Promise<SubscriptionRow | null> {
  if (backendMode === "mock") return mock.getMySubscription();
  const uid = requireUserId();
  const rows = check(await sb().from("subscriptions").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(50));
  return currentSubscription((rows ?? []) as SubscriptionRow[]);
}

/** True when the subscription currently gives membership benefits (the included month until it ends). */
export const isActiveMember = (s: SubscriptionRow | null | undefined, now = Date.now()) =>
  !!s &&
  (s.plan === "included"
    ? s.status === "active" && !!s.current_period_end && Date.parse(s.current_period_end) > now
    : s.status === "active" || s.status === "trialing" || (s.status === "past_due" && !!s.current_period_end && Date.parse(s.current_period_end) > now));

/** The reviewer's note and checklist for a delivered order (RLS hides it before delivery). */
export async function getMyReview(orderId: string): Promise<ReviewRow | null> {
  if (backendMode === "mock") return mock.getMyReview(orderId);
  const row = check(await sb().from("reviews").select("*").eq("order_id", orderId).maybeSingle());
  return (row as ReviewRow | null) ?? null;
}

/** Signed URLs for the approved visuals of the customer's delivered orders (optionally one order). */
export async function getMyVisuals(orderId?: string): Promise<CustomerVisual[]> {
  if (backendMode === "mock") return mock.customerVisuals(orderId);
  const res = await callFunction<{ visuals?: CustomerVisual[] } | CustomerVisual[]>("customer-visuals", orderId ? { order_id: orderId } : {});
  const list = Array.isArray(res) ? res : res?.visuals ?? [];
  return orderId ? list.filter((v) => v.order_id === orderId) : list;
}

/* ------------------------------ Hooks ------------------------------ */

export function useMyOrders(): QueryState<OrderRow[]> {
  const { session } = useSession();
  return useBackendQuery(session ? `orders:${session.userId}` : null, listMyOrders);
}

export function useOrder(id: string | null | undefined): QueryState<OrderRow | null> {
  const { session } = useSession();
  return useBackendQuery(session && id ? `order:${id}` : null, () => getOrder(id!));
}

export function useMySubscription(): QueryState<SubscriptionRow | null> {
  const { session } = useSession();
  return useBackendQuery(session ? `sub:${session.userId}` : null, getMySubscription);
}

export function useMyReview(orderId: string | null | undefined): QueryState<ReviewRow | null> {
  const { session } = useSession();
  return useBackendQuery(session && orderId ? `myreview:${orderId}` : null, () => getMyReview(orderId!));
}

export function useMyVisuals(orderId?: string | null): QueryState<CustomerVisual[]> {
  const { session } = useSession();
  return useBackendQuery(session ? `visuals:${session.userId}:${orderId ?? "*"}` : null, () => getMyVisuals(orderId ?? undefined));
}
