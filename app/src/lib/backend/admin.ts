import { useMemo } from "react";
import { BackendError, backendMode, check, invalidate, num, sb, useBackendQuery } from "./client";
import { mock } from "./mock";
import { normOrder, normPayment } from "./orders";
import {
  ADMIN_AUDIT_ACTIONS,
  OPEN_REVIEW_STATUSES,
  monthlyEquivalent,
  monthlyEquivalentKwd,
  type AdminAuditEvent,
  type AdSpendRow,
  type AdminDashboard,
  type AdminRows,
  type CampaignSpend,
  SLA_HOURS,
  type CostRow,
  type CustomerEconomics,
  type DailyPoint,
  type KpiRange,
  type Kpis,
  type OrderEconomics,
  type OrderRow,
  type OrderStatus,
  type QueryState,
  type SubscriptionRow,
  type SubscriptionStatus,
  type WaitlistRow,
  type WaitlistSummary,
} from "./types";

/* ------------------------------- FX -------------------------------- */

/**
 * Rates used to show USD / EUR costs and ad spend in KWD. These are
 * approximate defaults, not live rates: set VITE_FX_USD_KWD / VITE_FX_EUR_KWD
 * (KWD per 1 unit) to the rate your accountant uses.
 */
const envRate = (k: string, fallback: number) => {
  const v = Number(import.meta.env[k]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};
const USD_KWD = envRate("VITE_FX_USD_KWD", 0.307);
// The GCC currencies pegged to the US dollar (units per 1 USD), so an older
// caller never counts SAR 249 as KWD 249.
const GCC_PER_USD: Record<string, number> = { SAR: 3.75, AED: 3.6725, QAR: 3.64, BHD: 0.376, OMR: 0.3845 };
export const FX_TO_KWD: Record<string, number> = {
  KWD: 1,
  USD: USD_KWD,
  EUR: envRate("VITE_FX_EUR_KWD", 0.335),
  ...Object.fromEntries(Object.entries(GCC_PER_USD).map(([c, perUsd]) => [c, USD_KWD / perUsd])),
};
/**
 * Older KWD-only dashboard helper (the operator page uses fx_rates through
 * fxConverter). A currency with no rate here counts as 0, not as KWD.
 */
export const toKwd = (amount: number, currency: string | null | undefined) => amount * (FX_TO_KWD[(currency ?? "KWD").toUpperCase()] ?? 0);

/* ----------------------------- Ranges ------------------------------ */

const DAY = 86_400_000;

/** Start of the range: today = since local midnight; 7d / 30d = rolling windows ending now. */
export function rangeStart(range: KpiRange, now = Date.now()): number {
  if (range === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  return now - (range === "7d" ? 7 : 30) * DAY;
}

/* ------------------------------ Fetch ------------------------------ */

const OPEN = OPEN_REVIEW_STATUSES as string[];

type PageResult<T> = { data: T[] | null; error: { message: string; code?: string } | null };

/**
 * Read every row of a query, page by page. PostgREST caps each response at
 * `max_rows` and truncates silently, so a single select would undercount once
 * a table grows past that. Keeps going until an empty page, so it is correct
 * whatever `max_rows` is set to. `page` must apply a stable order.
 */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<PageResult<T>>, size = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; ) {
    const rows = check(await page(from, from + size - 1)) ?? [];
    if (!rows.length) return out;
    out.push(...rows);
    from += rows.length;
  }
}

/** Raw rows for the dashboard since `sinceIso` (plus open orders and all subscriptions). Admin only (RLS). */
export async function fetchAdminRows(sinceIso: string): Promise<AdminRows> {
  if (backendMode === "mock") return mock.adminRows(sinceIso);
  const c = sb();
  const [ordersRecent, ordersOpen, payments, subscriptions, generations, costs, adSpend, profiles, waitlist, audit] = await Promise.all([
    fetchAll<OrderRow>((a, b) => c.from("orders").select("*").or(`created_at.gte."${sinceIso}",delivered_at.gte."${sinceIso}",due_at.gte."${sinceIso}"`).order("id").range(a, b)),
    fetchAll<OrderRow>((a, b) => c.from("orders").select("*").in("status", OPEN).order("id").range(a, b)),
    fetchAll<AdminRows["payments"][number]>((a, b) => c.from("payments").select("*").gte("created_at", sinceIso).order("id").range(a, b)),
    fetchAll<AdminRows["subscriptions"][number]>((a, b) => c.from("subscriptions").select("*").order("id").range(a, b)),
    fetchAll<AdminRows["generations"][number]>((a, b) => c.from("generations").select("id,order_id,cost_usd,status,created_at,parent_id,kind").gte("created_at", sinceIso).order("id").range(a, b)),
    fetchAll<CostRow>((a, b) => c.from("costs").select("*").gte("created_at", sinceIso).order("id").range(a, b)),
    fetchAll<AdSpendRow>((a, b) => c.from("ad_spend").select("*").gte("date", sinceIso.slice(0, 10)).order("id").range(a, b)),
    fetchAll<AdminRows["profiles"][number]>((a, b) => c.from("profiles").select("id,email,role,created_at").order("id").range(a, b)),
    fetchAll<AdminRows["waitlist"][number]>((a, b) => c.from("waitlist").select("id,email,gender,locale,source,country,created_at").order("id").range(a, b)),
    c
      .from("audit_log")
      .select("id,action,target_type,target_id,meta,at")
      .in("action", ADMIN_AUDIT_ACTIONS as unknown as string[])
      .order("at", { ascending: false })
      .limit(AUDIT_EVENT_LIMIT)
      .then(check),
  ]);
  const byId = new Map<string, OrderRow>();
  for (const o of [...((ordersRecent ?? []) as OrderRow[]), ...((ordersOpen ?? []) as OrderRow[])]) byId.set(o.id, normOrder(o));
  return {
    orders: [...byId.values()],
    payments: ((payments ?? []) as AdminRows["payments"]).map(normPayment),
    subscriptions: (subscriptions ?? []) as AdminRows["subscriptions"],
    generations: ((generations ?? []) as AdminRows["generations"]).map((g) => ({ ...g, cost_usd: num(g.cost_usd) })),
    costs: ((costs ?? []) as CostRow[]).map((x) => ({ ...x, amount: num(x.amount) })),
    adSpend: ((adSpend ?? []) as AdSpendRow[]).map((a) => ({ ...a, spend: num(a.spend), impressions: num(a.impressions), clicks: num(a.clicks), purchases: num(a.purchases) })),
    profiles: (profiles ?? []) as AdminRows["profiles"],
    waitlist: (waitlist ?? []) as AdminRows["waitlist"],
    auditEvents: ((audit ?? []) as AuditRowLite[]).map(toAuditEvent),
  };
}

const AUDIT_EVENT_LIMIT = 200;

interface AuditRowLite {
  id: number | string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  meta: unknown;
  at: string;
}

/** audit_log row -> AdminAuditEvent (the order id when the row is about an order; other targets go into details). */
export function toAuditEvent(r: AuditRowLite): AdminAuditEvent {
  const meta = r.meta && typeof r.meta === "object" && !Array.isArray(r.meta) ? (r.meta as Record<string, unknown>) : {};
  const isOrder = r.target_type === "orders" || r.target_type === "order";
  return {
    id: String(r.id),
    action: r.action as AdminAuditEvent["action"],
    created_at: r.at,
    order_id: isOrder ? r.target_id : null,
    details: isOrder || !r.target_id ? meta : { ...meta, [`${r.target_type ?? "target"}_id`]: r.target_id },
  };
}

/* ----------------------------- Compute ----------------------------- */

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const round = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d;
const inRange = (t: string | null | undefined, from: number, to: number) => {
  if (!t) return false;
  const x = Date.parse(t);
  return x >= from && x <= to;
};
/**
 * Revenue effect of a payment row. The payment webhook records a refund as its
 * own row with status "refunded" and a negative amount, and leaves the original
 * payment "succeeded". Taking -|amount| also copes with a positive refund amount.
 */
const revenueOf = (p: { status: string; amount: number }) =>
  p.status === "succeeded" ? p.amount : p.status === "refunded" ? -Math.abs(p.amount) : 0;
const countsForRevenue = (p: { status: string }) => p.status === "succeeded" || p.status === "refunded";

/** Costs already counted elsewhere (payments.fee, generations.cost_usd). */
const COUNTED_ELSEWHERE = new Set(["payment_fee", "image_generation"]);

export function computeOrderEconomics(rows: AdminRows): OrderEconomics[] {
  const email = new Map(rows.profiles.map((p) => [p.id, p.email]));
  return rows.orders
    .filter((o) => o.status !== "pending_payment" && o.status !== "cancelled")
    .map((o) => {
      const pays = rows.payments.filter((p) => p.order_id === o.id && countsForRevenue(p));
      const revenueKwd = sum(pays.map((p) => toKwd(revenueOf(p), p.currency)));
      const paymentFeeKwd = sum(pays.map((p) => toKwd(p.fee, p.currency)));
      const gens = rows.generations.filter((g) => g.order_id === o.id);
      const imageCostUsd = sum(gens.map((g) => g.cost_usd));
      const imageCostKwd = toKwd(imageCostUsd, "USD");
      const otherCostKwd = sum(rows.costs.filter((c) => c.order_id === o.id && !COUNTED_ELSEWHERE.has(c.category)).map((c) => toKwd(c.amount, c.currency)));
      return {
        order_id: o.id,
        user_id: o.user_id,
        email: o.user_id ? email.get(o.user_id) ?? null : null,
        product: o.product,
        status: o.status,
        created_at: o.created_at,
        paid_at: o.paid_at,
        delivered_at: o.delivered_at,
        due_at: o.due_at,
        revenueKwd: round(revenueKwd),
        paymentFeeKwd: round(paymentFeeKwd),
        imageCostUsd: round(imageCostUsd, 4),
        imageCostKwd: round(imageCostKwd),
        generations: gens.length,
        otherCostKwd: round(otherCostKwd),
        marginKwd: round(revenueKwd - paymentFeeKwd - imageCostKwd - otherCostKwd),
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function computeCustomerEconomics(rows: AdminRows, orders: OrderEconomics[]): CustomerEconomics[] {
  const email = new Map(rows.profiles.map((p) => [p.id, p.email]));
  const subStatus = new Map<string, SubscriptionStatus>();
  for (const s of [...rows.subscriptions].sort((a, b) => a.created_at.localeCompare(b.created_at))) if (s.user_id) subStatus.set(s.user_id, s.status);
  const by = new Map<string, CustomerEconomics>();
  const get = (uid: string) => {
    let c = by.get(uid);
    if (!c) {
      c = { user_id: uid, email: email.get(uid) ?? null, orders: 0, revenueKwd: 0, paymentFeeKwd: 0, imageCostKwd: 0, generations: 0, otherCostKwd: 0, marginKwd: 0, member: subStatus.get(uid) ?? null };
      by.set(uid, c);
    }
    return c;
  };
  // Orders and payments of deleted accounts (user_id null) have no customer to show.
  for (const o of orders) {
    if (!o.user_id) continue;
    const c = get(o.user_id);
    c.orders++;
    c.revenueKwd += o.revenueKwd;
    c.paymentFeeKwd += o.paymentFeeKwd;
    c.imageCostKwd += o.imageCostKwd;
    c.generations += o.generations;
    c.otherCostKwd += o.otherCostKwd;
  }
  // Membership payments (and their refunds) are not tied to an order.
  for (const p of rows.payments.filter((x) => !x.order_id && countsForRevenue(x))) {
    if (!p.user_id) continue;
    const c = get(p.user_id);
    c.revenueKwd += toKwd(revenueOf(p), p.currency);
    c.paymentFeeKwd += toKwd(p.fee, p.currency);
  }
  for (const c of by.values()) {
    c.revenueKwd = round(c.revenueKwd);
    c.paymentFeeKwd = round(c.paymentFeeKwd);
    c.imageCostKwd = round(c.imageCostKwd);
    c.otherCostKwd = round(c.otherCostKwd);
    c.marginKwd = round(c.revenueKwd - c.paymentFeeKwd - c.imageCostKwd - c.otherCostKwd);
  }
  return [...by.values()].sort((a, b) => b.revenueKwd - a.revenueKwd);
}

function computeCampaigns(ad: AdSpendRow[], avgReportKwd: number | null): CampaignSpend[] {
  const by = new Map<string, CampaignSpend>();
  for (const a of ad) {
    const k = `${a.platform}:${a.campaign_id}`;
    let c = by.get(k);
    if (!c) {
      c = { platform: a.platform, campaign_id: a.campaign_id, campaign_name: a.campaign_name, spendKwd: 0, impressions: 0, clicks: 0, purchases: 0, ctr: null, cpaKwd: null, estRoas: null };
      by.set(k, c);
    }
    c.spendKwd += toKwd(a.spend, a.currency);
    c.impressions += a.impressions;
    c.clicks += a.clicks;
    c.purchases += a.purchases;
    if (a.campaign_name) c.campaign_name = a.campaign_name;
  }
  return [...by.values()]
    .map((c) => ({
      ...c,
      spendKwd: round(c.spendKwd),
      ctr: c.impressions ? round(c.clicks / c.impressions, 4) : null,
      cpaKwd: c.purchases ? round(c.spendKwd / c.purchases) : null,
      estRoas: c.spendKwd && avgReportKwd != null ? round((c.purchases * avgReportKwd) / c.spendKwd, 2) : null,
    }))
    .sort((a, b) => b.spendKwd - a.spendKwd);
}

function computeDaily(rows: AdminRows, from: number, to: number, orders: OrderEconomics[]): DailyPoint[] {
  const day = (t: string) => t.slice(0, 10);
  const map = new Map<string, DailyPoint>();
  for (let t = from; t <= to; t += DAY) {
    const d = new Date(t).toISOString().slice(0, 10);
    map.set(d, { date: d, revenueKwd: 0, orders: 0, adSpendKwd: 0, imageCostKwd: 0, paymentFeesKwd: 0 });
  }
  const at = (d: string) => map.get(d);
  for (const p of rows.payments) {
    if (!countsForRevenue(p) || !inRange(p.created_at, from, to)) continue;
    const x = at(day(p.created_at));
    if (x) {
      x.revenueKwd += toKwd(revenueOf(p), p.currency);
      x.paymentFeesKwd += toKwd(p.fee, p.currency);
    }
  }
  for (const o of orders) if (inRange(o.created_at, from, to)) at(day(o.created_at)) && at(day(o.created_at))!.orders++;
  for (const g of rows.generations) if (inRange(g.created_at, from, to)) {
    const x = at(day(g.created_at));
    if (x) x.imageCostKwd += toKwd(g.cost_usd, "USD");
  }
  for (const a of rows.adSpend) {
    const x = at(a.date);
    if (x) x.adSpendKwd += toKwd(a.spend, a.currency);
  }
  return [...map.values()].map((x) => ({ ...x, revenueKwd: round(x.revenueKwd), adSpendKwd: round(x.adSpendKwd), imageCostKwd: round(x.imageCostKwd), paymentFeesKwd: round(x.paymentFeesKwd) }));
}

function computeWaitlist(rows: AdminRows, now: number): WaitlistSummary {
  const byGender: WaitlistSummary["byGender"] = {};
  for (const w of rows.waitlist) {
    const g = w.gender ?? "unknown";
    byGender[g] = (byGender[g] ?? 0) + 1;
  }
  return { total: rows.waitlist.length, byGender, last7d: rows.waitlist.filter((w) => Date.parse(w.created_at) >= now - 7 * DAY).length };
}

export function computeKpis(rows: AdminRows, range: KpiRange, orders: OrderEconomics[], now = Date.now()): Kpis {
  const from = rangeStart(range, now);
  const pays = rows.payments.filter((p) => inRange(p.created_at, from, now));
  const succeeded = pays.filter((p) => p.status === "succeeded");
  const grossRevenueKwd = sum(succeeded.map((p) => toKwd(p.amount, p.currency)));
  const refundedKwd = sum(pays.filter((p) => p.status === "refunded").map((p) => toKwd(Math.abs(p.amount), p.currency)));
  const revenueKwd = grossRevenueKwd - refundedKwd;
  const paymentFeesKwd = sum(succeeded.map((p) => toKwd(p.fee, p.currency)));
  const imageCostUsd = sum(rows.generations.filter((g) => inRange(g.created_at, from, now)).map((g) => g.cost_usd));
  const imageCostKwd = toKwd(imageCostUsd, "USD");
  const otherCostKwd = sum(rows.costs.filter((c) => inRange(c.created_at, from, now) && !COUNTED_ELSEWHERE.has(c.category)).map((c) => toKwd(c.amount, c.currency)));

  const ordersInRange = orders.filter((o) => inRange(o.created_at, from, now));
  const reportsPaid = rows.orders.filter((o) => o.product === "report" && inRange(o.paid_at, from, now));
  const newPayingCustomers = new Set(reportsPaid.map((o) => o.user_id ?? `deleted:${o.id}`)).size;
  const newCustomers = rows.profiles.filter((p) => p.role === "customer" && inRange(p.created_at, from, now)).length;

  // The included month is not a paid membership.
  const paidSubs = rows.subscriptions.filter((s) => s.plan !== "included");
  const active = paidSubs.filter((s) => s.status === "active");
  const trialing = paidSubs.filter((s) => s.status === "trialing");
  const mrrKwd = sum(active.map((s) => monthlyEquivalentKwd(s.plan)));

  const delivered = rows.orders.filter((o) => o.submitted_at && inRange(o.delivered_at, from, now));
  const avgTurnaroundHours = delivered.length
    ? sum(delivered.map((o) => (Date.parse(o.delivered_at!) - Date.parse(o.submitted_at!)) / 3600_000)) / delivered.length
    : null;
  const slaBreaches = rows.orders.filter((o) => {
    if (!o.due_at || !inRange(o.due_at, from, now)) return false;
    if (o.delivered_at) return Date.parse(o.delivered_at) > Date.parse(o.due_at);
    return OPEN.includes(o.status);
  }).length;
  const openOrders = rows.orders.filter((o) => OPEN.includes(o.status));
  const overdueNow = openOrders.filter((o) => o.due_at && Date.parse(o.due_at) < now).length;

  const fromDate = new Date(from).toISOString().slice(0, 10);
  const adSpendKwd = sum(rows.adSpend.filter((a) => a.date >= fromDate).map((a) => toKwd(a.spend, a.currency)));

  return {
    range,
    from: new Date(from).toISOString(),
    revenueKwd: round(revenueKwd),
    grossRevenueKwd: round(grossRevenueKwd),
    refundedKwd: round(refundedKwd),
    paymentFeesKwd: round(paymentFeesKwd),
    imageCostUsd: round(imageCostUsd, 4),
    imageCostKwd: round(imageCostKwd),
    orders: ordersInRange.length,
    reportsSold: reportsPaid.length,
    newCustomers,
    newPayingCustomers,
    mrrKwd: round(mrrKwd),
    activeMembers: active.length,
    trialingMembers: trialing.length,
    avgTurnaroundHours: avgTurnaroundHours == null ? null : round(avgTurnaroundHours, 1),
    slaBreaches,
    overdueNow,
    openReviewOrders: openOrders.length,
    adSpendKwd: round(adSpendKwd),
    cacKwd: newPayingCustomers && adSpendKwd ? round(adSpendKwd / newPayingCustomers) : null,
    roas: adSpendKwd ? round(revenueKwd / adSpendKwd, 2) : null,
    grossMarginKwd: round(revenueKwd - paymentFeesKwd - imageCostKwd - otherCostKwd),
  };
}

/** Pure: build the whole dashboard from raw rows (shared by the Supabase and mock backends). */
export function computeDashboard(rows: AdminRows, range: KpiRange, now = Date.now()): AdminDashboard {
  const from = rangeStart(range, now);
  const allOrders = computeOrderEconomics(rows);
  const kpis = computeKpis(rows, range, allOrders, now);
  const orders = allOrders.filter((o) => inRange(o.created_at, from, now) || OPEN.includes(o.status));
  const reportRevenue = rows.payments.filter((p) => p.status === "succeeded" && p.order_id && inRange(p.created_at, from, now));
  const avgReportKwd = reportRevenue.length ? sum(reportRevenue.map((p) => toKwd(p.amount, p.currency))) / reportRevenue.length : null;
  const fromDate = new Date(from).toISOString().slice(0, 10);
  return {
    generatedAt: new Date(now).toISOString(),
    kpis,
    orders,
    customers: computeCustomerEconomics(
      { ...rows, payments: rows.payments.filter((p) => inRange(p.created_at, from, now)) },
      allOrders.filter((o) => inRange(o.created_at, from, now)),
    ),
    campaigns: computeCampaigns(rows.adSpend.filter((a) => a.date >= fromDate), avgReportKwd),
    daily: computeDaily(rows, range === "today" ? from : now - 29 * DAY, now, allOrders),
    waitlist: computeWaitlist(rows, now),
    fx: { ...FX_TO_KWD },
  };
}

/** Fetch and compute the dashboard for a range. Admin only. */
export async function loadAdminDashboard(range: KpiRange): Promise<AdminDashboard> {
  const now = Date.now();
  // Always fetch 30 days so the daily chart is complete whatever the range.
  const since = new Date(Math.min(rangeStart("30d", now), rangeStart(range, now))).toISOString();
  return computeDashboard(await fetchAdminRows(since), range, now);
}

export function useAdminDashboard(range: KpiRange): QueryState<AdminDashboard> {
  return useBackendQuery(backendMode === "off" ? null : `admin:${range}`, () => loadAdminDashboard(range));
}

const CSV_COLS = ["order_id", "email", "product", "status", "created_at", "paid_at", "delivered_at", "revenueKwd", "paymentFeeKwd", "imageCostUsd", "imageCostKwd", "otherCostKwd", "marginKwd"] as const;
/** Any per-order row with the CSV columns (OrderEconomics, or the operator dashboard's rows, whose KWD values may be null). */
export type OrderCsvRow = { [K in (typeof CSV_COLS)[number]]: unknown };

/** Orders as CSV for the accountant (from the dashboard's per-order economics). */
export function ordersToCsv(orders: OrderCsvRow[]): string {
  const cols = CSV_COLS;
  return toCsv(cols, orders as Record<string, unknown>[]);
}

/**
 * CSV with one header row. Text cells that a spreadsheet would read as a
 * formula (=, +, -, @ at the start, but not plain numbers) get a leading quote.
 */
export function toCsv(cols: readonly string[], rows: Record<string, unknown>[]): string {
  const esc = (v: unknown) => {
    let s = v == null ? "" : String(v);
    if (typeof v === "string" && /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((o) => cols.map((c) => esc(o[c])).join(","))].join("\n");
}

/* =================================================================== */
/*  Operator dashboard (/admin)                                         */
/*                                                                      */
/*  Same raw rows as above. Every amount is converted to the dashboard  */
/*  currency (EUR by default, the B.V.'s books; KWD or USD on request)  */
/*  with the fx_rates table. Fields ending in "Rep" are in that         */
/*  currency (OperatorDashboard.currency). When a rate is missing the   */
/*  converted value is null and the currency is listed in `fxMissing`,  */
/*  never silently counted as zero.                                     */
/* =================================================================== */

export type AdminRange = "7d" | "30d" | "90d" | "all";
export const ADMIN_RANGES: { value: AdminRange; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];
const RANGE_DAYS: Record<AdminRange, number | null> = { "7d": 7, "30d": 30, "90d": 90, all: null };

/** Start of a dashboard range in ms (0 for all time): rolling windows ending now. */
export function adminRangeStart(range: AdminRange, now = Date.now()): number {
  const d = RANGE_DAYS[range];
  return d == null ? 0 : now - d * DAY;
}

/** Calendar day in Kuwait (UTC+3, no daylight saving), YYYY-MM-DD. */
const KW_OFFSET = 3 * 3600_000;
export const kuwaitDay = (ms: number) => new Date(ms + KW_OFFSET).toISOString().slice(0, 10);

/* ----------------------------- FX rates ---------------------------- */

/**
 * One row of fx_rates (migration 010). Rates are in EUR, the reporting
 * currency the B.V. books in: eur_per_unit = EUR value of one unit.
 *   base    EUR itself (1)
 *   peg     fixed to the US dollar (per_usd units per 1 USD: SAR, AED, QAR,
 *           BHD, OMR); its EUR value follows the USD rate (the database
 *           recomputes it)
 *   manual  set by an admin (USD, KWD, and any other currency, e.g. an ad
 *           account's); max_age_days says how often (KWD: daily)
 */
export interface FxRate {
  currency: string;
  /** EUR per one unit; null = rate missing */
  eur_per_unit: number | null;
  basis: "base" | "peg" | "manual";
  /** pegged currencies: units per 1 USD */
  per_usd: number | null;
  /** manual rates: warn when older than this */
  max_age_days: number | null;
  note: string | null;
  updated_at: string | null;
}
/** Any ISO 4217 code: every currency in fx_rates can be edited (pegs through per_usd). */
export type FxCurrency = string;
/** The rates an admin has to keep up to date (the pegs follow USD). */
export const FX_EDITABLE: FxCurrency[] = ["USD", "KWD"];

/** Currencies the operator dashboard can show amounts in (converted with fx_rates). EUR is the books' currency. */
export const REPORT_CURRENCIES = ["EUR", "KWD", "USD"] as const;
export type ReportCurrency = (typeof REPORT_CURRENCIES)[number];
export const DEFAULT_REPORT_CURRENCY: ReportCurrency = "EUR";

/** The official pegs to the US dollar (units per 1 USD), as seeded by migration 010. */
export const USD_PEGS: Record<string, number> = { SAR: 3.75, AED: 3.6725, QAR: 3.64, BHD: 0.376, OMR: 0.3845 };

/** Same rules as refresh_fx_rates(): EUR = 1, pegs from the USD rate. */
export function deriveFxRates(rows: FxRate[]): FxRate[] {
  const usd = rows.find((r) => r.currency === "USD")?.eur_per_unit ?? null;
  return rows.map((r) =>
    r.basis === "base"
      ? { ...r, eur_per_unit: 1 }
      : r.basis === "peg" && r.per_usd
        ? { ...r, eur_per_unit: usd == null ? null : round(usd / r.per_usd, 10) }
        : r,
  );
}

/** A manual rate older than its max_age_days (KWD: 1 day, USD: 7). */
export function fxStale(r: FxRate, now = Date.now()): boolean {
  if (r.basis !== "manual" || !r.max_age_days || r.eur_per_unit == null) return false;
  return !r.updated_at || now - Date.parse(r.updated_at) > r.max_age_days * DAY;
}

/**
 * Converter to `to` with the given rates. Returns null for a missing rate (and
 * records the currency in `missing`), never zero.
 */
export function fxConverter(rates: FxRate[], to: string) {
  const eur = new Map<string, number>();
  for (const r of rates) if (r.eur_per_unit != null && r.eur_per_unit > 0) eur.set(r.currency.toUpperCase(), r.eur_per_unit);
  eur.set("EUR", 1);
  const missing = new Set<string>();
  const target = to.toUpperCase();
  const conv = (amount: number, currency: string | null | undefined): number | null => {
    if (!amount) return 0;
    const c = (currency ?? "KWD").toUpperCase();
    if (c === target) return amount;
    const a = eur.get(c);
    const b = eur.get(target);
    if (a == null || b == null) {
      if (a == null) missing.add(c);
      if (b == null) missing.add(target);
      return null;
    }
    return (amount * a) / b;
  };
  return { conv, missing };
}

// Demo mode keeps the rates here (the mock backend has no fx_rates table).
const MOCK_FX_KEY = "admin-demo-fx-rates-v2";
let mockFx: FxRate[] | null = null;
function demoFx(): FxRate[] {
  if (mockFx) return mockFx;
  try {
    const raw = sessionStorage.getItem(MOCK_FX_KEY);
    if (raw) mockFx = JSON.parse(raw) as FxRate[];
  } catch {
    /* storage blocked */
  }
  // Demo values only, roughly in line with recent rates; the operator sets the real ones.
  const manual = (currency: string, eur: number, max: number, note: string): FxRate => ({ currency, eur_per_unit: eur, basis: "manual", per_usd: null, max_age_days: max, note, updated_at: new Date().toISOString() });
  mockFx ??= deriveFxRates([
    { currency: "EUR", eur_per_unit: 1, basis: "base", per_usd: null, max_age_days: null, note: "Reporting currency.", updated_at: null },
    manual("USD", 0.92, 7, "EUR value of 1 USD (demo value)."),
    manual("KWD", 2.98, 1, "Pegged to an undisclosed basket: update daily (demo value)."),
    ...Object.entries(USD_PEGS).map<FxRate>(([currency, per_usd]) => ({ currency, eur_per_unit: null, basis: "peg", per_usd, max_age_days: null, note: `Fixed at ${per_usd} per USD.`, updated_at: null })),
  ]);
  return mockFx;
}
function saveDemoFx(rows: FxRate[]) {
  mockFx = deriveFxRates(rows).sort((a, b) => a.currency.localeCompare(b.currency));
  try {
    sessionStorage.setItem(MOCK_FX_KEY, JSON.stringify(mockFx));
  } catch {
    /* storage blocked: kept in memory */
  }
  invalidate();
}

const FX_COLS = "currency,eur_per_unit,basis,per_usd,max_age_days,note,updated_at";
const normFx = (r: FxRate): FxRate => ({
  ...r,
  eur_per_unit: r.eur_per_unit == null ? null : num(r.eur_per_unit),
  per_usd: r.per_usd == null ? null : num(r.per_usd),
  max_age_days: r.max_age_days == null ? null : num(r.max_age_days),
  basis: r.basis ?? "manual",
  note: r.note ?? null,
});

/** All rows of fx_rates (EUR is always 1). Admin only (RLS). */
export async function listFxRates(): Promise<FxRate[]> {
  if (backendMode === "mock") return demoFx();
  const rows = check(await sb().from("fx_rates").select(FX_COLS).order("currency"));
  return ((rows ?? []) as FxRate[]).map(normFx);
}

const ISO_CURRENCY = /^[A-Z]{3}$/;

/**
 * Set a manual rate: `unitsPerEur` is how much 1 EUR buys, as rates are
 * usually quoted (ECB: 1 EUR = 1.08 USD; 1 EUR = 0.335 KWD). Stored as
 * eur_per_unit = 1 / unitsPerEur. A currency not in the table yet is added
 * as a manual rate (e.g. an ad account's currency). Admin only.
 */
export async function saveFxRate(currency: FxCurrency, unitsPerEur: number): Promise<FxRate> {
  const cur = currency.trim().toUpperCase();
  if (!ISO_CURRENCY.test(cur)) throw new BackendError("Enter a three-letter currency code, e.g. GBP.", "invalid_currency");
  if (cur === "EUR") throw new BackendError("EUR is the reporting currency: its rate is always 1.", "invalid_currency");
  if (!Number.isFinite(unitsPerEur) || unitsPerEur <= 0 || unitsPerEur > 1_000_000) throw new BackendError(`Enter how many ${cur} 1 EUR buys (a number above 0).`, "invalid_rate");
  const existing = (await listFxRates()).find((r) => r.currency === cur);
  if (existing?.basis === "peg") throw new BackendError(`${cur} is pegged to the US dollar: change the USD rate, or its peg.`, "pegged_currency");
  const eur = round(1 / unitsPerEur, 10);
  const now = new Date().toISOString();
  if (backendMode === "mock") {
    const row: FxRate = existing ? { ...existing, eur_per_unit: eur, updated_at: now } : { currency: cur, eur_per_unit: eur, basis: "manual", per_usd: null, max_age_days: 7, note: null, updated_at: now };
    saveDemoFx([...demoFx().filter((r) => r.currency !== cur), row]);
    return demoFx().find((r) => r.currency === cur)!;
  }
  const saved = check(await sb().from("fx_rates").upsert({ currency: cur, eur_per_unit: eur, updated_at: now }, { onConflict: "currency" }).select(FX_COLS).single()) as FxRate;
  invalidate();
  return normFx(saved);
}

/** Change the peg of a pegged currency (units per 1 USD). Pegs rarely move; check the central bank first. Admin only. */
export async function saveFxPeg(currency: FxCurrency, perUsd: number): Promise<FxRate> {
  const cur = currency.trim().toUpperCase();
  const existing = (await listFxRates()).find((r) => r.currency === cur);
  if (existing?.basis !== "peg") throw new BackendError(`${cur} is not a pegged currency.`, "not_pegged");
  if (!Number.isFinite(perUsd) || perUsd <= 0 || perUsd > 1_000_000) throw new BackendError(`Enter how many ${cur} 1 USD buys (a number above 0).`, "invalid_rate");
  const now = new Date().toISOString();
  if (backendMode === "mock") {
    saveDemoFx([...demoFx().filter((r) => r.currency !== cur), { ...existing, per_usd: round(perUsd, 6), updated_at: now }]);
    return demoFx().find((r) => r.currency === cur)!;
  }
  const saved = check(await sb().from("fx_rates").update({ per_usd: round(perUsd, 6), updated_at: now }).eq("currency", cur).select(FX_COLS).single()) as FxRate;
  invalidate();
  return normFx(saved);
}

/* ------------------------------- MRR ------------------------------- */

/** Paying memberships per plan and currency, amounts in that currency (the included month is left out). */
export interface MrrRow {
  plan: string;
  currency: string;
  active: number;
  trialing: number;
  /** monthly equivalent of active memberships, in `currency`; null when an amount is missing */
  mrr: number | null;
  /** what trialing members will add once they pay */
  trialingMrr: number | null;
}

export interface MrrSummary {
  active: number;
  trialing: number;
  pastDue: number;
  cancelling: number;
  rows: MrrRow[];
  /** true when v_mrr reports a missing amount */
  dataMissing: boolean;
  source: "v_mrr" | "computed";
}

/** MrrSummary converted to the dashboard currency. */
export interface OperatorMrr extends MrrSummary {
  /** active subscriptions, monthly equivalent; null when an amount or rate is missing */
  mrrRep: number | null;
  trialingMrrRep: number | null;
  byPlan: { plan: string; active: number; trialing: number; mrrRep: number | null }[];
}

function computeMrr(rows: AdminRows): MrrSummary {
  // Same as v_mrr: the included month (no payment) is left out; amounts are the stored ones, else list prices.
  const subs = rows.subscriptions.filter((s) => s.plan !== "included" && s.status !== "canceled");
  const curOf = (s: SubscriptionRow) => (s.currency ?? "KWD").toUpperCase();
  const keys = [...new Set(subs.map((s) => `${s.plan}|${curOf(s)}`))];
  const monthly = (s: SubscriptionRow) => {
    const amount = s.amount ?? null;
    return amount == null ? monthlyEquivalent(s.plan, curOf(s)) : s.plan === "yearly" ? amount / 12 : amount;
  };
  return {
    active: subs.filter((s) => s.status === "active").length,
    trialing: subs.filter((s) => s.status === "trialing").length,
    pastDue: subs.filter((s) => s.status === "past_due").length,
    cancelling: subs.filter((s) => (s.status === "active" || s.status === "trialing") && s.cancel_at).length,
    rows: keys.map((k) => {
      const [plan, currency] = k.split("|");
      const of = subs.filter((s) => s.plan === plan && curOf(s) === currency);
      return {
        plan,
        currency,
        active: of.filter((s) => s.status === "active").length,
        trialing: of.filter((s) => s.status === "trialing").length,
        mrr: round(sum(of.filter((s) => s.status === "active").map(monthly))),
        trialingMrr: round(sum(of.filter((s) => s.status === "trialing").map(monthly))),
      };
    }),
    dataMissing: false,
    source: "computed",
  };
}

interface MrrViewRow {
  plan: string;
  currency: string;
  active: number | string;
  trialing: number | string;
  past_due: number | string;
  cancelling: number | string;
  mrr: number | string | null;
  trialing_mrr: number | string | null;
  data_missing: boolean | null;
}

/** MRR from the v_mrr view (per plan and currency, amounts as stored); the demo computes it from its rows. */
export async function fetchMrr(rows: AdminRows): Promise<MrrSummary> {
  if (backendMode === "mock") return computeMrr(rows);
  const view = (check(await sb().from("v_mrr").select("plan,currency,active,trialing,past_due,cancelling,mrr,trialing_mrr,data_missing")) ?? []) as MrrViewRow[];
  return {
    active: sum(view.map((v) => num(v.active))),
    trialing: sum(view.map((v) => num(v.trialing))),
    pastDue: sum(view.map((v) => num(v.past_due))),
    cancelling: sum(view.map((v) => num(v.cancelling))),
    rows: view.map((v) => ({
      plan: v.plan,
      currency: (v.currency ?? "KWD").toUpperCase(),
      active: num(v.active),
      trialing: num(v.trialing),
      mrr: v.data_missing ? null : round(num(v.mrr)),
      trialingMrr: v.data_missing ? null : round(num(v.trialing_mrr)),
    })),
    dataMissing: view.some((v) => v.data_missing),
    source: "v_mrr",
  };
}

/* ----------------------------- Waitlist ---------------------------- */

export interface AdminWaitlistEntry {
  id: string;
  /** null in demo mode (the mock does not hand out waitlist emails) */
  email: string | null;
  gender: WaitlistRow["gender"];
  locale: WaitlistRow["locale"];
  source: string | null;
  /** ISO-2, when given */
  country: string | null;
  created_at: string;
}

/** Every waitlist entry, newest first. Admin only (RLS). */
export async function listWaitlistEntries(fallback: AdminRows["waitlist"] = []): Promise<AdminWaitlistEntry[]> {
  if (backendMode === "mock") {
    return fallback.map((w) => ({ id: w.id, email: w.email ?? null, gender: w.gender, locale: w.locale ?? null, source: w.source ?? null, country: w.country ?? null, created_at: w.created_at })).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  return fetchAll<AdminWaitlistEntry>((a, b) => sb().from("waitlist").select("id,email,gender,locale,source,country,created_at").order("created_at", { ascending: false }).order("id").range(a, b));
}

export function waitlistToCsv(rows: AdminWaitlistEntry[]): string {
  return toCsv(["email", "gender", "locale", "country", "source", "created_at"], rows as unknown as Record<string, unknown>[]);
}

/* ------------------------------ Types ------------------------------ */

export interface OperatorOrder {
  order_id: string;
  /** null after the customer deleted their account */
  user_id: string | null;
  email: string | null;
  product: OrderRow["product"];
  status: OrderStatus;
  created_at: string;
  paid_at: string | null;
  submitted_at: string | null;
  delivered_at: string | null;
  due_at: string | null;
  /** country chosen at checkout (null for orders from before multi-currency) */
  country: string | null;
  /** the order's currency and list price in it */
  currency: string;
  amount: number;
  /** payments of the order after refunds, in the order's currency (null when they are in mixed currencies) */
  revenue: number | null;
  /** payments of the order after refunds, in the dashboard currency (null when a rate is missing) */
  revenueRep: number | null;
  refundedRep: number | null;
  paymentFeeRep: number | null;
  imageCostUsd: number;
  imageCostRep: number | null;
  otherCostRep: number | null;
  marginRep: number | null;
  generations: number;
  /** generations made from an earlier one (parent_id set); null when not known */
  regenerations: number | null;
  /** open review order past its due time */
  overdue: boolean;
  fxMissing: boolean;
}

export interface OperatorKpis {
  range: AdminRange;
  from: string | null;
  revenueRep: number | null;
  grossRevenueRep: number | null;
  refundedRep: number | null;
  /** paid orders created in the range */
  orders: number;
  /** orders delivered in the range */
  delivered: number;
  /** submitted -> delivered, hours, for orders delivered in the range */
  avgTurnaroundHours: number | null;
  /** share (0..1) of those delivered within the 72-hour promise */
  withinSlaShare: number | null;
  openOrders: number;
  overdueNow: number;
  awaitingPhotos: number;
  mrr: OperatorMrr;
}

export interface UnitEconomics {
  /** paid orders created in the range */
  orders: number;
  revenueRep: number | null;
  paymentFeeRep: number | null;
  imageCostUsd: number;
  imageCostRep: number | null;
  otherCostRep: number | null;
  marginRep: number | null;
  /** margin / revenue, 0..1 */
  marginShare: number | null;
  perOrder: { revenueRep: number | null; paymentFeeRep: number | null; imageCostRep: number | null; marginRep: number | null };
  /** customers with an account (deleted accounts are left out of per-customer figures) */
  customers: number;
  deletedAccountOrders: number;
  membershipRevenueRep: number | null;
  perCustomer: { revenueRep: number | null; marginRep: number | null; orders: number | null };
  generations: number;
  regenerations: number | null;
  ordersWithGenerations: number;
  imageCostPerOrderRep: number | null;
  imageCostPerGenerationUsd: number | null;
  imageCostPerGenerationRep: number | null;
}

export interface MarketingDay {
  date: string;
  spendRep: number | null;
  impressions: number;
  clicks: number;
  /** purchases the ad platform reports (its own attribution) */
  purchases: number;
  /** customers whose first report was paid that day (all channels) */
  newCustomers: number;
  revenueRep: number | null;
  /** spend / new paying customers that day (blended, all channels) */
  cacRep: number | null;
  /** net revenue that day / spend (blended) */
  roas: number | null;
}

export interface MarketingCampaign {
  platform: AdSpendRow["platform"];
  campaign_id: string;
  campaign_name: string | null;
  spendRep: number | null;
  impressions: number;
  clicks: number;
  purchases: number;
  ctr: number | null;
  /** spend / platform-reported purchases */
  cpaRep: number | null;
  /** platform purchases x average report payment / spend: an estimate */
  estRoas: number | null;
}

export interface MarketingSummary {
  hasRows: boolean;
  spendRep: number | null;
  impressions: number;
  clicks: number;
  purchases: number;
  ctr: number | null;
  newPayingCustomers: number;
  cacRep: number | null;
  roas: number | null;
  days: MarketingDay[];
  campaigns: MarketingCampaign[];
  currencies: string[];
}

export interface OperatorDailyPoint {
  date: string;
  revenueRep: number | null;
  adSpendRep: number | null;
  orders: number;
}

/** One market: a country and the currency it paid in (country null = not recorded, before multi-currency). */
export interface MarketRow {
  country: string | null;
  currency: string;
  /** paid report orders created in the range */
  orders: number;
  /** customers with a succeeded payment in the range */
  payingCustomers: number;
  /** in `currency`: succeeded payments, refunds (positive), net */
  gross: number;
  refunds: number;
  net: number;
  /** net in the dashboard currency (null when a rate is missing) */
  netRep: number | null;
  /** share of all net revenue in the range (0..1; null when a rate is missing) */
  share: number | null;
  /** paying memberships now (not range-bound) and their MRR */
  activeMembers: number;
  mrr: number;
  mrrRep: number | null;
}

export interface OperatorDashboard {
  generatedAt: string;
  range: AdminRange;
  /** the currency of every "Rep" amount */
  currency: string;
  kpis: OperatorKpis;
  daily: OperatorDailyPoint[];
  statusCounts: { status: OrderStatus; count: number }[];
  orders: OperatorOrder[];
  economics: UnitEconomics;
  /** revenue per country and currency, largest first */
  markets: MarketRow[];
  marketing: { meta: MarketingSummary; all: MarketingSummary };
  waitlist: { total: number; women: number; men: number; unknown: number; last7d: number; entries: AdminWaitlistEntry[]; emailsAvailable: boolean };
  fx: FxRate[];
  /** currencies that appear in the data but have no rate in fx_rates */
  fxMissing: string[];
  /** manual rates older than their max_age_days (KWD daily, USD weekly) */
  fxStale: string[];
  /** non-fatal problems while loading (shown as notes) */
  warnings: string[];
}

export interface OperatorInput {
  rows: AdminRows;
  rates: FxRate[];
  mrr: MrrSummary;
  /** ids of generations that have a parent (regenerations); null when not known */
  regenerated: Set<string> | null;
  waitlist: AdminWaitlistEntry[];
  warnings?: string[];
}

export const ORDER_STATUS_ORDER: OrderStatus[] = ["pending_payment", "paid", "awaiting_photos", "in_review", "changes_requested", "delivered", "refunded", "cancelled"];

/* ----------------------------- Compute ----------------------------- */

type N = number | null;
const addN = (xs: N[]): N => (xs.some((x) => x == null) ? null : sum(xs as number[]));

/**
 * Pure: the operator dashboard from raw rows and fx rates (shared by Supabase
 * and demo mode), with every amount in `currency` (EUR by default).
 */
export function computeOperatorDashboard(input: OperatorInput, range: AdminRange, now = Date.now(), currency: string = DEFAULT_REPORT_CURRENCY): OperatorDashboard {
  const { rows, rates, regenerated, waitlist } = input;
  const from = adminRangeStart(range, now);
  const { conv, missing } = fxConverter(rates, currency);
  // 3 decimals for KWD, 2 for EUR / USD.
  const dp = currency.toUpperCase() === "KWD" || currency.toUpperCase() === "BHD" || currency.toUpperCase() === "OMR" ? 3 : 2;
  const roundN = (x: N, d = dp): N => (x == null ? null : round(x, d));
  const divN = (a: N, b: N, d = dp): N => (a == null || b == null || b === 0 ? null : round(a / b, d));
  const mrr: OperatorMrr = {
    ...input.mrr,
    mrrRep: roundN(addN(input.mrr.rows.map((r) => (r.mrr == null ? null : conv(r.mrr, r.currency))))),
    trialingMrrRep: roundN(addN(input.mrr.rows.map((r) => (r.trialingMrr == null ? null : conv(r.trialingMrr, r.currency))))),
    byPlan: [...new Set(input.mrr.rows.map((r) => r.plan))].map((plan) => {
      const of = input.mrr.rows.filter((r) => r.plan === plan);
      return {
        plan,
        active: sum(of.map((r) => r.active)),
        trialing: sum(of.map((r) => r.trialing)),
        mrrRep: roundN(addN(of.map((r) => (r.mrr == null ? null : conv(r.mrr, r.currency))))),
      };
    }),
  };
  const isPaid = (s: OrderStatus) => s !== "pending_payment" && s !== "cancelled";
  const email = new Map(rows.profiles.map((p) => [p.id, p.email]));
  const OPEN_S = OPEN as OrderStatus[];

  /* per order */
  const paysBy = new Map<string, AdminRows["payments"]>();
  for (const p of rows.payments) if (p.order_id && countsForRevenue(p)) paysBy.set(p.order_id, [...(paysBy.get(p.order_id) ?? []), p]);
  const gensBy = new Map<string, AdminRows["generations"]>();
  for (const g of rows.generations) gensBy.set(g.order_id, [...(gensBy.get(g.order_id) ?? []), g]);
  const otherBy = new Map<string, CostRow[]>();
  for (const c of rows.costs) if (c.order_id && !COUNTED_ELSEWHERE.has(c.category)) otherBy.set(c.order_id, [...(otherBy.get(c.order_id) ?? []), c]);

  const allOrders: OperatorOrder[] = rows.orders.map((o) => {
    const pays = paysBy.get(o.id) ?? [];
    const gens = gensBy.get(o.id) ?? [];
    const revenueRep = addN(pays.map((p) => conv(revenueOf(p), p.currency)));
    const payCurrencies = new Set(pays.map((p) => p.currency.toUpperCase()));
    const ownCurrency = (o.currency ?? "KWD").toUpperCase();
    const revenueRaw = payCurrencies.size > 1 || (payCurrencies.size === 1 && !payCurrencies.has(ownCurrency)) ? null : sum(pays.map(revenueOf));
    const refundedRep = addN(pays.filter((p) => p.status === "refunded").map((p) => conv(Math.abs(p.amount), p.currency)));
    const paymentFeeRep = addN(pays.map((p) => conv(p.fee, p.currency)));
    const imageCostUsd = sum(gens.map((g) => g.cost_usd));
    const imageCostRep = conv(imageCostUsd, "USD");
    const otherCostRep = addN((otherBy.get(o.id) ?? []).map((c) => conv(c.amount, c.currency)));
    const marginRep = addN([revenueRep, paymentFeeRep == null ? null : -paymentFeeRep, imageCostRep == null ? null : -imageCostRep, otherCostRep == null ? null : -otherCostRep]);
    return {
      order_id: o.id,
      user_id: o.user_id,
      email: o.user_id ? email.get(o.user_id) ?? null : null,
      product: o.product,
      status: o.status,
      created_at: o.created_at,
      paid_at: o.paid_at,
      submitted_at: o.submitted_at,
      delivered_at: o.delivered_at,
      due_at: o.due_at,
      country: o.country ?? null,
      currency: ownCurrency,
      amount: o.amount,
      revenue: revenueRaw == null ? null : round(revenueRaw, 3),
      revenueRep: roundN(revenueRep),
      refundedRep: roundN(refundedRep),
      paymentFeeRep: roundN(paymentFeeRep),
      imageCostUsd: round(imageCostUsd, 4),
      imageCostRep: roundN(imageCostRep),
      otherCostRep: roundN(otherCostRep),
      marginRep: roundN(marginRep),
      generations: gens.length,
      regenerations: regenerated ? gens.filter((g) => regenerated.has(g.id)).length : null,
      overdue: OPEN_S.includes(o.status) && !!o.due_at && Date.parse(o.due_at) < now,
      fxMissing: [revenueRep, paymentFeeRep, imageCostRep, otherCostRep].some((x) => x == null),
    };
  });
  allOrders.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const createdIn = (o: { created_at: string }) => inRange(o.created_at, from, now);
  const tableOrders = allOrders.filter((o) => createdIn(o) || OPEN_S.includes(o.status));
  const paidInRange = allOrders.filter((o) => createdIn(o) && isPaid(o.status));

  /* KPIs */
  const pays = rows.payments.filter((p) => inRange(p.created_at, from, now));
  const gross = addN(pays.filter((p) => p.status === "succeeded").map((p) => conv(p.amount, p.currency)));
  const refunds = addN(pays.filter((p) => p.status === "refunded").map((p) => conv(Math.abs(p.amount), p.currency)));
  const delivered = rows.orders.filter((o) => inRange(o.delivered_at, from, now));
  const timed = delivered.filter((o) => o.submitted_at);
  const hours = timed.map((o) => (Date.parse(o.delivered_at!) - Date.parse(o.submitted_at!)) / 3600_000);
  const within = timed.filter((o) => Date.parse(o.delivered_at!) <= (o.due_at ? Date.parse(o.due_at) : Date.parse(o.submitted_at!) + SLA_HOURS * 3600_000)).length;
  const openOrders = rows.orders.filter((o) => OPEN_S.includes(o.status));
  const kpis: OperatorKpis = {
    range,
    from: from ? new Date(from).toISOString() : null,
    revenueRep: gross == null || refunds == null ? null : round(gross - refunds),
    grossRevenueRep: roundN(gross),
    refundedRep: roundN(refunds),
    orders: paidInRange.length,
    delivered: delivered.length,
    avgTurnaroundHours: hours.length ? round(sum(hours) / hours.length, 1) : null,
    withinSlaShare: timed.length ? round(within / timed.length, 3) : null,
    openOrders: openOrders.length,
    overdueNow: openOrders.filter((o) => o.due_at && Date.parse(o.due_at) < now).length,
    awaitingPhotos: rows.orders.filter((o) => o.status === "awaiting_photos").length,
    mrr,
  };

  /* daily (Kuwait days) */
  const fromDay = from
    ? kuwaitDay(from)
    : [...rows.payments.map((p) => p.created_at), ...rows.orders.map((o) => o.created_at)].map((t) => kuwaitDay(Date.parse(t))).concat(rows.adSpend.map((a) => a.date)).sort()[0] ?? kuwaitDay(now);
  const days: string[] = [];
  for (let t = Date.parse(`${fromDay}T00:00:00Z`), end = Date.parse(`${kuwaitDay(now)}T00:00:00Z`); t <= end; t += DAY) days.push(new Date(t).toISOString().slice(0, 10));
  const dayMap = new Map<string, { rev: N[]; ad: N[]; orders: number }>(days.map((d) => [d, { rev: [], ad: [], orders: 0 }]));
  for (const p of pays) if (countsForRevenue(p)) dayMap.get(kuwaitDay(Date.parse(p.created_at)))?.rev.push(conv(revenueOf(p), p.currency));
  for (const o of paidInRange) {
    const x = dayMap.get(kuwaitDay(Date.parse(o.created_at)));
    if (x) x.orders++;
  }
  const adInRange = rows.adSpend.filter((a) => a.date >= fromDay);
  for (const a of adInRange) dayMap.get(a.date)?.ad.push(conv(a.spend, a.currency));
  const daily: OperatorDailyPoint[] = days.map((date) => {
    const x = dayMap.get(date)!;
    return { date, revenueRep: roundN(addN(x.rev)), adSpendRep: roundN(addN(x.ad)), orders: x.orders };
  });

  /* orders by status (created in the range) */
  const statusCounts = ORDER_STATUS_ORDER.map((status) => ({ status, count: rows.orders.filter((o) => o.status === status && createdIn(o)).length })).filter((s) => s.count > 0);

  /* unit economics */
  const tot = (k: "revenueRep" | "paymentFeeRep" | "imageCostRep" | "otherCostRep" | "marginRep") => roundN(addN(paidInRange.map((o) => o[k])));
  const n = paidInRange.length;
  const generations = sum(paidInRange.map((o) => o.generations));
  const regenerations = regenerated ? sum(paidInRange.map((o) => o.regenerations ?? 0)) : null;
  const withGens = paidInRange.filter((o) => o.generations > 0);
  const imageCostUsd = round(sum(paidInRange.map((o) => o.imageCostUsd)), 4);
  const imageCostRep = tot("imageCostRep");
  const revenueRep = tot("revenueRep");
  const marginRep = tot("marginRep");
  // Per customer: order economics plus membership payments, for customers with an account.
  const memberPays = pays.filter((p) => !p.order_id && countsForRevenue(p));
  const membershipRevenueRep = roundN(addN(memberPays.map((p) => conv(revenueOf(p), p.currency))));
  const cust = new Map<string, { revenue: N[]; margin: N[]; orders: number }>();
  const c = (uid: string) => {
    let x = cust.get(uid);
    if (!x) cust.set(uid, (x = { revenue: [], margin: [], orders: 0 }));
    return x;
  };
  for (const o of paidInRange) {
    if (!o.user_id) continue;
    const x = c(o.user_id);
    x.orders++;
    x.revenue.push(o.revenueRep);
    x.margin.push(o.marginRep);
  }
  for (const p of memberPays) {
    if (!p.user_id) continue;
    const x = c(p.user_id);
    const r = conv(revenueOf(p), p.currency);
    const f = conv(p.fee, p.currency);
    x.revenue.push(r);
    x.margin.push(r == null || f == null ? null : r - f);
  }
  const custList = [...cust.values()];
  const economics: UnitEconomics = {
    orders: n,
    revenueRep,
    paymentFeeRep: tot("paymentFeeRep"),
    imageCostUsd,
    imageCostRep,
    otherCostRep: tot("otherCostRep"),
    marginRep,
    marginShare: revenueRep && marginRep != null && revenueRep > 0 ? round(marginRep / revenueRep, 3) : null,
    perOrder: {
      revenueRep: divN(revenueRep, n),
      paymentFeeRep: divN(tot("paymentFeeRep"), n),
      imageCostRep: divN(imageCostRep, n),
      marginRep: divN(marginRep, n),
    },
    customers: custList.length,
    deletedAccountOrders: paidInRange.filter((o) => !o.user_id).length,
    membershipRevenueRep,
    perCustomer: {
      revenueRep: divN(addN(custList.flatMap((x) => x.revenue)), custList.length),
      marginRep: divN(addN(custList.flatMap((x) => x.margin)), custList.length),
      orders: divN(sum(custList.map((x) => x.orders)), custList.length, 2),
    },
    generations,
    regenerations,
    ordersWithGenerations: withGens.length,
    imageCostPerOrderRep: divN(addN(withGens.map((o) => o.imageCostRep)), withGens.length),
    imageCostPerGenerationUsd: generations ? round(imageCostUsd / generations, 4) : null,
    imageCostPerGenerationRep: divN(imageCostRep, generations),
  };

  /* marketing */
  const reportPays = pays.filter((p) => p.status === "succeeded" && p.order_id);
  const reportPayRep = addN(reportPays.map((p) => conv(p.amount, p.currency)));
  const avgReportRep = reportPays.length ? divN(reportPayRep, reportPays.length) : null;
  const firstPaid = new Map<string, number>(); // new paying customers per Kuwait day
  const seen = new Set<string>();
  for (const o of rows.orders) {
    if (o.product !== "report" || !inRange(o.paid_at, from, now)) continue;
    const who = o.user_id ?? `deleted:${o.id}`;
    if (seen.has(who)) continue;
    seen.add(who);
    const d = kuwaitDay(Date.parse(o.paid_at!));
    firstPaid.set(d, (firstPaid.get(d) ?? 0) + 1);
  }
  const marketingFor = (platform: AdSpendRow["platform"] | null): MarketingSummary => {
    const ads = adInRange.filter((a) => !platform || a.platform === platform);
    const byDay = new Map<string, AdSpendRow[]>();
    for (const a of ads) byDay.set(a.date, [...(byDay.get(a.date) ?? []), a]);
    const mdays: MarketingDay[] = [...byDay.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, list]) => {
        const spendRep = roundN(addN(list.map((a) => conv(a.spend, a.currency))));
        const dp = daily.find((x) => x.date === date);
        // No point for the day means no revenue (0); a point with null revenue means a rate is missing (keep null).
        const dayRevenue: N = dp ? dp.revenueRep : 0;
        const newCustomers = firstPaid.get(date) ?? 0;
        return {
          date,
          spendRep,
          impressions: sum(list.map((a) => a.impressions)),
          clicks: sum(list.map((a) => a.clicks)),
          purchases: sum(list.map((a) => a.purchases)),
          newCustomers,
          revenueRep: dayRevenue,
          cacRep: divN(spendRep, newCustomers),
          roas: divN(dayRevenue, spendRep, 2),
        };
      });
    const byCamp = new Map<string, AdSpendRow[]>();
    for (const a of ads) byCamp.set(`${a.platform}:${a.campaign_id}`, [...(byCamp.get(`${a.platform}:${a.campaign_id}`) ?? []), a]);
    const campaigns: MarketingCampaign[] = [...byCamp.values()].map((list) => {
      const spendRep = roundN(addN(list.map((a) => conv(a.spend, a.currency))));
      const impressions = sum(list.map((a) => a.impressions));
      const clicks = sum(list.map((a) => a.clicks));
      const purchases = sum(list.map((a) => a.purchases));
      return {
        platform: list[0].platform,
        campaign_id: list[0].campaign_id,
        campaign_name: list.map((a) => a.campaign_name).filter(Boolean).pop() ?? null,
        spendRep,
        impressions,
        clicks,
        purchases,
        ctr: impressions ? round(clicks / impressions, 4) : null,
        cpaRep: divN(spendRep, purchases),
        estRoas: avgReportRep == null ? null : divN(purchases * avgReportRep, spendRep, 2),
      };
    });
    campaigns.sort((a, b) => (b.spendRep ?? 0) - (a.spendRep ?? 0));
    const spendRep = roundN(addN(ads.map((a) => conv(a.spend, a.currency))));
    const impressions = sum(ads.map((a) => a.impressions));
    const clicks = sum(ads.map((a) => a.clicks));
    const newPaying = sum([...firstPaid.values()]);
    return {
      hasRows: ads.length > 0,
      spendRep,
      impressions,
      clicks,
      purchases: sum(ads.map((a) => a.purchases)),
      ctr: impressions ? round(clicks / impressions, 4) : null,
      newPayingCustomers: newPaying,
      cacRep: divN(spendRep, newPaying),
      roas: divN(kpis.revenueRep, spendRep, 2),
      days: mdays,
      campaigns,
      currencies: [...new Set(ads.map((a) => a.currency.toUpperCase()))],
    };
  };

  /* per country and currency */
  function computeMarkets(): MarketRow[] {
    const orderById = new Map(rows.orders.map((o) => [o.id, o]));
    const subById = new Map(rows.subscriptions.map((x) => [x.id, x]));
    const countryOfPay = (p: AdminRows["payments"][number]) =>
      p.country ?? (p.order_id ? orderById.get(p.order_id)?.country : null) ?? (p.subscription_id ? subById.get(p.subscription_id)?.country : null) ?? null;
    const key = (country: string | null | undefined, cur: string | null | undefined) => `${country ?? ""}|${(cur ?? "KWD").toUpperCase()}`;
    const m = new Map<string, MarketRow & { customers: Set<string> }>();
    const at = (country: string | null | undefined, cur: string | null | undefined) => {
      const k = key(country, cur);
      let x = m.get(k);
      if (!x) m.set(k, (x = { country: country ?? null, currency: (cur ?? "KWD").toUpperCase(), orders: 0, payingCustomers: 0, gross: 0, refunds: 0, net: 0, netRep: 0, share: null, activeMembers: 0, mrr: 0, mrrRep: 0, customers: new Set() }));
      return x;
    };
    for (const p of pays) {
      if (!countsForRevenue(p)) continue;
      const x = at(countryOfPay(p), p.currency);
      if (p.status === "succeeded") {
        x.gross += p.amount;
        if (p.user_id) x.customers.add(p.user_id);
      } else x.refunds += Math.abs(p.amount);
    }
    for (const o of paidInRange) at(o.country, o.currency).orders++;
    for (const x of rows.subscriptions) {
      if (x.plan === "included" || x.status !== "active") continue;
      const r = at(x.country, x.currency);
      r.activeMembers++;
      r.mrr += x.amount == null ? monthlyEquivalent(x.plan, x.currency) : x.plan === "yearly" ? x.amount / 12 : x.amount;
    }
    const list = [...m.values()].map(({ customers, ...x }) => {
      const net = x.gross - x.refunds;
      return { ...x, payingCustomers: customers.size, gross: round(x.gross, 3), refunds: round(x.refunds, 3), net: round(net, 3), netRep: roundN(conv(net, x.currency)), mrr: round(x.mrr, 3), mrrRep: roundN(conv(x.mrr, x.currency)) };
    });
    const total = addN(list.map((x) => x.netRep));
    for (const x of list) x.share = total && x.netRep != null ? round(x.netRep / total, 3) : null;
    return list.sort((a, b) => (b.netRep ?? -Infinity) - (a.netRep ?? -Infinity) || b.orders - a.orders);
  }

  /* waitlist */
  const wl = rows.waitlist;
  const waitlistSummary = {
    total: wl.length,
    women: wl.filter((w) => w.gender === "female").length,
    men: wl.filter((w) => w.gender === "male").length,
    unknown: wl.filter((w) => !w.gender).length,
    last7d: wl.filter((w) => Date.parse(w.created_at) >= now - 7 * DAY).length,
    entries: waitlist,
    emailsAvailable: waitlist.some((w) => w.email),
  };

  const result: OperatorDashboard = {
    generatedAt: new Date(now).toISOString(),
    range,
    kpis,
    daily,
    statusCounts,
    orders: tableOrders,
    economics,
    markets: computeMarkets(),
    marketing: { meta: marketingFor("meta"), all: marketingFor(null) },
    waitlist: waitlistSummary,
    currency: currency.toUpperCase(),
    fx: rates,
    fxMissing: [],
    fxStale: rates.filter((r) => fxStale(r, now)).map((r) => r.currency),
    warnings: input.warnings ?? [],
  };
  result.fxMissing = [...missing].sort();
  return result;
}

/**
 * Open orders created before the range are listed too, but fetchAdminRows only
 * reads payments, generations and costs created in the range, so those orders
 * would show 0 revenue and a negative margin. Read their rows by order id.
 * Returns the merged rows and the ids of their regenerations.
 */
async function backfillOlderOrders(rows: AdminRows, since: string): Promise<{ rows: AdminRows; regenerated: string[] }> {
  const ids = rows.orders.filter((o) => o.created_at < since).map((o) => o.id);
  if (!ids.length) return { rows, regenerated: [] };
  let payments: AdminRows["payments"] = [];
  let generations: AdminRows["generations"] = [];
  let costs: CostRow[] = [];
  if (backendMode === "mock") {
    const want = new Set(ids);
    const full = await mock.adminRows(new Date(0).toISOString());
    payments = full.payments.filter((p) => p.order_id && want.has(p.order_id));
    generations = full.generations.filter((g) => want.has(g.order_id));
    costs = full.costs.filter((c) => c.order_id && want.has(c.order_id));
  } else {
    const c = sb();
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const [p, g, k] = await Promise.all([
        fetchAll<AdminRows["payments"][number]>((a, b) => c.from("payments").select("*").in("order_id", chunk).order("id").range(a, b)),
        fetchAll<AdminRows["generations"][number]>((a, b) => c.from("generations").select("id,order_id,cost_usd,status,created_at,parent_id,kind").in("order_id", chunk).order("id").range(a, b)),
        fetchAll<CostRow>((a, b) => c.from("costs").select("*").in("order_id", chunk).order("id").range(a, b)),
      ]);
      payments.push(...p.map(normPayment));
      generations.push(...g.map((x) => ({ ...x, cost_usd: num(x.cost_usd) })));
      costs.push(...k.map((x) => ({ ...x, amount: num(x.amount) })));
    }
  }
  const merge = <T extends { id: string }>(a: T[], b: T[]) => {
    const seen = new Set(a.map((x) => x.id));
    return [...a, ...b.filter((x) => !seen.has(x.id))];
  };
  return {
    rows: {
      ...rows,
      payments: merge(rows.payments, payments),
      generations: merge(rows.generations, generations),
      costs: merge(rows.costs, costs),
    },
    regenerated: generations.filter((g) => g.parent_id).map((g) => g.id),
  };
}

/** Fetch everything the operator dashboard needs for a range (raw amounts; computeOperatorDashboard converts). Admin only (RLS). */
export async function loadOperatorInput(range: AdminRange): Promise<{ input: OperatorInput; now: number }> {
  const now = Date.now();
  const since = new Date(adminRangeStart(range, now)).toISOString();
  const warnings: string[] = [];
  const fetched = await fetchAdminRows(since);
  let rows = fetched;
  let olderRegens: string[] = [];
  try {
    ({ rows, regenerated: olderRegens } = await backfillOlderOrders(fetched, since));
  } catch (e) {
    warnings.push(`Payments of open orders from before the range could not be loaded, so their amounts may be incomplete: ${e instanceof Error ? e.message : String(e)}`);
  }
  const soft = async <T,>(what: string, p: Promise<T>, fallback: T): Promise<T> => {
    try {
      return await p;
    } catch (e) {
      warnings.push(`${what}: ${e instanceof Error ? e.message : String(e)}`);
      return fallback;
    }
  };
  const regen = async (): Promise<Set<string> | null> => {
    // The rows (Supabase and demo) carry parent_id.
    if (backendMode === "mock") return new Set(rows.generations.filter((g) => g.parent_id).map((g) => g.id));
    const gens = await fetchAll<{ id: string; parent_id: string | null }>((a, b) => sb().from("generations").select("id,parent_id").gte("created_at", since).not("parent_id", "is", null).order("id").range(a, b));
    return new Set([...gens.map((g) => g.id), ...olderRegens]);
  };
  const [rates, mrr, regenerated, waitlist] = await Promise.all([
    soft("Exchange rates could not be loaded", listFxRates(), [] as FxRate[]),
    soft("MRR view could not be read, computed from list prices instead", fetchMrr(rows), computeMrr(rows)),
    soft("Regenerations could not be counted", regen(), null),
    soft("Waitlist emails could not be loaded", listWaitlistEntries(rows.waitlist), [] as AdminWaitlistEntry[]),
  ]);
  return { input: { rows, rates, mrr, regenerated, waitlist, warnings }, now };
}

/** Fetch and compute the operator dashboard for a range, in `currency` (EUR by default). Admin only. */
export async function loadOperatorDashboard(range: AdminRange, currency: string = DEFAULT_REPORT_CURRENCY): Promise<OperatorDashboard> {
  const { input, now } = await loadOperatorInput(range);
  return computeOperatorDashboard(input, range, now, currency);
}

/**
 * The operator dashboard for a range in `currency`. Switching the currency
 * only recomputes (the rows and rates are fetched once per range).
 */
export function useOperatorDashboard(range: AdminRange, enabled = true, currency: string = DEFAULT_REPORT_CURRENCY): QueryState<OperatorDashboard> {
  const q = useBackendQuery(backendMode === "off" || !enabled ? null : `admin-op:${range}`, () => loadOperatorInput(range));
  const data = useMemo(() => (q.data ? computeOperatorDashboard(q.data.input, range, q.data.now, currency) : undefined), [q.data, range, currency]);
  return { ...q, data };
}

const OPERATOR_CSV_COLS = ["order_id", "email", "product", "status", "country", "currency", "list_price", "revenue", "created_at", "paid_at", "delivered_at", "revenue_rep", "payment_fee_rep", "image_cost_usd", "image_cost_rep", "other_cost_rep", "margin_rep", "rep_currency"] as const;

/** The operator dashboard's orders as CSV: raw amounts in the order's currency plus the converted ones (rep_currency). */
export function operatorOrdersToCsv(orders: OperatorOrder[], currency: string): string {
  return toCsv(
    OPERATOR_CSV_COLS,
    orders.map((o) => ({
      order_id: o.order_id,
      email: o.email,
      product: o.product,
      status: o.status,
      country: o.country,
      currency: o.currency,
      list_price: o.amount,
      revenue: o.revenue,
      created_at: o.created_at,
      paid_at: o.paid_at,
      delivered_at: o.delivered_at,
      revenue_rep: o.revenueRep,
      payment_fee_rep: o.paymentFeeRep,
      image_cost_usd: o.imageCostUsd,
      image_cost_rep: o.imageCostRep,
      other_cost_rep: o.otherCostRep,
      margin_rep: o.marginRep,
      rep_currency: currency,
    })),
  );
}
