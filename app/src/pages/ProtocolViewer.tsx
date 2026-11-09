import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { Logo } from "../components/Logo";
import { ChevronDown, ChevronLeft, ChevronUp, Download, Expand, ZoomIn, ZoomOut } from "../components/icons";
import { GradeBadge, Radar, money, shortCite } from "../components/ui";
import { buildPlan, MYTHS, type Plan, type PlanItem } from "../lib/plan";
import { band, SCORE_LABEL, type ScoreKey } from "../lib/report";
import { LIMITATIONS, METHODS, REFS } from "../lib/science";
import { useActive } from "../lib/useActive";
import type { Intake, Profile, Scan, Visuals } from "../lib/types";
import "./ProtocolViewer.css";

interface Ctx {
  profile: Profile;
  scan: Scan;
  plan: Plan;
  visuals: Visuals;
  facePhoto: string | null;
  currency: import("../lib/types").Currency;
}

interface PageDef {
  title: string;
  render: (c: Ctx) => ReactNode;
}

const chunk = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

function pagesFor(plan: Plan): PageDef[] {
  const recPages = chunk(plan.items, 3);
  return [
    { title: "Disclaimer & Policy", render: () => <DisclaimerPage /> },
    { title: "Introduction", render: (c) => <IntroPage c={c} /> },
    { title: "Protocol", render: (c) => <ProtocolPage c={c} /> },
    ...recPages.map((items, i) => ({
      title: recPages.length > 1 ? `Recommendations ${i + 1}/${recPages.length}` : "Recommendations",
      render: (c: Ctx) => <RecommendationsPage c={c} items={items} start={i * 3} />,
    })),
    { title: "Action Plan", render: (c) => <ActionPlanPage c={c} /> },
    { title: "Estimations", render: (c) => <EstimationsPage c={c} /> },
    { title: "References", render: (c) => <ReferencesPage c={c} /> },
  ];
}

export function ProtocolViewer() {
  const { profile, scan, facePhoto, state } = useActive();
  const plan = useMemo(() => (scan && profile ? buildPlan(scan, profile.intake) : null), [scan, profile]);
  const [zoom, setZoom] = useState(1);
  const [current, setCurrent] = useState(0);
  const docRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const pages = useMemo(() => (plan ? pagesFor(plan) : []), [plan]);

  // Fit A4 pages (794 px wide) to narrow screens; user zoom multiplies on top.
  const [fit, setFit] = useState(1);
  useEffect(() => {
    const el = docRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const cs = getComputedStyle(el);
      const inner = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      setFit(Math.min(1, inner / 794));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [plan]);

  useEffect(() => {
    const root = docRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (vis) setCurrent(Number((vis.target as HTMLElement).dataset.index));
      },
      { root, threshold: [0.3, 0.6] },
    );
    pageRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [pages.length, zoom]);

  if (!profile || !scan || !plan) return <Navigate to="/home" replace />;
  const ctx: Ctx = { profile, scan, plan, visuals: scan.review?.status === "approved" ? state.visuals[scan.id] ?? {} : {}, facePhoto, currency: state.settings.currency };

  const go = (i: number) => {
    const n = Math.max(0, Math.min(pages.length - 1, i));
    pageRefs.current[n]?.scrollIntoView({ behavior: "smooth", block: "start" });
    setCurrent(n);
  };

  return (
    <div className="pv">
      <header className="pv-bar">
        <Link to="/analysis/summary" className="pv-back" title="Back to analysis">
          <ChevronLeft size={18} />
        </Link>
        <div className="pv-title">Protocol</div>
        <div className="pv-group pv-zoomgroup">
          <button className="pv-btn" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))} aria-label="Zoom out">
            <ZoomOut size={20} />
          </button>
          <span className="pv-zoom">{Math.round(zoom * 100)}%</span>
          <button className="pv-btn" onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))} aria-label="Zoom in">
            <ZoomIn size={20} />
          </button>
        </div>
        <span className="pv-sep" />
        <div className="pv-group">
          <button className="pv-btn" onClick={() => go(current - 1)} aria-label="Previous page">
            <ChevronUp size={20} />
          </button>
          <span className="pv-zoom pv-pageof" style={{ width: 40 }}>
            {current + 1}
            <span className="pv-total"> / {pages.length}</span>
          </span>
          <button className="pv-btn" onClick={() => go(current + 1)} aria-label="Next page">
            <ChevronDown size={20} />
          </button>
        </div>
        <button
          className="pv-btn pv-expand"
          aria-label="Full screen"
          onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())}
        >
          <Expand size={18} />
        </button>
        <button className="pv-download" onClick={() => window.print()}>
          <span className="pv-dl-text">Download PDF</span>
          <span className="pv-dl-short">PDF</span> <span className="pv-div" /> <Download size={20} />
        </button>
      </header>

      <div className="pv-body">
        <aside className="pv-thumbs">
          {pages.map((p, i) => (
            <button key={i} className={`pv-thumb ${i === current ? "on" : ""}`} onClick={() => go(i)} title={p.title}>
              <div className="pv-thumb-inner">
                <Page index={i} total={pages.length}>
                  {p.render(ctx)}
                </Page>
              </div>
            </button>
          ))}
        </aside>

        <main className="pv-doc" ref={docRef}>
          <details className="pv-mprofile">
            <summary>
              <span>User profile & overview</span>
              <ChevronDown size={16} />
            </summary>
            <UserProfile c={ctx} />
            <div className="pv-card">
              <h2>Overview</h2>
              <p className="pv-overview">{overviewText(plan)}</p>
            </div>
          </details>
          <div className="pv-pages" style={{ zoom: +(zoom * fit).toFixed(3) }}>
            {pages.map((p, i) => (
              <div key={i} data-index={i} ref={(el) => (pageRefs.current[i] = el)} className="pv-page-wrap">
                <Page index={i} total={pages.length}>
                  {p.render(ctx)}
                </Page>
              </div>
            ))}
          </div>
        </main>

        <aside className="pv-side">
          <UserProfile c={ctx} />
          <div className="pv-card">
            <h2>Overview</h2>
            <p className="pv-overview">{overviewText(plan)}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function overviewText(plan: Plan) {
  const gains = (Object.keys(plan.current) as ScoreKey[])
    .map((k) => ({ k, d: (plan.projected[k] ?? 0) - (plan.current[k] ?? 0) }))
    .filter((x) => x.d > 1)
    .sort((a, b) => b.d - a.d)
    .slice(0, 2)
    .map((x) => SCORE_LABEL[x.k].toLowerCase());
  return `Your analysis shows ${band(plan.overallNow).toLowerCase()} overall scores (${Math.round(plan.overallNow)}/100)${
    gains.length ? `, with the largest realistic gains in ${gains.join(" and ")}` : ""
  }. Following the plan for 12 months projects ~${Math.round(plan.overallProjected)}/100.`;
}

/* ------------------------------------------------------------------ */
/*  Page frame                                                         */
/* ------------------------------------------------------------------ */

function Page({ index, total, children }: { index: number; total: number; children: ReactNode }) {
  return (
    <section className="pv-page" aria-label={`Page ${index + 1} of ${total}`}>
      <div className="pv-page-head">
        <Logo size={26} />
        <span className="pv-pageno">
          PAGE <i>/</i> {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <div className="pv-page-body">{children}</div>
    </section>
  );
}

const H = ({ strong, muted }: { strong: string; muted: string }) => (
  <h1 className="pv-h">
    {strong} <span>{muted}</span>
  </h1>
);

/* ------------------------------------------------------------------ */
/*  Pages                                                              */
/* ------------------------------------------------------------------ */

function DisclaimerPage() {
  return (
    <>
      <H strong="Disclaimer" muted="Policy" />
      <div className="pv-cols">
        <div>
          <h3>Medical disclaimer</h3>
          <p>
            This report is generated automatically from photographs and the information you provided. It is intended for education and self-tracking only and does not constitute medical,
            dermatological or nutritional advice, diagnosis or treatment.
          </p>
          <p>
            Before starting prescription treatments, supplements, a calorie deficit or a new training programme — especially if you have a medical condition, are pregnant or take medication —
            consult a qualified professional. Clinical options listed in this report are informational and require assessment by a licensed practitioner.
          </p>
          <h3>Visualisations</h3>
          <p>
            The "after" image is an illustration of the plan's expected effects, generated by an image model. It is not a measured prediction; individual results depend on genetics and adherence.
          </p>
        </div>
        <div>
          <h3>Privacy policy</h3>
          <p>
            Analysis runs on your device. In this preview, photographs, measurements and plan progress are stored only in this browser. Specialist review needs your photos: when accounts launch, submitting a scan for review will upload it over an encrypted connection to our review team only, and we will ask you first.
          </p>
          <p>Photos leave your device only if you choose to use an external image generator for visualisations; that provider's terms then apply.</p>
          <h3>Limitations</h3>
          <ul className="pv-list">
            {LIMITATIONS.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

function IntroPage({ c }: { c: Ctx }) {
  const contents = ["Disclaimer & Policy", "Introduction", `${possessive(firstName(c.profile.intake))} Protocol`, "Recommendations", "Action Plan", "Estimations", "References"];
  return (
    <>
      <H strong="Introduction" muted="" />
      <div className="pv-cols">
        <div>
          <p>
            This protocol was built from {c.scan.face ? "a 478-point facial landmark analysis" : "your intake"}
            {c.scan.body ? ", a full-body silhouette analysis" : ""} and your intake answers. Every recommendation is triggered by one of your measurements and graded by the strength of the
            published evidence behind it.
          </p>
          <p>
            The plan focuses on what can realistically change within 12 months — skin quality, body fat, sleep, training and grooming. Bone structure is not changed by habits, and nothing in this plan
            pretends otherwise.
          </p>
          <h3>Evidence grades</h3>
          <ul className="pv-list">
            <li>
              <b>A</b> — randomised trials or meta-analyses
            </li>
            <li>
              <b>B</b> — controlled or large observational studies
            </li>
            <li>
              <b>C</b> — limited evidence or expert consensus
            </li>
          </ul>
        </div>
        <div>
          <h3>Contents</h3>
          <ol className="pv-contents">
            {contents.map((t, i) => (
              <li key={t}>
                <span>{t}</span>
                <i>{String(i + 1).padStart(2, "0")}</i>
              </li>
            ))}
          </ol>
          <h3>Not recommended</h3>
          <ul className="pv-list">
            {MYTHS.map((m) => (
              <li key={m.title}>
                <b>{m.title}.</b> {m.verdict}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

const firstName = (i: Intake) => i.name.trim().split(/\s+/)[0] || "Your";
const possessive = (n: string) => (n === "Your" || n.toLowerCase() === "you" ? "Your" : n.endsWith("s") ? `${n}'` : `${n}'s`);

const FEATURES = ["Hair", "Eyebrows", "Eyes", "Nose", "Cheeks", "Jaw", "Lips", "Chin", "Skin", "Neck", "Body"];

function ProtocolPage({ c }: { c: Ctx }) {
  const before = c.visuals.baseline ?? c.facePhoto;
  const after = c.visuals.after;
  const keys = Object.keys(c.plan.current) as ScoreKey[];
  return (
    <>
      <H strong={possessive(firstName(c.profile.intake))} muted="Protocol" />
      <div className="pv-ba">
        <div className="pv-ba-img">
          {before ? <img src={before} alt="" /> : <div className="pv-ph">No photo</div>}
          <span className="pv-tag">Before</span>
        </div>
        <div className="pv-ba-img">
          {after ? <img src={after} alt="" /> : <div className="pv-ph">Generate an "after" in Visualization</div>}
          <span className="pv-tag">After</span>
        </div>
      </div>
      <div className="pv-pp">
        <div>
          <h2>Projected potential</h2>
          <p>
            This report is organised around <b>{FEATURES.length} key features</b> for facial and physical aesthetics:
          </p>
          <ul className="pv-feats">
            {FEATURES.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
        <div className="pv-radar">
          {keys.length >= 3 && (
            <Radar
              size={300}
              title={`AESTHETIC SCORE ${Math.round(c.plan.overallNow)}`}
              axes={keys.map((k) => SCORE_LABEL[k])}
              series={[
                { name: "Projected potential", values: keys.map((k) => c.plan.projected[k] ?? 0), tone: "a" },
                { name: "Client values", values: keys.map((k) => c.plan.current[k] ?? 0), tone: "b" },
              ]}
            />
          )}
        </div>
      </div>
      <p className="pv-big">
        Your projected score rises <span>{Math.max(0, Math.round(c.plan.overallProjected - c.plan.overallNow))} points</span> in 12 months.
      </p>
      <div className="pv-scores">
        <div className="pv-score">
          <span>Current score</span>
          <b>{Math.round(c.plan.overallNow)}</b>
        </div>
        <div className="pv-score dark">
          <span>Projected score</span>
          <b>{Math.round(c.plan.overallProjected)}</b>
        </div>
      </div>
      <p className="pv-small">
        {c.plan.improvements.slice(0, 3).join(". ")}. Projections assume consistent adherence and only count changes the plan can produce.
      </p>
    </>
  );
}

function RecommendationsPage({ c, items, start }: { c: Ctx; items: PlanItem[]; start: number }) {
  return (
    <>
      <H strong="Recommendations" muted={start ? "continued" : "by priority"} />
      <div className="pv-recs">
        {items.map((it, i) => (
          <div key={it.id} className="pv-rec">
            <div className="pv-rec-head">
              <span className="pv-rec-n">{String(start + i + 1).padStart(2, "0")}</span>
              <span className="pv-rec-cat">{it.category}</span>
              <GradeBadge grade={it.grade} />
            </div>
            <h3>{it.title}</h3>
            <p>{it.why}</p>
            {it.reviewerNote && <p className="pv-note">Reviewer: {it.reviewerNote}</p>}
            <ul className="pv-list">
              {it.how.slice(0, 3).map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
            <div className="pv-rec-foot">
              <span>Visible: {it.timeToVisible}</span>
              <span>{it.refs.map(shortCite).join(" · ")}</span>
              <span>{costLabel(it, c.currency)}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

const costLabel = (it: PlanItem, cur: Ctx["currency"]) => {
  const m = it.monthly[1] > 0 ? `${money(it.monthly[0], cur)}–${money(it.monthly[1], cur)}/mo` : "";
  const o = it.oneOff[1] > 0 ? `${money(it.oneOff[0], cur)}–${money(it.oneOff[1], cur)} once` : "";
  return [m, o].filter(Boolean).join(" + ") || "Free";
};

const PHASES = [
  { n: 1, label: "Weeks 0–4", sub: "Foundations" },
  { n: 2, label: "Months 1–3", sub: "Build" },
  { n: 3, label: "Months 3–12", sub: "Refine" },
] as const;

function ActionPlanPage({ c }: { c: Ctx }) {
  return (
    <>
      <H strong="Action" muted="Plan" />
      <p className="pv-small" style={{ marginTop: -6 }}>
        {c.plan.monthsToTarget ? `Body-fat target reached in ~${c.plan.monthsToTarget} months at a sustainable pace. ` : ""}Start every phase-1 habit in the first month; later phases add on top.
      </p>
      <div className="pv-phases">
        {PHASES.map((ph) => {
          const items = c.plan.items.filter((i) => i.phase === ph.n);
          return (
            <div key={ph.n} className="pv-phase">
              <div className="pv-phase-head">
                <span className="mono-sm">Phase {ph.n}</span>
                <b>{ph.label}</b>
                <span>{ph.sub}</span>
              </div>
              {items.length === 0 && <p className="pv-small">No new items — keep phase-1 habits going.</p>}
              <div className="pv-phase-grid">
              {items.map((it) => (
                <div key={it.id} className="pv-phase-item">
                  <div className="pv-phase-title">{it.title}</div>
                  {it.tasks.map((t) => (
                    <div key={t.id} className="pv-task">
                      <span className="pv-box" /> {t.label} <i>{t.cadence}</i>
                    </div>
                  ))}
                </div>
              ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function EstimationsPage({ c }: { c: Ctx }) {
  const byCat = new Map<string, { m: [number, number]; o: [number, number] }>();
  for (const it of c.plan.items) {
    const e = byCat.get(it.category) ?? { m: [0, 0], o: [0, 0] };
    e.m = [e.m[0] + it.monthly[0], e.m[1] + it.monthly[1]];
    e.o = [e.o[0] + it.oneOff[0], e.o[1] + it.oneOff[1]];
    byCat.set(it.category, e);
  }
  const rows = [...byCat.entries()];
  const tm = rows.reduce<[number, number]>((s, [, e]) => [s[0] + e.m[0], s[1] + e.m[1]], [0, 0]);
  const to = rows.reduce<[number, number]>((s, [, e]) => [s[0] + e.o[0], s[1] + e.o[1]], [0, 0]);
  const cur = c.currency;
  const r = (x: [number, number]) => (x[1] ? `${money(x[0], cur)} – ${money(x[1], cur)}` : "—");
  return (
    <>
      <H strong="Cost" muted="Estimations" />
      <p className="pv-small" style={{ marginTop: -6 }}>
        Approximate retail prices, organised by category, to show where your budget goes. Clinical items only appear if your preferences allow them.
      </p>
      <table className="pv-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Monthly</th>
            <th>One-off</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([cat, e]) => (
            <tr key={cat}>
              <td>{cat}</td>
              <td>{r(e.m)}</td>
              <td>{r(e.o)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td>{r(tm)}</td>
            <td>{r(to)}</td>
          </tr>
        </tfoot>
      </table>
      <div className="pv-scores" style={{ marginTop: 26 }}>
        <div className="pv-score">
          <span>Monthly</span>
          <b style={{ fontSize: 40 }}>{money(Math.round((tm[0] + tm[1]) / 2), cur)}</b>
        </div>
        <div className="pv-score dark">
          <span>First 12 months</span>
          <b style={{ fontSize: 40 }}>{money(Math.round(((tm[0] + tm[1]) / 2) * 12 + (to[0] + to[1]) / 2), cur)}</b>
        </div>
      </div>
    </>
  );
}

function ReferencesPage({ c }: { c: Ctx }) {
  const ids = new Set<string>();
  c.plan.items.forEach((i) => i.refs.forEach((r) => ids.add(r)));
  Object.values(METHODS).forEach((m) => m.refs.forEach((r) => ids.add(r)));
  const refs = [...ids].map((id) => REFS[id]).filter(Boolean).sort((a, b) => a.authors.localeCompare(b.authors));
  return (
    <>
      <H strong="References" muted="" />
      <ol className="pv-refs">
        {refs.map((r) => (
          <li key={r.id}>
            {r.authors} ({r.year}). <i>{r.title}</i>. {r.source}.
          </li>
        ))}
      </ol>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Right column                                                       */
/* ------------------------------------------------------------------ */

const FITZ = ["#f3dccb", "#e8c4a6", "#d2a383", "#b07d58", "#7d5435", "#4a3022"];

function ageBand(a: number) {
  const d = Math.floor(a / 10) * 10;
  const r = a % 10;
  return `${r < 4 ? "Early" : r < 7 ? "Mid" : "Late"} ${d}s`;
}

function UserProfile({ c }: { c: Ctx }) {
  const i = c.profile.intake;
  const avatar = c.facePhoto ?? c.visuals.baseline;
  const rows: [string, ReactNode][] = [
    ["Ethnicity", i.ethnicity || "—"],
    ["Age", ageBand(i.age)],
    ["Gender", cap(i.gender)],
    ["Preferences", { "non-invasive": "Non-invasive treatments", "open-to-clinical": "Open to clinical treatments", "open-to-surgical": "Open to surgical options" }[i.preferences]],
    ["Smoking", { no: "No", occasionally: "Occasionally", daily: "Daily" }[i.smoking]],
    ["Drinking", { never: "Never", occasional: "Occasional social drinker", weekly: "Weekly", daily: "Daily" }[i.drinking]],
    [
      "Skin tone",
      <span key="st" className="pv-skin">
        <i style={{ background: FITZ[i.skinTone - 1] }} /> Fitzpatrick skin type {["I", "II", "III", "IV", "V", "VI"][i.skinTone - 1]}
      </span>,
    ],
    ["Location", i.location || "—"],
    ["Limitations", i.limitations || "None reported"],
    ["Allergies", i.allergies || "None reported"],
    ["Professional", i.profession || "—"],
  ];
  return (
    <div className="pv-card">
      <h2>User Profile</h2>
      <div className="pv-user">
        <div className="pv-avatar">{avatar && <img src={avatar} alt="" />}</div>
        <div>
          <div className="pv-name">{i.name}</div>
          <div className="pv-pid">
            Protocol ID: <b>#{c.scan.id.slice(0, 5).toUpperCase()}</b>
          </div>
        </div>
      </div>
      <dl className="pv-rows">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
