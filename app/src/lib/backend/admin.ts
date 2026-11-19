import { backendMode, check, num, sb, useBackendQuery } from "./client";
import { mock } from "./mock";
import { normOrder, normPayment } from "./orders";
import {
  OPEN_REVIEW_STATUSES,
  monthlyEquivalentKwd,
  type AdSpendRow,
  type AdminDashboard,
  type AdminRows,
  type CampaignSpend,
  type CostRow,
  type CustomerEconomics,
  type DailyPoint,
  type KpiRange,
  type Kpis,
  type OrderEconomics,
  type OrderRow,
  type QueryState,
  type SubscriptionStatus,
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
export const FX_TO_KWD: Record<string, number> = {
  KWD: 1,
  USD: envRate("VITE_FX_USD_KWD", 0.307),
  EUR: envRate("VITE_FX_EUR_KWD", 0.335),
};
export const toKwd = (amount: number, currency: string | null | undefined) => amount * (FX_TO_KWD[(currency ?? "KWD").toUpperCase()] ?? 1);

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
  const [ordersRecent, ordersOpen, payments, subscriptions, generations, costs, adSpend, profiles, waitlist] = await Promise.all([
    fetchAll<OrderRow>((a, b) => c.from("orders").select("*").or(`created_at.gte."${sinceIso}",delivered_at.gte."${sinceIso}",due_at.gte."${sinceIso}"`).order("id").range(a, b)),
    fetchAll<OrderRow>((a, b) => c.from("orders").select("*").in("status", OPEN).order("id").range(a, b)),
    fetchAll<AdminRows["payments"][number]>((a, b) => c.from("payments").select("*").gte("created_at", sinceIso).order("id").range(a, b)),
    fetchAll<AdminRows["subscriptions"][number]>((a, b) => c.from("subscriptions").select("*").order("id").range(a, b)),
    fetchAll<AdminRows["generations"][number]>((a, b) => c.from("generations").select("id,order_id,cost_usd,status,created_at").gte("created_at", sinceIso).order("id").range(a, b)),
    fetchAll<CostRow>((a, b) => c.from("costs").select("*").gte("created_at", sinceIso).order("id").range(a, b)),
    fetchAll<AdSpendRow>((a, b) => c.from("ad_spend").select("*").gte("date", sinceIso.slice(0, 10)).order("id").range(a, b)),
    fetchAll<AdminRows["profiles"][number]>((a, b) => c.from("profiles").select("id,email,role,created_at").order("id").range(a, b)),
    fetchAll<AdminRows["waitlist"][number]>((a, b) => c.from("waitlist").select("id,gender,created_at").order("id").range(a, b)),
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

  const active = rows.subscriptions.filter((s) => s.status === "active");
  const trialing = rows.subscriptions.filter((s) => s.status === "trialing");
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

/** Orders as CSV for the accountant (from the dashboard's per-order economics). */
export function ordersToCsv(orders: OrderEconomics[]): string {
  const cols: (keyof OrderEconomics)[] = ["order_id", "email", "product", "status", "created_at", "paid_at", "delivered_at", "revenueKwd", "paymentFeeKwd", "imageCostUsd", "imageCostKwd", "otherCostKwd", "marginKwd"];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...orders.map((o) => cols.map((c) => esc(o[c])).join(","))].join("\n");
}
