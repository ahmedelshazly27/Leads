import { Link } from "react-router-dom";
import { FacePhoto, toPhoto } from "../../components/FacePhoto";
import { MethodNote } from "../../components/MethodNote";
import { PageHeader, ScoreCard, SpectrumBar } from "../../components/ui";
import { band } from "../../lib/report";
import type { BodyResult, Pt } from "../../lib/types";
import type { SectionProps } from "./types";
import { SideLines, cropAround, sideCrop } from "./BodyDetail";
import "./Body.css";

const SKELETON: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28], [27, 29], [28, 30], [29, 31], [30, 32],
];

function BodyPhoto({ body, photo, children, crop }: { body: BodyResult; photo: string | null; children?: React.ReactNode; crop?: [number, number, number, number] }) {
  return (
    <div className="bd-photo">
      <FacePhoto src={photo} aspect={body.imageAspect} crop={crop} placeholderTone="slate">
        {children}
      </FacePhoto>
    </div>
  );
}

function Skeleton({ body }: { body: BodyResult }) {
  const lm = body.landmarks;
  if (!lm) return null;
  const a = body.imageAspect;
  const P = (i: number) => toPhoto(lm[i], a);
  const inFrame = (p: Pt) => p[1] <= 1.02 && p[1] >= -0.02;
  return (
    <g>
      {SKELETON.filter(([i, j]) => inFrame(lm[i]) && inFrame(lm[j])).map(([i, j]) => {
        const [x1, y1] = P(i);
        const [x2, y2] = P(j);
        return <line key={`${i}-${j}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fff" strokeOpacity={0.8} strokeWidth={1.3} vectorEffect="non-scaling-stroke" />;
      })}
      {[11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].filter((i) => inFrame(lm[i])).map((i) => {
        const [x, y] = P(i);
        return <circle key={i} cx={x} cy={y} r={5} fill="#fff" stroke="#55646a" strokeWidth={1} vectorEffect="non-scaling-stroke" />;
      })}
    </g>
  );
}

function Metric({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "ok" | "warn" | "muted" }) {
  return (
    <div className="bd-metric">
      <div className="mono-sm">{label}</div>
      <div className="bd-metric-value">{value}</div>
      {note && <div className={`bd-metric-note ${tone ?? ""}`}>{note}</div>}
    </div>
  );
}

function MissingData({ fields }: { fields: string[] }) {
  if (!fields.length) return null;
  return (
    <div className="bd-missing">
      <div>
        <b>Add {fields.join(", ")}</b> to unlock body-composition estimates (BMI, body fat, waist-to-height).
      </div>
      <Link to="/analysis/about-you" className="btn btn-ghost">Update About You</Link>
    </div>
  );
}

export function BodyOverview(p: SectionProps) {
  const body = p.scan.body!;
  const side = p.scan.bodySide ?? null;
  const m = body.metrics;
  const i = p.profile.intake;
  const missing = [
    !i.heightCm && "height",
    !i.weightKg && "weight",
  ].filter(Boolean) as string[];
  const swrRef = i.gender === "female" ? "≈1.35" : "≈1.6";
  return (
    <div className="page">
      <PageHeader kicker="Body overview" muted="An overview of" strong="your physique" lead={<>Silhouette proportions, alignment and composition from your full-body photo and measurements. <b>Body shape</b> is one of the strongest cues in first impressions.</>} />
      <MissingData fields={missing} />
      <div className="bd-grid">
        <div className={`bd-left ${side ? "bd-left-two" : ""}`}>
          <div className="bd-pane">
            <BodyPhoto
              body={body}
              photo={p.bodyPhoto}
              crop={side && body.landmarks ? cropAround([0, 11, 12, 15, 16, 23, 24].map((i) => body.landmarks![i]), body.imageAspect, 0.06, 0.42) : undefined}
            >
              <Skeleton body={body} />
            </BodyPhoto>
            <span className="photo-tag bd-pane-tag">Front</span>
          </div>
          {side && (
            <div className="bd-pane">
              <div className="bd-photo">
                <FacePhoto src={p.sidePhoto} aspect={side.imageAspect} crop={sideCrop(side, 0.42, 0.1)} placeholderTone="slate">
                  <SideLines side={side} showPlumb />
                </FacePhoto>
              </div>
              <span className="photo-tag bd-pane-tag">Side</span>
            </div>
          )}
          <ScoreCard className="bd-score" label="Body Score" value={m.bodyScore} />
        </div>
        <div className="bd-right">
          {!side && (
            <div className="bd-missing">
              <div>
                <b>Add a side photo</b> to unlock side posture, belly depth and core analysis.
              </div>
              <Link to="/new" className="btn btn-ghost">New check-in</Link>
            </div>
          )}
          <div className="bd-metrics">
            <Metric label="Shoulder : waist" value={m.shoulderToWaist.toFixed(2)} note={`Reference ${swrRef}`} />
            <Metric
              label={m.whrTape ? "Waist : hip (tape)" : "Waist : hip (frontal)"}
              value={(m.whrTape ?? m.waistToHip).toFixed(2)}
              note={m.whrTape ? (m.whrTape >= (i.gender === "female" ? 0.85 : 0.9) ? "Above WHO threshold" : "Below WHO threshold") : "Width ratio, not circumference"}
              tone={m.whrTape && m.whrTape >= (i.gender === "female" ? 0.85 : 0.9) ? "warn" : "muted"}
            />
            <Metric label="BMI" value={m.bmi ? m.bmi.toFixed(1) : "—"} note={m.bmi ? bmiBand(m.bmi) : "Needs height & weight"} tone={m.bmi && (m.bmi >= 25 || m.bmi < 18.5) ? "warn" : "muted"} />
            <Metric
              label="Body fat"
              value={m.bodyFatEstimate ? `${m.bodyFatEstimate.toFixed(0)}%` : "—"}
              note={m.bodyFatMethod === "navy" ? "US Navy method" : m.bodyFatMethod === "rfm-photo" ? "BMI + photo waist estimate (±5)" : m.bodyFatMethod === "deurenberg" ? "BMI estimate (±4)" : "Needs height & weight"}
              tone="muted"
            />
            <Metric label="Waist : height" value={m.whtr ? m.whtr.toFixed(2) : "—"} note={m.whtr ? (m.whtr >= 0.5 ? "≥ 0.5 — raised risk" : "< 0.5 — healthy") : "Needs height + side photo"} tone={m.whtr && m.whtr >= 0.5 ? "warn" : "muted"} />
            <Metric label="Front posture" value={`${Math.round(m.postureScore)}`} note={band(m.postureScore)} tone="muted" />
            {side && (
              <Metric
                label="Side posture"
                value={`${Math.round(side.metrics.postureScore)}`}
                note={`Head ${Math.max(0, side.metrics.headForward).toFixed(0)}% forward · ${band(side.metrics.postureScore)}`}
                tone={side.metrics.headForward > 10 ? "warn" : "muted"}
              />
            )}
            {side && (
              <Metric
                label="Core"
                value={`${Math.round(side.metrics.coreScore)}`}
                note={`Navel : chest depth ${side.metrics.waistToChestDepth.toFixed(2)}`}
                tone={side.metrics.waistToChestDepth > 0.9 ? "warn" : "muted"}
              />
            )}
            <Metric label="Upper arm : shoulders" value={`${Math.round(m.armToShoulder * 100)}%`} note="Strength cue · ≥ 22% trained" tone="muted" />
          </div>
          <div className="bd-subscores">
            {([
              ["Proportions", m.proportionScore, "/analysis/body-proportions"],
              ["Front posture", m.postureScore, "/analysis/posture"],
              ...(side ? [["Side posture", side.metrics.postureScore, "/analysis/side-posture"], ["Core & waist", side.metrics.coreScore, "/analysis/waist-core"]] : []),
              ["Symmetry", Math.max(0, 100 - m.lrBalance * 6), "/analysis/body-symmetry"],
              ["Composition", m.compositionScore, "/analysis/composition"],
            ] as [string, number, string][]).map(([l, v, to]) => (
              <Link key={l as string} to={to as string} className="bd-sub">
                <span>{l}</span>
                <span className="bd-sub-bar"><i style={{ width: `${v}%` }} /></span>
                <span className="bd-sub-val">{Math.round(v as number)}</span>
              </Link>
            ))}
          </div>
          <div className="bd-expl">
            <div className="mono-sm">Explanation</div>
            <p>
              Your frame measures <b>{m.shoulderToWaist.toFixed(2)}×</b> shoulder-to-waist{m.feetVisible ? "" : " (feet out of frame, so leg ratios were skipped)"}.
              {side ? ` From the side, your navel-level depth is ${Math.round(side.metrics.waistToChestDepth * 100)}% of chest depth and your head sits ${Math.max(0, side.metrics.headForward).toFixed(0)}% of torso length forward.` : ""}
              {m.bodyFatEstimate ? ` Estimated body fat is ${m.bodyFatEstimate.toFixed(0)}%.` : " Add measurements for a body-fat estimate."} Composition and shoulder development are the two levers habits can move most within a year.
            </p>
          </div>
        </div>
      </div>
      <div className="bd-links">
        {[
          ["physique-impression", "Physique impression"],
          ["body-proportions", "Shoulders & V-taper"],
          ["chest-arms", "Chest & arms"],
          ["waist-core", "Waist & core"],
          ["hips-legs", "Hips & legs"],
          ["posture", "Front posture"],
          ["side-posture", "Side posture"],
          ["body-symmetry", "Body symmetry"],
          ["composition", "Composition"],
          ["body-summary", "Summary"],
        ].map(([id, label]) => (
          <Link key={id} to={`/analysis/${id}`} className="bd-link">
            {label} <span>→</span>
          </Link>
        ))}
      </div>
      <MethodNote method="body" />
    </div>
  );
}

function bmiBand(b: number) {
  if (b < 18.5) return "Underweight (WHO)";
  if (b < 25) return "Healthy range (WHO)";
  if (b < 30) return "Overweight (WHO)";
  return "Obesity (WHO)";
}

export function Posture(p: SectionProps) {
  const body = p.scan.body!;
  const m = body.metrics;
  const lm = body.landmarks;
  const a = body.imageAspect;
  const line = (i: number, j: number) => {
    if (!lm) return null;
    const [x1, y1] = toPhoto(lm[i], a);
    const [x2, y2] = toPhoto(lm[j], a);
    const dx = x2 - x1, dy = y2 - y1;
    return (
      <g>
        <line x1={x1 - dx * 0.35} y1={y1 - dy * 0.35} x2={x2 + dx * 0.35} y2={y2 + dy * 0.35} stroke="#fff" strokeWidth={1.4} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
        <line x1={x1 - dx * 0.35} y1={(y1 + y2) / 2} x2={x2 + dx * 0.35} y2={(y1 + y2) / 2} stroke="#fff" strokeOpacity={0.35} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {[[x1, y1], [x2, y2]].map(([x, y], k) => (
          <circle key={k} cx={x} cy={y} r={6} fill="#fff" stroke="#55646a" vectorEffect="non-scaling-stroke" />
        ))}
      </g>
    );
  };
  const mid = lm ? toPhoto([(lm[11][0] + lm[12][0] + lm[23][0] + lm[24][0]) / 4, 0], a)[0] : 0;
  const tiltV = (d: number) => Math.min(1, Math.max(0, 0.5 + d / 10));
  const level = (d: number) => (Math.abs(d) < 1.5 ? "Level" : `${Math.abs(d).toFixed(1)}° ${d > 0 ? "right side lower" : "left side lower"}`);
  return (
    <div className="page">
      <PageHeader kicker="Front posture" muted="Your" strong="front posture" lead={<>Ideal standing alignment has <b>level shoulders and pelvis</b> and the head centred over the body.</>} />
      <div className="bd-grid">
        <div className="bd-left">
          <BodyPhoto body={body} photo={p.bodyPhoto}>
            {line(11, 12)}
            {line(23, 24)}
            {lm && <line x1={mid} y1={0} x2={mid} y2={1000 / a} stroke="#fff" strokeOpacity={0.6} strokeDasharray="2 6" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
          </BodyPhoto>
          <ScoreCard className="bd-score" label="Posture Score" value={m.postureScore} />
        </div>
        <div className="bd-right">
          {[
            ["Shoulder line", m.shoulderTilt, level(m.shoulderTilt)],
            ["Pelvis line", m.hipTilt, level(m.hipTilt)],
          ].map(([label, d, txt]) => (
            <div key={label as string} className="bd-card">
              <div className="bd-card-head">
                <span className="mono-sm">{label}</span>
                <span className="bd-card-val">{txt}</span>
              </div>
              <SpectrumBar value={tiltV(d as number)} labels={["Left low", "Level", "Right low"]} />
            </div>
          ))}
          <div className="bd-card">
            <div className="bd-card-head">
              <span className="mono-sm">Head position</span>
              <span className="bd-card-val">{Math.abs(m.headOffset) < 4 ? "Centred" : `${Math.abs(m.headOffset).toFixed(0)}% ${m.headOffset > 0 ? "right" : "left"} of midline`}</span>
            </div>
            <SpectrumBar value={Math.min(1, Math.max(0, 0.5 + m.headOffset / 30))} labels={["Left", "Centred", "Right"]} />
          </div>
          <div className="bd-card">
            <div className="bd-card-head">
              <span className="mono-sm">Arm symmetry</span>
              <span className="bd-card-val">{Math.round(m.armSymmetry)}/100</span>
            </div>
          </div>
          <div className="bd-expl">
            <div className="mono-sm">Explanation</div>
            <p>
              {Math.abs(m.shoulderTilt) < 2 && Math.abs(m.hipTilt) < 2
                ? "Your shoulders and pelvis are close to level — no corrective work needed beyond balanced training."
                : "A small tilt is common and often habitual (bag side, standing on one leg). Unilateral strength work is low-risk, though evidence that it corrects static asymmetry is limited."}{" "}
              Single photos are sensitive to stance — retake standing evenly on both feet before acting on small values.
            </p>
          </div>
        </div>
      </div>
      <MethodNote method="posture" />
    </div>
  );
}

export function Composition(p: SectionProps) {
  const body = p.scan.body!;
  const m = body.metrics;
  const i = p.profile.intake;
  const missing = [!i.heightCm && "height", !i.weightKg && "weight"].filter(Boolean) as string[];
  const bfIdeal = i.gender === "female" ? [18, 26] : i.gender === "male" ? [10, 18] : [14, 22];
  return (
    <div className="page">
      <PageHeader kicker="Composition" muted="Your" strong="body composition" lead={<>Composition sets <b>facial leanness</b> and body shape. These estimates use validated equations from your measurements.</>} />
      <MissingData fields={missing} />
      <div className="bd-comp">
        <div className="bd-card">
          <div className="bd-card-head">
            <span className="mono-sm">Body-mass index</span>
            <span className="bd-big">{m.bmi ? m.bmi.toFixed(1) : "—"}</span>
          </div>
          {m.bmi ? <SpectrumBar value={(m.bmi - 15) / 20} labels={["15", "25", "35"]} /> : <p className="bd-na">Add height and weight.</p>}
          <p className="bd-note">{m.bmi ? bmiBand(m.bmi) : "WHO categories: 18.5–24.9 healthy."} BMI can't separate muscle from fat.</p>
        </div>
        <div className="bd-card">
          <div className="bd-card-head">
            <span className="mono-sm">Body fat estimate</span>
            <span className="bd-big">{m.bodyFatEstimate ? `${m.bodyFatEstimate.toFixed(0)}%` : "—"}</span>
          </div>
          {m.bodyFatEstimate ? <SpectrumBar value={m.bodyFatEstimate / 45} labels={["Lean", `${bfIdeal[0]}–${bfIdeal[1]}%`, "High"]} /> : <p className="bd-na">Add measurements.</p>}
          <p className="bd-note">
            {m.bodyFatMethod === "navy"
              ? "US Navy circumference method (Hodgdon & Beckett 1984), standard error ≈ ±3–4%."
              : m.bodyFatMethod === "rfm-photo"
                ? `Average of the Deurenberg BMI equation (1991) and Relative Fat Mass (Woolcott & Bergman 2018) using your photo-estimated waist of ~${m.waistEstCm?.toFixed(0)} cm. Treat as ±5 points.`
                : m.bodyFatMethod === "deurenberg"
                  ? "Deurenberg BMI equation (1991), standard error ≈ ±4%. Add a side photo to include the waist-based estimate."
                  : "Needs height & weight."}
          </p>
        </div>
        <div className="bd-card">
          <div className="bd-card-head">
            <span className="mono-sm">Waist-to-height</span>
            <span className="bd-big">{m.whtr ? m.whtr.toFixed(2) : "—"}</span>
          </div>
          {m.whtr ? <SpectrumBar value={(m.whtr - 0.35) / 0.3} labels={["0.35", "0.50", "0.65"]} /> : <p className="bd-na">Needs height and a side photo.</p>}
          <p className="bd-note">{m.waistEstCm && !i.waistCm ? `Waist estimated from your photos (~${m.waistEstCm.toFixed(0)} cm). ` : ""}Keep waist below half your height; ≥ 0.5 flags raised cardiometabolic risk (Ashwell 2012).</p>
        </div>
        <div className="bd-card">
          <div className="bd-card-head">
            <span className="mono-sm">Waist-to-hip (tape)</span>
            <span className="bd-big">{m.whrTape ? m.whrTape.toFixed(2) : "—"}</span>
          </div>
          {m.whrTape ? <SpectrumBar value={(m.whrTape - 0.6) / 0.45} labels={["0.60", i.gender === "female" ? "0.85" : "0.90", "1.05"]} /> : <p className="bd-na">Add waist and hip circumferences.</p>}
          <p className="bd-note">WHO thresholds: ≥ 0.90 men, ≥ 0.85 women.</p>
        </div>
      </div>
      <div className="bd-expl bd-expl-wide">
        <div className="mono-sm">Explanation</div>
        <p>
          {m.bodyFatEstimate
            ? `At ~${m.bodyFatEstimate.toFixed(0)}% body fat, the reference range for ${i.gender === "other" ? "adults" : i.gender + "s"} is ${bfIdeal[0]}–${bfIdeal[1]}%. `
            : ""}
          Fat loss at 0.5–1% of body weight per week, with high protein and resistance training, preserves muscle while revealing facial structure. Measure waist at the navel, relaxed, after exhaling.
        </p>
      </div>
      <MethodNote method="composition" />
    </div>
  );
}
