import { useState, type ReactNode } from "react";
import { Radar, Toggle } from "../components/ui";
import { REFS } from "../lib/science";
import { SCORE_LABEL, type ScoreKey } from "../lib/report";
import type { Plan } from "../lib/plan";
import type { Intake, Scan } from "../lib/types";
import "./LandingSections.css";

const S = `${import.meta.env.BASE_URL}sample/`;
const L = `${import.meta.env.BASE_URL}library/`;

export interface SampleData {
  intake: Intake;
  scan: Scan;
  plan: Plan;
}

function Kicker({ children }: { children: ReactNode }) {
  return <span className="ls-kicker">{children}</span>;
}

/** Short author–year–journal line for a reference. */
function Source({ id }: { id: string }) {
  const r = REFS[id];
  if (!r) return null;
  const first = r.authors.split(",")[0];
  const journal = r.source.split(/\s\d/)[0];
  const body = (
    <>
      {first}
      {r.authors.includes(",") ? " et al." : ""} ({r.year}). {journal}.
    </>
  );
  return r.doi ? (
    <a className="ls-src" href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer" title={r.title}>
      {body}
    </a>
  ) : (
    <span className="ls-src" title={r.title}>
      {body}
    </span>
  );
}

function DocIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  1 · Looks influence (studies, by area of life)                     */
/* ------------------------------------------------------------------ */

type Area = "finances" | "dating" | "social" | "health" | "education" | "law" | "influence" | "happiness";

const AREAS: { value: Area; label: string }[] = [
  { value: "finances", label: "Finances" },
  { value: "dating", label: "Dating" },
  { value: "social", label: "Socialising" },
  { value: "health", label: "Health" },
  { value: "education", label: "Education" },
  { value: "law", label: "Law" },
  { value: "influence", label: "Influence" },
  { value: "happiness", label: "Happiness" },
];

/** Every line here is the cited paper's own finding (see docs/CLAIMS.md). */
const STUDIES: Record<Area, { muted: string; dark: string; text: string; ref: string }[]> = {
  finances: [
    { muted: "Higher", dark: "pay", text: "Workers rated plain earned 5–10% less than average-looking colleagues, who earned less again than those rated good-looking.", ref: "hamermesh1994" },
    { muted: "Easier", dark: "hiring", text: "Across experiments, attractive candidates were rated more favourably in hiring, performance and promotion decisions.", ref: "hosoda2003" },
    { muted: "Bigger", dark: "tips", text: "Restaurant servers rated attractive earned about $1,261 more a year in tips.", ref: "parrett2015" },
    { muted: "More", dark: "confidence", text: "In a lab job market, attractive workers were more confident and employers expected more of them.", ref: "mobius2006" },
  ],
  dating: [
    { muted: "First", dark: "dates", text: "At a matched dance, a partner’s looks were the strongest predictor of wanting to see them again.", ref: "walster1966" },
    { muted: "Speed", dark: "dating", text: "Looks predicted romantic interest just as strongly for women as for men.", ref: "eastwick2008" },
    { muted: "Second", dark: "looks", text: "Attractive adults were judged and treated more positively across dozens of studies.", ref: "langlois2000" },
  ],
  social: [
    { muted: "Warmer", dark: "assumptions", text: "People assumed attractive strangers had better personalities and happier lives.", ref: "dion1972" },
    { muted: "More", dark: "social credit", text: "The halo was strongest for judgements of social competence, and weak for honesty or kindness.", ref: "eagly1991" },
    { muted: "Faster", dark: "judgements", text: "A tenth of a second of seeing a face was enough to form trait impressions.", ref: "willis2006" },
  ],
  health: [
    { muted: "Leaner", dark: "faces", text: "Perceived facial fat tracks BMI and is linked to how healthy a face looks.", ref: "coetzee2009" },
    { muted: "Even", dark: "skin", text: "An even skin tone made faces look younger and healthier.", ref: "fink2006" },
    { muted: "Rested", dark: "eyes", text: "After sleep loss, faces looked more tired, with hanging lids and darker circles.", ref: "sundelin2013" },
  ],
  education: [
    { muted: "Higher", dark: "expectations", text: "Teachers tended to judge attractive students as brighter and expect more of them.", ref: "ritts1992" },
    { muted: "Same", dark: "report card", text: "Given identical report cards, teachers expected the attractive child to have a higher IQ.", ref: "clifford1973" },
  ],
  law: [
    { muted: "Lighter", dark: "sentences", text: "In real criminal cases, more attractive defendants received lighter sentences.", ref: "stewart1980" },
    { muted: "Lower", dark: "bail", text: "In real misdemeanour cases, judges set lower bail and fines for more attractive defendants.", ref: "downs1991" },
    { muted: "Fewer", dark: "convictions", text: "Mock jurors were somewhat less likely to convict attractive defendants; the effect was small.", ref: "mazzella1994" },
  ],
  influence: [
    { muted: "More", dark: "persuasive", text: "Attractive communicators got more people to sign a petition.", ref: "chaiken1979" },
    { muted: "Faces", dark: "win votes", text: "Competence judged from brief looks at candidates’ faces predicted about 70% of US Senate races.", ref: "todorov2005" },
    { muted: "Even", dark: "children", text: "Children picking a face to captain a ship chose the winners of French run-offs about 71% of the time.", ref: "antonakis2009" },
  ],
  happiness: [
    { muted: "Higher", dark: "life satisfaction", text: "Better-looking people reported higher life satisfaction, partly through better economic outcomes.", ref: "hamermesh2013" },
    { muted: "Self", dark: "presentation", text: "Looks rated by others were only weakly tied to happiness; grooming and presentation carried part of the link.", ref: "diener1995" },
  ],
};

export function LooksInfluence() {
  const [area, setArea] = useState<Area>("finances");
  const cards = STUDIES[area];
  return (
    <section className="lp-sec ls-studies" id="why">
      <h2 className="ls-big">
        Studies show your looks influence almost everything, <span>from your career to your romantic life.</span>
      </h2>
      <div className="ls-tabs">
        <Toggle value={area} onChange={setArea} options={AREAS} />
      </div>
      <div className="ls-cards" style={{ gridTemplateColumns: `repeat(${Math.max(2, cards.length)}, minmax(0, 1fr))` }}>
        {cards.map((c, i) => (
          <article key={c.ref} className="ls-card" tabIndex={0}>
            <span className="ls-card-bg" aria-hidden="true" style={{ backgroundImage: `url(${S}${i % 2 ? "face_after" : "face"}.jpg)` }} />
            <h3>
              <span>{c.muted}</span> {c.dark}
            </h3>
            <p>{c.text}</p>
            <footer>
              <DocIcon />
              <Source id={c.ref} />
            </footer>
          </article>
        ))}
      </div>
      <p className="ls-foot">
        Averages from published studies, mostly in Western samples. They describe how people tend to be judged, not what anyone is worth.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  2 · Your complete facial analysis (data cards around the face)     */
/* ------------------------------------------------------------------ */

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function Scale({ value, min, max, labels, caption }: { value: number; min: number; max: number; labels: string[]; caption: string }) {
  const p = clamp01((value - min) / (max - min)) * 100;
  return (
    <div className="ls-scale">
      <div className="ls-scale-bar">
        {labels.map((_, i) => (
          <i key={i} />
        ))}
        <b style={{ left: `${p}%` }} />
      </div>
      <div className="ls-scale-labels">
        {labels.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      <div className="ls-glass-cap">{caption}</div>
    </div>
  );
}

export function CompleteAnalysis({ data }: { data: SampleData }) {
  const m = data.scan.face?.metrics;
  if (!m) return null;
  // dimorphism grid: x = feminine → masculine (shape), y = subtle → bold (feature contrast)
  const gx = Math.round(clamp01(m.dimorphism) * 8);
  const gy = Math.round((1 - clamp01(m.contrast / 100)) * 8);
  const tone = data.intake.skinTone;
  return (
    <section className="ls-analysis">
      <div className="ls-analysis-in">
        <header className="ls-analysis-head">
          <Kicker>Personalised analysis</Kicker>
          <h2>
            Your complete <span>facial analysis</span>
          </h2>
          <p>Every face is different. We measure 48 markers across face, skin and body and explain what each one means for you.</p>
        </header>
        <div className="ls-analysis-stage">
          <img className="ls-analysis-face" src={`${S}face.jpg`} alt="Synthetic sample client" />

          <div className="ls-glass ls-g-dim">
            <span className="ls-glass-k">Shape · contrast</span>
            <div className="ls-grid" role="img" aria-label="Feature map from feminine to masculine and subtle to bold">
              {Array.from({ length: 81 }, (_, i) => {
                const x = i % 9;
                const y = Math.floor(i / 9);
                const d = Math.hypot(x - gx, y - gy);
                return <i key={i} style={{ opacity: d === 0 ? 1 : Math.max(0.12, 0.6 - d * 0.16) }} className={d === 0 ? "on" : ""} />;
              })}
            </div>
            <div className="ls-axis">
              <span>Feminine</span>
              <span>Masculine</span>
            </div>
            <div className="ls-glass-cap">Shape reads softer than typical for men; strong feature contrast.</div>
          </div>

          <div className="ls-glass ls-g-brow">
            <span className="ls-glass-k">Brow thickness</span>
            <Scale value={m.browThickness} min={0.05} max={0.25} labels={["Fine", "Even", "Full"]} caption={`${Math.round(m.browThickness * 100)}% of brow length · even thickness`} />
          </div>

          <div className="ls-glass ls-g-lip">
            <span className="ls-glass-k">Lip fullness</span>
            <b className="ls-glass-big">{Math.round(m.lipFullness * 100)}%</b>
            <Scale value={m.lipFullness} min={0.2} max={0.48} labels={["Thin", "Medium", "Full"]} caption="Lip height ÷ mouth width" />
          </div>

          <div className="ls-glass ls-g-skin">
            <span className="ls-glass-k">Skin type</span>
            <div className="ls-tones">
              {["#f6dccb", "#ecc4a4", "#d6a47c", "#b07a52", "#7d5235", "#4a2f20"].map((c, i) => (
                <i key={c} style={{ background: c }} className={i + 1 === tone ? "on" : ""} />
              ))}
            </div>
            <div className="ls-glass-cap">
              Fitzpatrick type {["I", "II", "III", "IV", "V", "VI"][tone - 1]} · skin score {Math.round(m.skinScore)}/100
            </div>
          </div>

          <div className="ls-glass ls-g-thirds">
            <span className="ls-glass-k">Facial thirds</span>
            <div className="ls-thirds">
              <div>
                <span>Middle</span>
                <i style={{ width: `${(m.midToLowerThird / (1 + m.midToLowerThird)) * 100}%` }} />
              </div>
              <div>
                <span>Lower</span>
                <i style={{ width: `${(1 / (1 + m.midToLowerThird)) * 100}%` }} />
              </div>
            </div>
            <div className="ls-glass-cap">Middle ÷ lower {m.midToLowerThird.toFixed(2)} · classical canon 1.00</div>
          </div>

          <div className="ls-glass ls-g-sym">
            <span className="ls-glass-k">Symmetry</span>
            <Scale value={m.symmetry} min={60} max={100} labels={["Asymmetrical", "Symmetrical"]} caption={`You ${Math.round(m.symmetry)}/100 · 100 = perfectly mirrored`} />
          </div>
        </div>
        <p className="ls-analysis-cap">Real measurements of a synthetic sample person</p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  3 · Taking into account your…                                      */
/* ------------------------------------------------------------------ */

function Row({ title, text, thumb }: { title: string; text: string; thumb: ReactNode }) {
  return (
    <div className="ls-row">
      <div className="ls-thumb">{thumb}</div>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </div>
  );
}

export function TakingIntoAccount({ data }: { data: SampleData }) {
  const i = data.intake;
  return (
    <section className="lp-sec ls-list-sec">
      <header className="ls-center-head">
        <Kicker>Personalised analysis</Kicker>
        <h2>
          Taking into account <span>your…</span>
        </h2>
      </header>
      <div className="ls-list">
        <Row
          title="Background"
          text="Features are read against published references for your background where they exist; eye-tilt norms, for example, differ by ethnicity."
          thumb={
            <div className="ls-th-faces">
              <img src={`${L}eyelid/mono.jpg`} alt="" />
              <img src={`${L}eye-shape/almond.jpg`} alt="" />
              <img src={`${L}eyelid/hooded.jpg`} alt="" />
            </div>
          }
        />
        <Row
          title="Choices"
          text="You pick the hair and beard. The plan respects what you won’t do, such as no clinical treatments."
          thumb={
            <div className="ls-th-faces">
              <img src={`${L}hair-texture/2b.jpg`} alt="" />
              <img src={`${L}hair-texture/3b.jpg`} alt="" />
              <img src={`${L}hair-texture/4a.jpg`} alt="" />
            </div>
          }
        />
        <Row
          title="Lifestyle"
          text="Sleep, training, smoking and drinking shape your plan and how fast it moves."
          thumb={
            <div className="ls-th-stats">
              <div>
                <span>Sleep</span>
                <b>
                  {i.sleepHours}
                  <small> h</small>
                </b>
              </div>
              <div>
                <span>Training</span>
                <b>
                  {i.trainingDays}
                  <small> d/wk</small>
                </b>
              </div>
            </div>
          }
        />
        <Row
          title="Body"
          text="Height, weight and waist set your calorie targets and body-fat estimate."
          thumb={
            <div className="ls-th-photo">
              <img src={`${S}body_front.jpg`} alt="" />
            </div>
          }
        />
        <Row
          title="Region"
          text="Prices in AED or SAR, sun protection for Gulf UV, and specialist partners in the UAE and Saudi Arabia (coming soon)."
          thumb={
            <div className="ls-th-chips">
              <span>AED</span>
              <span>SAR</span>
            </div>
          }
        />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  4 · You will learn…                                                */
/* ------------------------------------------------------------------ */

export function YouWillLearn({ data }: { data: SampleData }) {
  const now = Math.round(data.plan.overallNow);
  const next = Math.round(data.plan.overallProjected);
  const gains = (Object.keys(data.plan.projected) as ScoreKey[])
    .map((k) => ({ k, now: Math.round(data.plan.current[k] ?? 0), next: Math.round(data.plan.projected[k] ?? 0) }))
    .filter((g) => g.next > g.now)
    .sort((a, b) => b.next - b.now - (a.next - a.now))
    .slice(0, 3);
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <section className="lp-sec ls-list-sec">
      <header className="ls-center-head">
        <Kicker>Informative</Kicker>
        <h2>
          You will <span>learn…</span>
        </h2>
      </header>
      <div className="ls-list">
        <Row
          title="Your scores"
          text="Where you stand today and your realistic 12-month potential."
          thumb={
            <div className="ls-th-ring">
              <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">
                <circle cx="42" cy="42" r={r} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="5" />
                <circle cx="42" cy="42" r={r} fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(now / 100) * c} ${c}`} transform="rotate(-90 42 42)" />
              </svg>
              <b>{now}</b>
              <span>→ {next}</span>
            </div>
          }
        />
        <Row
          title="How each feature reads"
          text="Feature-by-feature breakdowns, with the research behind each one."
          thumb={
            <div className="ls-th-mosaic">
              {["eye-shape/almond", "brow-shape/soft", "lip-fullness/medium", "nose-profile/straight", "hairline/rounded", "jaw-width/moderate"].map((p) => (
                <img key={p} src={`${L}${p}.jpg`} alt="" />
              ))}
            </div>
          }
        />
        <Row
          title="The harmony of your face"
          text="How your proportions work together, from the front and in profile."
          thumb={
            <div className="ls-th-photo">
              <img src={`${S}face_left.jpg`} alt="" />
            </div>
          }
        />
        <Row
          title="Where you can gain most"
          text="What you can improve without surgery, ranked by expected effect."
          thumb={
            <div className="ls-th-gains">
              {gains.map((g) => (
                <div key={g.k}>
                  <span>{SCORE_LABEL[g.k]}</span>
                  <b>+{g.next - g.now}</b>
                </div>
              ))}
            </div>
          }
        />
        <Row
          title="The science behind your plan"
          text="Every step is graded A–C by the strength of its evidence, with the sources linked."
          thumb={
            <div className="ls-th-cite">
              <span className="ls-th-grade">Evidence A</span>
              <i />
              <i />
              <i className="short" />
            </div>
          }
        />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  5 · Get your personalised plan (protocol preview)                  */
/* ------------------------------------------------------------------ */

export function PersonalPlan({ data }: { data: SampleData }) {
  const i = data.intake;
  const keys = (Object.keys(data.plan.current) as ScoreKey[]).filter((k) => data.plan.projected[k] != null).slice(0, 8);
  const first = i.name.split(" ")[0];
  const profile: [string, string][] = [
    ["Background", i.ethnicity],
    ["Age", `${i.age}`],
    ["Gender", i.gender === "male" ? "Male" : i.gender === "female" ? "Female" : "—"],
    ["Preferences", i.preferences === "non-invasive" ? "Non-invasive only" : i.preferences === "open-to-clinical" ? "Open to clinical" : "Open to surgical"],
    ["Smoking", i.smoking === "no" ? "No" : i.smoking],
    ["Drinking", i.drinking === "never" ? "Never" : i.drinking],
    ["Skin type", `Fitzpatrick ${["I", "II", "III", "IV", "V", "VI"][i.skinTone - 1]}`],
    ["Location", i.location],
    ["Limitations", i.limitations || "None reported"],
    ["Profession", i.profession || "—"],
  ];
  return (
    <section className="ls-plan" id="plan">
      <div className="ls-plan-in">
        <div className="ls-plan-text">
          <Kicker>Personalised plan</Kicker>
          <h2>
            Get your <span>personalised plan</span>
          </h2>
          <p>Understand your features and act on them today, with a plan built for your face, body and life.</p>
          <ol>
            {["Your expert-reviewed analysis", "See a realistic 12-month visual", "Your step-by-step protocol", "Track your progress monthly"].map((t, n) => (
              <li key={t}>
                <span>[{n + 1}]</span>
                {t}
              </li>
            ))}
          </ol>
        </div>
        <div className="ls-device">
          <div className="ls-device-pages" aria-hidden="true">
            {[0, 1, 2, 3].map((n) => (
              <div key={n} className={n === 2 ? "on" : ""}>
                <i />
                <i />
                <i className="short" />
                {n === 2 && (
                  <div className="ls-mini-pair">
                    <img src={`${S}face.jpg`} alt="" />
                    <img src={`${S}face_after.jpg`} alt="" />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="ls-device-main">
            <div className="ls-doc-head">
              <h3>
                {first}’s <span>Protocol</span>
              </h3>
              <span className="ls-doc-page">Page / 04</span>
            </div>
            <div className="ls-doc-pair">
              <figure>
                <img src={`${S}face.jpg`} alt="Sample client before" />
                <figcaption>Before</figcaption>
              </figure>
              <figure>
                <img src={`${S}face_after.jpg`} alt="AI illustration of the 12-month plan" />
                <figcaption>12 months · AI illustration</figcaption>
              </figure>
            </div>
            <div className="ls-doc-potential">
              <div>
                <h4>Projected potential</h4>
                <p>
                  This plan is organised around {data.plan.items.length} steps across skin, leanness, rest, grooming and body. Score now {Math.round(data.plan.overallNow)}, projected{" "}
                  {Math.round(data.plan.overallProjected)}.
                </p>
              </div>
              <div className="ls-doc-radar">
                <Radar
                  axes={keys.map((k) => SCORE_LABEL[k])}
                  series={[
                    { name: "Projected", values: keys.map((k) => data.plan.projected[k]!), tone: "a" },
                    { name: "Now", values: keys.map((k) => data.plan.current[k]!), tone: "b" },
                  ]}
                  size={230}
                />
              </div>
            </div>
          </div>
          <aside className="ls-device-side">
            <h4>Client profile</h4>
            <div className="ls-profile-who">
              <img src={`${S}face.jpg`} alt="" />
              <div>
                <b>{i.name.replace(" (sample)", "")}</b>
                <span>Sample · synthetic person</span>
              </div>
            </div>
            <dl>
              {profile.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <div className="ls-overview">
              <h4>Reviewer’s note</h4>
              <p>{data.scan.review?.note ?? "Start with sleep, protein and the training plan."}</p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
