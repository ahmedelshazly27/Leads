import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { PageHeader, ScoreCard, GradeBadge, Citations } from "../../components/ui";
import { User } from "../../components/icons";
import { band } from "../../lib/report";
import { GRADE_LABEL, LIMITATIONS, METHODS, REFS, type EvidenceGrade } from "../../lib/science";
import { NAV } from "../../lib/sections";
import { updateIntake } from "../../lib/store";
import type { Intake } from "../../lib/types";
import type { SectionProps } from "./types";
import "./Intro.css";

/* ------------------------------------------------------------------ */
/*  Getting started                                                     */
/* ------------------------------------------------------------------ */

export function GettingStarted(p: SectionProps) {
  const first = p.profile.intake.name.split(" ")[0];
  const scanDate = new Date(p.scan.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="page">
      <PageHeader
        kicker="Getting started"
        muted={`Welcome,`}
        strong={first}
        lead={<>Your analysis from <b>{scanDate}</b>. Every number is measured from your photos and compared with published reference data; every recommendation cites the research behind it.</>}
      />
      <div className="in-top">
        <ScoreCard className="in-score" tone="dark" label="Overall score" value={p.plan.overallNow} />
        <div className="in-top-side">
          <div className="in-stat">
            <span className="mono-sm">Band</span>
            <b>{band(p.plan.overallNow)}</b>
          </div>
          <div className="in-stat">
            <span className="mono-sm">12-month potential</span>
            <b>{Math.round(p.plan.overallProjected)}/100</b>
          </div>
          <div className="in-stat">
            <span className="mono-sm">Plan steps</span>
            <b>{p.plan.items.length}</b>
          </div>
          <div className="in-stat">
            <span className="mono-sm">Check-ins</span>
            <b>{p.scans.length}</b>
          </div>
        </div>
      </div>

      <h2 className="title-md in-h2">What's inside</h2>
      <div className="in-groups">
        {NAV.filter((g) => g.id !== "introduction").map((g) => (
          <Link key={g.id} to={`/analysis/${g.items[0].id}`} className="in-group">
            <div className="mono-sm">{g.items.length} sections</div>
            <div className="in-group-title">{g.label}</div>
            <div className="in-group-items">{g.items.map((i) => i.label.replace(" Analysis", "")).join(" · ")}</div>
          </Link>
        ))}
      </div>

      <div className="in-two">
        <section className="in-card">
          <div className="mono">Capture tips</div>
          <ul className="bullets in-list">
            <li><b>Front portrait</b> from ~1.5 m using zoom — not an arm's-length selfie (close range widens the nose by up to ~30%).</li>
            <li>Camera at <b>eye level</b>, head straight, neutral expression, lips closed.</li>
            <li>Even, soft front light (facing a window); no overhead spotlights or filters.</li>
            <li><b>Full body</b>: head to toe, facing the camera, feet hip-width, arms slightly away from the body (A-pose), fitted clothing.</li>
            <li>Use the same place, light and distance for every check-in.</li>
          </ul>
        </section>
        <section className="in-card">
          <div className="mono">Limitations</div>
          <ul className="bullets in-list">
            {LIMITATIONS.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>
      </div>
      <div className="in-cta">
        <Link to="/analysis/about-you" className="btn btn-ghost">Review your details</Link>
        <Link to="/analysis/your-protocol" className="btn">See your protocol</Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  About you                                                           */
/* ------------------------------------------------------------------ */

const SKIN_SWATCH = ["#f1d9c6", "#e6c3a5", "#d4a888", "#b98462", "#8d5a3b", "#5b3a26"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");

export function AboutYou(p: SectionProps) {
  const i = p.profile.intake;
  const avatar = p.facePhoto ?? p.visuals.baseline ?? null;
  const rows: [string, ReactNode][] = [
    ["Ethnicity", i.ethnicity || "—"],
    ["Age", i.age],
    ["Gender", cap(i.gender)],
    ["Preferences", cap(i.preferences)],
    ["Smoking", cap(i.smoking)],
    ["Drinking", cap(i.drinking)],
    ["Skin tone", <><i className="in-swatch" style={{ background: SKIN_SWATCH[i.skinTone - 1] }} /> Fitzpatrick type {["I", "II", "III", "IV", "V", "VI"][i.skinTone - 1]}</>],
    ["Location", i.location || "—"],
    ["Limitations", i.limitations || "None reported"],
    ["Allergies", i.allergies || "None reported"],
    ["Professional", i.profession || "—"],
  ];
  return (
    <div className="page">
      <PageHeader kicker="About you" muted="Your" strong="profile" mutedFirst lead="These details personalise reference ranges and the plan. Height, weight and tape measurements unlock validated body-composition estimates." />
      <div className="in-about">
        <section className="in-profile">
          <h2 className="title-md">User Profile</h2>
          <div className="in-prow in-prow-head">
            <div className="in-avatar">{avatar ? <img src={avatar} alt="" /> : <User size={28} />}</div>
            <div>
              <div className="in-name">{i.name}</div>
              <div className="in-pid">Protocol ID: <b>#{p.profile.id.slice(0, 5).toUpperCase()}</b></div>
            </div>
          </div>
          {rows.map(([k, v]) => (
            <div key={k} className="in-prow">
              <span className="in-pk">{k}</span>
              <span className="in-pv">{v}</span>
            </div>
          ))}
        </section>
        <IntakeForm key={p.profile.id} profileId={p.profile.id} intake={i} />
      </div>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="in-field">
      <span className="mono-sm">{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function IntakeForm({ profileId, intake }: { profileId: string; intake: Intake }) {
  const [f, setF] = useState<Intake>(intake);
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof Intake>(k: K, v: Intake[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setSaved(false);
  };
  const num = (v: string) => (v === "" ? null : Number(v));
  const sel = <K extends keyof Intake>(k: K, opts: string[]) => (
    <select value={String(f[k])} onChange={(e) => set(k, e.target.value as Intake[K])}>
      {opts.map((o) => (
        <option key={o} value={o}>{cap(o)}</option>
      ))}
    </select>
  );
  return (
    <form
      className="in-form"
      onSubmit={(e) => {
        e.preventDefault();
        updateIntake(profileId, f);
        setSaved(true);
      }}
    >
      <div className="in-form-sec mono">Basics</div>
      <div className="in-grid">
        <Field label="Name"><input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Age"><input type="number" min={16} max={99} value={f.age} onChange={(e) => set("age", Number(e.target.value))} /></Field>
        <Field label="Gender">{sel("gender", ["female", "male", "other"])}</Field>
        <Field label="Ethnicity"><input value={f.ethnicity} onChange={(e) => set("ethnicity", e.target.value)} /></Field>
        <Field label="Location"><input value={f.location} onChange={(e) => set("location", e.target.value)} /></Field>
        <Field label="Profession"><input value={f.profession} onChange={(e) => set("profession", e.target.value)} /></Field>
      </div>
      <div className="in-form-sec mono">Body measurements</div>
      <div className="in-grid">
        <Field label="Height (cm)"><input type="number" value={f.heightCm ?? ""} onChange={(e) => set("heightCm", num(e.target.value))} /></Field>
        <Field label="Weight (kg)"><input type="number" step="0.1" value={f.weightKg ?? ""} onChange={(e) => set("weightKg", num(e.target.value))} /></Field>
        <Field label="Waist (cm)" hint="At the navel, relaxed"><input type="number" step="0.5" value={f.waistCm ?? ""} onChange={(e) => set("waistCm", num(e.target.value))} /></Field>
        <Field label="Hip (cm)" hint="Widest point of the buttocks"><input type="number" step="0.5" value={f.hipCm ?? ""} onChange={(e) => set("hipCm", num(e.target.value))} /></Field>
        <Field label="Neck (cm)" hint="Below the larynx"><input type="number" step="0.5" value={f.neckCm ?? ""} onChange={(e) => set("neckCm", num(e.target.value))} /></Field>
      </div>
      <div className="in-form-sec mono">Hair & skin</div>
      <div className="in-grid">
        <Field label="Hair type">{sel("hairType", ["straight", "wavy", "curly", "coily"])}</Field>
        <Field label="Hair length on top (cm)"><input type="number" value={f.hairLengthCm} onChange={(e) => set("hairLengthCm", Number(e.target.value))} /></Field>
        <Field label="Hair loss">{sel("hairLoss", ["none", "early", "moderate", "advanced"])}</Field>
        <Field label="Facial hair growth">{sel("facialHair", ["none", "patchy", "full"])}</Field>
        <Field label="Skin tone (Fitzpatrick)">
          <select value={f.skinTone} onChange={(e) => set("skinTone", Number(e.target.value) as Intake["skinTone"])}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>Type {["I", "II", "III", "IV", "V", "VI"][n - 1]}</option>
            ))}
          </select>
        </Field>
        <Field label="Active acne">
          <select value={f.activeAcne ? "yes" : "no"} onChange={(e) => set("activeAcne", e.target.value === "yes")}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </Field>
      </div>
      <div className="in-form-sec mono">Lifestyle & preferences</div>
      <div className="in-grid">
        <Field label="Sleep (h/night)"><input type="number" step="0.5" value={f.sleepHours} onChange={(e) => set("sleepHours", Number(e.target.value))} /></Field>
        <Field label="Training days / week"><input type="number" min={0} max={7} value={f.trainingDays} onChange={(e) => set("trainingDays", Number(e.target.value))} /></Field>
        <Field label="Smoking">{sel("smoking", ["no", "occasionally", "daily"])}</Field>
        <Field label="Drinking">{sel("drinking", ["never", "occasional", "weekly", "daily"])}</Field>
        <Field label="Treatment preference">{sel("preferences", ["non-invasive", "open-to-clinical", "open-to-surgical"])}</Field>
        <Field label="Budget">{sel("budget", ["low", "medium", "high"])}</Field>
        <Field label="Limitations"><input value={f.limitations} onChange={(e) => set("limitations", e.target.value)} /></Field>
        <Field label="Allergies"><input value={f.allergies} onChange={(e) => set("allergies", e.target.value)} /></Field>
      </div>
      <div className="in-form-foot">
        <span className="in-saved">{saved ? "Saved — your plan has been updated." : "Body scores recompute from measurements on your next scan."}</span>
        <button type="submit" className="btn">Save details</button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Methodology                                                         */
/* ------------------------------------------------------------------ */

const METHOD_NAMES: Record<string, string> = {
  symmetry: "Symmetry",
  averageness: "Averageness",
  dimorphism: "Dimorphism",
  fwhr: "Facial width-to-height ratio",
  proportions: "Proportions",
  neoteny: "Neoteny",
  adiposity: "Facial adiposity",
  contrast: "Facial contrast",
  skin: "Skin analysis",
  canthal: "Canthal tilt",
  lips: "Lips",
  brows: "Brows",
  impression: "First impression",
  body: "Body proportions",
  posture: "Posture",
  composition: "Composition",
};

export function Methodology(_p: SectionProps) {
  const refs = Object.values(REFS).sort((a, b) => a.authors.localeCompare(b.authors));
  return (
    <div className="page">
      <PageHeader kicker="Methodology" muted="How we" strong="measure" lead="Landmark detection runs on your device (MediaPipe face mesh: 478 points; pose: 33 points + body segmentation). The face is rotated into a frontal pose before any ratio is computed. Below: what each metric measures, its reference norm, and the sources." />
      <section className="in-card">
        <div className="mono">Evidence grades</div>
        <div className="in-grades">
          {(Object.keys(GRADE_LABEL) as EvidenceGrade[]).map((g) => (
            <div key={g} className="in-grade">
              <GradeBadge grade={g} />
              <span>{GRADE_LABEL[g]}</span>
            </div>
          ))}
        </div>
      </section>
      <div className="in-methods">
        {Object.entries(METHODS).map(([k, m]) => (
          <article key={k} className="in-method">
            <h3>{METHOD_NAMES[k] ?? k}</h3>
            <p><span className="mono-sm">Method</span>{m.how}</p>
            <p><span className="mono-sm">Reference</span>{m.norm}</p>
            <Citations ids={m.refs} />
          </article>
        ))}
      </div>
      <section className="in-card">
        <div className="mono">Limitations</div>
        <ul className="bullets in-list">
          {LIMITATIONS.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>
      <section className="in-card">
        <div className="mono">Bibliography · {refs.length} sources</div>
        <ol className="in-bib">
          {refs.map((r) => (
            <li key={r.id}>
              <span>{r.authors} ({r.year}). <i>{r.title}</i>. {r.source}.</span>
              <small>{r.finding}</small>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
