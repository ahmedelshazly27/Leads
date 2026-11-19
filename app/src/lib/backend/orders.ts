import { BackendError, backendMode, callFunction, check, num, sb, useBackendQuery } from "./client";
import { mock } from "./mock";
import { requireUserId, useSession } from "./auth";
import type { CheckoutPlan, CustomerVisual, Locale, OrderRow, PaymentRow, QueryState, ReviewRow, SubscriptionRow } from "./types";

export const normOrder = (o: OrderRow): OrderRow => ({ ...o, amount: num(o.amount) });
export const normPayment = (p: PaymentRow): PaymentRow => ({ ...p, amount: num(p.amount), fee: num(p.fee), net: num(p.net) });

/**
 * Create the order and a hosted checkout session. Returns the URL to send the
 * customer to; `redirectToCheckout` does the redirect for you.
 */
export async function startCheckout(plan: CheckoutPlan, locale: Locale = "en"): Promise<{ url: string }> {
  if (backendMode === "mock") return mock.startCheckout(plan, locale);
  requireUserId();
  const res = await callFunction<{ url?: string }>("create-checkout", { plan, locale });
  if (!res?.url) throw new BackendError("Checkout could not be started. Please try again.", "checkout_failed");
  return { url: res.url };
}

export async function redirectToCheckout(plan: CheckoutPlan, locale: Locale = "en"): Promise<void> {
  const { url } = await startCheckout(plan, locale);
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

/** The customer's latest subscription (any status), or null. */
export async function getMySubscription(): Promise<SubscriptionRow | null> {
  if (backendMode === "mock") return mock.getMySubscription();
  const uid = requireUserId();
  const row = check(await sb().from("subscriptions").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(1).maybeSingle());
  return (row as SubscriptionRow | null) ?? null;
}

/** True when the subscription currently gives membership benefits. */
export const isActiveMember = (s: SubscriptionRow | null | undefined) =>
  !!s && (s.status === "active" || s.status === "trialing" || (s.status === "past_due" && !!s.current_period_end && Date.parse(s.current_period_end) > Date.now()));

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
