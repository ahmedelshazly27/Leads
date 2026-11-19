import { BackendError, backendMode, check, invalidate, num, sb, useBackendQuery } from "./client";
import { mock } from "./mock";
import { normOrder, normPayment } from "./orders";
import {
  ADMIN_AUDIT_ACTIONS,
  OPEN_REVIEW_STATUSES,
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
  const [ordersRecent, ordersOpen, payments, subscriptions, generations, costs, adSpend, profiles, waitlist, audit] = await Promise.all([
    fetchAll<OrderRow>((a, b) => c.from("orders").select("*").or(`created_at.gte."${sinceIso}",delivered_at.gte."${sinceIso}",due_at.gte."${sinceIso}"`).order("id").range(a, b)),
    fetchAll<OrderRow>((a, b) => c.from("orders").select("*").in("status", OPEN).order("id").range(a, b)),
    fetchAll<AdminRows["payments"][number]>((a, b) => c.from("payments").select("*").gte("created_at", sinceIso).order("id").range(a, b)),
    fetchAll<AdminRows["subscriptions"][number]>((a, b) => c.from("subscriptions").select("*").order("id").range(a, b)),
    fetchAll<AdminRows["generations"][number]>((a, b) => c.from("generations").select("id,order_id,cost_usd,status,created_at,parent_id,kind").gte("created_at", sinceIso).order("id").range(a, b)),
    fetchAll<CostRow>((a, b) => c.from("costs").select("*").gte("created_at", sinceIso).order("id").range(a, b)),
    fetchAll<AdSpendRow>((a, b) => c.from("ad_spend").select("*").gte("date", sinceIso.slice(0, 10)).order("id").range(a, b)),
    fetchAll<AdminRows["profiles"][number]>((a, b) => c.from("profiles").select("id,email,role,created_at").order("id").range(a, b)),
    fetchAll<AdminRows["waitlist"][number]>((a, b) => c.from("waitlist").select("id,email,gender,locale,source,created_at").order("id").range(a, b)),
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
/*  Same raw rows as above, but USD / EUR amounts are converted with    */
/*  the fx_rates table (kept by an admin) instead of fixed defaults.    */
/*  When a rate is missing the converted value is null and the          */
/*  currency is listed in `fxMissing`, never silently counted as zero.  */
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

export interface FxRate {
  currency: string;
  /** KWD per one unit of the currency */
  kwd_per_unit: number;
  updated_at: string | null;
}
export type FxCurrency = "USD" | "EUR";
export const FX_EDITABLE: FxCurrency[] = ["USD", "EUR"];

// Demo mode keeps the rates here (the mock backend has no fx_rates table).
const MOCK_FX_KEY = "admin-demo-fx-rates";
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
  mockFx ??= [
    { currency: "USD", kwd_per_unit: FX_TO_KWD.USD, updated_at: null },
    { currency: "EUR", kwd_per_unit: FX_TO_KWD.EUR, updated_at: null },
  ];
  return mockFx;
}

/** All rows of fx_rates (KWD is always 1). Admin only (RLS). */
export async function listFxRates(): Promise<FxRate[]> {
  if (backendMode === "mock") return [{ currency: "KWD", kwd_per_unit: 1, updated_at: null }, ...demoFx()];
  const rows = check(await sb().from("fx_rates").select("currency,kwd_per_unit,updated_at").order("currency"));
  return ((rows ?? []) as FxRate[]).map((r) => ({ ...r, kwd_per_unit: num(r.kwd_per_unit) }));
}

/** Set the rate for USD or EUR (KWD per 1 unit). Admin only: the "fx_rates: admin all" policy allows the upsert. */
export async function saveFxRate(currency: FxCurrency, kwdPerUnit: number): Promise<FxRate> {
  if (!FX_EDITABLE.includes(currency)) throw new BackendError("Only USD and EUR rates can be edited here.", "invalid_currency");
  if (!Number.isFinite(kwdPerUnit) || kwdPerUnit <= 0 || kwdPerUnit > 100) throw new BackendError(`Enter the KWD value of 1 ${currency} (a number above 0).`, "invalid_rate");
  const row: FxRate = { currency, kwd_per_unit: round(kwdPerUnit, 6), updated_at: new Date().toISOString() };
  if (backendMode === "mock") {
    mockFx = [...demoFx().filter((r) => r.currency !== currency), row].sort((a, b) => a.currency.localeCompare(b.currency));
    try {
      sessionStorage.setItem(MOCK_FX_KEY, JSON.stringify(mockFx));
    } catch {
      /* storage blocked: kept in memory */
    }
    invalidate();
    return row;
  }
  const saved = check(await sb().from("fx_rates").upsert(row, { onConflict: "currency" }).select("currency,kwd_per_unit,updated_at").single()) as FxRate;
  invalidate();
  return { ...saved, kwd_per_unit: num(saved.kwd_per_unit) };
}

/* ------------------------------- MRR ------------------------------- */

export interface MrrSummary {
  /** active subscriptions, monthly equivalent, KWD; null when an amount or rate is missing */
  mrrKwd: number | null;
  /** what trialing members will add once they pay */
  trialingMrrKwd: number | null;
  active: number;
  trialing: number;
  pastDue: number;
  cancelling: number;
  byPlan: { plan: string; active: number; trialing: number; mrrKwd: number | null }[];
  /** true when v_mrr reports a missing amount or rate */
  dataMissing: boolean;
  source: "v_mrr" | "computed";
}

function computeMrr(rows: AdminRows): MrrSummary {
  // Same as v_mrr: the included month (no payment) is left out.
  const subs = rows.subscriptions.filter((s) => s.plan !== "included");
  const plans = [...new Set(subs.map((s) => s.plan))];
  const mrrOf = (status: SubscriptionStatus, plan?: string) => round(sum(subs.filter((s) => s.status === status && (!plan || s.plan === plan)).map((s) => monthlyEquivalentKwd(s.plan))));
  return {
    mrrKwd: mrrOf("active"),
    trialingMrrKwd: mrrOf("trialing"),
    active: subs.filter((s) => s.status === "active").length,
    trialing: subs.filter((s) => s.status === "trialing").length,
    pastDue: subs.filter((s) => s.status === "past_due").length,
    cancelling: subs.filter((s) => (s.status === "active" || s.status === "trialing") && s.cancel_at).length,
    byPlan: plans.map((plan) => ({
      plan,
      active: subs.filter((s) => s.plan === plan && s.status === "active").length,
      trialing: subs.filter((s) => s.plan === plan && s.status === "trialing").length,
      mrrKwd: mrrOf("active", plan),
    })),
    dataMissing: false,
    source: "computed",
  };
}

interface MrrViewRow {
  plan: string;
  active: number | string;
  trialing: number | string;
  past_due: number | string;
  cancelling: number | string;
  mrr_kwd: number | string | null;
  trialing_mrr_kwd: number | string | null;
  data_missing: boolean | null;
}

/** MRR from the v_mrr view (amounts and fx as stored); the demo computes it from list prices. */
export async function fetchMrr(rows: AdminRows): Promise<MrrSummary> {
  if (backendMode === "mock") return computeMrr(rows);
  const view = (check(await sb().from("v_mrr").select("*")) ?? []) as MrrViewRow[];
  const missing = view.some((v) => v.data_missing);
  const total = (k: "mrr_kwd" | "trialing_mrr_kwd") => (missing ? null : round(sum(view.map((v) => num(v[k])))));
  return {
    mrrKwd: total("mrr_kwd"),
    trialingMrrKwd: total("trialing_mrr_kwd"),
    active: sum(view.map((v) => num(v.active))),
    trialing: sum(view.map((v) => num(v.trialing))),
    pastDue: sum(view.map((v) => num(v.past_due))),
    cancelling: sum(view.map((v) => num(v.cancelling))),
    byPlan: view.map((v) => ({ plan: v.plan, active: num(v.active), trialing: num(v.trialing), mrrKwd: v.data_missing ? null : round(num(v.mrr_kwd)) })),
    dataMissing: missing,
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
  created_at: string;
}

/** Every waitlist entry, newest first. Admin only (RLS). */
export async function listWaitlistEntries(fallback: AdminRows["waitlist"] = []): Promise<AdminWaitlistEntry[]> {
  if (backendMode === "mock") {
    return fallback.map((w) => ({ id: w.id, email: w.email ?? null, gender: w.gender, locale: w.locale ?? null, source: w.source ?? null, created_at: w.created_at })).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  return fetchAll<AdminWaitlistEntry>((a, b) => sb().from("waitlist").select("id,email,gender,locale,source,created_at").order("created_at", { ascending: false }).order("id").range(a, b));
}

export function waitlistToCsv(rows: AdminWaitlistEntry[]): string {
  return toCsv(["email", "gender", "locale", "source", "created_at"], rows as unknown as Record<string, unknown>[]);
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
  /** payments of the order after refunds, KWD (null when a rate is missing) */
  revenueKwd: number | null;
  refundedKwd: number | null;
  paymentFeeKwd: number | null;
  imageCostUsd: number;
  imageCostKwd: number | null;
  otherCostKwd: number | null;
  marginKwd: number | null;
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
  revenueKwd: number | null;
  grossRevenueKwd: number | null;
  refundedKwd: number | null;
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
  mrr: MrrSummary;
}

export interface UnitEconomics {
  /** paid orders created in the range */
  orders: number;
  revenueKwd: number | null;
  paymentFeeKwd: number | null;
  imageCostUsd: number;
  imageCostKwd: number | null;
  otherCostKwd: number | null;
  marginKwd: number | null;
  /** margin / revenue, 0..1 */
  marginShare: number | null;
  perOrder: { revenueKwd: number | null; paymentFeeKwd: number | null; imageCostKwd: number | null; marginKwd: number | null };
  /** customers with an account (deleted accounts are left out of per-customer figures) */
  customers: number;
  deletedAccountOrders: number;
  membershipRevenueKwd: number | null;
  perCustomer: { revenueKwd: number | null; marginKwd: number | null; orders: number | null };
  generations: number;
  regenerations: number | null;
  ordersWithGenerations: number;
  imageCostPerOrderKwd: number | null;
  imageCostPerGenerationUsd: number | null;
  imageCostPerGenerationKwd: number | null;
}

export interface MarketingDay {
  date: string;
  spendKwd: number | null;
  impressions: number;
  clicks: number;
  /** purchases the ad platform reports (its own attribution) */
  purchases: number;
  /** customers whose first report was paid that day (all channels) */
  newCustomers: number;
  revenueKwd: number | null;
  /** spend / new paying customers that day (blended, all channels) */
  cacKwd: number | null;
  /** net revenue that day / spend (blended) */
  roas: number | null;
}

export interface MarketingCampaign {
  platform: AdSpendRow["platform"];
  campaign_id: string;
  campaign_name: string | null;
  spendKwd: number | null;
  impressions: number;
  clicks: number;
  purchases: number;
  ctr: number | null;
  /** spend / platform-reported purchases */
  cpaKwd: number | null;
  /** platform purchases x average report payment / spend: an estimate */
  estRoas: number | null;
}

export interface MarketingSummary {
  hasRows: boolean;
  spendKwd: number | null;
  impressions: number;
  clicks: number;
  purchases: number;
  ctr: number | null;
  newPayingCustomers: number;
  cacKwd: number | null;
  roas: number | null;
  days: MarketingDay[];
  campaigns: MarketingCampaign[];
  currencies: string[];
}

export interface OperatorDailyPoint {
  date: string;
  revenueKwd: number | null;
  adSpendKwd: number | null;
  orders: number;
}

export interface OperatorDashboard {
  generatedAt: string;
  range: AdminRange;
  kpis: OperatorKpis;
  daily: OperatorDailyPoint[];
  statusCounts: { status: OrderStatus; count: number }[];
  orders: OperatorOrder[];
  economics: UnitEconomics;
  marketing: { meta: MarketingSummary; all: MarketingSummary };
  waitlist: { total: number; women: number; men: number; unknown: number; last7d: number; entries: AdminWaitlistEntry[]; emailsAvailable: boolean };
  fx: FxRate[];
  /** currencies that appear in the data but have no rate in fx_rates */
  fxMissing: string[];
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
const roundN = (x: N, d = 3): N => (x == null ? null : round(x, d));
const divN = (a: N, b: N, d = 3): N => (a == null || b == null || b === 0 ? null : round(a / b, d));

/** Pure: the operator dashboard from raw rows and fx rates (shared by Supabase and demo mode). */
export function computeOperatorDashboard(input: OperatorInput, range: AdminRange, now = Date.now()): OperatorDashboard {
  const { rows, rates, mrr, regenerated, waitlist } = input;
  const from = adminRangeStart(range, now);
  const rate = new Map(rates.map((r) => [r.currency.toUpperCase(), r.kwd_per_unit]));
  rate.set("KWD", 1);
  const missing = new Set<string>();
  const conv = (amount: number, currency: string | null | undefined): N => {
    if (!amount) return 0;
    const c = (currency ?? "KWD").toUpperCase();
    const r = rate.get(c);
    if (r == null) {
      missing.add(c);
      return null;
    }
    return amount * r;
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
    const revenueKwd = addN(pays.map((p) => conv(revenueOf(p), p.currency)));
    const refundedKwd = addN(pays.filter((p) => p.status === "refunded").map((p) => conv(Math.abs(p.amount), p.currency)));
    const paymentFeeKwd = addN(pays.map((p) => conv(p.fee, p.currency)));
    const imageCostUsd = sum(gens.map((g) => g.cost_usd));
    const imageCostKwd = conv(imageCostUsd, "USD");
    const otherCostKwd = addN((otherBy.get(o.id) ?? []).map((c) => conv(c.amount, c.currency)));
    const marginKwd = addN([revenueKwd, paymentFeeKwd == null ? null : -paymentFeeKwd, imageCostKwd == null ? null : -imageCostKwd, otherCostKwd == null ? null : -otherCostKwd]);
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
      revenueKwd: roundN(revenueKwd),
      refundedKwd: roundN(refundedKwd),
      paymentFeeKwd: roundN(paymentFeeKwd),
      imageCostUsd: round(imageCostUsd, 4),
      imageCostKwd: roundN(imageCostKwd),
      otherCostKwd: roundN(otherCostKwd),
      marginKwd: roundN(marginKwd),
      generations: gens.length,
      regenerations: regenerated ? gens.filter((g) => regenerated.has(g.id)).length : null,
      overdue: OPEN_S.includes(o.status) && !!o.due_at && Date.parse(o.due_at) < now,
      fxMissing: [revenueKwd, paymentFeeKwd, imageCostKwd, otherCostKwd].some((x) => x == null),
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
    revenueKwd: gross == null || refunds == null ? null : round(gross - refunds),
    grossRevenueKwd: roundN(gross),
    refundedKwd: roundN(refunds),
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
    return { date, revenueKwd: roundN(addN(x.rev)), adSpendKwd: roundN(addN(x.ad)), orders: x.orders };
  });

  /* orders by status (created in the range) */
  const statusCounts = ORDER_STATUS_ORDER.map((status) => ({ status, count: rows.orders.filter((o) => o.status === status && createdIn(o)).length })).filter((s) => s.count > 0);

  /* unit economics */
  const tot = (k: "revenueKwd" | "paymentFeeKwd" | "imageCostKwd" | "otherCostKwd" | "marginKwd") => roundN(addN(paidInRange.map((o) => o[k])));
  const n = paidInRange.length;
  const generations = sum(paidInRange.map((o) => o.generations));
  const regenerations = regenerated ? sum(paidInRange.map((o) => o.regenerations ?? 0)) : null;
  const withGens = paidInRange.filter((o) => o.generations > 0);
  const imageCostUsd = round(sum(paidInRange.map((o) => o.imageCostUsd)), 4);
  const imageCostKwd = tot("imageCostKwd");
  const revenueKwd = tot("revenueKwd");
  const marginKwd = tot("marginKwd");
  // Per customer: order economics plus membership payments, for customers with an account.
  const memberPays = pays.filter((p) => !p.order_id && countsForRevenue(p));
  const membershipRevenueKwd = roundN(addN(memberPays.map((p) => conv(revenueOf(p), p.currency))));
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
    x.revenue.push(o.revenueKwd);
    x.margin.push(o.marginKwd);
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
    revenueKwd,
    paymentFeeKwd: tot("paymentFeeKwd"),
    imageCostUsd,
    imageCostKwd,
    otherCostKwd: tot("otherCostKwd"),
    marginKwd,
    marginShare: revenueKwd && marginKwd != null && revenueKwd > 0 ? round(marginKwd / revenueKwd, 3) : null,
    perOrder: {
      revenueKwd: divN(revenueKwd, n),
      paymentFeeKwd: divN(tot("paymentFeeKwd"), n),
      imageCostKwd: divN(imageCostKwd, n),
      marginKwd: divN(marginKwd, n),
    },
    customers: custList.length,
    deletedAccountOrders: paidInRange.filter((o) => !o.user_id).length,
    membershipRevenueKwd,
    perCustomer: {
      revenueKwd: divN(addN(custList.flatMap((x) => x.revenue)), custList.length),
      marginKwd: divN(addN(custList.flatMap((x) => x.margin)), custList.length),
      orders: divN(sum(custList.map((x) => x.orders)), custList.length, 2),
    },
    generations,
    regenerations,
    ordersWithGenerations: withGens.length,
    imageCostPerOrderKwd: divN(addN(withGens.map((o) => o.imageCostKwd)), withGens.length),
    imageCostPerGenerationUsd: generations ? round(imageCostUsd / generations, 4) : null,
    imageCostPerGenerationKwd: divN(imageCostKwd, generations),
  };

  /* marketing */
  const reportPays = pays.filter((p) => p.status === "succeeded" && p.order_id);
  const reportPayKwd = addN(reportPays.map((p) => conv(p.amount, p.currency)));
  const avgReportKwd = reportPays.length ? divN(reportPayKwd, reportPays.length) : null;
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
        const spendKwd = roundN(addN(list.map((a) => conv(a.spend, a.currency))));
        const dp = daily.find((x) => x.date === date);
        // No point for the day means no revenue (0); a point with null revenue means a rate is missing (keep null).
        const dayRevenue: N = dp ? dp.revenueKwd : 0;
        const newCustomers = firstPaid.get(date) ?? 0;
        return {
          date,
          spendKwd,
          impressions: sum(list.map((a) => a.impressions)),
          clicks: sum(list.map((a) => a.clicks)),
          purchases: sum(list.map((a) => a.purchases)),
          newCustomers,
          revenueKwd: dayRevenue,
          cacKwd: divN(spendKwd, newCustomers),
          roas: divN(dayRevenue, spendKwd, 2),
        };
      });
    const byCamp = new Map<string, AdSpendRow[]>();
    for (const a of ads) byCamp.set(`${a.platform}:${a.campaign_id}`, [...(byCamp.get(`${a.platform}:${a.campaign_id}`) ?? []), a]);
    const campaigns: MarketingCampaign[] = [...byCamp.values()].map((list) => {
      const spendKwd = roundN(addN(list.map((a) => conv(a.spend, a.currency))));
      const impressions = sum(list.map((a) => a.impressions));
      const clicks = sum(list.map((a) => a.clicks));
      const purchases = sum(list.map((a) => a.purchases));
      return {
        platform: list[0].platform,
        campaign_id: list[0].campaign_id,
        campaign_name: list.map((a) => a.campaign_name).filter(Boolean).pop() ?? null,
        spendKwd,
        impressions,
        clicks,
        purchases,
        ctr: impressions ? round(clicks / impressions, 4) : null,
        cpaKwd: divN(spendKwd, purchases),
        estRoas: avgReportKwd == null ? null : divN(purchases * avgReportKwd, spendKwd, 2),
      };
    });
    campaigns.sort((a, b) => (b.spendKwd ?? 0) - (a.spendKwd ?? 0));
    const spendKwd = roundN(addN(ads.map((a) => conv(a.spend, a.currency))));
    const impressions = sum(ads.map((a) => a.impressions));
    const clicks = sum(ads.map((a) => a.clicks));
    const newPaying = sum([...firstPaid.values()]);
    return {
      hasRows: ads.length > 0,
      spendKwd,
      impressions,
      clicks,
      purchases: sum(ads.map((a) => a.purchases)),
      ctr: impressions ? round(clicks / impressions, 4) : null,
      newPayingCustomers: newPaying,
      cacKwd: divN(spendKwd, newPaying),
      roas: divN(kpis.revenueKwd, spendKwd, 2),
      days: mdays,
      campaigns,
      currencies: [...new Set(ads.map((a) => a.currency.toUpperCase()))],
    };
  };

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
    marketing: { meta: marketingFor("meta"), all: marketingFor(null) },
    waitlist: waitlistSummary,
    fx: rates,
    fxMissing: [],
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

/** Fetch everything the operator dashboard needs for a range. Admin only (RLS). */
export async function loadOperatorDashboard(range: AdminRange): Promise<OperatorDashboard> {
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
  return computeOperatorDashboard({ rows, rates, mrr, regenerated, waitlist, warnings }, range, now);
}

export function useOperatorDashboard(range: AdminRange, enabled = true): QueryState<OperatorDashboard> {
  return useBackendQuery(backendMode === "off" || !enabled ? null : `admin-op:${range}`, () => loadOperatorDashboard(range));
}
