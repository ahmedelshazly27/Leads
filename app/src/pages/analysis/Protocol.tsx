import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Placeholder } from "../../components/FacePhoto";
import { ChatHeart, ChevronDown, ChevronRight, GradCap, HeartHand } from "../../components/icons";
import { BeforeAfter, Citations, GradeBadge, PageHeader, Radar, money, shortCite } from "../../components/ui";
import type { Category, PlanItem } from "../../lib/plan";
import { MYTHS } from "../../lib/plan";
import { SCORE_LABEL, band, currentScores, overall, type ScoreKey } from "../../lib/report";
import { toggleProgress, useAppState } from "../../lib/store";
import { useActive } from "../../lib/useActive";
import type { SectionProps } from "./types";
import "./Protocol.css";

const PHASES = [
  { id: 1, label: "Weeks 0–4", sub: "Foundations" },
  { id: 2, label: "Months 1–3", sub: "Build" },
  { id: 3, label: "Months 3–12", sub: "Compound" },
] as const;

const Img = ({ src }: { src: string | null | undefined }) =>
  src ? <img src={src} alt="" className="pr-img" /> : <Placeholder tone="slate" />;

/* ------------------------------------------------------------------ */
/*  Your protocol (summary screenshot)                                 */
/* ------------------------------------------------------------------ */

export function YourProtocol(p: SectionProps) {
  const { plan, visuals } = p;
  const before = visuals.baseline ?? p.facePhoto;
  const keys = Object.keys(plan.current) as ScoreKey[];
  return (
    <div className="page">
      <PageHeader
        kicker="Summary"
        muted="Your protocol"
        strong="summary"
        lead="Where you are now, what the plan targets, and the visible result of 12 months of evidence-based changes — organised so you can see what drives each improvement."
      />
      <div className="pr-hero">
        <div className="pr-card pr-figure">
          {visuals.after ? (
            <BeforeAfter before={<Img src={before} />} after={<Img src={visuals.after} />} caption={<><b>FIG 1</b> LOOKS</>} />
          ) : (
            <figure className="ba">
              <div className="ba-frame pr-noafter">
                <div className="ba-layer"><Img src={before} /></div>
                <span className="photo-tag ba-tag ba-tag-l">Before</span>
                <div className="pr-gen glass">
                  <div className="mono-sm">After image</div>
                  <div>In preparation — released after review</div>
                </div>
              </div>
              <figcaption className="fig-caption"><b>FIG 1</b> LOOKS</figcaption>
            </figure>
          )}
        </div>
        <div className="pr-side">
          <div className="pr-card pr-goal">
            <div className="mono">What we're working toward</div>
            <h2 className="pr-goal-title">
              <span className="hl">{plan.goal.headline[0]}</span>
              <br />
              {plan.goal.headline[1]}
            </h2>
            <p className="pr-goal-text">{plan.goal.summary}</p>
            <div className="pr-impr">
              <div className="mono">Improvements</div>
              <ul className="bullets">
                {plan.improvements.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="pr-card pr-drivers">
            <div className="mono">Driven by</div>
            <div className="pr-chips">
              {(plan.drivers.length ? plan.drivers : ["General optimisation"]).map((d) => (
                <span key={d} className="chip mono-chip">{d}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <section className="pr-gain">
        <h2 className="title-lg"><span className="hl">What</span> you'll gain</h2>
        <p className="lead">Following the plan isn't only about the mirror. Research links how faces look to how people are judged — quickly and consistently.</p>
        <div className="pr-gain-grid">
          <GainCard dark icon={<ChatHeart size={22} />} muted="Better" strong="first impressions" text="Trait judgements like trustworthiness and competence form within a tenth of a second of seeing a face." cite="willis2006" />
          <GainCard icon={<HeartHand size={22} />} muted="Healthier" strong="looking skin" text="Even skin tone and carotenoid-rich colouring make faces look younger and healthier." cite={["fink2006", "whitehead2012"]} />
          <GainCard icon={<GradCap size={22} />} muted="More" strong="rested & approachable" text="Well-slept faces are rated healthier and more attractive, and people are more willing to socialise with them." cite={["axelsson2010", "sundelin2017"]} />
        </div>
      </section>

      <section className="pr-proj">
        <div className="mono">Projected at 12 months</div>
        <div className="pr-proj-row">
          <div className="pr-proj-chip pr-proj-main">
            <span>Overall</span>
            <b>{Math.round(plan.overallNow)} → {Math.round(plan.overallProjected)}</b>
          </div>
          {keys.map((k) => (
            <div key={k} className="pr-proj-chip">
              <span>{SCORE_LABEL[k]}</span>
              <b>
                {Math.round(plan.current[k]!)} → {Math.round(plan.projected[k]!)}
              </b>
            </div>
          ))}
        </div>
        <p className="pr-fine">Projections assume good adherence and diminishing returns near the top of the scale. Bone-driven scores (symmetry, proportions) are held constant.</p>
      </section>
    </div>
  );
}

function GainCard({ icon, muted, strong, text, cite, dark }: { icon: ReactNode; muted: string; strong: string; text: string; cite: string | string[]; dark?: boolean }) {
  const ids = Array.isArray(cite) ? cite : [cite];
  return (
    <div className={`pr-gcard ${dark ? "pr-gcard-dark" : ""}`}>
      <div className="pr-gcard-icon">{icon}</div>
      <div className="pr-gcard-body">
        <h3><span className="pr-gcard-muted">{muted}</span> {strong}</h3>
        <p>{text}</p>
        <div className="pr-gcard-cite mono-sm">{ids.map(shortCite).join(" · ")}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Recommendations                                                     */
/* ------------------------------------------------------------------ */

export function Recommendations(p: SectionProps) {
  const cur = useAppState().settings.currency;
  const groups = new Map<Category, PlanItem[]>();
  for (const it of p.plan.items) groups.set(it.category, [...(groups.get(it.category) ?? []), it]);
  return (
    <div className="page">
      <PageHeader kicker="Recommendations" muted="Your" strong="recommendations" mutedFirst lead={<>Each step is triggered by one of your measurements and graded by the strength of its evidence: <b>A</b> trials/meta-analyses, <b>B</b> controlled or observational studies, <b>C</b> limited.</>} />
      {[...groups.entries()].map(([cat, items]) => (
        <section key={cat} className="pr-group">
          <div className="pr-group-head mono">{cat}</div>
          <div className="pr-recs">
            {items.map((it) => (
              <RecCard key={it.id} item={it} cur={cur} />
            ))}
          </div>
        </section>
      ))}
      <section className="pr-group">
        <div className="pr-group-head mono">What we don't recommend</div>
        <div className="pr-myths">
          {MYTHS.map((m) => (
            <div key={m.title} className="pr-myth">
              <div className="pr-myth-title">{m.title}</div>
              <p>{m.verdict}</p>
              <Citations ids={m.refs} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function RecCard({ item, cur }: { item: PlanItem; cur: import("../../lib/types").Currency }) {
  const [open, setOpen] = useState(false);
  const cost =
    item.monthly[1] > 0
      ? `${money(item.monthly[0], cur)}–${money(item.monthly[1], cur)}/mo`
      : item.oneOff[1] > 0
        ? `${money(item.oneOff[0], cur)}–${money(item.oneOff[1], cur)} once`
        : "Free";
  return (
    <article className="pr-rec">
      <header className="pr-rec-head">
        <h3>{item.title}</h3>
        <div className="pr-rec-badges">
          <GradeBadge grade={item.grade} />
          <span className="chip mono-chip pr-phase">Phase {item.phase}</span>
          {item.clinical && <span className="chip mono-chip">Clinical · consult</span>}
        </div>
      </header>
      <p className="pr-rec-why">{item.why}</p>
      {item.reviewerNote && (
        <p className="pr-rec-note">
          <b>Reviewer note</b> {item.reviewerNote}
        </p>
      )}
      <div className="mono-sm">How</div>
      <ul className="bullets pr-rec-how">
        {item.how.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>
      <div className="pr-rec-meta">
        <div><span className="mono-sm">Visible in</span><span>{item.timeToVisible}</span></div>
        <div><span className="mono-sm">Cost</span><span>{cost}</span></div>
      </div>
      <div className="pr-rec-foot">
        <div className="pr-chips">
          {item.drivenBy.map((d) => (
            <span key={d} className="chip">{d}</span>
          ))}
        </div>
        {item.refs.length > 0 && (
          <button className="pr-src" onClick={() => setOpen((o) => !o)}>
            {item.refs.map(shortCite).join(" · ")} {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
      </div>
      {open && <Citations ids={item.refs} />}
      {item.id === "lifting" && (
        <Link to="/analysis/training" className="pr-book">
          See your muscle-by-muscle plan →
        </Link>
      )}
      {item.partner && (
        <Link to="/analysis/partners" className="pr-book">
          Partner support · coming soon
        </Link>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Action plan                                                         */
/* ------------------------------------------------------------------ */

export function ActionPlan(p: SectionProps) {
  const { progress } = useActive();
  // Stagger habits: start with priority-1 foundations, layer the rest in later phases
  // so the plan isn't 14 new habits in week one.
  const rows = p.plan.items.flatMap((it) =>
    it.tasks.map((t) => ({ it, t, key: `${it.id}:${t.id}`, phase: Math.max(it.phase, it.priority) as 1 | 2 | 3 })),
  );
  const done = rows.filter((r) => progress[r.key]).length;
  const pct = rows.length ? Math.round((done / rows.length) * 100) : 0;
  return (
    <div className="page">
      <PageHeader kicker="Action plan" muted="Your" strong="action plan" mutedFirst lead="Start with the foundations; later phases build on them. Tick off habits as you set them up — progress is saved on this device." />
      <div className="pr-overall">
        <div>
          <div className="mono-sm">Overall setup</div>
          <div className="pr-overall-num">{pct}%</div>
        </div>
        <div className="pr-overall-bar"><i style={{ width: `${pct}%` }} /></div>
        <div className="pr-overall-count">{done}/{rows.length} habits in place</div>
      </div>
      <div className="pr-phases">
        {PHASES.map((ph) => {
          const list = rows.filter((r) => r.phase === ph.id);
          const d = list.filter((r) => progress[r.key]).length;
          return (
            <section key={ph.id} className="pr-phase-col">
              <header>
                <div className="mono-sm">Phase {ph.id} · {ph.sub}</div>
                <div className="pr-phase-title">{ph.label}</div>
                <div className="pr-phase-bar"><i style={{ width: `${list.length ? (d / list.length) * 100 : 0}%` }} /></div>
                <div className="pr-phase-count">{d}/{list.length} done</div>
              </header>
              {list.length === 0 && <p className="pr-fine">Nothing new in this phase — keep the earlier habits going.</p>}
              {list.map(({ it, t, key }) => (
                <label key={key} className={`pr-task ${progress[key] ? "done" : ""}`}>
                  <input type="checkbox" checked={!!progress[key]} onChange={() => toggleProgress(p.profile.id, key)} />
                  <span className="pr-check" />
                  <span className="pr-task-text">
                    <span>{t.label}</span>
                    <span className="pr-task-sub">{it.title}</span>
                  </span>
                  <span className={`chip mono-chip pr-cad pr-cad-${t.cadence}`}>{t.cadence}</span>
                </label>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Estimations                                                         */
/* ------------------------------------------------------------------ */

export function Estimations(p: SectionProps) {
  const cur = useAppState().settings.currency;
  const cats = new Map<string, { lo: number; hi: number; oLo: number; oHi: number; items: string[] }>();
  for (const it of p.plan.items) {
    const c = cats.get(it.category) ?? { lo: 0, hi: 0, oLo: 0, oHi: 0, items: [] };
    c.lo += it.monthly[0];
    c.hi += it.monthly[1];
    c.oLo += it.oneOff[0];
    c.oHi += it.oneOff[1];
    c.items.push(it.title);
    cats.set(it.category, c);
  }
  const rows = [...cats.entries()].map(([k, v]) => ({ k, ...v, yLo: v.lo * 12 + v.oLo, yHi: v.hi * 12 + v.oHi }));
  const tot = rows.reduce((s, r) => ({ lo: s.lo + r.lo, hi: s.hi + r.hi, yLo: s.yLo + r.yLo, yHi: s.yHi + r.yHi }), { lo: 0, hi: 0, yLo: 0, yHi: 0 });
  const max = Math.max(1, ...rows.map((r) => r.yHi));
  return (
    <div className="page">
      <PageHeader kicker="Estimations" muted="Your" strong="investment" mutedFirst lead="A detailed estimate of the expected cost of your protocol, organised by category, to help you see where the budget goes and prioritise." />
      <div className="pr-est-top">
        <div className="pr-est-card pr-gcard-dark">
          <div className="mono-sm">Monthly</div>
          <div className="pr-est-num">{money(tot.lo, cur)}–{money(tot.hi, cur)}</div>
        </div>
        <div className="pr-est-card">
          <div className="mono-sm">First 12 months</div>
          <div className="pr-est-num">{money(tot.yLo, cur)}–{money(tot.yHi, cur)}</div>
        </div>
      </div>
      <div className="pr-card pr-table">
        <div className="pr-tr pr-th mono-sm">
          <span>Category</span>
          <span>Monthly</span>
          <span>One-off</span>
          <span>12 months</span>
          <span />
        </div>
        {rows.map((r) => (
          <div key={r.k} className="pr-tr">
            <span>
              <b>{r.k}</b>
              <small>{r.items.join(" · ")}</small>
            </span>
            <span>{r.hi ? `${money(r.lo, cur)}–${money(r.hi, cur)}` : "—"}</span>
            <span>{r.oHi ? `${money(r.oLo, cur)}–${money(r.oHi, cur)}` : "—"}</span>
            <span>{r.yHi ? `${money(r.yLo, cur)}–${money(r.yHi, cur)}` : "Free"}</span>
            <span className="pr-est-bar">
              <i style={{ left: `${(r.yLo / max) * 100}%`, width: `${Math.max(1, ((r.yHi - r.yLo) / max) * 100)}%` }} />
              <em style={{ width: `${(r.yLo / max) * 100}%` }} />
            </span>
          </div>
        ))}
      </div>
      <p className="pr-fine">Approximate retail prices, converted at a fixed rate; gym, barber and clinic prices vary widely by city. Clinical items exclude consultation fees unless stated.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Progress                                                            */
/* ------------------------------------------------------------------ */

export function Progress(p: SectionProps) {
  const intake = p.profile.intake;
  const pts = p.scans.map((s) => ({ date: new Date(s.createdAt), score: overall(currentScores(s, intake)), scan: s }));
  const first = pts[0]?.date ?? new Date();
  const end = new Date(first.getTime() + 365 * 864e5);
  const last = pts[pts.length - 1];
  const W = 720, H = 260, L = 44, R = 20, T = 24, B = 34;
  const x = (d: Date) => L + ((d.getTime() - first.getTime()) / (end.getTime() - first.getTime())) * (W - L - R);
  const lo = Math.max(0, Math.floor((Math.min(...pts.map((q) => q.score), p.plan.overallNow) - 10) / 10) * 10);
  const hi = Math.min(100, Math.ceil((p.plan.overallProjected + 6) / 10) * 10);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const ticks = [lo, (lo + hi) / 2, hi].map(Math.round);
  return (
    <div className="page">
      <PageHeader
        kicker="Progress"
        muted="Your"
        strong="progress"
        mutedFirst
        lead="Each check-in is measured the same way, so changes reflect you — not the camera. Take check-ins in the same place, light and distance."
        right={<Link to={`/new/${p.profile.id}`} className="btn">New check-in</Link>}
      />
      <div className="pr-card pr-chart">
        <div className="pr-chart-head">
          <div className="mono-sm">Overall score</div>
          <div className="pr-legend mono-sm">
            <span><i className="sw-on" /> With plan</span>
            <span><i className="sw-off" /> Without plan</span>
          </div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#f0efef" />
              <text x={L - 10} y={y(t) + 4} textAnchor="end" className="pr-axis">{t}</text>
            </g>
          ))}
          {last && (
            <>
              <line x1={x(last.date)} y1={y(last.score)} x2={x(end)} y2={y(p.plan.overallProjected)} stroke="#69565a" strokeDasharray="5 5" strokeWidth={1.4} />
              <line x1={x(last.date)} y1={y(last.score)} x2={x(end)} y2={y(last.score)} stroke="#915965" strokeDasharray="2 5" strokeWidth={1.4} />
            </>
          )}
          <polyline points={pts.map((q) => `${x(q.date)},${y(q.score)}`).join(" ")} fill="none" stroke="#69565a" strokeWidth={1.6} />
          {pts.map((q, i) => (
            <g key={i}>
              <circle cx={x(q.date)} cy={y(q.score)} r={5} fill="#fff" stroke="#69565a" strokeWidth={1.4} />
              {i === pts.length - 1 && (
                <g transform={`translate(${x(q.date)},${y(q.score) - 22})`}>
                  <rect x={-18} y={-12} width={36} height={20} rx={5} fill="#fff" stroke="#e6dee0" />
                  <text y={3} textAnchor="middle" className="pr-bubble">{Math.round(q.score)}</text>
                </g>
              )}
            </g>
          ))}
          <g transform={`translate(${x(end) - 4},${y(p.plan.overallProjected) - 20})`}>
            <rect x={-30} y={-12} width={36} height={20} rx={5} fill="#69565a" />
            <text x={-12} y={3} textAnchor="middle" className="pr-bubble pr-bubble-on">{Math.round(p.plan.overallProjected)}</text>
          </g>
          <text x={L} y={H - 10} className="pr-axis">{first.toLocaleDateString(undefined, { month: "short", year: "numeric" })}</text>
          <text x={W - R} y={H - 10} textAnchor="end" className="pr-axis">+12 months</text>
        </svg>
      </div>
      <div className="pr-card pr-table pr-checkins">
        <div className="pr-tr pr-th mono-sm">
          <span>Check-in</span>
          <span>Overall</span>
          <span>Skin</span>
          <span>Leanness</span>
          <span>Body</span>
        </div>
        {pts.map((q, i) => {
          const s = currentScores(q.scan, intake);
          const f = (v?: number) => (v == null ? "—" : Math.round(v));
          return (
            <div key={q.scan.id} className="pr-tr">
              <span><b>#{i + 1}</b> <small>{q.date.toLocaleDateString()}</small></span>
              <span>{f(q.score)} <small>{band(q.score)}</small></span>
              <span>{f(s.skin)}</span>
              <span>{f(s.leanness)}</span>
              <span>{f(s.body)}</span>
            </div>
          );
        })}
      </div>
      {pts.length < 2 && <p className="pr-fine">Add a check-in every 4–6 weeks to see your trend line.</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Summary ("{Name}'s Protocol")                                       */
/* ------------------------------------------------------------------ */

export function Summary(p: SectionProps) {
  const { plan, visuals, profile } = p;
  const first = profile.intake.name.split(" ")[0];
  const owner = first.toLowerCase() === "you" ? "Your" : first.endsWith("s") ? `${first}'` : `${first}'s`;
  const keys = Object.keys(plan.current) as ScoreKey[];
  const short: Record<ScoreKey, string> = { skin: "Skin", leanness: "Leanness", rested: "Rested", symmetry: "Symmetry", harmony: "Harmony", body: "Body", posture: "Posture", core: "Core" };
  const gain = plan.overallProjected - plan.overallNow;
  return (
    <div className="page">
      <section className="page-card pr-sum">
        <h1 className="title-xl">
          {owner} <span className="hl">Protocol</span>
        </h1>
        <div className="pr-sum-photos">
          <div className="pr-sum-ph">
            <Img src={visuals.baseline ?? p.facePhoto} />
            <span className="photo-tag pr-sum-tag">Before</span>
          </div>
          <div className="pr-sum-ph">
            {visuals.after ? <Img src={visuals.after} /> : <Link to="/analysis/projection" className="pr-sum-empty">After image in preparation in Visualization →</Link>}
            <span className="photo-tag pr-sum-tag">After</span>
          </div>
        </div>
        <div className="pr-sum-mid">
          <div>
            <h2 className="title-md">Projected potential</h2>
            <p className="pr-sum-text">
              This report is organised around <b>{keys.length} measured areas</b> and <b>{plan.items.length} evidence-graded steps</b>:
            </p>
            <ul className="bullets pr-sum-list">
              {keys.map((k) => (
                <li key={k}>{SCORE_LABEL[k]}</li>
              ))}
            </ul>
          </div>
          <Radar
            title={`OVERALL SCORE ${Math.round(plan.overallNow)}`}
            axes={keys.map((k) => short[k])}
            series={[
              { name: "Projected potential", values: keys.map((k) => plan.projected[k]!), tone: "a" },
              { name: "Client values", values: keys.map((k) => plan.current[k]!), tone: "b" },
            ]}
          />
        </div>
        <h2 className="pr-sum-reads">
          Your projected face score: <span className="hl">{gain > 0 ? `+${Math.round(gain)} points` : "about the same"}</span> after 12 months on the plan.
        </h2>
        <div className="pr-sum-cards">
          <div className="pr-age">
            <div>Real age</div>
            <b>{profile.intake.age}</b>
          </div>
          <div className="pr-age pr-age-dark">
            <div>Projected score</div>
            <b>{Math.round(plan.overallNow)} → {Math.round(plan.overallProjected)}</b>
          </div>
        </div>
        <p className="pr-sum-text">
          {plan.drivers.length ? `Biggest levers: ${plan.drivers.join(", ").toLowerCase()}.` : "You're already close to your potential — the plan focuses on maintenance."} Bone structure is held constant; gains come from skin, body composition, sleep, training and grooming.
        </p>
        <div className="pr-sum-actions">
          <Link to="/protocol" className="btn">Open protocol document</Link>
          <Link to="/analysis/recommendations" className="btn btn-ghost">See recommendations</Link>
        </div>
      </section>
    </div>
  );
}
