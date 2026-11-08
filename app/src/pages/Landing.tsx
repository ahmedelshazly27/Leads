import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Logo } from "../components/Logo";
import { ChevronDown, Doc, Info, Scan, FaceScan, Bars, Infinity as InfinityIcon } from "../components/icons";
import { GRADE_LABEL, LIMITATIONS, METHODS, REFS, type EvidenceGrade } from "../lib/science";
import { MYTHS } from "../lib/plan";
import { shortCite } from "../components/ui";
import "./Landing.css";

/* ------------------------------------------------------------------ */
/*  Content                                                            */
/* ------------------------------------------------------------------ */

const NAV = [
  { id: "method", label: "Method" },
  { id: "science", label: "Science" },
  { id: "reports", label: "Reports" },
  { id: "privacy", label: "Privacy" },
  { id: "faq", label: "FAQ" },
];

const STEPS = [
  {
    n: "01",
    title: "Capture",
    text: "Guided front, profile and full-body photos, plus height and weight.",
    detail: "Lens-distance, head-turn and framing checks run before anything is measured.",
  },
  {
    n: "02",
    title: "Measure",
    text: "478 facial and 33 body landmarks, a body silhouette and per-region skin colour analysis.",
    detail: "Head pose is corrected in 3D; skin is read in CIELAB, the colour space used in dermatology research.",
  },
  {
    n: "03",
    title: "Review",
    text: "A human expert checks every visual and every plan item before it reaches you.",
    detail: "Anything unrealistic, unsupported or outside the 12-month rule is corrected or removed.",
  },
  {
    n: "04",
    title: "Track",
    text: "Monthly check-ins in the same set-up, compared against your baseline.",
    detail: "Same capture protocol each time, so changes reflect you — not the lighting.",
  },
];

const FAMILIES: { title: string; count: string; method: string; refs: string[] }[] = [
  { title: "Facial proportions", count: "10 ratios", method: "Thirds, fifths, nasal and oral widths against anthropometric norms", refs: ["farkas1994"] },
  { title: "Symmetry", count: "17 landmark pairs", method: "Mirrored displacement after 3D pose correction", refs: ["grammer1994", "rhodes2006"] },
  { title: "Averageness", count: "1 composite", method: "Standardised distance from population means", refs: ["langlois1990"] },
  { title: "Dimorphism", count: "5 cues", method: "Jaw, brow, fWHR, lips and eye openness (experimental index)", refs: ["perrett1998"] },
  { title: "Skin", count: "6 regions", method: "Pigment, redness and texture flagged pixel-by-pixel in CIELAB", refs: ["fink2006", "stephen2011"] },
  { title: "First impression", count: "4 indices", method: "Trust, openness, confidence and dominance cues", refs: ["willis2006", "oosterhof2008"] },
  { title: "Body ratios", count: "8 measures", method: "Shoulder, chest, waist, hip and arm widths from the silhouette", refs: ["sell2017", "singh1993"] },
  { title: "Side posture", count: "5 measures", method: "Ear–shoulder–hip alignment and trunk lean", refs: ["yip2008", "kendall2005"] },
  { title: "Core depth", count: "3 measures", method: "Navel versus chest depth — a sagittal abdominal proxy", refs: ["pouliot1994"] },
  { title: "Composition", count: "4 estimates", method: "BMI, photo-estimated waist, waist-to-height and body fat", refs: ["woolcott2018", "ashwell2012"] },
];

const EXAMPLES: { grade: EvidenceGrade; title: string; why: string; ref: string; kind: string }[] = [
  { grade: "A", title: "Daily broad-spectrum SPF 30+", why: "Prevents visible skin ageing and uneven pigmentation.", ref: "hughes2013", kind: "Randomised trial" },
  { grade: "A", title: "Protein ≈ 1.6 g/kg/day with resistance training", why: "Maximises lean-mass gains while losing fat.", ref: "morton2018", kind: "Meta-analysis" },
  { grade: "B", title: "Forward-head correction routine", why: "Targeted exercise improves forward head posture.", ref: "sheikhhoseini2018", kind: "Systematic review" },
];

const FAQ = [
  {
    q: "How accurate are the measurements?",
    a: "Landmark positions are reliable to a few pixels on a well-taken photo, but a single 2D image cannot capture depth, and lens distance changes proportions. Every screen states its method and limitations, and photo-derived estimates (like waist circumference) are labelled as such. The most reliable signal is change over time under the same capture set-up.",
  },
  {
    q: "What photos do I need?",
    a: "A front portrait from about 1.5 m at eye level, left and right profiles, and front and side full-body photos in fitted clothing. Plus your height and weight. The app checks each photo and asks for a retake if it would distort the results.",
  },
  {
    q: "Who reviews my report?",
    a: "A human reviewer checks the studio images, the 12-month visual and every plan item before release. Unrealistic visuals are regenerated or removed, and plan items that don't fit your situation are adjusted.",
  },
  {
    q: "Is this medical advice?",
    a: "No. It is educational and self-tracking guidance based on published research. Prescription treatments, clinical procedures and significant diet or training changes should be discussed with a licensed professional.",
  },
  {
    q: "Can I book clinics, dietitians or trainers?",
    a: "Where a plan item benefits from a professional — an InBody scan, a dietitian meal plan built on your calorie and protein targets, a personal trainer, or a licensed aesthetic clinic — you can request a booking with a vetted partner. Only the details needed for that booking are shared, and only with your consent.",
  },
  {
    q: "What happens to my data?",
    a: "Analysis runs on your device. Photos you send for review are encrypted and seen only by your reviewer. They are never used for advertising or to train AI models, and raw photos are deleted 90 days after delivery (members: while the membership is active, plus 30 days). You can delete everything at any time.",
  },
  {
    q: "Can I get a refund?",
    a: "Refund terms will be published before launch.",
  },
];

type Cur = "AED" | "SAR" | "EUR";
const PRICE: Record<string, Record<Cur, string>> = {
  free: { AED: "Free", SAR: "Free", EUR: "Free" },
  report: { AED: "AED 199", SAR: "SAR 199", EUR: "€49" },
  premium: { AED: "AED 399", SAR: "SAR 399", EUR: "€99" },
  month: { AED: "AED 49", SAR: "SAR 49", EUR: "€12" },
  year: { AED: "AED 399", SAR: "SAR 399", EUR: "€99" },
};

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
  const [cur, setCur] = useState<Cur>("AED");
  const [open, setOpen] = useState<number | null>(0);
  const refCount = Object.keys(REFS).length;
  const methodCount = Object.keys(METHODS).length;

  return (
    <div className="ld">
      <header className="ld-nav">
        <Link to="/" className="ld-brand">
          <Logo size={22} /> <span>Facet</span>
        </Link>
        <nav className="ld-links">
          {NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`}>
              {n.label}
            </a>
          ))}
        </nav>
        <Link to="/protocols" className="ld-btn ld-btn-ghost ld-open">
          Open app
        </Link>
      </header>

      {/* ------------------------------ Hero ------------------------------ */}
      <section className="ld-hero ld-wrap">
        <div className="ld-hero-text">
          <span className="kicker">
            <InfinityIcon size={14} /> Facial &amp; body analysis
          </span>
          <h1 className="ld-h1">
            <span className="hl">Your face and body, measured.</span> Your plan, referenced.
          </h1>
          <p className="ld-lead">
            478 facial landmarks, 33 body landmarks and per-region skin analysis produce more than 40 measurements, each compared with a published
            reference. Every recommendation in your 12-month plan carries an evidence grade and its citation.
          </p>
          <div className="ld-cta">
            <Link to="/new" className="ld-btn">
              Start a free scan
            </Link>
            <Link to="/analysis/getting-started" className="ld-btn ld-btn-ghost">
              See a sample report
            </Link>
          </div>
          <div className="ld-stats">
            <div>
              <b>{refCount}</b>
              <span>peer-reviewed references</span>
            </div>
            <div>
              <b>{methodCount}</b>
              <span>documented methods</span>
            </div>
            <div>
              <b>100%</b>
              <span>human-reviewed reports</span>
            </div>
          </div>
        </div>
        <HeroVisual />
      </section>

      {/* ------------------------------ Method ---------------------------- */}
      <section id="method" className="ld-sec ld-wrap">
        <SecHead kicker="The method" muted="Four steps," strong="one protocol." lead="The same capture protocol, the same measurements and the same review at every check-in — so a change in the numbers means a change in you." />
        <div className="ld-steps">
          {STEPS.map((s) => (
            <div key={s.n} className="ld-step">
              <span className="ld-step-n">{s.n}</span>
              <div className="ld-step-title">{s.title}</div>
              <p>{s.text}</p>
              <p className="ld-step-detail">{s.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------ Measure --------------------------- */}
      <section id="science" className="ld-sec ld-wrap">
        <SecHead kicker="What we measure" muted="Measured against" strong="published norms." lead="Each family below has its own screen in your report, with the exact method, the reference range and the studies behind it." />
        <div className="ld-families">
          {FAMILIES.map((f) => (
            <div key={f.title} className="ld-fam">
              <div className="ld-fam-head">
                <span className="ld-fam-title">{f.title}</span>
                <span className="mono-sm">{f.count}</span>
              </div>
              <p>{f.method}</p>
              <div className="ld-cites">
                {f.refs.filter((r) => REFS[r]).map((r) => (
                  <span key={r} className="ld-cite" title={`${REFS[r].authors} (${REFS[r].year}). ${REFS[r].title}. ${REFS[r].source}.`}>
                    {shortCite(r)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------ Evidence -------------------------- */}
      <section className="ld-sec ld-wrap">
        <SecHead kicker="Evidence, graded" muted="Every step" strong="shows its evidence." lead="A recommendation only enters a plan if a measurement triggers it, and it is labelled with the strength of the research behind it." />
        <div className="ld-grades">
          {(Object.keys(GRADE_LABEL) as EvidenceGrade[]).map((g) => (
            <div key={g} className="ld-grade">
              <span className={`grade grade-${g}`}>Evidence {g}</span>
              <p>{GRADE_LABEL[g]}</p>
            </div>
          ))}
        </div>
        <div className="ld-examples">
          {EXAMPLES.map((e) => {
            const r = REFS[e.ref];
            return (
              <div key={e.title} className="ld-ex">
                <div className="ld-ex-top">
                  <span className={`grade grade-${e.grade}`}>Evidence {e.grade}</span>
                  <span className="mono-sm">{e.kind}</span>
                </div>
                <div className="ld-ex-title">{e.title}</div>
                <p>{e.why}</p>
                {r && (
                  <p className="ld-ex-ref">
                    {r.authors.split(",")[0]} et al. ({r.year}). <i>{r.title}</i>. {r.source}.
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <div className="ld-myths">
          <div className="mono-sm">What we don't recommend</div>
          <div className="ld-myth-grid">
            {MYTHS.map((m) => (
              <div key={m.title} className="ld-myth">
                <div className="ld-myth-title">{m.title}</div>
                <p>{m.verdict}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------ Visuals --------------------------- */}
      <section className="ld-sec ld-wrap ld-visuals">
        <div>
          <SecHead kicker="Honest visuals" muted="A realistic after," strong="not a filter." />
          <ul className="ld-points">
            <li>
              <b>Studio baseline.</b> Your photos are re-photographed on a neutral background without retouching, so before and after are comparable.
            </li>
            <li>
              <b>12-month rule.</b> The after image only shows what your plan can realistically change in a year: skin, body fat, muscle, posture, grooming.
            </li>
            <li>
              <b>Bone structure is never changed.</b> No reshaped jaw, nose or eyes, and no skin lightening.
            </li>
            <li>
              <b>Measurements come from your original photos.</b> Generated images are for visualisation only and are never measured.
            </li>
            <li>
              <b>Reviewed by a person.</b> Overstated results — like a six-pack that a first year of training wouldn't produce — are corrected before release.
            </li>
          </ul>
        </div>
        <BeforeAfterSchematic />
      </section>

      {/* ------------------------------ Limitations ----------------------- */}
      <section className="ld-sec ld-wrap">
        <SecHead kicker="Limitations" muted="What photos" strong="can't tell us." lead="Being clear about uncertainty is part of the method. These limits are shown inside every report too." />
        <ol className="ld-limits">
          {LIMITATIONS.map((l, i) => (
            <li key={i}>
              <span className="mono-sm">{String(i + 1).padStart(2, "0")}</span>
              <p>{l}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------ Reports --------------------------- */}
      <section id="reports" className="ld-sec ld-wrap">
        <SecHead
          kicker="Reports"
          muted="Choose the depth"
          strong="you need."
          lead="Prices include VAT."
          right={
            <div className="ld-cur" role="group" aria-label="Currency">
              {(["AED", "SAR", "EUR"] as Cur[]).map((c) => (
                <button key={c} className={c === cur ? "on" : ""} onClick={() => setCur(c)}>
                  {c}
                </button>
              ))}
            </div>
          }
        />
        <div className="ld-tiers">
          <Tier
            name="Free scan"
            price={PRICE.free[cur]}
            items={["On-device face and body scan", "Headline scores", "Photo-quality checks"]}
            cta="Start a free scan"
          />
          <Tier
            name="Glow-Up Report"
            price={PRICE.report[cur]}
            items={[
              "Full face and body analysis, 40+ measurements",
              "Evidence-graded 12-month plan with citations",
              "Studio before and 12-month after — face and body",
              "Human-reviewed before delivery",
              "Protocol document (PDF)",
            ]}
            cta="Order a report"
          />
          <Tier
            name="Glow-Up Premium"
            price={PRICE.premium[cur]}
            items={["Everything in the Report", "Hairstyle and beard previews, 3 angles", "20-minute consultation", "Delivered within 24 hours", "3 months of membership"]}
            cta="Order premium"
          />
        </div>
        <div className="ld-member">
          <div>
            <div className="ld-tier-name">Progress membership</div>
            <p>Monthly check-ins under the same protocol, progress charts against your baseline, a monthly plan review and a refreshed after-visual each quarter. Requires a report.</p>
          </div>
          <div className="ld-member-price">
            <span>
              {PRICE.month[cur]}
              <small>/month</small>
            </span>
            <span className="ld-or">or</span>
            <span>
              {PRICE.year[cur]}
              <small>/year</small>
            </span>
          </div>
        </div>
      </section>

      {/* ------------------------------ Privacy --------------------------- */}
      <section id="privacy" className="ld-sec ld-wrap">
        <SecHead kicker="Privacy" muted="Your images" strong="stay yours." />
        <div className="ld-privacy">
          {[
            { icon: <Scan size={18} />, t: "On-device analysis", d: "Landmarks and measurements are computed in your browser. Nothing is uploaded to measure you." },
            { icon: <Doc size={18} />, t: "Encrypted, single reviewer", d: "Photos you send for a report are encrypted and only visible to your reviewer." },
            { icon: <Info size={18} />, t: "Never for ads or AI training", d: "Your images are not used in marketing or to train models — ever, unless you opt in separately." },
            { icon: <FaceScan size={18} />, t: "Deleted on schedule", d: "Raw photos are deleted 90 days after delivery; members' photos while active plus 30 days. Delete everything anytime." },
            { icon: <Bars size={18} />, t: "Gulf data-protection principles", d: "Built around consent, purpose limitation and minimisation under the UAE and Saudi personal data protection laws." },
          ].map((p) => (
            <div key={p.t} className="ld-priv">
              <span className="ld-priv-icon">{p.icon}</span>
              <div className="ld-priv-t">{p.t}</div>
              <p>{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------ FAQ ------------------------------- */}
      <section id="faq" className="ld-sec ld-wrap">
        <SecHead kicker="FAQ" muted="Common" strong="questions." />
        <div className="ld-faq">
          {FAQ.map((f, i) => (
            <div key={f.q} className={`ld-q ${open === i ? "open" : ""}`}>
              <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                <span>{f.q}</span>
                <ChevronDown size={16} />
              </button>
              {open === i && <p>{f.a}</p>}
            </div>
          ))}
        </div>
      </section>

      <footer className="ld-foot ld-wrap">
        <div className="ld-brand">
          <Logo size={20} /> <span>Facet</span>
        </div>
        <nav className="ld-foot-links">
          {NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`}>
              {n.label}
            </a>
          ))}
          <Link to="/analysis/methodology">Methodology</Link>
          <Link to="/protocols">Open app</Link>
        </nav>
        <p className="ld-foot-note">Educational and self-tracking guidance. Not medical advice. Consult a licensed professional before clinical or prescription treatments.</p>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pieces                                                             */
/* ------------------------------------------------------------------ */

function SecHead({ kicker, muted, strong, lead, right }: { kicker: string; muted: string; strong: string; lead?: string; right?: React.ReactNode }) {
  return (
    <div className="ld-sechead">
      <div>
        <span className="mono ld-kick">{kicker}</span>
        <h2 className="ld-h2">
          <span className="hl">{muted}</span> {strong}
        </h2>
        {lead && <p className="ld-lead">{lead}</p>}
      </div>
      {right}
    </div>
  );
}

function Tier({ name, price, items, cta }: { name: string; price: string; items: string[]; cta: string }) {
  return (
    <div className="ld-tier">
      <div className="ld-tier-name">{name}</div>
      <div className="ld-tier-price">{price}</div>
      <ul>
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
      <Link to="/new" className="ld-btn ld-btn-ghost">
        {cta}
      </Link>
    </div>
  );
}

/** Deterministic face-shaped wireframe, drawn in the same style as the app's mask view. */
function useFaceMesh() {
  return useMemo(() => {
    const cx = 200, cy = 220;
    // face outline radius as a function of angle (narrower jaw, rounded cranium)
    const outline = (t: number): [number, number] => {
      const s = Math.sin(t), c = Math.cos(t);
      const w = 118 * (s > 0 ? 1 - 0.28 * Math.pow(s, 3) : 1);
      const h = s > 0 ? 160 : 150;
      return [cx + c * w, cy + s * h];
    };
    const N = 30, R = 9;
    const rings: [number, number][][] = [];
    for (let r = 1; r <= R; r++) {
      const k = 0.18 + 0.82 * (r / R);
      const ring: [number, number][] = [];
      for (let i = 0; i < N; i++) {
        const t = (i / N) * Math.PI * 2 + (r % 2 ? Math.PI / N : 0);
        const [x, y] = outline(t);
        // deterministic jitter
        const j = Math.sin(i * 12.9898 + r * 78.233) * 43758.5453;
        const jit = (j - Math.floor(j) - 0.5) * 5 * k;
        ring.push([cx + (x - cx) * k + jit, cy + (y - cy) * k + jit * 0.6]);
      }
      rings.push(ring);
    }
    const eyes: [number, number][] = [[156, 196], [244, 196]];
    const inHole = (x: number, y: number) =>
      eyes.some(([ex, ey]) => ((x - ex) / 26) ** 2 + ((y - ey) / 11) ** 2 < 1) || ((x - cx) / 34) ** 2 + ((y - 298) / 9) ** 2 < 1;
    const tris: string[] = [];
    for (let r = 0; r < R - 1; r++) {
      for (let i = 0; i < N; i++) {
        const a = rings[r][i], b = rings[r][(i + 1) % N], c = rings[r + 1][i], d = rings[r + 1][(i + 1) % N];
        for (const tri of [[a, b, c], [b, d, c]] as [number, number][][]) {
          const mx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, my = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
          if (!inHole(mx, my)) tris.push(tri.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" "));
        }
      }
    }
    return { tris, outer: rings[R - 1], eyes };
  }, []);
}

function HeroVisual() {
  const { tris, outer, eyes } = useFaceMesh();
  return (
    <div className="ld-visual" aria-hidden="true">
      <svg viewBox="0 0 400 460" className="ld-mesh">
        <defs>
          <radialGradient id="ld-glow" cx="50%" cy="45%" r="60%">
            <stop offset="0" stopColor="#fff" stopOpacity=".18" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="400" height="460" fill="url(#ld-glow)" />
        <line x1="200" y1="30" x2="200" y2="430" stroke="#fff" strokeOpacity=".45" strokeWidth="0.8" />
        {tris.map((t, i) => (
          <polygon key={i} points={t} fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth=".5" />
        ))}
        <polygon points={outer.map((p) => p.join(",")).join(" ")} fill="none" stroke="#fff" strokeOpacity=".9" strokeWidth="1" />
        {eyes.map(([x, y]) => (
          <ellipse key={x} cx={x} cy={y} rx="26" ry="11" fill="none" stroke="#fff" strokeOpacity=".9" strokeWidth="1" />
        ))}
        <path d="M168 298 Q200 312 232 298" fill="none" stroke="#fff" strokeOpacity=".9" strokeWidth="1" />
        <path d="M200 200 L200 262 M186 262 L214 262" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth=".8" />
        {[
          [156, 196], [244, 196], [200, 262], [168, 298], [232, 298], [200, 378], [94, 214], [306, 214], [128, 330], [272, 330],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3" fill="#fff" />
        ))}
        <circle cx="200" cy="232" r="10" fill="none" stroke="#fff" strokeOpacity=".6" />
      </svg>
      <div className="ld-chip ld-chip-a">
        <span className="mono-sm">Symmetry</span>
        <b>
          84<small>/100</small>
        </b>
      </div>
      <div className="ld-chip ld-chip-b">
        <span className="mono-sm">Shoulder : waist</span>
        <b>1.49</b>
      </div>
      <div className="ld-chip ld-chip-c">
        <span className="mono-sm">Daily SPF</span>
        <span className="grade grade-A">Evidence A</span>
      </div>
      <span className="ld-fig mono-sm">Fig. 1 · Landmark mesh</span>
    </div>
  );
}

function BeforeAfterSchematic() {
  const figure = (waist: number, shoulder: number, x: number) => {
    const top = 120, waistY = 250, hipY = 300;
    return (
      <g transform={`translate(${x},0)`}>
        <circle cx="0" cy="78" r="30" fill="#fff" fillOpacity=".18" stroke="#fff" strokeOpacity=".8" />
        <path
          d={`M${-shoulder} ${top} Q0 ${top - 18} ${shoulder} ${top} L${waist} ${waistY} L${waist + 6} ${hipY} L${-waist - 6} ${hipY} L${-waist} ${waistY} Z`}
          fill="#fff"
          fillOpacity=".12"
          stroke="#fff"
          strokeOpacity=".85"
        />
        {[[top + 10, shoulder], [waistY, waist], [hipY, waist + 6]].map(([y, w], i) => (
          <g key={i}>
            <line x1={-w - 14} x2={w + 14} y1={y} y2={y} stroke="#fff" strokeOpacity=".7" strokeDasharray="3 3" />
            <circle cx={-w} cy={y} r="2.5" fill="#fff" />
            <circle cx={w} cy={y} r="2.5" fill="#fff" />
          </g>
        ))}
      </g>
    );
  };
  return (
    <div className="ld-visual ld-visual-sm" aria-hidden="true">
      <svg viewBox="0 0 400 360" className="ld-mesh">
        <line x1="200" y1="20" x2="200" y2="340" stroke="#fff" strokeOpacity=".5" />
        {figure(54, 70, 105)}
        {figure(44, 76, 295)}
        <text x="105" y="335" textAnchor="middle" className="ld-svg-label">BASELINE</text>
        <text x="295" y="335" textAnchor="middle" className="ld-svg-label">12 MONTHS</text>
      </svg>
      <span className="ld-tag ld-tag-l">Before</span>
      <span className="ld-tag ld-tag-r">After</span>
    </div>
  );
}
