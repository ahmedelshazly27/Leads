import type { SubscriptionRow } from "./types";

const OPEN_SUB = new Set(["trialing", "active", "past_due"]);

/**
 * The membership that applies now, from all of a customer's subscription rows:
 * an open paid (Stripe) membership first, else the included month while it
 * runs, else the most recent row (ended), or null. Pure; shared by the
 * Supabase client and the demo backend.
 */
export function currentSubscription(rows: SubscriptionRow[], now = Date.now()): SubscriptionRow | null {
  const newest = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const paid = newest.find((s) => s.plan !== "included" && OPEN_SUB.has(s.status));
  if (paid) return paid;
  const included = newest
    .filter((s) => s.plan === "included" && s.status === "active" && !!s.current_period_end && Date.parse(s.current_period_end) > now)
    .sort((a, b) => (b.current_period_end ?? "").localeCompare(a.current_period_end ?? ""))[0];
  return included ?? newest[0] ?? null;
}
