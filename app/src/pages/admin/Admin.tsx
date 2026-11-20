/*
 * Operator dashboard (/admin): revenue, unit economics, marketing, orders,
 * waitlist and exchange rates. Admin accounts only; English only.
 *
 * Data comes from useOperatorDashboard (lib/backend/admin.ts): the same rows
 * in Supabase and demo mode (VITE_BACKEND_MOCK=1). Customers pay in their
 * country's currency (KWD, SAR, AED, QAR, BHD, OMR); every amount is shown
 * in the selected currency (EUR, the books' currency, by default; KWD or
 * USD on request), converted with the fx_rates table. A missing rate shows
 * as "rate missing", never as zero. The Markets table keeps the raw amounts
 * per country and currency.
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Empty, Toggle } from "../../components/ui";
import { BRAND_NAME } from "../../lib/brand";
import {
  ADMIN_AUDIT_ACTIONS,
  ADMIN_RANGES,
  DEFAULT_REPORT_CURRENCY,
  ORDER_STATUS_ORDER,
  REPORT_CURRENCIES,
  SLA_HOURS,
  backendMode,
  isIncluded,
  isMock,
  mockBackend,
  fxStale,
  operatorOrdersToCsv,
  saveFxPeg,
  saveFxRate,
  signOut,
  supabase,
  toAuditEvent,
  useBackendQuery,
  useOperatorDashboard,
  useRole,
  useSession,
  waitlistToCsv,
  type AdminAuditEvent,
  type AdminRange,
  type FxRate,
  type MarketingSummary,
  type OperatorDashboard,
  type OperatorOrder,
  type OrderStatus,
  type ReportCurrency,
  type SubscriptionRow,
} from "../../lib/backend";
import { countryName } from "../../lib/pricing";
import { StaffOnly } from "../review/StaffOnly";
import { ENGLISH_ONLY } from "../review/serverShared";
import { BarList, LineChart, SERIES } from "./charts";
import "../pages.css";
import "./admin.css";

/* ------------------------------ Format ----------------------------- */

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Pending payment",
  paid: "Paid",
  awaiting_photos: "Awaiting photos",
  in_review: "In review",
  changes_requested: "Changes requested",
  delivered: "Delivered",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

const int = (n: number) => n.toLocaleString("en");
const kwdNum = (n: number, d = 3) => n.toLocaleString("en", { minimumFractionDigits: d, maximumFractionDigits: d });
/** Decimals shown for a currency: 3 for the dinars and the rial (KWD, BHD, OMR), 2 otherwise. */
const decimals = (cur: string) => (cur === "KWD" || cur === "BHD" || cur === "OMR" ? 3 : 2);
const fmtMoney = (n: number, cur: string) => `${kwdNum(n, decimals(cur))} ${cur}`;
/** The currency every dashboard amount is shown in. */
const CurrencyCtx = createContext<string>(DEFAULT_REPORT_CURRENCY);
const country = (code: string | null | undefined) => (code ? `${countryName(code, "en")} (${code})` : "Not recorded");
const pct = (x: number | null, d = 0) => (x == null ? "—" : `${(x * 100).toFixed(d)}%`);
const ratio = (x: number | null) => (x == null ? "—" : `${x.toFixed(2)}×`);
const dateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kuwait" }) : "—";
const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/**
 * An amount in the dashboard currency (or `cur`); null means a needed
 * exchange rate is missing (or nothing to show).
 */
function Money({ v, fx, d, plain, cur }: { v: number | null | undefined; fx: boolean; d?: number; plain?: boolean; cur?: string }) {
  const ctx = useContext(CurrencyCtx);
  const c = cur ?? ctx;
  if (v == null) return fx ? <span className="ad-missing">rate missing</span> : <span className="ad-dim">—</span>;
  return (
    <span className={`ad-num${!plain && v < 0 ? " is-neg" : ""}`}>
      {kwdNum(v, d ?? decimals(c))}
      <small> {c}</small>
    </span>
  );
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const stamp = () => new Date().toISOString().slice(0, 10);

/* ------------------------------ Page ------------------------------- */

export function Admin() {
  return (
    <div className="ad" {...ENGLISH_ONLY}>
      <TopBar />
      <main className="ad-main">
        <Gate />
      </main>
    </div>
  );
}

function TopBar() {
  const { session } = useSession();
  const { role } = useRole();
  return (
    <header className="ad-top">
      <div className="ad-top-in">
        <Link to="/" className="ad-brand">
          {BRAND_NAME} <span>Operator</span>
        </Link>
        <nav className="ad-top-nav">
          {isMock && <span className="ad-chip">Demo data</span>}
          {session && (role === "admin" || role === "reviewer") && <Link to="/review">Review console</Link>}
          {session && (
            <button type="button" onClick={() => void signOut()}>
              Sign out
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}

function Gate() {
  const { role, loading } = useRole();
  if (backendMode === "off")
    return (
      <Empty title="Online service not configured">
        The dashboard reads from Supabase. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, or VITE_BACKEND_MOCK=1 for demo data.
      </Empty>
    );
  if (loading) return <div className="ad-loading" aria-busy="true" />;
  if (role === "admin") return <Dashboard />;
  // The same in-place sign-in as the review console; the email link comes back to /admin.
  return <StaffOnly need="admin" />;
}

const RANGE_KEY = "admin-range";
function readRange(): AdminRange {
  try {
    const v = localStorage.getItem(RANGE_KEY);
    if (v && ADMIN_RANGES.some((r) => r.value === v)) return v as AdminRange;
  } catch {
    /* storage blocked */
  }
  return "30d";
}

const CURRENCY_KEY = "admin-currency";
function readCurrency(): ReportCurrency {
  try {
    const v = localStorage.getItem(CURRENCY_KEY);
    if (v && (REPORT_CURRENCIES as readonly string[]).includes(v)) return v as ReportCurrency;
  } catch {
    /* storage blocked */
  }
  return DEFAULT_REPORT_CURRENCY;
}
const CURRENCY_OPTIONS = REPORT_CURRENCIES.map((c) => ({ value: c, label: c }));

function Dashboard() {
  const [range, setRange] = useState<AdminRange>(readRange);
  const [currency, setCurrency] = useState<ReportCurrency>(readCurrency);
  const q = useOperatorDashboard(range, true, currency);
  const members = useIncludedMembers();
  // Keep the previous frame while a new range loads (no flash, no layout jump).
  const last = useRef<OperatorDashboard | undefined>(undefined);
  if (q.data) last.current = q.data;
  const data = q.data ?? last.current;

  const chooseCurrency = (c: ReportCurrency) => {
    setCurrency(c);
    try {
      localStorage.setItem(CURRENCY_KEY, c);
    } catch {
      /* storage blocked */
    }
  };
  const choose = (r: AdminRange) => {
    setRange(r);
    try {
      localStorage.setItem(RANGE_KEY, r);
    } catch {
      /* storage blocked */
    }
  };

  return (
    <CurrencyCtx.Provider value={data?.currency ?? currency}>
      <div className="ad-head">
        <div>
          <h1 className="title-lg">
            <span className="hl">Operator</span> dashboard
          </h1>
          <p className="ad-sub">
            {data
              ? `Updated ${dateTime(data.generatedAt)} (Kuwait time). Amounts in ${data.currency}${data.currency === "EUR" ? " (the books' currency)" : ", converted from EUR rates"}; per-country amounts in their own currency under Markets.`
              : "Loading…"}
            {q.loading && data ? " Refreshing…" : ""}
          </p>
        </div>
        <div className="ad-filters">
          <Toggle value={currency} options={CURRENCY_OPTIONS} onChange={chooseCurrency} />
          <Toggle value={range} options={ADMIN_RANGES} onChange={choose} />
          <button type="button" className="btn btn-ghost ad-btn-sm" onClick={q.refresh} disabled={q.loading}>
            Refresh
          </button>
        </div>
      </div>

      {q.error && (
        <div className="ad-alert" role="alert">
          Could not load the dashboard: {q.error.message}
        </div>
      )}
      {!data && !q.error && <div className="ad-loading" aria-busy="true" />}
      {data && (
        <div className={`ad-body${q.loading ? " is-stale" : ""}`}>
          {data.fxMissing.length > 0 && (
            <div className="ad-alert is-warn" role="status">
              No exchange rate for {data.fxMissing.join(", ")}: amounts in {data.fxMissing.length > 1 ? "these currencies" : "this currency"} show as "rate missing". Set the rate under Exchange rates
              below.
            </div>
          )}
          {data.fxStale.length > 0 && (
            <div className="ad-alert is-warn" role="status">
              {`Exchange rate${data.fxStale.length > 1 ? "s" : ""} for ${data.fxStale.join(", ")} ${data.fxStale.length > 1 ? "are" : "is"} out of date (KWD needs a daily update). Update under Exchange rates below.`}
            </div>
          )}
          {data.warnings.map((w) => (
            <div key={w} className="ad-alert is-warn" role="status">
              {w}
            </div>
          ))}
          <Attention d={data} />
          <KpiRow d={data} members={members} />
          <div className="ad-grid-2 is-wide-first">
            <Section title="Revenue and ad spend per day" note="Revenue after refunds by payment date; ad spend all platforms. Kuwait days.">
              <RevenueChart d={data} />
            </Section>
            <Section title="Orders by status" note="Orders created in the range.">
              {data.statusCounts.length ? (
                <BarList rows={data.statusCounts.map((s) => ({ key: s.status, label: STATUS_LABEL[s.status], value: s.count }))} unit="orders" />
              ) : (
                <p className="ad-dim">No orders in this range.</p>
              )}
            </Section>
          </div>
          <Economics d={data} />
          <Markets d={data} />
          <Marketing d={data} />
          <Orders d={data} />
          <div className="ad-grid-2">
            <Waitlist d={data} />
            <FxEditor d={data} />
          </div>
        </div>
      )}
    </CurrencyCtx.Provider>
  );
}

function Section({ title, note, right, children, id }: { title: string; note?: ReactNode; right?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="ad-card" id={id} aria-labelledby={id ? `${id}-h` : undefined}>
      <div className="ad-card-head">
        <div>
          <h2 id={id ? `${id}-h` : undefined}>{title}</h2>
          {note && <p className="ad-card-note">{note}</p>}
        </div>
        {right && <div className="ad-card-right">{right}</div>}
      </div>
      {children}
    </section>
  );
}

/* ---------------------- Included memberships ----------------------- */

interface IncludedMembers {
  /** included months running now (a report bought on its own: 30 days, no renewal) */
  active: number;
  /** of those, ending within 7 days */
  endingSoon: number;
}

/**
 * Included months are counted on their own: no payment, so never in MRR and
 * not among paying members. v_mrr and computeMrr already leave them out.
 */
async function loadIncludedMembers(): Promise<IncludedMembers> {
  let subs: Pick<SubscriptionRow, "plan" | "status" | "current_period_end">[];
  if (isMock) subs = (await mockBackend.adminRows(new Date().toISOString())).subscriptions;
  else {
    const { data, error } = await supabase!.from("subscriptions").select("plan,status,current_period_end").eq("plan", "included").eq("status", "active");
    if (error) throw new Error(error.message);
    subs = (data ?? []) as typeof subs;
  }
  const now = Date.now();
  const running = subs.filter((s) => isIncluded(s as SubscriptionRow) && s.status === "active" && (!s.current_period_end || Date.parse(s.current_period_end) > now));
  return {
    active: running.length,
    endingSoon: running.filter((s) => s.current_period_end && Date.parse(s.current_period_end) - now < 7 * 86_400_000).length,
  };
}

function useIncludedMembers(): IncludedMembers | undefined {
  return useBackendQuery("admin:included", loadIncludedMembers).data;
}

/* -------------------------- Needs attention ------------------------- */

const AUDIT_LIMIT = 200;
const ATTENTION_DAYS = 30;

/** audit_log rows of ADMIN_AUDIT_ACTIONS, newest first (the same mapping as fetchAdminRows' auditEvents). */
async function loadAuditEvents(): Promise<AdminAuditEvent[]> {
  if (isMock) return (await mockBackend.adminRows(new Date().toISOString())).auditEvents;
  const { data, error } = await supabase!
    .from("audit_log")
    .select("id,action,target_type,target_id,meta,at")
    .in("action", [...ADMIN_AUDIT_ACTIONS])
    .order("at", { ascending: false })
    .limit(AUDIT_LIMIT);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toAuditEvent);
}

const ACTION_LABEL: Record<AdminAuditEvent["action"], string> = {
  "orders.cancelled_consent_withdrawn": "Cancelled: photo consent withdrawn",
  "stripe.schedule_failed": "Yearly schedule failed",
  "orders.changes_requested": "Changes requested",
  "checkout.country_mismatch": "Billing country differs",
};

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const amount = (v: unknown): number | null => (typeof v === "number" ? v : typeof v === "string" && v.trim() && !Number.isNaN(Number(v)) ? Number(v) : null);

/**
 * What the refund policy suggests for an order cancelled because the customer
 * withdrew photo consent (audit meta refund_policy, written by the server).
 * Partial refunds are left to the operator: the amount is not computed here.
 */
function suggestedRefund(details: Record<string, unknown>): { text: string; tone?: "warn" } {
  const policy = str(details.refund_policy);
  const amt = amount(details.amount);
  const cur = str(details.currency) ?? "KWD";
  const price = amt == null ? "the price paid" : fmtMoney(amt, cur);
  if (policy === "full") return { text: `Full refund: ${price} (review had not started)`, tone: "warn" };
  if (policy === "partial") return { text: `Partial refund: ${price} less a fair amount for the review work already done. Decide the amount and refund in Stripe.`, tone: "warn" };
  if (policy && policy.startsWith("none")) return { text: "No refund: included check-in, nothing was paid" };
  return { text: policy ? `Refund policy: ${policy}` : "Check the refund policy" };
}

function eventSummary(e: AdminAuditEvent): { what: string; action?: { text: string; tone?: "warn" } } {
  const x = e.details;
  if (e.action === "orders.cancelled_consent_withdrawn") {
    const from = str(x.from);
    const started = x.review_started === true ? "review had started" : x.review_started === false ? "review had not started" : null;
    const waiver = x.withdrawal_waiver === true ? "withdrawal waiver on record" : x.withdrawal_waiver === false ? "no withdrawal waiver on record" : null;
    return { what: [from ? `Was ${STATUS_LABEL[from as OrderStatus]?.toLowerCase() ?? from}` : null, started, waiver].filter(Boolean).join(" · "), action: suggestedRefund(x) };
  }
  if (e.action === "stripe.schedule_failed") {
    const sub = str(x.subscription) ?? str(x.subscriptions_id);
    const on = str(x.on);
    const err = str(x.error);
    return {
      what: [sub ? `Subscription ${sub}` : null, on ? `on ${on}` : null, err].filter(Boolean).join(" · "),
      action: {
        text: "The Stripe schedule that moves this yearly plan to the monthly price (same currency) after its 12 months could not be set up. Create it in Stripe by hand before the year ends.",
        tone: "warn",
      },
    };
  }
  if (e.action === "checkout.country_mismatch") {
    const chosen = str(x.country);
    const billing = str(x.billing_country);
    const cur = str(x.currency);
    return {
      what: [chosen ? `Chose ${chosen}${cur ? ` (paid in ${cur})` : ""}` : null, billing ? `card billing address in ${billing}` : null].filter(Boolean).join(" · "),
      action: { text: "The sale went through at the chosen country's price. Check with your accountant which country's VAT applies." },
    };
  }
  const throttled = x.throttled === true;
  const emailed = x.emailed === true ? "customer emailed" : throttled ? "email skipped (3 already sent for this order this hour)" : x.emailed === false ? "email NOT sent" : null;
  const msg = x.with_message === true ? "with a message" : x.with_message === false ? "no message" : null;
  return {
    what: [emailed, msg].filter(Boolean).join(" · "),
    action:
      x.emailed === false && !throttled
        ? { text: "Let the customer know another way.", tone: "warn" }
        : { text: "Waiting for the customer to send new photos." },
  };
}

function Attention({ d }: { d: OperatorDashboard }) {
  const q = useBackendQuery("admin:audit", loadAuditEvents);
  const [kind, setKind] = useState<AdminAuditEvent["action"] | "all">("all");
  const [showAll, setShowAll] = useState(false);
  const byOrder = useMemo(() => new Map(d.orders.map((o) => [o.order_id, o])), [d.orders]);
  const since = Date.now() - ATTENTION_DAYS * 86_400_000;
  const all = q.data ?? [];
  // Open items: a changes request only while the order is still waiting on the customer; a refund until the order is refunded.
  const open = all.filter((e) => {
    const o = e.order_id ? byOrder.get(e.order_id) : undefined;
    // an order outside the dashboard's range: fall back to the time window
    if (!o) return Date.parse(e.created_at) >= since;
    if (e.action === "orders.changes_requested") return o.status === "changes_requested";
    if (e.action === "orders.cancelled_consent_withdrawn") {
      // nothing to refund (included check-in): informational, like the time window
      if (str(e.details.refund_policy)?.startsWith("none")) return Date.parse(e.created_at) >= since;
      // handled once any refund is recorded (a partial refund leaves the order "cancelled")
      return o.status !== "refunded" && !((o.refundedRep ?? 0) > 0);
    }
    return Date.parse(e.created_at) >= since;
  });
  const list = (showAll ? all : open).filter((e) => kind === "all" || e.action === kind);
  const count = (a: AdminAuditEvent["action"]) => open.filter((e) => e.action === a).length;
  const shown = list.slice(0, 30);
  return (
    <Section
      title="Needs attention"
      id="attention"
      note={`Consent-withdrawn cancellations (with the refund the policy suggests), failed yearly schedules, changes requests and checkouts whose billing country differs from the chosen one, from the audit log. ${showAll ? `Showing the last ${AUDIT_LIMIT} events.` : `Open items (and anything from the last ${ATTENTION_DAYS} days whose order is outside the range).`}`}
      right={
        <label className="ad-check">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Include handled
        </label>
      }
    >
      {q.error && (
        <div className="ad-alert" role="alert">
          Could not load the audit log: {q.error.message}
        </div>
      )}
      {!q.data && !q.error ? (
        <p className="ad-dim" aria-busy="true">
          Loading…
        </p>
      ) : (
        <>
          <div className="ad-attn-filter" role="group" aria-label="Filter events">
            <button type="button" className={kind === "all" ? "on" : ""} onClick={() => setKind("all")}>
              {`All (${showAll ? all.length : open.length})`}
            </button>
            {ADMIN_AUDIT_ACTIONS.map((a) => (
              <button key={a} type="button" className={kind === a ? "on" : ""} onClick={() => setKind(a)}>
                {`${ACTION_LABEL[a]} (${showAll ? all.filter((e) => e.action === a).length : count(a)})`}
              </button>
            ))}
          </div>
          {!shown.length ? (
            <p className="ad-dim">Nothing needs attention.</p>
          ) : (
            <ul className="ad-attn">
              {shown.map((e) => {
                const s = eventSummary(e);
                const o = e.order_id ? byOrder.get(e.order_id) : undefined;
                return (
                  <li key={e.id} className={`ad-attn-item a-${e.action.replace(/\./g, "-")}`}>
                    <div className="ad-attn-top">
                      <b>{ACTION_LABEL[e.action] ?? e.action}</b>
                      <span className="ad-dim nowrap">{dateTime(e.created_at)}</span>
                    </div>
                    {s.what && <div className="ad-attn-what">{s.what}</div>}
                    {s.action && <div className={`ad-attn-do${s.action.tone ? ` is-${s.action.tone}` : ""}`}>{s.action.text}</div>}
                    {e.order_id && (
                      <div className="ad-attn-order">
                        {`Order ${e.order_id.slice(0, 8)}`}
                        {o ? ` · ${o.user_id ? o.email ?? "no email" : "deleted account"} · now ${STATUS_LABEL[o.status].toLowerCase()}` : ""}{" "}
                        <Link to={`/review/orders/${e.order_id}`} className="ad-link">
                          Open
                        </Link>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {list.length > shown.length && <p className="ad-note">{`${int(list.length - shown.length)} more not shown.`}</p>}
        </>
      )}
    </Section>
  );
}

/* ------------------------------- KPIs ------------------------------ */

function Stat({ label, children, sub, tone }: { label: string; children: ReactNode; sub?: ReactNode; tone?: "bad" | "warn" }) {
  return (
    <div className={`ad-stat${tone ? ` is-${tone}` : ""}`}>
      <div className="ad-stat-label">{label}</div>
      <div className="ad-stat-value">{children}</div>
      {sub && <div className="ad-stat-sub">{sub}</div>}
    </div>
  );
}

function KpiRow({ d, members }: { d: OperatorDashboard; members: IncludedMembers | undefined }) {
  const k = d.kpis;
  const fx = d.fxMissing.length > 0;
  const mrr = k.mrr;
  return (
    <div className="ad-kpis">
      <Stat label="Revenue after refunds" sub={k.refundedRep ? <>Refunds <Money v={k.refundedRep} fx={fx} plain /></> : "No refunds"}>
        <Money v={k.revenueRep} fx={fx} />
      </Stat>
      <Stat label="Gross revenue" sub="Before refunds">
        <Money v={k.grossRevenueRep} fx={fx} />
      </Stat>
      <Stat label="Refunds" tone={k.refundedRep ? "warn" : undefined}>
        <Money v={k.refundedRep} fx={fx} plain />
      </Stat>
      <Stat label="Orders" sub={`${int(k.delivered)} delivered in range`}>
        {int(k.orders)}
      </Stat>
      <Stat label="MRR" sub={mrr.trialing ? <>{int(mrr.trialing)} in trial (<Money v={mrr.trialingMrrRep} fx={mrr.dataMissing} plain /> once paying)</> : "Now, not range-bound"}>
        <Money v={mrr.mrrRep} fx={mrr.dataMissing} />
      </Stat>
      <Stat label="Active members" sub={[mrr.pastDue ? `${mrr.pastDue} past due` : null, mrr.cancelling ? `${mrr.cancelling} cancelling` : null].filter(Boolean).join(" · ") || "Paying subscriptions"} tone={mrr.pastDue ? "warn" : undefined}>
        {int(mrr.active)}
      </Stat>
      <Stat
        label="Included month"
        sub={members ? (members.endingSoon ? `${int(members.endingSoon)} end within 7 days · not paying, not in MRR` : "Not paying, not in MRR") : "Loading…"}
      >
        {members ? int(members.active) : <span className="ad-dim">—</span>}
      </Stat>
      <Stat label="Avg turnaround" sub={k.withinSlaShare == null ? "Submitted to delivered" : `${pct(k.withinSlaShare)} within ${SLA_HOURS}h`} tone={k.withinSlaShare != null && k.withinSlaShare < 0.9 ? "warn" : undefined}>
        {k.avgTurnaroundHours == null ? <span className="ad-dim">—</span> : `${k.avgTurnaroundHours} h`}
      </Stat>
      <Stat label="Open orders" sub={k.awaitingPhotos ? `${int(k.awaitingPhotos)} awaiting photos` : "In review or changes requested"}>
        {int(k.openOrders)}
      </Stat>
      <Stat label="Overdue now" sub={`Past the ${SLA_HOURS}h due time`} tone={k.overdueNow ? "bad" : undefined}>
        {int(k.overdueNow)}
      </Stat>
    </div>
  );
}

/* ------------------------------ Charts ----------------------------- */

function RevenueChart({ d }: { d: OperatorDashboard }) {
  const fx = d.fxMissing.length > 0;
  const fmt = (v: number | null) => (v == null ? (fx ? "rate missing" : "—") : fmtMoney(v, d.currency));
  const hasAds = d.daily.some((x) => x.adSpendRep);
  const series = [
    { key: "rev", name: "Revenue", color: SERIES.revenue, values: d.daily.map((x) => x.revenueRep) },
    ...(hasAds ? [{ key: "ads", name: "Ad spend", color: SERIES.adSpend, values: d.daily.map((x) => x.adSpendRep) }] : []),
  ];
  return (
    <>
      <LineChart dates={d.daily.map((x) => x.date)} series={series} unit={d.currency} format={fmt} />
      <details className="ad-details">
        <summary>Data table</summary>
        <div className="ad-table-wrap is-short">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Day</th>
                <th className="r">Revenue</th>
                <th className="r">Ad spend</th>
                <th className="r">Orders</th>
              </tr>
            </thead>
            <tbody>
              {[...d.daily].reverse().map((x) => (
                <tr key={x.date}>
                  <td>{day(x.date)}</td>
                  <td className="r">
                    <Money v={x.revenueRep} fx={fx} />
                  </td>
                  <td className="r">
                    <Money v={x.adSpendRep} fx={fx} plain />
                  </td>
                  <td className="r">{x.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

/* -------------------------- Unit economics ------------------------- */

function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="ad-row">
      <dt>
        {label}
        {hint && <small>{hint}</small>}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

function Economics({ d }: { d: OperatorDashboard }) {
  const e = d.economics;
  const fx = d.fxMissing.length > 0;
  const usdRate = d.fx.find((r) => r.currency === "USD");
  const target = d.fx.find((r) => r.currency === d.currency);
  const usdIn = usdRate?.eur_per_unit && (d.currency === "EUR" ? 1 : target?.eur_per_unit) ? usdRate.eur_per_unit / (d.currency === "EUR" ? 1 : target!.eur_per_unit!) : null;
  return (
    <Section
      title="Unit economics"
      id="economics"
      note={
        <>
          Paid orders created in the range ({int(e.orders)}). Image cost is converted from USD at{" "}
          {d.currency === "USD" ? "1:1" : usdIn ? `${usdIn.toFixed(decimals(d.currency) + 1)} ${d.currency} per USD` : <span className="ad-missing">rate missing</span>}. Gross margin = revenue − payment fees − image cost − other order costs.
        </>
      }
    >
      <div className="ad-grid-3">
        <dl className="ad-dl">
          <h3>Per order (average)</h3>
          <Row label="Revenue">
            <Money v={e.perOrder.revenueRep} fx={fx} />
          </Row>
          <Row label="Payment fee">
            <Money v={e.perOrder.paymentFeeRep} fx={fx} plain />
          </Row>
          <Row label="Image generation">
            <Money v={e.perOrder.imageCostRep} fx={fx} plain />
          </Row>
          <Row label="Gross margin" hint={e.marginShare == null ? undefined : `${pct(e.marginShare, 1)} of revenue`}>
            <Money v={e.perOrder.marginRep} fx={fx} />
          </Row>
        </dl>
        <dl className="ad-dl">
          <h3>Per customer (average)</h3>
          <Row label="Customers" hint={e.deletedAccountOrders ? `${e.deletedAccountOrders} order(s) from deleted accounts left out` : undefined}>
            {int(e.customers)}
          </Row>
          <Row label="Orders per customer">{e.perCustomer.orders == null ? "—" : e.perCustomer.orders.toFixed(2)}</Row>
          <Row label="Revenue" hint="Orders and membership payments">
            <Money v={e.perCustomer.revenueRep} fx={fx} />
          </Row>
          <Row label="Gross margin">
            <Money v={e.perCustomer.marginRep} fx={fx} />
          </Row>
          <Row label="Membership revenue (total)">
            <Money v={e.membershipRevenueRep} fx={fx} />
          </Row>
        </dl>
        <dl className="ad-dl">
          <h3>Image generation</h3>
          <Row label="Total cost" hint={`${e.imageCostUsd.toFixed(2)} USD`}>
            <Money v={e.imageCostRep} fx={fx} plain />
          </Row>
          <Row label="Per order with images" hint={`${int(e.ordersWithGenerations)} orders`}>
            <Money v={e.imageCostPerOrderRep} fx={fx} plain />
          </Row>
          <Row label="Per generation" hint={e.imageCostPerGenerationUsd == null ? undefined : `${e.imageCostPerGenerationUsd.toFixed(4)} USD`}>
            <Money v={e.imageCostPerGenerationRep} fx={fx} plain />
          </Row>
          <Row label="Generations">{int(e.generations)}</Row>
          <Row label="Regenerations" hint={e.regenerations == null ? "Not known (generations without parent_id)" : e.generations ? `${pct(e.regenerations / e.generations)} of generations · refined from an earlier attempt` : undefined}>
            {e.regenerations == null ? <span className="ad-dim">—</span> : int(e.regenerations)}
          </Row>
        </dl>
      </div>
      <div className="ad-totals">
        <span>
          Revenue <Money v={e.revenueRep} fx={fx} />
        </span>
        <span>
          Payment fees <Money v={e.paymentFeeRep} fx={fx} plain />
        </span>
        <span>
          Image cost <Money v={e.imageCostRep} fx={fx} plain />
        </span>
        <span>
          Other costs <Money v={e.otherCostRep} fx={fx} plain />
        </span>
        <span>
          Gross margin <Money v={e.marginRep} fx={fx} />
        </span>
      </div>
    </Section>
  );
}

/* ------------------------------ Markets ---------------------------- */

function Markets({ d }: { d: OperatorDashboard }) {
  const fx = d.fxMissing.length > 0;
  const rows = d.markets;
  const currencies = [...new Set(rows.map((m) => m.currency))].sort();
  return (
    <Section
      title="Markets"
      id="markets"
      note={`Per country and the currency it paid in. Gross, refunds and net are in that currency; the converted columns are in ${d.currency}. Payments in the range; members and MRR are now. "Not recorded" = orders from before multi-currency.`}
    >
      {!rows.length ? (
        <p className="ad-dim">No payments in this range.</p>
      ) : (
        <>
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Country</th>
                  <th>Currency</th>
                  <th className="r">Orders</th>
                  <th className="r">Paying customers</th>
                  <th className="r">Gross</th>
                  <th className="r">Refunds</th>
                  <th className="r">Net</th>
                  <th className="r">Net ({d.currency})</th>
                  <th className="r">Share</th>
                  <th className="r">Members</th>
                  <th className="r">MRR ({d.currency})</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={`${m.country ?? ""}|${m.currency}`}>
                    <td>{m.country ? country(m.country) : <span className="ad-dim">Not recorded</span>}</td>
                    <td>{m.currency}</td>
                    <td className="r">{int(m.orders)}</td>
                    <td className="r">{int(m.payingCustomers)}</td>
                    <td className="r">
                      <Money v={m.gross} fx={false} cur={m.currency} plain />
                    </td>
                    <td className="r">{m.refunds ? <Money v={m.refunds} fx={false} cur={m.currency} plain /> : <span className="ad-dim">—</span>}</td>
                    <td className="r">
                      <Money v={m.net} fx={false} cur={m.currency} />
                    </td>
                    <td className="r">
                      <Money v={m.netRep} fx={fx} />
                    </td>
                    <td className="r">{pct(m.share)}</td>
                    <td className="r">{int(m.activeMembers)}</td>
                    <td className="r">{m.activeMembers ? <Money v={m.mrrRep} fx={fx} plain /> : <span className="ad-dim">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {currencies.length > 1 && (
            <>
              <h3 className="ad-h3">Per currency</h3>
              <div className="ad-totals">
                {currencies.map((c) => {
                  const of = rows.filter((m) => m.currency === c);
                  const net = of.reduce((a, m) => a + m.net, 0);
                  const rep = of.some((m) => m.netRep == null) ? null : of.reduce((a, m) => a + (m.netRep ?? 0), 0);
                  return (
                    <span key={c}>
                      {c} <Money v={net} fx={false} cur={c} /> <small className="ad-dim">≈</small> <Money v={rep} fx={fx} plain />
                    </span>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </Section>
  );
}

/* ----------------------------- Marketing --------------------------- */

function Marketing({ d }: { d: OperatorDashboard }) {
  const [scope, setScope] = useState<"meta" | "all">("meta");
  const m: MarketingSummary = d.marketing[scope];
  const fx = d.fxMissing.length > 0;
  const showToggle = d.marketing.all.campaigns.some((c) => c.platform !== "meta");
  const [showAllDays, setShowAllDays] = useState(false);
  const days = showAllDays ? m.days : m.days.slice(0, 14);
  return (
    <Section
      title={scope === "meta" ? "Meta ads" : "Ads, all platforms"}
      id="marketing"
      note="Spend, impressions, clicks and purchases as the ad platform reports them. CAC and ROAS are blended: spend against all new paying customers and all revenue."
      right={
        showToggle ? (
          <Toggle
            value={scope}
            options={[
              { value: "meta", label: "Meta" },
              { value: "all", label: "All platforms" },
            ]}
            onChange={setScope}
          />
        ) : undefined
      }
    >
      {!m.hasRows ? (
        <div className="ad-empty">
          <b>Connect Meta: set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID in Supabase</b>
          <span>
            {scope === "meta" ? "No Meta ad spend in this range." : "No ad spend in this range."} The daily sync (sync-meta-ads) fills the ad_spend table once both secrets are set in the
            Supabase dashboard.
          </span>
        </div>
      ) : (
        <>
          <div className="ad-kpis is-compact">
            <Stat label="Spend">
              <Money v={m.spendRep} fx={fx} plain />
            </Stat>
            <Stat label="Impressions">{int(m.impressions)}</Stat>
            <Stat label="Clicks" sub={`CTR ${pct(m.ctr, 2)}`}>
              {int(m.clicks)}
            </Stat>
            <Stat label="Purchases" sub="Platform-reported">
              {int(m.purchases)}
            </Stat>
            <Stat label="CAC" sub={`${int(m.newPayingCustomers)} new paying customers`}>
              <Money v={m.cacRep} fx={fx} plain />
            </Stat>
            <Stat label="ROAS" sub="Revenue after refunds / spend">
              {ratio(m.roas)}
            </Stat>
          </div>
          <h3 className="ad-h3">Per campaign</h3>
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  {scope === "all" && <th>Platform</th>}
                  <th className="r">Spend</th>
                  <th className="r">Impr.</th>
                  <th className="r">Clicks</th>
                  <th className="r">CTR</th>
                  <th className="r">Purchases</th>
                  <th className="r" title="Spend / platform-reported purchases">
                    Cost per purchase
                  </th>
                  <th className="r" title="Platform purchases × average report payment / spend">
                    Est. ROAS
                  </th>
                </tr>
              </thead>
              <tbody>
                {m.campaigns.map((c) => (
                  <tr key={`${c.platform}:${c.campaign_id}`}>
                    <td className="ad-ellipsis" title={c.campaign_name ?? c.campaign_id}>
                      {c.campaign_name ?? c.campaign_id}
                    </td>
                    {scope === "all" && <td className="cap">{c.platform}</td>}
                    <td className="r">
                      <Money v={c.spendRep} fx={fx} plain />
                    </td>
                    <td className="r">{int(c.impressions)}</td>
                    <td className="r">{int(c.clicks)}</td>
                    <td className="r">{pct(c.ctr, 2)}</td>
                    <td className="r">{int(c.purchases)}</td>
                    <td className="r">
                      <Money v={c.cpaRep} fx={fx && c.spendRep == null} plain />
                    </td>
                    <td className="r">{ratio(c.estRoas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className="ad-h3">Per day</h3>
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th className="r">Spend</th>
                  <th className="r">Impr.</th>
                  <th className="r">Clicks</th>
                  <th className="r">Purchases</th>
                  <th className="r">New customers</th>
                  <th className="r">Revenue</th>
                  <th className="r">CAC</th>
                  <th className="r">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {days.map((x) => (
                  <tr key={x.date}>
                    <td>{day(x.date)}</td>
                    <td className="r">
                      <Money v={x.spendRep} fx={fx} plain />
                    </td>
                    <td className="r">{int(x.impressions)}</td>
                    <td className="r">{int(x.clicks)}</td>
                    <td className="r">{int(x.purchases)}</td>
                    <td className="r">{int(x.newCustomers)}</td>
                    <td className="r">
                      <Money v={x.revenueRep} fx={fx} />
                    </td>
                    <td className="r">
                      <Money v={x.cacRep} fx={fx && x.spendRep == null} plain />
                    </td>
                    <td className="r">{ratio(x.roas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {m.days.length > 14 && (
            <button type="button" className="ad-link ad-more" onClick={() => setShowAllDays((v) => !v)}>
              {showAllDays ? "Show the last 14 days" : `Show all ${m.days.length} days`}
            </button>
          )}
        </>
      )}
    </Section>
  );
}

/* ------------------------------ Orders ----------------------------- */

const PAGE = 50;

function Orders({ d }: { d: OperatorDashboard }) {
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [overdue, setOverdue] = useState(false);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const fx = d.fxMissing.length > 0;
  useEffect(() => setLimit(PAGE), [status, overdue, search, d.range]);

  const list = useMemo(() => {
    const s = search.trim().toLowerCase();
    return d.orders.filter(
      (o) =>
        (status === "all" || o.status === status) &&
        (!overdue || o.overdue) &&
        (!s || (o.email ?? "").toLowerCase().includes(s) || (s.length >= 6 && o.order_id.toLowerCase().startsWith(s))),
    );
  }, [d.orders, status, overdue, search]);
  const present = new Set(d.orders.map((o) => o.status));

  return (
    <Section
      title="Orders"
      id="orders"
      note="Orders created in the range, plus every open review order."
      right={
        <button type="button" className="btn btn-ghost ad-btn-sm" onClick={() => download(`orders-${d.range}-${d.currency}-${stamp()}.csv`, operatorOrdersToCsv(list, d.currency))} disabled={!list.length}>
          Export CSV ({int(list.length)})
        </button>
      }
    >
      <div className="ad-filter-row">
        <div className="field">
          <label htmlFor="ad-status">Status</label>
          <select id="ad-status" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | "all")}>
            <option value="all">All statuses</option>
            {ORDER_STATUS_ORDER.filter((s) => present.has(s)).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="field ad-grow">
          <label htmlFor="ad-search">Search</label>
          <input id="ad-search" type="search" placeholder="Email or order id" value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" />
        </div>
        <label className="ad-check">
          <input type="checkbox" checked={overdue} onChange={(e) => setOverdue(e.target.checked)} /> Overdue only
        </label>
      </div>
      {!list.length ? (
        <p className="ad-dim">No orders match.</p>
      ) : (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Created</th>
                <th>Customer</th>
                <th>Country</th>
                <th>Product</th>
                <th>Status</th>
                <th>Due</th>
                <th className="r">Revenue</th>
                <th className="r">Fee</th>
                <th className="r">Images</th>
                <th className="r">Margin</th>
                <th aria-label="Open" />
              </tr>
            </thead>
            <tbody>
              {list.slice(0, limit).map((o) => (
                <OrderRowView key={o.order_id} o={o} fx={fx} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.length > limit && (
        <button type="button" className="ad-link ad-more" onClick={() => setLimit((n) => n + PAGE)}>
          Show {Math.min(PAGE, list.length - limit)} more of {int(list.length - limit)}
        </button>
      )}
    </Section>
  );
}

function OrderRowView({ o, fx }: { o: OperatorOrder; fx: boolean }) {
  return (
    <tr className={o.overdue ? "is-overdue" : ""}>
      <td className="nowrap">{dateTime(o.created_at)}</td>
      <td className="ad-ellipsis">{o.user_id ? o.email ?? <span className="ad-dim">No email</span> : <span className="ad-dim">Deleted account</span>}</td>
      <td className="nowrap" title={o.country ? country(o.country) : "Not recorded (before multi-currency)"}>
        {o.country ?? <span className="ad-dim">—</span>} <small className="ad-dim">{o.currency}</small>
      </td>
      <td className="cap">{o.product === "checkin" ? "Check-in" : "Report"}</td>
      <td>
        <span className={`ad-status s-${o.status}`}>{STATUS_LABEL[o.status]}</span>
      </td>
      <td className="nowrap">{o.overdue ? <span className="ad-overdue">Overdue · {dateTime(o.due_at)}</span> : dateTime(o.due_at)}</td>
      <td className="r" title={o.revenue == null ? undefined : `Paid ${fmtMoney(o.revenue, o.currency)}`}>
        <Money v={o.revenueRep} fx={fx} />
      </td>
      <td className="r">
        <Money v={o.paymentFeeRep} fx={fx} plain />
      </td>
      <td className="r" title={`${o.generations} generation(s)${o.regenerations != null ? `, ${o.regenerations} regenerated` : ""}, ${o.imageCostUsd.toFixed(2)} USD`}>
        <Money v={o.imageCostRep} fx={fx} plain />
        <small className="ad-dim"> · {o.generations}</small>
      </td>
      <td className="r">
        <Money v={o.marginRep} fx={fx} />
      </td>
      <td className="r">
        <Link to={`/review/orders/${o.order_id}`} className="ad-link">
          Open
        </Link>
      </td>
    </tr>
  );
}

/* ----------------------------- Waitlist ---------------------------- */

function Waitlist({ d }: { d: OperatorDashboard }) {
  const w = d.waitlist;
  const latest = w.entries.slice(0, 8);
  return (
    <Section
      title="Waitlist"
      id="waitlist"
      right={
        <button
          type="button"
          className="btn btn-ghost ad-btn-sm"
          disabled={!w.entries.length}
          title={w.emailsAvailable ? "Email, gender, locale, source and join time" : "No emails in these rows"}
          onClick={() => download(`waitlist-${stamp()}.csv`, waitlistToCsv(w.entries))}
        >
          Export CSV with emails ({int(w.entries.length)})
        </button>
      }
      note="Women join the waitlist until the service opens for them."
    >
      <div className="ad-kpis is-compact is-3">
        <Stat label="Women">{int(w.women)}</Stat>
        <Stat label="Total" sub={[w.men ? `${w.men} men` : null, w.unknown ? `${w.unknown} not given` : null].filter(Boolean).join(" · ") || undefined}>
          {int(w.total)}
        </Stat>
        <Stat label="Last 7 days">{int(w.last7d)}</Stat>
      </div>
      <h3 className="ad-h3">Latest joins</h3>
      {!latest.length ? (
        <p className="ad-dim">No one has joined yet.</p>
      ) : (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Joined</th>
                <th>Email</th>
                <th>Gender</th>
                <th>Locale</th>
                <th>Country</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {latest.map((x) => (
                <tr key={x.id}>
                  <td className="nowrap">{dateTime(x.created_at)}</td>
                  <td className="ad-ellipsis">{x.email ?? <span className="ad-dim">—</span>}</td>
                  <td className="cap">{x.gender ?? "—"}</td>
                  <td>{x.locale ?? "—"}</td>
                  <td title={x.country ? country(x.country) : undefined}>{x.country ?? "—"}</td>
                  <td className="cap">{x.source ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

/* ------------------------------ FX rates --------------------------- */

/** How a rate is quoted to the operator: 1 EUR = x units (the usual quote, e.g. ECB 1 EUR = 1.08 USD). */
const perEur = (r: FxRate) => (r.eur_per_unit ? 1 / r.eur_per_unit : null);
const sig = (n: number) => Number(n.toPrecision(6)).toString();

function FxEditor({ d }: { d: OperatorDashboard }) {
  const now = Date.now();
  const order = (r: FxRate) => (r.basis === "base" ? 0 : r.basis === "manual" ? 1 : 2);
  const rows = [...d.fx].sort((a, b) => order(a) - order(b) || a.currency.localeCompare(b.currency));
  const known = new Set(d.fx.map((r) => r.currency));
  const absent = d.fxMissing.filter((c) => !known.has(c));
  return (
    <Section
      title="Exchange rates"
      id="fx"
      note="From the fx_rates table, in EUR (the books' currency). Set USD and KWD yourself, from the rate your accountant uses: KWD moves daily (basket peg), USD can be weekly. SAR, AED, QAR, BHD and OMR are fixed to the US dollar, so they follow the USD rate."
    >
      <div className="ad-fx">
        {rows.map((r) => (r.basis === "base" ? <FxBase key={r.currency} r={r} /> : <FxRow key={r.currency} r={r} stale={fxStale(r, now)} usd={d.fx.find((x) => x.currency === "USD") ?? null} />))}
        {absent.map((c) => (
          <FxRow key={c} r={{ currency: c, eur_per_unit: null, basis: "manual", per_usd: null, max_age_days: null, note: "Used in the data, no rate yet.", updated_at: null }} stale={false} usd={null} />
        ))}
        <FxAdd />
      </div>
      {isMock && <p className="ad-note">Demo mode: rates are kept in this browser tab only.</p>}
    </Section>
  );
}

function FxBase({ r }: { r: FxRate }) {
  return (
    <div className="ad-fx-row">
      <div className="field ad-grow">
        <label>{r.currency}</label>
        <input value="1 (reporting currency)" readOnly aria-readonly="true" />
      </div>
    </div>
  );
}

function FxRow({ r, stale, usd }: { r: FxRate; stale: boolean; usd: FxRate | null }) {
  const pegged = r.basis === "peg";
  const shown = pegged ? (r.per_usd != null ? sig(r.per_usd) : "") : perEur(r) != null ? sig(perEur(r)!) : "";
  const [value, setValue] = useState(shown);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => setValue(shown), [shown]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = Number(value.replace(",", "."));
    setBusy(true);
    setMsg(null);
    try {
      if (pegged) await saveFxPeg(r.currency, n);
      else await saveFxRate(r.currency, n);
      setMsg({ ok: true, text: "Saved." });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }
  const id = `fx-${r.currency}`;
  const eurValue = r.eur_per_unit ? `1 ${r.currency} = ${sig(r.eur_per_unit)} EUR` : null;
  let status: ReactNode;
  if (msg) status = msg.text;
  else if (r.eur_per_unit == null) status = <span className="ad-missing">{pegged && !usd?.eur_per_unit ? "rate missing: set USD first" : "rate missing"}</span>;
  else if (pegged) status = `Fixed peg to USD · ${eurValue}`;
  else if (stale) status = <span className="ad-missing">{`Out of date (${r.updated_at ? `updated ${dateTime(r.updated_at)}` : "never confirmed"}; update every ${r.max_age_days === 1 ? "day" : `${r.max_age_days} days`}) · ${eurValue}`}</span>;
  else status = `${r.updated_at ? `Updated ${dateTime(r.updated_at)}` : "Demo value, not yet confirmed"} · ${eurValue}`;
  return (
    <form className="ad-fx-row" onSubmit={submit} noValidate>
      <div className="field ad-grow">
        <label htmlFor={id} title={r.note ?? undefined}>
          {pegged ? `${r.currency} per 1 USD (peg)` : `${r.currency} per 1 EUR`}
        </label>
        <input id={id} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder={pegged ? "e.g. 3.75" : r.currency === "KWD" ? "e.g. 0.335" : "e.g. 1.08"} aria-describedby={`${id}-s`} />
      </div>
      <button type="submit" className="btn ad-btn-sm" disabled={busy || !value.trim() || value === shown} aria-busy={busy || undefined}>
        Save
      </button>
      <p id={`${id}-s`} className={`ad-fx-status${msg && !msg.ok ? " is-bad" : ""}`} role={msg ? "status" : undefined}>
        {status}
      </p>
    </form>
  );
}

/** Add a currency that is not in the table yet (e.g. an ad account billed in another currency). */
function FxAdd() {
  const [code, setCode] = useState("");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await saveFxRate(code, Number(value.replace(",", ".")));
      setMsg({ ok: true, text: `Added ${code.trim().toUpperCase()}.` });
      setCode("");
      setValue("");
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="ad-fx-row" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="fx-new-code">Add currency</label>
        <input id="fx-new-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 3))} placeholder="GBP" autoComplete="off" size={5} />
      </div>
      <div className="field ad-grow">
        <label htmlFor="fx-new-rate">{code.trim().length === 3 ? `${code.trim().toUpperCase()} per 1 EUR` : "Per 1 EUR"}</label>
        <input id="fx-new-rate" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. 0.85" aria-describedby="fx-new-s" />
      </div>
      <button type="submit" className="btn btn-ghost ad-btn-sm" disabled={busy || code.trim().length !== 3 || !value.trim()} aria-busy={busy || undefined}>
        Add
      </button>
      <p id="fx-new-s" className={`ad-fx-status${msg && !msg.ok ? " is-bad" : ""}`} role={msg ? "status" : undefined}>
        {msg?.text ?? ""}
      </p>
    </form>
  );
}
