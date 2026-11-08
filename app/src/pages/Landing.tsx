import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Logo } from "../components/Logo";
import { BeforeAfter, shortCite } from "../components/ui";
import { METHODS, REFS, type EvidenceGrade } from "../lib/science";
import { buildPlan } from "../lib/plan";
import { buildNutrition } from "../lib/nutrition";
import { refreshBody } from "../lib/bodyAnalysis";
import { sampleProfile, sampleScan } from "../lib/sample";
import { IDX } from "../lib/faceAnalysis";
import type { Pt } from "../lib/types";
import "./Landing.css";

const L = `${import.meta.env.BASE_URL}landing/`;
const S = `${import.meta.env.BASE_URL}sample/`;

type Cur = "AED" | "SAR" | "EUR";
const PRICE: Record<string, Record<Cur, string>> = {
  free: { AED: "0", SAR: "0", EUR: "0" },
  report: { AED: "AED 199", SAR: "SAR 199", EUR: "€49" },
  premium: { AED: "AED 399", SAR: "SAR 399", EUR: "€99" },
  month: { AED: "AED 49", SAR: "SAR 49", EUR: "€12" },
  year: { AED: "AED 399", SAR: "SAR 399", EUR: "€99" },
};

const STRIP = [
  { src: "averageness", cap: "Averageness · mask" },
  { src: "first-impression", cap: "First impression" },
  { src: "skin", cap: "Skin · CIELAB heatmap" },
  { src: "eyebrows", cap: "Brow geometry" },
  { src: "body", cap: "Body overview" },
  { src: "side", cap: "Side posture" },
  { src: "nutrition", cap: "Nutrition plan" },
  { src: "summary", cap: "Projected potential" },
];

const r0 = (n: number | null | undefined) => (n == null ? "—" : String(Math.round(n)));

/* ------------------------------------------------------------------ */

function useSampleData() {
  return useMemo(() => {
    const intake = sampleProfile.intake;
    const scan = sampleScan.body
      ? { ...sampleScan, body: refreshBody(sampleScan.body, intake, sampleScan.bodySide?.metrics ?? null) }
      : sampleScan;
    const plan = buildPlan(scan, intake);
    const nut = buildNutrition(scan, intake, plan);
    const grades: Record<EvidenceGrade, number> = { A: 0, B: 0, C: 0 };
    plan.items.forEach((i) => (grades[i.grade] += 1));
    return { scan, plan, nut, grades };
  }, []);
}

export function Landing() {
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" }), 60);
    return () => clearTimeout(t);
  }, [hash]);
  const [cur, setCur] = useState<Cur>("AED");
  const { scan, plan, nut, grades } = useSampleData();
  const fm = scan.face!.metrics;
  const bm = scan.body!.metrics;
  const sm = scan.bodySide?.metrics;
  const phase = nut.ok ? nut.phases[0] : null;
  const refCount = Object.keys(REFS).length;
  const methodCount = Object.keys(METHODS).length;
  const totalGrades = grades.A + grades.B + grades.C || 1;
  const examples = plan.items.filter((i) => i.refs.length).slice(0, 4);

  return (
    <div className="ld">
      {/* -------------------------------- Nav ------------------------------ */}
      <nav className="ld-nav">
        <Link to="/" className="ld-brand">
          <Logo size={20} /> Facet
        </Link>
        <div className="ld-links">
          <a href="#method">Method</a>
          <a href="#science">Science</a>
          <a href="#reports">Reports</a>
          <a href="#privacy">Privacy</a>
        </div>
        <Link to="/protocols" className="ld-btn ld-btn-ghost ld-open">Open app</Link>
      </nav>

      {/* -------------------------------- Hero ----------------------------- */}
      <header className="ld-wrap ld-hero">
        <div className="ld-hero-text">
          <span className="ld-kicker mono-sm">Facial &amp; body analysis · v1</span>
          <h1 className="ld-h1">
            <span className="hl">Measured.</span> <span className="hl">Referenced.</span> Reviewed.
          </h1>
          <p className="ld-lead">Your face and body, measured against published norms — then a 12-month plan where every step is cited.</p>
          <div className="ld-ctas">
            <Link to="/new" className="ld-btn">Start a free scan</Link>
            <Link to="/analysis/getting-started" className="ld-btn ld-btn-ghost">View sample report</Link>
          </div>
          <div className="ld-stats">
            <Stat n="478" l="Facial landmarks" />
            <Stat n="40+" l="Measurements" />
            <Stat n={String(refCount)} l="References" />
          </div>
        </div>
        <figure className="ld-hero-fig">
          <div className="ld-mesh">
            <img src={S + "face.jpg"} alt="Synthetic sample person" />
            <MeshOverlay lm={scan.face!.landmarks!} aspect={scan.face!.imageAspect} />
            <Chip k="Symmetry" v={r0(fm.symmetry)} unit="/100" pos="tl" />
            <Chip k="Averageness" v={r0(fm.averageness)} unit="/100" pos="tr" />
            <Chip k="Skin" v={r0(fm.skinScore)} unit="/100" pos="bl" />
            <Chip k="Canthal tilt" v={`${fm.canthalTilt >= 0 ? "+" : ""}${fm.canthalTilt.toFixed(1)}`} unit="°" pos="br" />
          </div>
          <figcaption className="ld-fig">
            <b>FIG. 1</b> 478-point landmark mesh · synthetic sample person
          </figcaption>
        </figure>
      </header>

      {/* ------------------------------ Report ----------------------------- */}
      <section id="method" className="ld-sec">
        <div className="ld-wrap">
          <SecHead n="01" muted="The" strong="report" cap="40+ screens. One protocol. Same set-up at every check-in." />
          <div className="ld-browser">
            <div className="ld-browser-bar">
              <i /><i /><i />
              <span className="ld-url">app / analysis / your-protocol</span>
            </div>
            <img src={L + "protocol-full.webp"} alt="Protocol summary screen" loading="lazy" />
            <span className="ld-mark ld-mark-1">1</span>
            <span className="ld-mark ld-mark-2">2</span>
            <span className="ld-mark ld-mark-3">3</span>
          </div>
          <ol className="ld-callouts">
            <li><b>1</b> Before / after reviewed by a human</li>
            <li><b>2</b> Every plan item graded &amp; cited</li>
            <li><b>3</b> 12-month achievability rule</li>
          </ol>
          <div className="ld-strip">
            {STRIP.map((s, i) => (
              <figure key={s.src} className="ld-tile">
                <img src={`${L}${s.src}.webp`} alt={s.cap} loading="lazy" />
                <figcaption className="ld-fig">
                  <b>FIG. {i + 2}</b> {s.cap}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------- Data band ----------------------------- */}
      <section className="ld-sec ld-band">
        <div className="ld-wrap">
          <SecHead n="02" muted="Face ·" strong="Body · Plan" cap="Sample output — real pipeline, synthetic person." />
          <div className="ld-cols">
            <DataCol
              img={S + "face_left.jpg"}
              label="Face"
              rows={[
                ["Symmetry", r0(fm.symmetry), "/100"],
                ["Averageness", r0(fm.averageness), "/100"],
                ["Skin score", r0(fm.skinScore), "/100"],
                ["fWHR", fm.fWHR.toFixed(2), ""],
              ]}
            />
            <DataCol
              img={S + "body_side.jpg"}
              label="Body"
              rows={[
                ["Shoulder : waist", bm.shoulderToWaist.toFixed(2), ""],
                ["Waist : height", bm.whtr ? bm.whtr.toFixed(2) : "—", ""],
                ["Body fat (est.)", r0(bm.bodyFatEstimate), "%"],
                ["Side posture", r0(sm?.postureScore), "/100"],
              ]}
            />
            <DataCol
              img={S + "body_after_front.jpg"}
              label="Plan"
              rows={[
                ["Daily target", phase ? String(phase.macros.kcal) : "—", "kcal"],
                ["Protein", phase ? String(phase.macros.protein) : "—", "g"],
                ["Plan items", String(plan.items.length), ""],
                ["Overall", `${r0(plan.overallNow)}→${r0(plan.overallProjected)}`, ""],
              ]}
            />
          </div>
        </div>
      </section>

      {/* ---------------------------- Visuals ------------------------------ */}
      <section className="ld-sec">
        <div className="ld-wrap">
          <SecHead n="03" muted="12 months," strong="rendered honestly" cap="Fat loss, skin, grooming, posture. Bone structure never changes." />
          <div className="ld-ba">
            <BeforeAfter
              aspect={0.75}
              before={<img src={S + "face.jpg"} alt="Before" />}
              after={<img src={S + "face_after.jpg"} alt="After" />}
              caption={<><b>FIG. 10</b> Face · drag to compare</>}
            />
            <BeforeAfter
              aspect={0.75}
              before={<img src={S + "body_front.jpg"} alt="Before" />}
              after={<img src={S + "body_after_front.jpg"} alt="After" />}
              caption={<><b>FIG. 11</b> Body · drag to compare</>}
            />
          </div>
        </div>
      </section>

      {/* ---------------------------- Evidence ----------------------------- */}
      <section id="science" className="ld-sec ld-band">
        <div className="ld-wrap">
          <SecHead n="04" muted="Evidence," strong="graded" cap="A = trials or meta-analyses · B = controlled studies · C = limited." />
          <div className="ld-ev">
            <div className="ld-ev-nums">
              <Big n={String(refCount)} l="Peer-reviewed references" />
              <Big n={String(methodCount)} l="Documented methods" />
              <Big n={String(plan.items.length)} l="Plan items (sample)" />
            </div>
            <div className="ld-ev-bar">
              <div className="mono-sm">Grade distribution · sample plan</div>
              <div className="ld-bar">
                {(["A", "B", "C"] as EvidenceGrade[]).map((g) => (
                  <span key={g} className={`ld-bar-${g}`} style={{ flexGrow: grades[g] || 0.0001 }}>
                    {grades[g] ? `${g} · ${grades[g]}` : ""}
                  </span>
                ))}
              </div>
              <div className="ld-bar-legend mono-sm">
                <span>{Math.round((grades.A / totalGrades) * 100)}% strong</span>
                <span>{Math.round((grades.B / totalGrades) * 100)}% moderate</span>
                <span>{Math.round((grades.C / totalGrades) * 100)}% limited</span>
              </div>
            </div>
            <table className="ld-table">
              <thead>
                <tr>
                  <th>Plan item</th>
                  <th>Grade</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {examples.map((i) => (
                  <tr key={i.id}>
                    <td>{i.title}</td>
                    <td><span className={`grade grade-${i.grade}`}>{i.grade}</span></td>
                    <td className="mono-sm">{i.refs.slice(0, 2).map(shortCite).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ----------------------------- Phones ------------------------------ */}
      <section className="ld-sec">
        <div className="ld-wrap">
          <SecHead n="05" muted="Built for" strong="your phone" cap="Monthly check-ins in the same set-up, charted against your baseline." />
          <div className="ld-phones">
            {[
              ["m-protocol", "Protocol"],
              ["m-body", "Body"],
              ["m-nutrition", "Nutrition"],
            ].map(([src, cap], i) => (
              <figure key={src} className={`ld-phone ld-phone-${i}`}>
                <div className="ld-phone-frame">
                  <img src={`${L}${src}.webp`} alt={cap} loading="lazy" />
                </div>
                <figcaption className="ld-fig"><b>FIG. {12 + i}</b> {cap}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------- Reports ----------------------------- */}
      <section id="reports" className="ld-sec ld-band">
        <div className="ld-wrap">
          <div className="ld-rep-head">
            <SecHead n="06" muted="" strong="Reports" cap="Prices include VAT." />
            <div className="ld-cur">
              {(["AED", "SAR", "EUR"] as Cur[]).map((c) => (
                <button key={c} className={c === cur ? "on" : ""} onClick={() => setCur(c)}>{c}</button>
              ))}
            </div>
          </div>
          <table className="ld-table ld-price">
            <thead>
              <tr>
                <th>Report</th>
                <th>Analysis</th>
                <th>Plan</th>
                <th>Studio visuals</th>
                <th>Human review</th>
                <th className="r">Price</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Free scan</td><td>Scores</td><td>—</td><td>—</td><td>—</td>
                <td className="r"><Link to="/new">{PRICE.free[cur] === "0" ? "Free" : PRICE.free[cur]}</Link></td>
              </tr>
              <tr>
                <td>Report</td><td>Face + body</td><td>12 months</td><td>Before · after</td><td>✓</td>
                <td className="r"><Link to="/new">{PRICE.report[cur]}</Link></td>
              </tr>
              <tr>
                <td>Premium</td><td>Face + body</td><td>12 months</td><td>+ 3 style previews</td><td>✓ + 20-min call</td>
                <td className="r"><Link to="/new">{PRICE.premium[cur]}</Link></td>
              </tr>
              <tr className="ld-member">
                <td>Membership</td><td colSpan={4}>Monthly check-ins · plan updates · quarterly visual · partner rates</td>
                <td className="r">{PRICE.month[cur]}/mo · {PRICE.year[cur]}/yr</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ----------------------------- Privacy ----------------------------- */}
      <section id="privacy" className="ld-sec">
        <div className="ld-wrap">
          <SecHead n="07" muted="Private" strong="by design" cap="Aligned with UAE PDPL and Saudi PDPL principles." />
          <div className="ld-priv">
            <Big n="On-device" l="Analysis runs in your browser" />
            <Big n="0" l="Photos shared with partners" />
            <Big n="90 d" l="Raw photo deletion after delivery" />
            <Big n="1 tap" l="Delete everything, anytime" />
          </div>
        </div>
      </section>

      <footer className="ld-foot">
        <div className="ld-wrap ld-foot-in">
          <span className="ld-brand"><Logo size={18} /> Facet</span>
          <span className="mono-sm">Not medical advice · Synthetic person used in all product imagery</span>
          <Link to="/protocols" className="mono-sm">Open app →</Link>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div className="ld-stat">
      <span className="ld-stat-n">{n}</span>
      <span className="mono-sm">{l}</span>
    </div>
  );
}

function Big({ n, l }: { n: string; l: string }) {
  return (
    <div className="ld-big">
      <span className="ld-big-n">{n}</span>
      <span className="mono-sm">{l}</span>
    </div>
  );
}

function SecHead({ n, muted, strong, cap }: { n: string; muted: string; strong: string; cap: string }) {
  return (
    <div className="ld-sechead">
      <span className="mono-sm ld-secno">{n}</span>
      <h2 className="ld-h2">
        {muted && <span className="hl">{muted} </span>}
        {strong}
      </h2>
      <p className="ld-cap">{cap}</p>
    </div>
  );
}

function Chip({ k, v, unit, pos }: { k: string; v: string; unit: string; pos: "tl" | "tr" | "bl" | "br" }) {
  return (
    <div className={`ld-chip ld-chip-${pos}`}>
      <span className="mono-sm">{k}</span>
      <span className="ld-chip-v">
        {v}
        <small>{unit}</small>
      </span>
    </div>
  );
}

function DataCol({ img, label, rows }: { img: string; label: string; rows: [string, string, string][] }) {
  return (
    <div className="ld-col">
      <div className="ld-col-img">
        <img src={img} alt="" loading="lazy" />
        <span className="ld-col-tag mono-sm">{label}</span>
      </div>
      <dl className="ld-rows">
        {rows.map(([k, v, u]) => (
          <div key={k} className="ld-row">
            <dt className="mono-sm">{k}</dt>
            <dd>
              {v}
              {u && <small>{u}</small>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Real landmarks of the sample scan drawn over the photo (object-fit: cover, centred). */
function MeshOverlay({ lm, aspect }: { lm: Pt[]; aspect: number }) {
  const H = 1000 / aspect;
  const p = (i: number) => [lm[i][0] * 1000, lm[i][1] * H] as const;
  const line = (ids: number[]) => ids.map((i) => p(i).join(",")).join(" ");
  const jaw = [234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454];
  const mid = [10, 151, 9, 8, 168, 6, 197, 195, 5, 4, 1, 2, 164, 0, 17, 18, 200, 199, 175, 152];
  return (
    <svg className="ld-mesh-svg" viewBox={`0 0 1000 ${H}`} preserveAspectRatio="xMidYMid slice">
      {lm.slice(0, 468).map((q, i) => (
        <circle key={i} cx={q[0] * 1000} cy={q[1] * H} r={2.1} fill="rgba(255,255,255,.55)" />
      ))}
      <polyline points={line(jaw)} fill="none" stroke="rgba(255,255,255,.85)" strokeWidth={1.4} strokeDasharray="4 4" />
      <polyline points={line(mid)} fill="none" stroke="rgba(255,255,255,.7)" strokeWidth={1} />
      <polyline points={line([...IDX.browL.upper].reverse())} fill="none" stroke="#fff" strokeWidth={1.6} />
      <polyline points={line(IDX.browR.upper)} fill="none" stroke="#fff" strokeWidth={1.6} />
      {[IDX.eyeL.outer, IDX.eyeL.inner, IDX.eyeR.inner, IDX.eyeR.outer, IDX.mouthL, IDX.mouthR, IDX.noseTip, IDX.menton, IDX.zygL, IDX.zygR].map((i) => {
        const [x, y] = p(i);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={9} fill="rgba(255,255,255,.25)" />
            <circle cx={x} cy={y} r={4} fill="#fff" />
          </g>
        );
      })}
    </svg>
  );
}
