import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Logo } from "../components/Logo";
import { SpectrumBar, Toggle, shortCite } from "../components/ui";
import { ChevronDown, Verified } from "../components/icons";
import { METHODS } from "../lib/science";
import { buildPlan } from "../lib/plan";
import { buildNutrition } from "../lib/nutrition";
import { refreshBody } from "../lib/bodyAnalysis";
import { SCORE_LABEL, type ScoreKey } from "../lib/report";
import { sampleProfile, sampleScan } from "../lib/sample";
import "./Landing.css";
import { CompleteAnalysis, LooksInfluence, PersonalPlan, TakingIntoAccount, YouWillLearn } from "./LandingSections";
import { Ancestry, DiscoverYou, FollowPlan, LifeChanging, Mindset, NoSurgery, Pillars, StartCta, Support, Technology } from "./LandingSections2";

const S = `${import.meta.env.BASE_URL}sample/`;

type Cur = "AED" | "SAR" | "EUR";
const PRICE: Record<"report" | "premium" | "month" | "year", Record<Cur, string>> = {
  report: { AED: "AED 199", SAR: "SAR 199", EUR: "€49" },
  premium: { AED: "AED 399", SAR: "SAR 399", EUR: "€99" },
  month: { AED: "AED 49", SAR: "SAR 49", EUR: "€12" },
  year: { AED: "AED 399", SAR: "SAR 399", EUR: "€99" },
};

/* ------------------------------------------------------------------ */
/*  Real sample data (synthetic person, real pipeline)                 */
/* ------------------------------------------------------------------ */

function useSample() {
  return useMemo(() => {
    const intake = sampleProfile.intake;
    const scan = sampleScan.body
      ? { ...sampleScan, body: refreshBody(sampleScan.body, intake, sampleScan.bodySide?.metrics ?? null) }
      : sampleScan;
    const plan = buildPlan(scan, intake);
    const nut = buildNutrition(scan, intake, plan);
    return { intake, scan, plan, nut: nut.ok ? nut : null };
  }, []);
}

/* ------------------------------------------------------------------ */
/*  Small building blocks                                              */
/* ------------------------------------------------------------------ */

function Pill({ children, light }: { children: ReactNode; light?: boolean }) {
  return <span className={`lp-pill ${light ? "lp-pill-light" : ""}`}>{children}</span>;
}

function Title({ dark, muted, mutedFirst, as = "h2", light }: { dark: string; muted: string; mutedFirst?: boolean; as?: "h1" | "h2"; light?: boolean }) {
  const Tag = as;
  return (
    <Tag className={`lp-title ${as === "h1" ? "lp-title-xl" : ""} ${light ? "lp-title-light" : ""}`}>
      {mutedFirst ? (
        <>
          <span className="lp-muted">{muted}</span> {dark}
        </>
      ) : (
        <>
          {dark} <span className="lp-muted">{muted}</span>
        </>
      )}
    </Tag>
  );
}

function Head({ kicker, dark, muted, mutedFirst, lead, center, light }: { kicker: string; dark: string; muted: string; mutedFirst?: boolean; lead?: ReactNode; center?: boolean; light?: boolean }) {
  return (
    <header className={`lp-head ${center ? "lp-center" : ""}`}>
      <Pill light={light}>{kicker}</Pill>
      <Title dark={dark} muted={muted} mutedFirst={mutedFirst} light={light} />
      {lead && <p className={`lp-lead ${light ? "lp-lead-light" : ""}`}>{lead}</p>}
    </header>
  );
}


/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function Landing() {
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" }), 60);
    return () => clearTimeout(t);
  }, [hash]);

  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const data = useSample();

  return (
    <div className="lp">
      <nav className={`lp-nav ${scrolled ? "lp-nav-solid" : ""}`}>
        <div className="lp-nav-in">
          <Link to="/" className="lp-logo">
            <Logo size={22} />
            <span>Facet</span>
          </Link>
          <div className="lp-nav-links">
            <a href="#why">Why glow up</a>
            <a href="#how">How it works</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </div>
          <Link to="/protocols" className="lp-btn lp-btn-nav">
            Open app
          </Link>
        </div>
      </nav>

      <Hero />
      <div className="lp-frame">
        <LifeChanging />
        <LooksInfluence />
        <BetterWay />
      </div>
      <CompleteAnalysis data={data} />
      <div className="lp-frame">
        <TakingIntoAccount data={data} />
        <YouWillLearn data={data} />
      </div>
      <PersonalPlan data={data} />
      <div className="lp-frame">
        <NoSurgery />
        <FollowPlan data={data} />
        <FutureSelf />
        <Track data={data} />
      </div>
      <Pillars />
      <div className="lp-frame">
        <Measures />
        <DiscoverYou data={data} />
        <Technology />
        <Ancestry />
      </div>
      <StartCta />
      <div className="lp-frame">
        <How />
        <Pricing />
        <Support />
        <CareNetwork />
        <Faq />
        <Mindset />
      </div>
      <footer className="lp-foot">
        <div className="lp-foot-in">
          <div className="lp-logo">
            <Logo size={20} />
            <span>Facet</span>
          </div>
          <div className="lp-foot-links">
            <Link to="/protocols">Open app</Link>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
            <Link to="/analysis/methodology">Methodology</Link>
          </div>
          <p className="lp-foot-note">Not medical advice · Product imagery uses a synthetic person · After images are AI illustrations, not results · © {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  1 · Hero                                                           */
/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="lp-hero">
      <img className="lp-hero-img" src={`${S}face.jpg`} alt="" aria-hidden />
      <div className="lp-hero-in">
        <div className="lp-hero-text">
          <span className="lp-hero-eyebrow">Facial &amp; body analysis</span>
          <h1 className="lp-hero-title">
            See where you stand,
            <br />
            <span>measured, not guessed.</span>
          </h1>
          <p className="lp-hero-lead">A science-referenced analysis of your face and body, and a 12-month plan built from it.</p>
          <div className="lp-hero-cta">
            <Link to="/new" className="lp-btn lp-btn-white">
              Start my scan
            </Link>
            <a href="#how" className="lp-btn lp-btn-glass">
              How it works
            </a>
          </div>
        </div>
        <div className="lp-trust">
          {[
            ["Science-referenced", "Every step evidence-graded"],
            ["Human-reviewed", "Before you see it"],
            ["Non-surgical", "A habit-based 12-month plan"],
          ].map(([a, b]) => (
            <div key={a}>
              <b>{a}</b>
              <span>{b}</span>
            </div>
          ))}
        </div>
      </div>
      <span className="lp-hero-cap">Synthetic sample person</span>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  2 · Realistic change                                              */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  3 · Research                                                       */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  4 · Better way                                                     */
/* ------------------------------------------------------------------ */

function BetterWay() {
  const old = ["Fixate on one feature", "Visit a clinic", "No assessment", "Procedures first", "Results that don't fit you"];
  const ours = ["Look at your face and body as a whole", "Your analysis, reviewed by a person", "See your 12-month visual", "Your personalised protocol", "Track real change"];
  return (
    <section className="lp-sec">
      <Head center kicker="Personalised analysis" dark="A new way to" muted="glow up." mutedFirst={false} lead="Most advice is one-size-fits-all and starts with a procedure. We start with your measurements, your goals and the evidence." />
      <div className="lp-rails">
        <Rail label="The old way" steps={old} />
        <Rail label="The new way" steps={ours} dark />
      </div>
    </section>
  );
}

function Rail({ label, steps, dark }: { label: string; steps: string[]; dark?: boolean }) {
  return (
    <div className={`lp-rail ${dark ? "lp-rail-dark" : ""}`}>
      <div className="lp-rail-label">
        <span className="lp-rail-ico">{dark ? <Logo size={16} /> : "—"}</span>
        {label}
      </div>
      <ol>
        {steps.map((s, i) => (
          <li key={s}>
            <span className="lp-rail-dot" />
            <span className="lp-rail-step">Step {i + 1}</span>
            <span className="lp-rail-text">{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  5 · Analysis band (real landmarks)                                 */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  6 · Plan                                                           */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  7 · Future self                                                    */
/* ------------------------------------------------------------------ */

function FutureSelf() {
  const tiles: { t: string; d: string; v: ReactNode }[] = [
    { t: "Realistic visualisation", d: "Only changes that skin care, fat loss, grooming and training can make.", v: <VizPair /> },
    { t: "Ethnicity-aware", d: "Generated to keep your skin tone and features — checked by a human.", v: <VizSwatches /> },
    { t: "Achievable without surgery", d: "Bone structure stays the same; we re-measure it to check.", v: <VizBars /> },
    { t: "Reviewed by a human", d: "Every image is checked before it reaches you.", v: <VizCheck /> },
  ];
  return (
    <section className="lp-sec">
      <Head center kicker="Visualisation" dark="See your" muted="future you." mutedFirst={false} lead="Ever wondered what you would look like at your best? An AI illustration of your plan’s end point, not a photo or a guarantee." />
      <div className="lp-future">
        <div className="lp-future-col">
          {tiles.slice(0, 2).map((x) => (
            <Tile key={x.t} {...x} />
          ))}
        </div>
        <figure className="lp-future-photo">
          <img src={`${S}face_after.jpg`} alt="AI-generated 12-month visual (synthetic sample)" />
          <figcaption>AI illustration · 12 months · synthetic sample</figcaption>
        </figure>
        <div className="lp-future-col">
          {tiles.slice(2).map((x) => (
            <Tile key={x.t} {...x} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Tile({ t, d, v }: { t: string; d: string; v: ReactNode }) {
  return (
    <div className="lp-tile">
      <div className="lp-tile-viz">{v}</div>
      <h3>{t}</h3>
      <p>{d}</p>
    </div>
  );
}
const VizPair = () => (
  <div className="viz viz-pair">
    <i />
    <i />
  </div>
);
const VizSwatches = () => (
  <div className="viz viz-sw">
    {["#e8cdb4", "#d4ab88", "#b98a63", "#8d6446", "#5f4130"].map((c) => (
      <i key={c} style={{ background: c }} />
    ))}
  </div>
);
const VizBars = () => (
  <div className="viz viz-bars">
    {[70, 45, 85, 60].map((h, i) => (
      <i key={i} style={{ height: `${h}%` }} />
    ))}
  </div>
);
const VizCheck = () => (
  <div className="viz viz-check">
    <span>
      <Verified size={18} />
    </span>
  </div>
);

/* ------------------------------------------------------------------ */
/*  8 · Track                                                          */
/* ------------------------------------------------------------------ */

function Track({ data }: { data: ReturnType<typeof useSample> }) {
  const order: ScoreKey[] = ["symmetry", "harmony", "skin", "core", "posture", "body"];
  const keys = order.filter((k) => data.plan.current[k] != null);
  const cards = keys.slice(0, 6).map((k) => {
    const now = data.plan.current[k]!;
    const next = data.plan.projected[k] ?? now;
    const status = next - now > 3 ? "Improving" : now >= 80 ? "Balanced" : "Focus";
    return { k, now, next, status };
  });
  const left = cards.slice(0, 3);
  const right = cards.slice(3);
  return (
    <section className="lp-sec">
      <Head center kicker="Your biometrics" dark="Track your progress." muted="See where you’re heading." lead="Monthly check-ins in the same set-up, measured against your baseline. Scores are our composites of literature-based measures, not clinical scores." />
      <div className="lp-track">
        <div className="lp-track-col">
          {left.map((c) => (
            <MetricCard key={c.k} {...c} />
          ))}
        </div>
        <Chart now={data.plan.overallNow} next={data.plan.overallProjected} />
        <div className="lp-track-col">
          {right.map((c) => (
            <MetricCard key={c.k} {...c} />
          ))}
        </div>
      </div>
    </section>
  );
}

function MetricCard({ k, now, status }: { k: ScoreKey; now: number; next: number; status: string }) {
  return (
    <div className="lp-metric">
      <div className="lp-metric-top">
        <span>{SCORE_LABEL[k]}</span>
        <span className={`lp-status lp-status-${status.toLowerCase()}`}>{status}</span>
      </div>
      <b>{Math.round(now)}</b>
      <SpectrumBar value={now / 100} labels={["0", "You", "100"]} />
    </div>
  );
}

function Chart({ now, next }: { now: number; next: number }) {
  const W = 320, H = 240, pad = 32;
  const y = (v: number) => H - pad - ((v - 40) / 60) * (H - pad * 2);
  const x = (i: number) => pad + (i * (W - pad * 2)) / 2;
  const mid = now + (next - now) * 0.6;
  return (
    <div className="lp-chart">
      <div className="lp-chart-legend">
        <span>
          <i className="sw-a" /> With plan
        </span>
        <span>
          <i className="sw-b" /> Without
        </span>
      </div>
      <div className="lp-chart-big">
        <span className="mono-sm">Overall score (composite)</span>
        <b>
          {Math.round(now)} <i>→</i> {Math.round(next)}
        </b>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%">
        {[40, 60, 80, 100].map((v) => (
          <g key={v}>
            <line x1={pad} x2={W - pad} y1={y(v)} y2={y(v)} stroke="#e9e8e8" />
            <text x={pad - 8} y={y(v) + 3} textAnchor="end" className="lp-chart-ax">
              {v}
            </text>
          </g>
        ))}
        <polyline points={`${x(0)},${y(now)} ${x(1)},${y(now)} ${x(2)},${y(now)}`} fill="none" stroke="#905864" strokeDasharray="4 4" />
        <polyline points={`${x(0)},${y(now)} ${x(1)},${y(mid)} ${x(2)},${y(next)}`} fill="none" stroke="#69565a" strokeWidth={1.6} />
        <circle cx={x(0)} cy={y(now)} r={4} fill="#fff" stroke="#69565a" />
        <circle cx={x(2)} cy={y(next)} r={4} fill="#69565a" />
        <g transform={`translate(${x(0)}, ${y(now) - 18})`}>
          <rect x={-16} y={-12} width={32} height={18} rx={5} fill="#71454f" />
          <text x={0} y={1} textAnchor="middle" fill="#fff" fontSize={10}>
            {Math.round(now)}
          </text>
        </g>
        {["Now", "6 mo", "12 mo"].map((t, i) => (
          <text key={t} x={x(i)} y={H - 8} textAnchor="middle" className="lp-chart-ax">
            {t}
          </text>
        ))}
      </svg>
      <span className="mono-sm">Projected estimate, not a guarantee · synthetic sample</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  9 · What we measure                                               */
/* ------------------------------------------------------------------ */

const MEASURES: { name: string; n: number; text: string; method?: string; refs?: string[] }[] = [
  { name: "Face proportions", n: 8, text: "Facial thirds and fifths, nose and mouth widths, lip-to-chin height — against anthropometric norms.", method: "proportions" },
  { name: "Symmetry & averageness", n: 3, text: "17 mirrored landmark pairs after 3D head-pose correction; closeness to population averages.", method: "averageness" },
  { name: "Eyes & brows", n: 7, text: "Canthal tilt, eye openness and spacing; brow arch, peak, thickness and height.", method: "brows" },
  { name: "Nose & lips", n: 5, text: "Nasal width vs. eye spacing, lip ratio and fullness, mouth-corner tilt.", method: "lips" },
  { name: "Jaw & chin", n: 4, text: "Jaw-to-face width, chin width, facial width-to-height ratio.", method: "fwhr" },
  { name: "Skin", n: 6, text: "Six regions read in CIELAB colour space: pigment, redness, texture and evenness.", method: "skin" },
  { name: "Body proportions", n: 6, text: "Shoulder-to-waist, waist-to-hip, chest and arm widths, left/right balance.", method: "body" },
  { name: "Posture", n: 5, text: "Shoulder and pelvis lines from the front; head and shoulder position from the side.", method: "sidePosture" },
  { name: "Composition", n: 4, text: "BMI, photo-estimated waist, waist-to-height and body-fat estimate (±4–5 points).", method: "composition" },
  { name: "Nutrition", n: 6, text: "Energy needs, calorie target, protein, fat, carbs and fibre for each phase.", refs: ["mifflin1990", "morton2018"] },
];

/* ------------------------------------------------------------------ */
/*  Care network · partners + integrations + follow-ups                */
/* ------------------------------------------------------------------ */

const PARTNERS = [
  {
    k: "derm",
    name: "Dermatologists",
    who: "Licensed (DHA / MOH registration required)",
    out: "Your skin findings & photos you choose to share",
    back: "Prescriptions and notes update your skin plan",
    cadence: "Follow-ups at weeks 6 and 12",
  },
  {
    k: "diet",
    name: "Dietitians & meal kitchens",
    who: "Registered dietitians, macro-matched meals",
    out: "Calorie & macro targets, phase, allergies",
    back: "Weekly weigh-ins adjust your targets",
    cadence: "Check-ins every 2 weeks",
  },
  {
    k: "inbody",
    name: "Body composition",
    who: "InBody & DEXA centres",
    out: "Booking request only",
    back: "Measured body fat replaces the photo estimate",
    cadence: "Baseline, then every 3 months",
  },
  {
    k: "coach",
    name: "Coaches & trainers",
    who: "Certified personal trainers",
    out: "Your training split & posture priorities",
    back: "Logged sessions feed your progress",
    cadence: "Weekly sessions",
  },
  {
    k: "clinic",
    name: "Non-surgical clinics",
    who: "Licensed aesthetic practitioners",
    out: "Only the plan section you select",
    back: "Consultation outcome added to your plan",
    cadence: "Consultation first, always",
  },
];

const FOLLOW = [
  { t: "Week 0", d: "Analysis & plan, reviewed" },
  { t: "Week 2", d: "Partner intros booked" },
  { t: "Week 6", d: "Dermatologist follow-up" },
  { t: "Month 3", d: "InBody re-scan · plan update" },
  { t: "Month 6", d: "Check-in · new 12-month visual" },
  { t: "Month 12", d: "Final report & next goals" },
];

function CareNetwork() {
  const [active, setActive] = useState(0);
  const p = PARTNERS[active];
  return (
    <section className="lp-sec" id="care">
      <Head
        center
        kicker="Care network · coming soon"
        dark="Your plan, carried out"
        muted="by specialists."
        lead="Coming soon: licensed dermatologists, registered dietitians and vetted specialists, connected to your plan with follow-ups built in. We're onboarding partners now."
      />
      <div className="lp-care">
        <div className="lp-hub">
          <svg viewBox="0 0 400 400" className="lp-hub-lines" aria-hidden>
            {PARTNERS.map((_, i) => {
              const a = -Math.PI / 2 + (i * 2 * Math.PI) / PARTNERS.length;
              return (
                <line
                  key={i}
                  x1={200}
                  y1={200}
                  x2={200 + Math.cos(a) * 150}
                  y2={200 + Math.sin(a) * 150}
                  className={i === active ? "on" : ""}
                />
              );
            })}
          </svg>
          <div className="lp-hub-core">
            <span className="lp-mono">Your plan</span>
            <b>Targets · follow-ups · results</b>
          </div>
          {PARTNERS.map((x, i) => {
            const a = -Math.PI / 2 + (i * 2 * Math.PI) / PARTNERS.length;
            return (
              <button
                key={x.k}
                className={`lp-hub-node ${i === active ? "on" : ""}`}
                style={{ left: `${50 + Math.cos(a) * 37.5}%`, top: `${50 + Math.sin(a) * 37.5}%` }}
                onClick={() => setActive(i)}
              >
                {x.name}
              </button>
            );
          })}
        </div>
        <div className="lp-care-card">
          <span className="lp-mono">Planned integration</span>
          <h3>{p.name}</h3>
          <p className="lp-care-who">{p.who}</p>
          <div className="lp-care-rows">
            <div><span className="lp-mono">Sent from your plan</span><span>{p.out}</span></div>
            <div><span className="lp-mono">Comes back</span><span>{p.back}</span></div>
            <div><span className="lp-mono">Follow-up</span><span>{p.cadence}</span></div>
          </div>
          <p className="lp-care-note">You choose what's shared, booking by booking. Photos are never shared automatically.</p>
        </div>
      </div>

      <div className="lp-follow">
        {FOLLOW.map((f, i) => (
          <div key={f.t} className="lp-follow-step">
            <i>{i + 1}</i>
            <b>{f.t}</b>
            <span>{f.d}</span>
          </div>
        ))}
      </div>
      <p className="lp-care-launch lp-mono">Partner network not yet live · launching in the UAE & Saudi Arabia</p>
    </section>
  );
}

function Measures() {
  const [open, setOpen] = useState<number | null>(0);
  // nutrition rows are targets, not measurements of you
  const total = MEASURES.filter((m) => m.name !== "Nutrition").reduce((s, m) => s + m.n, 0);
  return (
    <section className="lp-sec">
      <Head center kicker="Assessments" dark={`${total}`} muted="assessments." mutedFirst={false} lead={`Included in your analysis, across ${MEASURES.length - 1} areas, from a few guided photos at home. Plus 100 feature types in the library.`} />
      <div className="lp-acc">
        {MEASURES.map((m, i) => {
          const refs = m.refs ?? (m.method ? METHODS[m.method]?.refs ?? [] : []);
          const isOpen = open === i;
          return (
            <div key={m.name} className={`lp-acc-row ${isOpen ? "open" : ""}`}>
              <button className="lp-acc-head" onClick={() => setOpen(isOpen ? null : i)}>
                <span className="lp-acc-thumb" />
                <span className="lp-acc-name">{m.name}</span>
                <span className="lp-acc-n">{m.n} measurements</span>
                <span className="lp-acc-ico">{isOpen ? "−" : "+"}</span>
              </button>
              {isOpen && (
                <div className="lp-acc-body">
                  <p>{m.text}</p>
                  {refs.length > 0 && <span className="lp-acc-refs">{refs.slice(0, 3).map(shortCite).join(" · ")}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  10 · How it works                                                  */
/* ------------------------------------------------------------------ */

function How() {
  return (
    <section className="lp-sec" id="how">
      <Head center kicker="How it works" dark="How it" muted="works." mutedFirst={false} lead="Your personalised analysis from home, in three simple steps." />
      <div className="lp-how">
        <div className="lp-howcard">
          <div className="lp-how-viz">
            <div className="hv-upload">
              <div className="hv-drop">
                <span>↑</span>
                Upload photos
              </div>
              <div className="hv-thumbs">
                {["face.jpg", "face_left.jpg", "body_front.jpg", "body_side.jpg"].map((f) => (
                  <img key={f} src={`${S}${f}`} alt="" />
                ))}
              </div>
            </div>
          </div>
          <span className="lp-how-n">1</span>
          <h3>Upload</h3>
          <p>A front portrait, a full-body and a side photo, plus height and weight.</p>
        </div>
        <div className="lp-howcard">
          <div className="lp-how-viz">
            <div className="hv-list">
              {["Facial landmarks", "Skin regions", "Body silhouette", "Expert review"].map((t, i) => (
                <div key={t} className={i < 3 ? "done" : ""}>
                  {t}
                  <span>{i < 3 ? "✓" : "…"}</span>
                </div>
              ))}
            </div>
          </div>
          <span className="lp-how-n">2</span>
          <h3>Measure &amp; review</h3>
          <p>Measured on your device, then checked by a human before release.</p>
        </div>
        <div className="lp-howcard">
          <div className="lp-how-viz">
            <div className="hv-report">
              <div className="hv-report-head">Your report</div>
              <div className="hv-report-row">
                <img src={`${S}face.jpg`} alt="" />
                <img src={`${S}face_after.jpg`} alt="" />
              </div>
              <div className="hv-report-lines">
                <i />
                <i />
                <i />
              </div>
            </div>
          </div>
          <span className="lp-how-n">3</span>
          <h3>Your plan</h3>
          <p>Your analysis, your 12-month visual and an evidence-graded plan.</p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  11 · Pricing                                                       */
/* ------------------------------------------------------------------ */

function Pricing() {
  const [cur, setCur] = useState<Cur>("AED");
  const features: [string, string][] = [
    ["Face & body analysis", "48 measurements against reference ranges."],
    ["Evidence-graded 12-month plan", "Every step graded A–C and cited."],
    ["Your 12-month visuals", "Face and body, front and side — reviewed by a human."],
    ["Nutrition targets", "Calories and macros for each phase of your plan."],
    ["Progress tracking", "Check in and compare against your baseline."],
  ];
  return (
    <section className="lp-sec" id="pricing">
      <Head center kicker="Pricing" dark="One analysis." muted="A plan for the year." lead="Prices include VAT." />
      <div className="lp-price">
        <ul className="lp-price-list">
          {features.map(([t, d]) => (
            <li key={t}>
              <Verified size={16} />
              <div>
                <b>{t}</b>
                <span>{d}</span>
              </div>
            </li>
          ))}
        </ul>
        <div className="lp-price-side">
          <div className="lp-price-card">
            <div className="lp-price-top">
              <div>
                <span className="lp-price-name">Glow-Up Report</span>
                <span className="lp-price-sub">One-off · face + body</span>
              </div>
              <Toggle value={cur} onChange={setCur} options={(["AED", "SAR", "EUR"] as Cur[]).map((c) => ({ value: c, label: c }))} />
            </div>
            <div className="lp-price-amt">{PRICE.report[cur]}</div>
            <Link to="/new" className="lp-btn lp-btn-white lp-btn-block">
              Start my scan
            </Link>
          </div>
          <div className="lp-price-alt">
            <div>
              <b>Premium</b>
              <span>+ style previews, video consult, 3 months tracking</span>
              <em>{PRICE.premium[cur]}</em>
            </div>
            <div>
              <b>Membership</b>
              <span>Monthly check-ins and plan updates</span>
              <em>
                {PRICE.month[cur]}/mo · {PRICE.year[cur]}/yr
              </em>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  12 · FAQ + CTA                                                     */
/* ------------------------------------------------------------------ */

const FAQ: [string, string][] = [
  ["Is it medical advice?", "No. It's aesthetic and wellness guidance. Anything clinical points you to a licensed practitioner."],
  ["How accurate is it?", "Measurements use established face and pose landmark models (MediaPipe) and are compared with published norms where they exist. They are estimates — body-fat estimates carry errors of roughly ±4–5 points, and photo conditions matter, so we flag selfies, head turns and cropped body shots."],
  ["Who sees my photos?", "Analysis runs on your device. Photos you send for your report are seen only by your reviewer and deleted 90 days after delivery."],
  ["Do I need special equipment?", "No. A phone, a plain wall and someone (or a timer) to take the photos from about 1.5–3 m."],
  ["Can I cancel the membership?", "Yes, anytime. Your report and plan stay yours."],
];

function Faq() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="lp-sec" id="faq">
      <Head center kicker="Your questions" dark="Frequently asked" muted="questions." mutedFirst={false} />
      <div className="lp-faq">
        {FAQ.map(([q, a], i) => (
          <div key={q} className={`lp-faq-row ${open === i ? "open" : ""}`}>
            <button onClick={() => setOpen(open === i ? null : i)}>
              {q}
              <ChevronDown size={16} />
            </button>
            {open === i && <p>{a}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

