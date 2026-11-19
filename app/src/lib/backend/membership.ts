import { BackendError, backendMode, callFunction, invalidate } from "./client";
import { mock } from "./mock";
import { requireUserId } from "./auth";
import type { SubscriptionRow } from "./types";

/**
 * Membership changes by the customer (manage-membership function):
 * - "cancel":  stops at the end of the current period (the 30 days included
 *              with the report, the paid month or the paid year). Benefits
 *              stay until then and nothing more is charged.
 * - "resume":  undoes a cancel while the period is still running.
 * - "end_now": yearly plan only, once the year is paid: ends today and refunds
 *              the full months that are left (price / 12 each), to the card.
 * Errors (BackendError.code): no_membership, ended, not_yearly, trialing, not_stripe,
 * included (only the included month is running: it ends by itself, nothing to change).
 */
export type MembershipAction = "cancel" | "resume" | "end_now";

export interface MembershipRefund {
  /** in `currency` (KWD) */
  amount: number;
  currency: string;
  /** full months refunded */
  months: number;
  /** true when the refund could not be sent automatically; our team sends it */
  pending: boolean;
}

export interface MembershipResult {
  subscription: Pick<SubscriptionRow, "id" | "plan" | "status" | "cancel_at" | "current_period_end"> & { canceled_at?: string | null };
  refund?: MembershipRefund;
}

export async function manageMembership(action: MembershipAction): Promise<MembershipResult> {
  if (backendMode === "mock") return mock.manageMembership(action);
  requireUserId();
  const res = await callFunction<MembershipResult>("manage-membership", { action });
  invalidate();
  if (!res?.subscription) throw new BackendError("The membership could not be updated. Please try again.", "membership_failed");
  return res;
}

export const cancelMembership = () => manageMembership("cancel");
export const resumeMembership = () => manageMembership("resume");
export const endYearlyMembershipNow = () => manageMembership("end_now");

/** Whole calendar months from `from` until `to`. */
export function fullMonthsBetween(from: Date, to: Date): number {
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  const probe = new Date(from);
  probe.setUTCMonth(probe.getUTCMonth() + months);
  if (probe > to) months--;
  return Math.max(0, months);
}

/**
 * What ending a yearly membership today would refund (same rule as the
 * server: full months left x price / 12, in whole 10 fils). Null when "end_now"
 * does not apply (monthly, trialing, ended, or no period end known).
 */
export function yearlyEndNowRefund(sub: SubscriptionRow | null | undefined, yearlyPriceKwd: number, now = Date.now()): { months: number; amountKwd: number } | null {
  if (!sub || sub.plan !== "yearly" || sub.status !== "active" || !sub.current_period_end) return null;
  const months = fullMonthsBetween(new Date(now), new Date(sub.current_period_end));
  const fils = Math.floor((Math.round(yearlyPriceKwd * 1000) * months) / 12 / 10) * 10;
  return { months, amountKwd: fils / 1000 };
}

/** The membership is set to end at `cancel_at` (still active until then). Never true for the included month (it has no renewal to cancel). */
export const isCancelling = (sub: SubscriptionRow | null | undefined) =>
  !!sub && !isIncluded(sub) && (sub.status === "active" || sub.status === "trialing" || sub.status === "past_due") && !!sub.cancel_at;

/* ------------------------- Included membership ------------------------- */

/**
 * The 30 days of membership that come with a report bought on its own (plan
 * "report"): no payment behind it and no renewal. It ends at includedUntil();
 * joining monthly or yearly during it starts the paid membership's trial until
 * that date (create-checkout), so nothing is charged twice.
 */
export const isIncluded = (sub: SubscriptionRow | null | undefined): boolean => !!sub && sub.plan === "included";

/** When the included month ends (ISO), or null when `sub` is not one. */
export const includedUntil = (sub: SubscriptionRow | null | undefined): string | null => (isIncluded(sub) ? sub!.current_period_end ?? null : null);
