import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { BeforeAfter, GradeBadge } from "../components/ui";
import { REFS } from "../lib/science";
import { LIBRARY, NO_PHOTO, matchFor, type Ctx } from "../lib/library";
import { FeatureArt } from "../components/FeatureArt";
import type { SampleData } from "./LandingSections";
import "./LandingSections.css";

const S = `${import.meta.env.BASE_URL}sample/`;
const L = `${import.meta.env.BASE_URL}library/`;

function SecHead({ kicker, dark, muted, lead, left }: { kicker: string; dark: string; muted: string; lead?: ReactNode; left?: boolean }) {
  return (
    <header className={left ? "ls-left-head" : "ls-center-head"}>
      <span className="ls-kicker">{kicker}</span>
      <h2>
        {dark} <span>{muted}</span>
      </h2>
      {lead && <p className="ls-lead">{lead}</p>}
    </header>
  );
}

function cite(id: string) {
  const r = REFS[id];
  if (!r) return "";
  return `${r.authors.split(",")[0].split(" ")[0]}${r.authors.includes(",") ? " et al." : ""} ${r.year}`;
}

/* ---------------- 2 · Life-changing transformations ---------------- */

export function LifeChanging() {
  const benefits: [string, string][] = [
    ["More career opportunities", "hosoda2003"],
    ["A stronger first impression", "willis2006"],
    ["A better dating life", "walster1966"],
    ["A higher quality of life", "hamermesh2013"],
  ];
  return (
    <section className="lp-sec ls-split">
      <div className="ls-split-text">
        <SecHead
          left
          kicker="New approach"
          dark="Life-changing"
          muted="transformations."
          lead="Research consistently links how people look with how they are treated, at work, in love and in daily life."
        />
        <ol className="ls-benefits">
          {benefits.map(([t, ref], i) => (
            <li key={t}>
              <span>[{i + 1}]</span>
              {t}
              <small>{cite(ref)}</small>
            </li>
          ))}
        </ol>
      </div>
      <div className="ls-ba-pair">
        <BeforeAfter
          aspect={0.75}
          before={<img src={`${S}face.jpg`} alt="Before (synthetic sample)" />}
          after={<img src={`${S}face_after.jpg`} alt="AI illustration of the 12-month plan (synthetic sample)" />}
        />
        <BeforeAfter
          aspect={0.75}
          before={<img src={`${S}body_front.jpg`} alt="Body before (synthetic sample)" />}
          after={<img src={`${S}body_after_front.jpg`} alt="AI illustration of the body after 12 months (synthetic sample)" />}
        />
        <p className="ls-ba-cap">Before · 12-month projection (AI illustration, synthetic person)</p>
      </div>
    </section>
  );
}

/* ---------------- 9 · No need for surgery ---------------- */

export function NoSurgery() {
  return (
    <section className="lp-sec">
      <SecHead
        kicker="Surgery-free transformations"
        dark="No need for"
        muted="surgery."
        lead="Measurements, evidence and a person’s review, turned into a plan built around your features, goals and preferences. Nothing in it needs a scalpel."
      />
      <div className="ls-nosurg">
        {[
          { b: `${S}face.jpg`, a: `${S}face_after.jpg`, t: "Face · 12 months", d: "Skin routine, fat loss, sleep, haircut and beard shaping." },
          { b: `${S}body_side.jpg`, a: `${S}body_after_side.jpg`, t: "Body · 12 months", d: "Training, nutrition and posture work." },
        ].map((x) => (
          <figure key={x.t} className="ls-nosurg-card">
            <BeforeAfter aspect={0.75} before={<img src={x.b} alt="Before (synthetic sample)" />} after={<img src={x.a} alt="AI illustration after 12 months" />} />
            <figcaption>
              <b>{x.t}</b>
              <span>{x.d}</span>
              <Link to="/analysis/projection">See the detailed transformation →</Link>
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="ls-foot ls-foot-c">Projections are AI illustrations of the plan’s end point for a synthetic person, not real results.</p>
    </section>
  );
}

/* ---------------- 10 · Simply follow your plan ---------------- */

const PHASES: { n: 1 | 2 | 3; t: string; w: string }[] = [
  { n: 1, t: "Foundations", w: "Weeks 0–4" },
  { n: 2, t: "Build", w: "Months 1–3" },
  { n: 3, t: "Refine", w: "Months 3–12" },
];

export function FollowPlan({ data }: { data: SampleData }) {
  const items = data.plan.items;
  return (
    <section className="lp-sec ls-split ls-split-top">
      <div className="ls-split-text">
        <SecHead
          left
          kicker="Your plan"
          dark="Simply follow your plan."
          muted="See the difference."
          lead="A step-by-step plan to improve how you look without surgery, in three phases."
        />
        <ul className="ls-checks">
          {[
            "Every step tied to one of your measurements or answers",
            "Each step graded A–C by the strength of its evidence",
            "A realistic visual of where the plan leads",
            "Your reviewer’s notes on the steps that matter most",
          ].map((t) => (
            <li key={t}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              {t}
            </li>
          ))}
        </ul>
        <p className="ls-count">
          <b>{items.length}</b> steps in Khalid’s plan, across {new Set(items.map((i) => i.category)).size} areas.
        </p>
      </div>
      <div className="ls-timeline">
        {PHASES.map((ph) => {
          const steps = items.filter((i) => i.phase === ph.n).slice(0, 4);
          return (
            <div key={ph.n} className="ls-phase">
              <div className="ls-phase-head">
                <span>{ph.n}</span>
                <b>{ph.t}</b>
                <em>{ph.w}</em>
              </div>
              <ul>
                {steps.map((s) => (
                  <li key={s.id}>
                    <span>{s.title}</span>
                    <GradeBadge grade={s.grade} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------- 13 · Four pillars ---------------- */

export function Pillars() {
  const p: [string, string][] = [
    ["Reviewed by a person", "Every report is checked before you see it."],
    ["Surgery-free", "Habits, skin care, grooming and training only."],
    ["100% personalised", "Built from your measurements and answers."],
    ["Science-backed", "Every step cites its research."],
  ];
  return (
    <section className="ls-pillars">
      {p.map(([t, d]) => (
        <div key={t}>
          <b>{t}</b>
          <span>{d}</span>
        </div>
      ))}
    </section>
  );
}

/* ---------------- 15 · Discover what makes you, you ---------------- */

const DISCOVER = ["eye-shape", "brow-shape", "nose-width", "lip-fullness", "jaw-width", "hair-texture"];

export function DiscoverYou({ data }: { data: SampleData }) {
  const ctx: Ctx = { face: data.scan.face, body: data.scan.body?.metrics, side: data.scan.bodySide?.metrics, intake: data.intake };
  const cats = DISCOVER.map((id) => LIBRARY.find((c) => c.id === id)!).filter(Boolean);
  const [sel, setSel] = useState(cats[0].id);
  const cat = cats.find((c) => c.id === sel)!;
  const m = matchFor(cat, ctx, data.scan.featureTypes);
  const type = cat.types.find((t) => t.id === m?.typeId) ?? cat.types.find((t) => m?.family && t.family === m.family) ?? cat.types[0];
  return (
    <section className="lp-sec ls-split ls-split-top">
      <div className="ls-split-text">
        <SecHead left kicker="Learn about your face" dark="Discover what" muted="makes you, you." lead="Every feature, its type, and what it does for your look, with the research behind it." />
        <Link to="/library" className="lp-btn lp-btn-accent">
          Explore the feature library
        </Link>
      </div>
      <div className="ls-discover">
        <div className="ls-discover-tabs" role="tablist">
          {cats.map((c) => (
            <button key={c.id} role="tab" aria-selected={c.id === sel} className={c.id === sel ? "on" : ""} onClick={() => setSel(c.id)}>
              {c.title.replace(" and curl pattern", "")}
            </button>
          ))}
        </div>
        <div className="ls-discover-card">
          {NO_PHOTO.has(cat.id) ? (
            <div className="ls-discover-art">
              <FeatureArt art={type.art} active />
            </div>
          ) : (
            <img src={`${L}${cat.id}/${type.id}.jpg`} alt={`${type.name}, AI-generated synthetic example`} />
          )}
          <div>
            <span className="ls-glass-k ls-dk">Your type</span>
            <h3>{type.name}</h3>
            {m?.value && <span className="ls-discover-val">Measured: {m.value}</span>}
            <p>{type.definition}</p>
            <p className="ls-discover-why">{cat.why}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- 19 · Technology ---------------- */

export function Technology() {
  const t: [string, string][] = [
    ["Precision landmarking", "A 478-point face mesh and a 33-point body pose, run on your device, then corrected for head tilt before any ratio is measured."],
    ["Real personalisation", "Your age, background, location, lifestyle, budget and preferences shape every plan. No two are the same."],
    ["The science of appearance", "48 measurements and 100 feature types, each compared with published reference ranges and graded by evidence."],
    ["Reviewed by humans", "A named reviewer checks the landmarks, the plan and the visuals, and visuals are re-measured for realism before release."],
  ];
  return (
    <section className="lp-sec">
      <SecHead kicker="Technology" dark="The technology behind" muted="your transformation." lead="Measurement, evidence and a person’s judgement. No guesswork." />
      <div className="ls-tech">
        {t.map(([a, b], i) => (
          <div key={a} className="ls-tech-card">
            <span className="ls-tech-n">0{i + 1}</span>
            <h3>{a}</h3>
            <p>{b}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- 20 · Your face tells your story ---------------- */

export function Ancestry() {
  const f: { text: string; ref: string; img: string }[] = [
    { text: "Nostril width varies with the temperature and humidity of ancestral climates.", ref: "zaidi2017", img: "nose-width/balanced" },
    { text: "A single eyelid, with no visible crease, is common in East Asian people and is normal anatomy.", ref: "saonanon2014", img: "eyelid/mono" },
    { text: "Attractive eye tilt differs by ethnicity: steeper in Caucasian and African composites, less steep in Asian ones.", ref: "rhee2012", img: "eye-tilt/mild" },
    { text: "Hair runs on a continuum from straight to tightly coiled, with every shape found worldwide.", ref: "delamettrie2007", img: "hair-texture/3b" },
  ];
  return (
    <section className="lp-sec">
      <SecHead kicker="Background" dark="Your face tells" muted="your story." lead="How some features reflect ancestry, and why we read yours against references that fit you." />
      <div className="ls-ancestry">
        {f.map((x, i) => (
          <div key={x.ref} className="ls-anc">
            <img src={`${L}${x.img}.jpg`} alt="" />
            <span className="ls-anc-n">{i + 1}</span>
            <p>{x.text}</p>
            <small>{cite(x.ref)}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- 23 · Start your transformation ---------------- */

export function StartCta() {
  return (
    <section className="ls-start">
      <div className="ls-start-in">
        <span className="ls-kicker">Get started</span>
        <h2>
          Start your <span>transformation.</span>
        </h2>
        <p>Your personalised analysis and 12-month plan, built from your face, your body and the evidence.</p>
        <Link to="/new" className="lp-btn lp-btn-white">
          Start my scan
        </Link>
      </div>
    </section>
  );
}

/* ---------------- 26 · Your support system ---------------- */

export function Support() {
  return (
    <section className="lp-sec ls-split">
      <div className="ls-split-text">
        <SecHead
          left
          kicker="Informative"
          dark="Your support"
          muted="system."
          lead="A person reviews your report before release and stays on your plan with you: notes on the steps that matter, and monthly check-ins that update it."
        />
        <ul className="ls-checks">
          {["A named reviewer on every report", "Notes from your reviewer on the steps that matter", "Monthly check-ins that update your plan", "Specialist partners in the UAE and KSA (coming soon)"].map((t) => (
            <li key={t}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              {t}
            </li>
          ))}
        </ul>
      </div>
      <div className="ls-chat" aria-label="Example of a reviewer note">
        <div className="ls-chat-head">
          <b>Your reviewer</b>
          <span>Note on your plan</span>
        </div>
        <div className="ls-bubble ls-bubble-me">My results say “mild asymmetry”. Is that normal?</div>
        <div className="ls-bubble">
          Yes. Almost every face has small left–right differences, and yours is within the normal range. Nothing in your plan tries to change it.
        </div>
        <div className="ls-bubble ls-bubble-me">What should I start with?</div>
        <div className="ls-bubble">Sleep and protein first. They drive most of the change in your 12-month visual.</div>
        <span className="ls-chat-note">Example · in-app messaging is coming soon</span>
      </div>
    </section>
  );
}

/* ---------------- 29 · Mindset ---------------- */

export function Mindset() {
  return (
    <section className="lp-sec ls-split ls-split-top">
      <div className="ls-split-text">
        <SecHead left kicker="Your questions" dark="Will analysing my face" muted="make me insecure?" />
      </div>
      <div className="ls-mind">
        <p>
          Worry often comes from guessing. A clear, honest read of your face replaces guesses with facts, including what is normal and what doesn’t need changing.
        </p>
        {[
          ["You learn what is genuinely yours.", "Many features people worry about are normal variation. Types describe your face; none is better than another."],
          ["You see what can and can’t change.", "Small asymmetries are normal and are never a target. Bone doesn’t change with habits, and we say so."],
          ["You stay in control.", "You choose your hair and beard, what you won’t do, and how much detail you see."],
        ].map(([a, b]) => (
          <div key={a} className="ls-mind-row">
            <b>{a}</b>
            <span>{b}</span>
          </div>
        ))}
        <p className="ls-mind-note">If thinking about your appearance is causing you real distress, please talk to a doctor or mental-health professional before starting.</p>
      </div>
    </section>
  );
}

/* ---------------- Privacy · and the service for women ---------------- */

const PRIVACY: [string, string][] = [
  ["Measured on your phone", "Your measurements are computed in your browser. Your photos aren't uploaded to analyse them."],
  ["Seen by one reviewer", "When you send your scan for review, only the reviewer assigned to you sees your photos. Partners never see them unless you choose to share."],
  ["Deleted on schedule", "Review photos are deleted 90 days after your report is delivered, or straight away when you ask."],
  ["Never sold, never shown", "We don't sell your data, use your photos in marketing, or use them to train AI models."],
  ["Encrypted, kept in the region", "Your data is encrypted and stored in line with UAE and Saudi data-protection law."],
  ["Your 12-month visual", "If you ask for one, your photo goes to our image provider only to create it, under a contract that bars keeping or reusing it."],
];

export function Privacy() {
  return (
    <section className="lp-sec ls-privacy" id="privacy">
      <SecHead kicker="Privacy" dark="Your photos stay" muted="yours." lead="Your face is personal. Here is exactly what happens to your photos and results." />
      <div className="ls-privacy-grid">
        {PRIVACY.map(([t, d]) => (
          <div key={t} className="ls-privacy-item">
            <b>{t}</b>
            <p>{d}</p>
          </div>
        ))}
      </div>
      <div className="ls-women" id="women">
        <div>
          <span className="ls-kicker">For women</span>
          <h3>
            A private service for women, <span>reviewed only by women.</span>
          </h3>
          <p>
            The same analysis and the same plan, built for women’s faces and bodies. Your photos and results are only ever seen by a female reviewer, and we never show photos of women on
            this website or in our marketing.
          </p>
        </div>
        <ul>
          <li>Female reviewers only, for every photo and every report</li>
          <li>No photos of women anywhere on our site or in our ads</li>
          <li>Same deletion rules: 90 days after delivery, or on request</li>
        </ul>
      </div>
    </section>
  );
}
