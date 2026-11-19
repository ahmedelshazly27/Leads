/*
 * Operator dashboard (/admin): revenue, unit economics, marketing, orders,
 * waitlist and exchange rates. Admin accounts only; English only.
 *
 * Data comes from loadOperatorDashboard (lib/backend/admin.ts): the same rows
 * in Supabase and demo mode (VITE_BACKEND_MOCK=1). USD / EUR amounts are
 * converted with the fx_rates table; a missing rate shows as "rate missing",
 * never as zero.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Empty, Toggle } from "../../components/ui";
import { SignIn } from "../../components/SignIn";
import { BRAND_NAME } from "../../lib/brand";
import {
  ADMIN_RANGES,
  FX_EDITABLE,
  ORDER_STATUS_ORDER,
  SLA_HOURS,
  backendMode,
  isMock,
  ordersToCsv,
  saveFxRate,
  signOut,
  useOperatorDashboard,
  useRole,
  useSession,
  waitlistToCsv,
  type AdminRange,
  type FxCurrency,
  type MarketingSummary,
  type OperatorDashboard,
  type OperatorOrder,
  type OrderStatus,
} from "../../lib/backend";
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
const pct = (x: number | null, d = 0) => (x == null ? "—" : `${(x * 100).toFixed(d)}%`);
const ratio = (x: number | null) => (x == null ? "—" : `${x.toFixed(2)}×`);
const dateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kuwait" }) : "—";
const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** A KWD amount; null means a needed exchange rate is missing (or nothing to show). */
function Kwd({ v, fx, d = 3, plain }: { v: number | null | undefined; fx: boolean; d?: number; plain?: boolean }) {
  if (v == null) return fx ? <span className="ad-missing">rate missing</span> : <span className="ad-dim">—</span>;
  return (
    <span className={`ad-num${!plain && v < 0 ? " is-neg" : ""}`}>
      {kwdNum(v, d)}
      <small> KWD</small>
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
    <div className="ad">
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
  const { session } = useSession();
  if (backendMode === "off")
    return (
      <Empty title="Online service not configured">
        The dashboard reads from Supabase. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, or VITE_BACKEND_MOCK=1 for demo data.
      </Empty>
    );
  if (loading) return <div className="ad-loading" aria-busy="true" />;
  if (role === "admin") return <Dashboard />;
  if (session)
    return (
      <Empty title="Admin accounts only">
        You are signed in{session.email ? ` as ${session.email}` : ""}, which is not an admin account.{" "}
        <button type="button" className="ad-link" onClick={() => void signOut()}>
          Sign out
        </button>{" "}
        and sign in with an admin account.
      </Empty>
    );
  return (
    <div className="ad-signin">
      <SignIn title="Operator sign-in" lead="Admin accounts only. We email you a sign-in code." />
      {isMock && <p className="ad-note">Demo mode: use an email that starts with "admin" (for example admin@example.com) and any 6 digits.</p>}
    </div>
  );
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

function Dashboard() {
  const [range, setRange] = useState<AdminRange>(readRange);
  const q = useOperatorDashboard(range);
  // Keep the previous frame while a new range loads (no flash, no layout jump).
  const last = useRef<OperatorDashboard | undefined>(undefined);
  if (q.data) last.current = q.data;
  const data = q.data ?? last.current;

  const choose = (r: AdminRange) => {
    setRange(r);
    try {
      localStorage.setItem(RANGE_KEY, r);
    } catch {
      /* storage blocked */
    }
  };

  return (
    <>
      <div className="ad-head">
        <div>
          <h1 className="title-lg">
            <span className="hl">Operator</span> dashboard
          </h1>
          <p className="ad-sub">
            {data ? `Updated ${dateTime(data.generatedAt)} (Kuwait time). Amounts in KWD.` : "Loading…"}
            {q.loading && data ? " Refreshing…" : ""}
          </p>
        </div>
        <div className="ad-filters">
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
          {data.warnings.map((w) => (
            <div key={w} className="ad-alert is-warn" role="status">
              {w}
            </div>
          ))}
          <KpiRow d={data} />
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
          <Marketing d={data} />
          <Orders d={data} />
          <div className="ad-grid-2">
            <Waitlist d={data} />
            <FxEditor d={data} />
          </div>
        </div>
      )}
    </>
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

function KpiRow({ d }: { d: OperatorDashboard }) {
  const k = d.kpis;
  const fx = d.fxMissing.length > 0;
  const mrr = k.mrr;
  return (
    <div className="ad-kpis">
      <Stat label="Revenue after refunds" sub={k.refundedKwd ? <>Refunds <Kwd v={k.refundedKwd} fx={fx} plain /></> : "No refunds"}>
        <Kwd v={k.revenueKwd} fx={fx} />
      </Stat>
      <Stat label="Gross revenue" sub="Before refunds">
        <Kwd v={k.grossRevenueKwd} fx={fx} />
      </Stat>
      <Stat label="Refunds" tone={k.refundedKwd ? "warn" : undefined}>
        <Kwd v={k.refundedKwd} fx={fx} plain />
      </Stat>
      <Stat label="Orders" sub={`${int(k.delivered)} delivered in range`}>
        {int(k.orders)}
      </Stat>
      <Stat label="MRR" sub={mrr.trialing ? <>{int(mrr.trialing)} in trial (<Kwd v={mrr.trialingMrrKwd} fx={mrr.dataMissing} plain /> once paying)</> : "Now, not range-bound"}>
        <Kwd v={mrr.mrrKwd} fx={mrr.dataMissing} />
      </Stat>
      <Stat label="Active members" sub={[mrr.pastDue ? `${mrr.pastDue} past due` : null, mrr.cancelling ? `${mrr.cancelling} cancelling` : null].filter(Boolean).join(" · ") || "Paying subscriptions"} tone={mrr.pastDue ? "warn" : undefined}>
        {int(mrr.active)}
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
  const fmt = (v: number | null) => (v == null ? (fx ? "rate missing" : "—") : `${kwdNum(v)} KWD`);
  const hasAds = d.daily.some((x) => x.adSpendKwd);
  const series = [
    { key: "rev", name: "Revenue", color: SERIES.revenue, values: d.daily.map((x) => x.revenueKwd) },
    ...(hasAds ? [{ key: "ads", name: "Ad spend", color: SERIES.adSpend, values: d.daily.map((x) => x.adSpendKwd) }] : []),
  ];
  return (
    <>
      <LineChart dates={d.daily.map((x) => x.date)} series={series} unit="KWD" format={fmt} />
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
                    <Kwd v={x.revenueKwd} fx={fx} />
                  </td>
                  <td className="r">
                    <Kwd v={x.adSpendKwd} fx={fx} plain />
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
  return (
    <Section
      title="Unit economics"
      id="economics"
      note={
        <>
          Paid orders created in the range ({int(e.orders)}). Image cost is converted from USD at{" "}
          {usdRate ? `${usdRate.kwd_per_unit} KWD per USD` : <span className="ad-missing">rate missing</span>}. Gross margin = revenue − payment fees − image cost − other order costs.
        </>
      }
    >
      <div className="ad-grid-3">
        <dl className="ad-dl">
          <h3>Per order (average)</h3>
          <Row label="Revenue">
            <Kwd v={e.perOrder.revenueKwd} fx={fx} />
          </Row>
          <Row label="Payment fee">
            <Kwd v={e.perOrder.paymentFeeKwd} fx={fx} plain />
          </Row>
          <Row label="Image generation">
            <Kwd v={e.perOrder.imageCostKwd} fx={fx} plain />
          </Row>
          <Row label="Gross margin" hint={e.marginShare == null ? undefined : `${pct(e.marginShare, 1)} of revenue`}>
            <Kwd v={e.perOrder.marginKwd} fx={fx} />
          </Row>
        </dl>
        <dl className="ad-dl">
          <h3>Per customer (average)</h3>
          <Row label="Customers" hint={e.deletedAccountOrders ? `${e.deletedAccountOrders} order(s) from deleted accounts left out` : undefined}>
            {int(e.customers)}
          </Row>
          <Row label="Orders per customer">{e.perCustomer.orders == null ? "—" : e.perCustomer.orders.toFixed(2)}</Row>
          <Row label="Revenue" hint="Orders and membership payments">
            <Kwd v={e.perCustomer.revenueKwd} fx={fx} />
          </Row>
          <Row label="Gross margin">
            <Kwd v={e.perCustomer.marginKwd} fx={fx} />
          </Row>
          <Row label="Membership revenue (total)">
            <Kwd v={e.membershipRevenueKwd} fx={fx} />
          </Row>
        </dl>
        <dl className="ad-dl">
          <h3>Image generation</h3>
          <Row label="Total cost" hint={`${e.imageCostUsd.toFixed(2)} USD`}>
            <Kwd v={e.imageCostKwd} fx={fx} plain />
          </Row>
          <Row label="Per order with images" hint={`${int(e.ordersWithGenerations)} orders`}>
            <Kwd v={e.imageCostPerOrderKwd} fx={fx} plain />
          </Row>
          <Row label="Per generation" hint={e.imageCostPerGenerationUsd == null ? undefined : `${e.imageCostPerGenerationUsd.toFixed(4)} USD`}>
            <Kwd v={e.imageCostPerGenerationKwd} fx={fx} plain />
          </Row>
          <Row label="Generations">{int(e.generations)}</Row>
          <Row label="Regenerations" hint={e.regenerations == null ? "Not in demo data" : e.generations ? `${pct(e.regenerations / e.generations)} of generations` : undefined}>
            {e.regenerations == null ? <span className="ad-dim">—</span> : int(e.regenerations)}
          </Row>
        </dl>
      </div>
      <div className="ad-totals">
        <span>
          Revenue <Kwd v={e.revenueKwd} fx={fx} />
        </span>
        <span>
          Payment fees <Kwd v={e.paymentFeeKwd} fx={fx} plain />
        </span>
        <span>
          Image cost <Kwd v={e.imageCostKwd} fx={fx} plain />
        </span>
        <span>
          Other costs <Kwd v={e.otherCostKwd} fx={fx} plain />
        </span>
        <span>
          Gross margin <Kwd v={e.marginKwd} fx={fx} />
        </span>
      </div>
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
              <Kwd v={m.spendKwd} fx={fx} plain />
            </Stat>
            <Stat label="Impressions">{int(m.impressions)}</Stat>
            <Stat label="Clicks" sub={`CTR ${pct(m.ctr, 2)}`}>
              {int(m.clicks)}
            </Stat>
            <Stat label="Purchases" sub="Platform-reported">
              {int(m.purchases)}
            </Stat>
            <Stat label="CAC" sub={`${int(m.newPayingCustomers)} new paying customers`}>
              <Kwd v={m.cacKwd} fx={fx} plain />
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
                      <Kwd v={c.spendKwd} fx={fx} plain />
                    </td>
                    <td className="r">{int(c.impressions)}</td>
                    <td className="r">{int(c.clicks)}</td>
                    <td className="r">{pct(c.ctr, 2)}</td>
                    <td className="r">{int(c.purchases)}</td>
                    <td className="r">
                      <Kwd v={c.cpaKwd} fx={fx && c.spendKwd == null} plain />
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
                      <Kwd v={x.spendKwd} fx={fx} plain />
                    </td>
                    <td className="r">{int(x.impressions)}</td>
                    <td className="r">{int(x.clicks)}</td>
                    <td className="r">{int(x.purchases)}</td>
                    <td className="r">{int(x.newCustomers)}</td>
                    <td className="r">
                      <Kwd v={x.revenueKwd} fx={fx} />
                    </td>
                    <td className="r">
                      <Kwd v={x.cacKwd} fx={fx && x.spendKwd == null} plain />
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
        <button type="button" className="btn btn-ghost ad-btn-sm" onClick={() => download(`orders-${d.range}-${stamp()}.csv`, ordersToCsv(list))} disabled={!list.length}>
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
      <td className="cap">{o.product === "checkin" ? "Check-in" : "Report"}</td>
      <td>
        <span className={`ad-status s-${o.status}`}>{STATUS_LABEL[o.status]}</span>
      </td>
      <td className="nowrap">{o.overdue ? <span className="ad-overdue">Overdue · {dateTime(o.due_at)}</span> : dateTime(o.due_at)}</td>
      <td className="r">
        <Kwd v={o.revenueKwd} fx={fx} />
      </td>
      <td className="r">
        <Kwd v={o.paymentFeeKwd} fx={fx} plain />
      </td>
      <td className="r" title={`${o.generations} generation(s)${o.regenerations != null ? `, ${o.regenerations} regenerated` : ""}, ${o.imageCostUsd.toFixed(2)} USD`}>
        <Kwd v={o.imageCostKwd} fx={fx} plain />
        <small className="ad-dim"> · {o.generations}</small>
      </td>
      <td className="r">
        <Kwd v={o.marginKwd} fx={fx} />
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
        <button type="button" className="btn btn-ghost ad-btn-sm" disabled={!w.entries.length} onClick={() => download(`waitlist-${stamp()}.csv`, waitlistToCsv(w.entries))}>
          Export CSV
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
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {latest.map((x) => (
                <tr key={x.id}>
                  <td className="nowrap">{dateTime(x.created_at)}</td>
                  <td className="ad-ellipsis">{x.email ?? <span className="ad-dim">Hidden in demo</span>}</td>
                  <td className="cap">{x.gender ?? "—"}</td>
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

function FxEditor({ d }: { d: OperatorDashboard }) {
  const others = d.fxMissing.filter((c) => !FX_EDITABLE.includes(c as FxCurrency));
  return (
    <Section
      title="Exchange rates"
      id="fx"
      note="KWD per 1 unit, from the fx_rates table. Used to convert image-generation cost (USD) and ad spend into KWD. Enter the rate your accountant uses."
    >
      <div className="ad-fx">
        {FX_EDITABLE.map((c) => (
          <FxRow key={c} currency={c} current={d.fx.find((r) => r.currency === c) ?? null} />
        ))}
      </div>
      {others.length > 0 && <p className="ad-note">Also missing: {others.join(", ")}. Add {others.length > 1 ? "these rates" : "this rate"} to the fx_rates table in Supabase.</p>}
      {isMock && <p className="ad-note">Demo mode: rates are kept in this browser tab only.</p>}
    </Section>
  );
}

function FxRow({ currency, current }: { currency: FxCurrency; current: { kwd_per_unit: number; updated_at: string | null } | null }) {
  const [value, setValue] = useState(current ? String(current.kwd_per_unit) : "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => setValue(current ? String(current.kwd_per_unit) : ""), [current?.kwd_per_unit]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = Number(value.replace(",", "."));
    setBusy(true);
    setMsg(null);
    try {
      await saveFxRate(currency, n);
      setMsg({ ok: true, text: "Saved." });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }
  const id = `fx-${currency}`;
  return (
    <form className="ad-fx-row" onSubmit={submit} noValidate>
      <div className="field ad-grow">
        <label htmlFor={id}>1 {currency} in KWD</label>
        <input id={id} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. 0.300" aria-describedby={`${id}-s`} />
      </div>
      <button type="submit" className="btn ad-btn-sm" disabled={busy || !value.trim()} aria-busy={busy || undefined}>
        Save
      </button>
      <p id={`${id}-s`} className={`ad-fx-status${msg && !msg.ok ? " is-bad" : ""}`} role={msg ? "status" : undefined}>
        {msg ? msg.text : current ? (current.updated_at ? `Updated ${dateTime(current.updated_at)}` : "Demo value, not yet confirmed") : <span className="ad-missing">rate missing</span>}
      </p>
    </form>
  );
}
