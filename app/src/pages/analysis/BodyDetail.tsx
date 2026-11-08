import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { FacePhoto, toPhoto } from "../../components/FacePhoto";
import { MethodNote } from "../../components/MethodNote";
import { Doc, ListIcon, Play, Search } from "../../components/icons";
import { Empty, GradeBadge, Kicker, PageHeader, ScoreCard, SpectrumBar } from "../../components/ui";
import { sigmoid } from "../../lib/geometry";
import { band } from "../../lib/report";
import type { BodyResult, Pt, SideResult } from "../../lib/types";
import { FeatureView } from "./FeatureView";
import type { SectionProps } from "./types";
import "./BodyDetail.css";

/* ------------------------------------------------------------------ */
/*  Geometry helpers (normalized image coords)                         */
/* ------------------------------------------------------------------ */

const avgPt = (...ps: Pt[]): Pt => [ps.reduce((s, p) => s + p[0], 0) / ps.length, ps.reduce((s, p) => s + p[1], 0) / ps.length];

function frame(body: BodyResult) {
  const lm = body.landmarks;
  if (!lm) return null;
  const sh = avgPt(lm[11], lm[12]);
  const hp = avgPt(lm[23], lm[24]);
  const torso = Math.max(1e-3, hp[1] - sh[1]);
  const xAt = (y: number) => sh[0] + ((hp[0] - sh[0]) * (y - sh[1])) / torso;
  /** horizontal line centred at cx with a width given in torso units */
  const span = (y: number, width: number, cx = xAt(y)): [Pt, Pt] => {
    const half = (width * torso) / body.imageAspect / 2;
    return [
      [cx - half, y],
      [cx + half, y],
    ];
  };
  return { lm, sh, hp, torso, xAt, span };
}

/** Crop rectangle (normalized x,y,w,h) around points, keeping a portrait-ish box. */
export function cropAround(pts: Pt[], aspect: number, pad = 0.12, shape = 0.8): [number, number, number, number] {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  let x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad;
  let y0 = Math.min(...ys) - pad * aspect, y1 = Math.max(...ys) + pad * aspect;
  // enforce visual aspect: visual w/h = (w*1000)/(h*1000/aspect) = w*aspect/h
  let w = x1 - x0, h = y1 - y0;
  if ((w * aspect) / h < shape) {
    const nw = (shape * h) / aspect;
    x0 -= (nw - w) / 2;
    w = nw;
  } else {
    const nh = (w * aspect) / shape;
    y0 -= (nh - h) / 2;
    h = nh;
  }
  x0 = Math.max(0, Math.min(1 - Math.min(w, 1), x0));
  y0 = Math.max(0, Math.min(1 - Math.min(h, 1), y0));
  return [x0, y0, Math.min(w, 1), Math.min(h, 1)];
}

/* ------------------------------------------------------------------ */
/*  Overlay primitives                                                 */
/* ------------------------------------------------------------------ */

function MLine({ a, b, aspect, label, dim }: { a: Pt; b: Pt; aspect: number; label?: string; dim?: boolean }) {
  const p = toPhoto(a, aspect);
  const q = toPhoto(b, aspect);
  return (
    <g opacity={dim ? 0.55 : 1}>
      <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="#fff" strokeWidth={1.4} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
      {[p, q].map((x, i) => (
        <circle key={i} cx={x[0]} cy={x[1]} r={6} fill="#fff" stroke="#55646a" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      ))}
      {label && (
        <g transform={`translate(${(p[0] + q[0]) / 2}, ${p[1] - 16})`}>
          <rect x={-label.length * 4.6 - 10} y={-15} width={label.length * 9.2 + 20} height={22} rx={6} fill="rgba(70,82,88,.62)" />
          <text x={0} y={0} textAnchor="middle" fill="#eef3f4" fontSize={12} fontFamily="JetBrains Mono" letterSpacing=".08em">
            {label}
          </text>
        </g>
      )}
    </g>
  );
}

function Pic({ photo, aspect, children, crop }: { photo: string | null; aspect: number; children?: ReactNode; crop?: [number, number, number, number] }) {
  return (
    <FacePhoto src={photo} aspect={aspect} crop={crop} placeholderTone="slate">
      {children}
    </FacePhoto>
  );
}

function NeedSide() {
  return (
    <div className="bdd-needside">
      <div>
        <b>Add a side photo</b> (side-on, whole body, arms relaxed) to measure head position, belly depth and back curves.
      </div>
      <Link to="/new" className="btn btn-ghost">
        New check-in
      </Link>
    </div>
  );
}

function Card({ label, value, note, children, tone }: { label: string; value?: ReactNode; note?: ReactNode; children?: ReactNode; tone?: "warn" }) {
  return (
    <div className="bdd-card">
      <div className="bdd-card-head">
        <span className="mono-sm">{label}</span>
        {value != null && <span className="bdd-card-val">{value}</span>}
      </div>
      {children}
      {note && <p className={`bdd-note ${tone ?? ""}`}>{note}</p>}
    </div>
  );
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const pct = (v: number, d = 0) => `${v.toFixed(d)}%`;

/* ------------------------------------------------------------------ */
/*  Physique indices                                                   */
/* ------------------------------------------------------------------ */

function physique(p: SectionProps) {
  const m = p.scan.body!.metrics;
  const side = p.scan.bodySide?.metrics ?? null;
  const female = p.profile.intake.gender === "female";
  const swrRef = female ? 1.35 : 1.5;
  const strength = sigmoid((m.shoulderToWaist - swrRef) / 0.08 + (m.armToShoulder - 0.21) / 0.02);
  const leanness = side
    ? sigmoid(-(side.waistToChestDepth - 0.88) / 0.05 - (side.bellyProtrusion - 2) / 3)
    : sigmoid(-(m.waistWidth / m.shoulderWidth - 0.66) / 0.04);
  const postureV = (side ? (side.postureScore + m.postureScore) / 2 : m.postureScore) / 100;
  return { m, side, strength, leanness, postureV, female };
}

/* ------------------------------------------------------------------ */
/*  Physique impression                                                */
/* ------------------------------------------------------------------ */

export function PhysiqueImpression(p: SectionProps) {
  const body = p.scan.body!;
  const { m, side, strength, leanness, postureV, female } = physique(p);
  const f = frame(body);
  const [hover, setHover] = useState<string | null>(null);
  const pills = [
    { w: "Strong", on: strength > 0.62 },
    { w: "Athletic", on: strength > 0.5 && leanness > 0.5 },
    { w: "Broad", on: m.shoulderToWaist >= (female ? 1.4 : 1.55) },
    { w: "Balanced", on: Math.abs(strength - 0.5) < 0.15 },
    { w: "Soft", on: leanness < 0.4 },
    { w: "Slim", on: m.armToShoulder < 0.19 && leanness > 0.55 },
    { w: "Upright", on: postureV >= 0.82 },
    { w: "Slouched", on: postureV < 0.7 },
  ];
  const hot = f
    ? [
        { id: 11, label: "Shoulder width" },
        { id: 12, label: "Shoulder width" },
        { id: 13, label: "Upper arm" },
        { id: 14, label: "Upper arm" },
        { id: 23, label: "Waist & hips" },
        { id: 24, label: "Waist & hips" },
        { id: 0, label: "Head position" },
      ]
    : [];
  const rows = [
    {
      name: "Strength cue",
      v: strength,
      axis: ["Slight", "Average", "Strong"] as [string, string, string],
      chips: ["Shoulders", "Waist", "Upper arms"],
      text: `Shoulder-to-waist ${m.shoulderToWaist.toFixed(2)} and upper-arm width ${Math.round(m.armToShoulder * 100)}% of shoulder width. Perceived upper-body strength explained ~70% of the variance in men's bodily attractiveness ratings (Sell 2017); broader shoulders and fuller arms move this most.`,
    },
    {
      name: "Leanness cue",
      v: leanness,
      axis: ["Soft", "Average", "Lean"] as [string, string, string],
      chips: side ? ["Belly depth", "Chest depth", "Waist"] : ["Waist", "Shoulders"],
      text: side
        ? `Navel-level depth is ${Math.round(side.waistToChestDepth * 100)}% of chest depth and the belly sits ${Math.max(0, side.bellyProtrusion).toFixed(0)}% of torso length ahead of the chest. Central fat is read quickly as lower fitness; it changes only with overall fat loss.`
        : `Waist width is ${Math.round((m.waistWidth / m.shoulderWidth) * 100)}% of shoulder width. Add a side photo for belly depth.`,
    },
    {
      name: "Posture cue",
      v: postureV,
      axis: ["Slouched", "Neutral", "Upright"] as [string, string, string],
      chips: side ? ["Head", "Shoulders", "Trunk"] : ["Shoulder line", "Pelvis", "Head"],
      text: side
        ? `Ear sits ${side.headForward.toFixed(0)}% of torso length ahead of the shoulder; shoulders ${Math.abs(side.shoulderForward) < 1 ? "stacked over" : `${Math.abs(side.shoulderForward).toFixed(0)}% ${side.shoulderForward > 0 ? "ahead of" : "behind"}`} hips. An upright, stacked posture makes the same physique read taller and more confident.`
        : `Shoulder line ${m.shoulderTilt.toFixed(1)}°, pelvis ${m.hipTilt.toFixed(1)}°. Add a side photo for head and shoulder position.`,
    },
  ];
  const strongest = [...rows].sort((a, b) => Math.abs(b.v - 0.5) - Math.abs(a.v - 0.5))[0];
  const bodyItems = p.plan.items.filter((i) => ["lifting", "fatloss", "forward-head", "rounded-shoulders", "posture", "protein"].includes(i.id)).slice(0, 3);
  return (
    <div className="page">
      <div className="fi-head">
        <div>
          <Kicker>Physique impression</Kicker>
          <h1 className="title-lg fi-title">First impression of your physique</h1>
          <p className="lead">How your build and posture read at first glance — the cues people use to judge strength, fitness and confidence before any detail.</p>
        </div>
        <a className="fi-why" href="#bd-method">
          Why body impressions matter? <Play size={14} />
        </a>
      </div>
      <div className="fi-hero bdd-hero">
        <div className="fi-photo">
          <Pic photo={p.bodyPhoto} aspect={body.imageAspect} crop={f ? cropAround([f.lm[0], f.lm[11], f.lm[12], f.lm[23], f.lm[24], f.lm[15], f.lm[16]], body.imageAspect, 0.14, 1.35) : undefined}>
            {f &&
              hot.map((h, i) => {
                const q = toPhoto(f.lm[h.id], body.imageAspect);
                return (
                  <g key={i} onMouseEnter={() => setHover(h.label)} onMouseLeave={() => setHover(null)} onClick={() => setHover(h.label)} style={{ cursor: "pointer" }}>
                    <circle cx={q[0]} cy={q[1]} r={10} fill="rgba(255,255,255,.25)" />
                    <circle cx={q[0]} cy={q[1]} r={4} fill="#fff" />
                  </g>
                );
              })}
          </Pic>
          <span className="fi-tip">{hover ?? "Click/Hover here"}</span>
        </div>
        <div className="fi-panel">
          <span className="fi-grip" />
          <div className="fi-pills">
            {pills.map((x) => (
              <span key={x.w} className={`fi-pill ${x.on ? "on" : ""}`}>
                {x.w}
              </span>
            ))}
          </div>
        </div>
      </div>
      <section className="fi-social">
        <h2 className="title-md">How your physique is read</h2>
        <p className="lead">Three body cues carry most of the weight in first impressions of build.</p>
        <div className="fi-rows">
          {rows.map((x) => (
            <div key={x.name} className="fi-row">
              <div className="fi-row-l">
                <div className="fi-row-name">{x.name}</div>
                <div>
                  <div className="mono-sm">Features involved</div>
                  <div className="fi-chips">
                    {x.chips.map((c) => (
                      <span key={c} className="chip">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="fi-row-r">
                <p>{x.text}</p>
                <SpectrumBar value={x.v} labels={x.axis} />
              </div>
              <Doc size={14} className="fi-doc" />
            </div>
          ))}
        </div>
      </section>
      <section className="fi-summary">
        <div className="mono-sm fi-sum-k">Summary</div>
        <h2 className="title-md">Summary of your physique impression</h2>
        <div className="fi-sum-block">
          <div className="mono-sm">
            <Search size={12} /> Observation
          </div>
          <p>
            Your build reads most strongly on <b>{strongest.name.replace(" cue", "").toLowerCase()}</b> ({strongest.v > 0.5 ? strongest.axis[2] : strongest.axis[0]}).
          </p>
        </div>
        <div className="fi-sum-block">
          <div className="mono-sm">
            <Doc size={12} /> Takeaway
          </div>
          <p>Frame width is fixed, but shoulder and arm muscle, central fat and posture all change within a year — and they are exactly the cues raters use.</p>
        </div>
        <div className="fi-sum-block">
          <div className="mono-sm">
            <ListIcon size={12} /> Actions
          </div>
          <ul className="bullets">
            {bodyItems.map((i) => (
              <li key={i.id}>
                <Link to="/analysis/recommendations">{i.title}</Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <div id="bd-method">
        <MethodNote method="physique" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Chest & arms                                                       */
/* ------------------------------------------------------------------ */

export function ChestArms(p: SectionProps) {
  const body = p.scan.body!;
  const m = body.metrics;
  const side = p.scan.bodySide?.metrics ?? null;
  const f = frame(body);
  const a = body.imageAspect;
  const chestY = f ? f.sh[1] + f.torso * 0.3 : 0;
  const armLine = (s: number, e: number): [Pt, Pt] | null => {
    if (!f) return null;
    const c = avgPt(f.lm[s], f.lm[e]);
    const half = (m.upperArmWidth * f.torso) / a / 2;
    return [
      [c[0] - half, c[1]],
      [c[0] + half, c[1]],
    ];
  };
  const chestRatio = m.chestWidth / m.shoulderWidth;
  const armLabel = m.armToShoulder >= 0.24 ? "Full upper arms" : m.armToShoulder >= 0.21 ? "Moderate upper arms" : "Slim upper arms";
  const la = armLine(11, 13), ra = armLine(12, 14);
  return (
    <FeatureView
      title="Your chest &"
      highlight="arms"
      lead={
        <>
          Upper-arm and chest development are direct <b>strength cues</b> — and among the fastest areas to respond to training.
        </>
      }
      photo={
        <Pic photo={p.bodyPhoto} aspect={a} crop={f ? cropAround([f.lm[11], f.lm[12], f.lm[13], f.lm[14], f.lm[0]], a, 0.1, 0.9) : undefined}>
          {f && (
            <>
              <MLine {...{ a: f.span(chestY, m.chestWidth)[0], b: f.span(chestY, m.chestWidth)[1] }} aspect={a} label="CHEST" />
              {la && <MLine a={la[0]} b={la[1]} aspect={a} />}
              {ra && <MLine a={ra[0]} b={ra[1]} aspect={a} />}
            </>
          )}
        </Pic>
      }
      diagram={<WidthBars rows={[["Shoulders", m.shoulderWidth], ["Chest", m.chestWidth], ["Upper arm ×2", m.upperArmWidth * 2]]} />}
      typeLabel={armLabel}
      attrs={[
        { label: "Chest : shoulders", value: `${Math.round(chestRatio * 100)}%` },
        { label: "Upper arm : shoulders", value: `${Math.round(m.armToShoulder * 100)}%` },
        { label: "Arm length symmetry", value: `${Math.round(m.armSymmetry)}/100` },
        { label: "Chest depth (side)", value: side ? `${Math.round(side.chestDepth * 100)}% torso` : "Needs side photo" },
      ]}
      explanation={
        <>
          Your upper arms measure <b>{Math.round(m.armToShoulder * 100)}%</b> of shoulder width (frontal, relaxed). {m.armToShoulder < 0.22 ? "Adding direct arm work (biceps and triceps, 6–10 hard sets/week each) on top of presses and rows is the quickest visible win. " : "Arm development is in a good range relative to your frame. "}
          Chest width at armpit level is {Math.round(chestRatio * 100)}% of shoulder width; a fuller chest and upper back come from presses and rows trained 2×/week. Relaxed-arm widths include some fat, so track them alongside body fat.
        </>
      }
      method="physique"
    />
  );
}

function WidthBars({ rows }: { rows: [string, number][] }) {
  const max = Math.max(...rows.map((r) => r[1]));
  return (
    <svg viewBox="0 0 320 120" width="100%" height="100%">
      {rows.map(([name, v], i) => {
        const w = (v / max) * 210;
        const y = 24 + i * 36;
        return (
          <g key={name}>
            <text x={14} y={y + 4} fontSize={9} fontFamily="JetBrains Mono" fill="#7d898d" letterSpacing=".08em">
              {name.toUpperCase()}
            </text>
            <line x1={205 - w / 2} y1={y} x2={205 + w / 2} y2={y} stroke="#8a9a9f" strokeDasharray="3 3" />
            <circle cx={205 - w / 2} cy={y} r={3} fill="#fff" stroke="#8a9a9f" />
            <circle cx={205 + w / 2} cy={y} r={3} fill="#fff" stroke="#8a9a9f" />
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Waist & core                                                       */
/* ------------------------------------------------------------------ */

export function SideLines({ side, showPlumb = false, showDepth = false, showArc = false }: { side: SideResult; showPlumb?: boolean; showDepth?: boolean; showArc?: boolean }) {
  const L = side.lines;
  if (!L) return null;
  const a = side.imageAspect;
  const m = side.metrics;
  const dir = m.facing === "left" ? -1 : 1;
  const E = toPhoto(L.ear, a), S = toPhoto(L.shoulder, a), H = toPhoto(L.hip, a);
  const front = (seg: [Pt, Pt]) => (dir < 0 ? (seg[0][0] < seg[1][0] ? seg[0] : seg[1]) : seg[0][0] > seg[1][0] ? seg[0] : seg[1]);
  const cf = toPhoto(front(L.chest), a);
  const wf = toPhoto(front(L.waist), a);
  // angle arc at the shoulder: from horizontal (towards the front) to the ear
  const r = 70;
  const ex = E[0] - S[0], ey = E[1] - S[1];
  const el = Math.hypot(ex, ey) || 1;
  const start: Pt = [S[0] + dir * r, S[1]];
  const end: Pt = [S[0] + (ex / el) * r, S[1] + (ey / el) * r];
  const cross = dir * r * ((ey / el) * r) - 0 * ((ex / el) * r);
  return (
    <g>
      {showPlumb && (
        // reference vertical through the hip (feet are often out of frame, so the ankle can't anchor it)
        <line x1={H[0]} y1={0} x2={H[0]} y2={1000 / a} stroke="#fff" strokeOpacity={0.7} strokeDasharray="2 6" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
      )}
      {showPlumb && (
        <polyline points={`${E[0]},${E[1]} ${S[0]},${S[1]} ${H[0]},${H[1]}`} fill="none" stroke="#fff" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
      )}
      {showArc && (
        <>
          <line x1={S[0]} y1={S[1]} x2={S[0] + dir * r * 1.6} y2={S[1]} stroke="#fff" strokeOpacity={0.6} strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          <path d={`M ${start[0]} ${start[1]} A ${r} ${r} 0 0 ${cross > 0 ? 1 : 0} ${end[0]} ${end[1]}`} fill="rgba(255,255,255,.18)" stroke="#fff" strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
          <g transform={`translate(${S[0] + dir * (r + 46)}, ${S[1] - 26})`}>
            <rect x={-30} y={-15} width={60} height={22} rx={6} fill="rgba(70,82,88,.62)" />
            <text x={0} y={0} textAnchor="middle" fill="#eef3f4" fontSize={12} fontFamily="JetBrains Mono">
              {Math.round(m.earShoulderAngle)}°
            </text>
          </g>
        </>
      )}
      {showDepth && (
        <>
          <MLine a={L.chest[0]} b={L.chest[1]} aspect={a} label="CHEST" />
          <MLine a={L.waist[0]} b={L.waist[1]} aspect={a} label="NAVEL" />
          <line x1={cf[0]} y1={wf[1]} x2={wf[0]} y2={wf[1]} stroke="#f3d7cf" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          <line x1={cf[0]} y1={cf[1]} x2={cf[0]} y2={wf[1] + 20} stroke="#fff" strokeOpacity={0.6} strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
        </>
      )}
      {showPlumb && [E, S, H].map((q, i) => (
        <g key={i}>
          <circle cx={q[0]} cy={q[1]} r={14} fill="rgba(255,255,255,.28)" />
          <circle cx={q[0]} cy={q[1]} r={6} fill="#fff" stroke="#55646a" vectorEffect="non-scaling-stroke" />
        </g>
      ))}
    </g>
  );
}

export function sideCrop(side: SideResult, shape = 0.72, pad = 0.12, extraBottom = 0): [number, number, number, number] | undefined {
  const L = side.lines;
  if (!L) return undefined;
  const below: Pt = [L.hip[0], Math.min(1, L.hip[1] + extraBottom)];
  return cropAround([L.ear, L.shoulder, L.hip, below, L.waist[0], L.waist[1], L.chest[0], L.chest[1]], side.imageAspect, pad, shape);
}

export function WaistCore(p: SectionProps) {
  const body = p.scan.body!;
  const m = body.metrics;
  const side = p.scan.bodySide ?? null;
  const s = side?.metrics ?? null;
  const a = body.imageAspect;
  const f = frame(body);
  const score = s ? s.coreScore : null;
  const wToS = m.waistWidth / m.shoulderWidth;
  return (
    <div className="page">
      <PageHeader
        kicker="Waist & core"
        muted="Your"
        strong="waist & core"
        lead={
          <>
            Central fat changes the silhouette more than anything else, and it is a <b>health marker</b>: abdominal depth tracks visceral fat closely.
          </>
        }
      />
      <div className="bdd-two">
        <div className="bdd-photo">
          <Pic photo={p.bodyPhoto} aspect={a} crop={f ? cropAround([f.lm[11], f.lm[12], f.lm[23], f.lm[24]], a, 0.12, 0.72) : undefined}>
            {body.lines && <MLine a={body.lines.waist[0]} b={body.lines.waist[1]} aspect={a} label="WAIST" />}
          </Pic>
          <span className="photo-tag bdd-tag">Front</span>
        </div>
        <div className="bdd-photo">
          {side ? (
            <>
              <Pic photo={p.sidePhoto} aspect={side.imageAspect} crop={sideCrop(side)}>
                <SideLines side={side} showDepth />
              </Pic>
              <span className="photo-tag bdd-tag">Side</span>
            </>
          ) : (
            <Empty title="No side photo">Add a side photo to measure belly depth.</Empty>
          )}
        </div>
      </div>
      <div className="bdd-row3">
        <div className="bdd-scorewrap">
          <ScoreCard tone="dark" label="Core score" value={score ?? "—"} suffix={score != null ? "/100" : ""} />
          {score != null && <div className="bdd-band mono-sm">{band(score)}</div>}
        </div>
        <Card label="Navel depth : chest depth" value={s ? s.waistToChestDepth.toFixed(2) : "—"} note={s ? "Lean men usually sit below ~0.85; above 1.0 the belly is deeper than the chest." : "Needs side photo"}>
          {s && <SpectrumBar value={clamp01((s.waistToChestDepth - 0.75) / 0.4)} labels={["0.75 lean", "0.95", "1.15 central"]} />}
        </Card>
        <Card label="Belly ahead of chest" value={s ? pct(Math.max(0, s.bellyProtrusion)) : "—"} note={s ? "% of torso length the belly sits in front of the chest line." : "Needs side photo"}>
          {s && <SpectrumBar value={clamp01((s.bellyProtrusion + 4) / 16)} labels={["Behind", "Level", "Ahead"]} />}
        </Card>
      </div>
      <div className="bdd-row3">
        <Card label="Waist : shoulders (front)" value={`${Math.round(wToS * 100)}%`} note="Frontal width at the WHO waist site relative to shoulder width.">
          <SpectrumBar value={clamp01((wToS - 0.5) / 0.35)} labels={["Tapered", "Straight", "Wide"]} />
        </Card>
        <Card label="Waist : height" value={m.whtr ? m.whtr.toFixed(2) : "—"} tone={m.whtr && m.whtr >= 0.5 ? "warn" : undefined} note={m.whtr ? (m.whtr >= 0.5 ? "≥ 0.5 — raised cardiometabolic risk (Ashwell 2012)" : "< 0.5 — healthy range (Ashwell 2012)") : <Link to="/analysis/about-you">Add your height to estimate it →</Link>}>
          {m.whtr ? <SpectrumBar value={clamp01((m.whtr - 0.35) / 0.3)} labels={["0.35", "0.50", "0.65"]} /> : null}
        </Card>
      </div>
      <div className="bdd-expl">
        <div className="mono-sm">Explanation</div>
        <p>
          {s ? (
            <>
              From the side, your navel-level depth is <b>{Math.round(s.waistToChestDepth * 100)}%</b> of your chest depth and the belly sits {Math.max(0, s.bellyProtrusion).toFixed(0)}% of torso length in front of the chest.{" "}
              {s.waistToChestDepth > 0.9 ? "That points to central fat as the biggest lever for your silhouette. " : "Central fat is in a good range. "}
            </>
          ) : (
            <>Your frontal waist is {Math.round(wToS * 100)}% of your shoulder width. </>
          )}
          Ab exercises alone don't shrink the belly — six weeks of abdominal training didn't reduce abdominal fat (Vispute 2011). It comes off with overall fat loss (a 300–500 kcal daily deficit, high protein) while
          training keeps muscle.
        </p>
      </div>
      <MethodNote method="core" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hips & legs                                                        */
/* ------------------------------------------------------------------ */

export function HipsLegs(p: SectionProps) {
  const body = p.scan.body!;
  const m = body.metrics;
  const f = frame(body);
  const a = body.imageAspect;
  const female = p.profile.intake.gender === "female";
  const thighY = f ? f.hp[1] + f.torso * 0.3 : 0;
  const thighs: [Pt, Pt][] = [];
  if (f && m.thighWidth != null && thighY < 0.99) {
    for (const h of [23, 24]) {
      const half = (m.thighWidth * f.torso) / a / 2;
      const cx = f.lm[h][0];
      thighs.push([
        [cx - half, thighY],
        [cx + half, thighY],
      ]);
    }
  }
  const hipToShoulder = m.hipWidth / m.shoulderWidth;
  const whr = m.whrTape ?? m.waistToHip;
  return (
    <FeatureView
      title="Your hips &"
      highlight="legs"
      lead={
        <>
          Hip width sets the lower half of the silhouette; leg proportions only show in a <b>head-to-toe</b> photo.
        </>
      }
      photo={
        <Pic photo={p.bodyPhoto} aspect={a} crop={f ? cropAround([f.lm[23], f.lm[24], f.lm[11], f.lm[12], [f.hp[0], Math.min(0.99, f.hp[1] + f.torso * 0.5)]], a, 0.1, 0.8) : undefined}>
          {body.lines && <MLine a={body.lines.hip[0]} b={body.lines.hip[1]} aspect={a} label="HIP" />}
          {body.lines && <MLine a={body.lines.shoulder[0]} b={body.lines.shoulder[1]} aspect={a} dim />}
          {thighs.map((t, i) => (
            <MLine key={i} a={t[0]} b={t[1]} aspect={a} />
          ))}
        </Pic>
      }
      diagram={<WidthBars rows={[["Shoulders", m.shoulderWidth], ["Waist", m.waistWidth], ["Hips", m.hipWidth]]} />}
      typeLabel={hipToShoulder < 0.8 ? "Shoulder-dominant frame" : hipToShoulder < 0.95 ? "Balanced frame" : "Hip-dominant frame"}
      attrs={[
        { label: "Hips : shoulders", value: `${Math.round(hipToShoulder * 100)}%` },
        { label: "Thigh width", value: m.thighWidth != null ? `${Math.round(m.thighWidth * 100)}% torso` : "Not measurable" },
        { label: m.whrTape ? "Waist : hip (tape)" : "Waist : hip (frontal)", value: whr.toFixed(2) },
        { label: "Leg : height", value: m.legToHeight != null ? m.legToHeight.toFixed(2) : "Legs out of frame" },
      ]}
      explanation={
        <>
          Your hips measure <b>{Math.round(hipToShoulder * 100)}%</b> of shoulder width{female ? "; a waist-to-hip ratio around 0.7 is most often preferred (Singh 1993)" : " — shoulders wider than hips is the typical male V-shape"}.{" "}
          {m.thighWidth == null ? "Thighs couldn't be measured separately (legs touching or out of frame). " : ""}
          {!m.feetVisible ? "Your feet are out of frame, so leg-to-height and torso-to-leg ratios were skipped — retake head to toe from 2–3 m. " : ""}
          {m.whrTape ? "" : "Frontal width ratios are not circumferences; add tape waist and hip measurements for WHO-comparable values."}
        </>
      }
      method="body"
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Side posture                                                       */
/* ------------------------------------------------------------------ */

export function SidePosture(p: SectionProps) {
  const side = p.scan.bodySide;
  if (!side)
    return (
      <div className="page">
        <NeedSide />
      </div>
    );
  const s = side.metrics;
  const fixes = p.plan.items.filter((i) => i.id === "forward-head" || i.id === "rounded-shoulders");
  const head = s.headForward <= 5 ? "Stacked over shoulder" : s.headForward <= 10 ? "Slightly forward" : s.headForward <= 18 ? "Forward" : "Markedly forward";
  return (
    <div className="page">
      <PageHeader
        kicker="Side posture"
        muted="Your"
        strong="side alignment"
        lead={
          <>
            Ideal standing posture stacks <b>ear, shoulder and hip</b> on one vertical line. Forward head posture is linked to neck pain and makes the same body read shorter and less confident.
          </>
        }
      />
      <div className="bd-grid">
        <div className="bd-left">
          <div className="bd-photo">
            <Pic photo={p.sidePhoto} aspect={side.imageAspect} crop={sideCrop(side, 0.62, 0.12, 0.2)}>
              <SideLines side={side} showPlumb showArc />
            </Pic>
          </div>
          <ScoreCard className="bd-score" label="Side posture score" value={s.postureScore} />
        </div>
        <div className="bd-right">
          <div className="bdd-grid2">
            <Card label="Ear–shoulder angle" value={`${Math.round(s.earShoulderAngle)}°`} note="CVA proxy: uses the shoulder joint, not C7, so it reads higher than clinical CVA. Target ≈ 80–90° (ear over shoulder)." />
            <Card label="Head forward" value={pct(Math.max(0, s.headForward))} note={`${head} · % of torso length`} tone={s.headForward > 10 ? "warn" : undefined} />
            <Card label="Shoulders ahead of hips" value={pct(Math.abs(s.shoulderForward) < 0.5 ? 0 : s.shoulderForward)} note={Math.abs(s.shoulderForward) < 5 ? "Stacked" : s.shoulderForward > 0 ? "Rounded / slumped forward" : "Leaning back"} />
            <Card label="Trunk lean" value={`${s.trunkLean.toFixed(1)}°`} note={Math.abs(s.trunkLean) < 3 ? "Upright" : s.trunkLean > 0 ? "Leaning forward" : "Leaning back"} />
          </div>
          <Card label="Head position" value={head}>
            <SpectrumBar value={clamp01(1 - s.headForward / 30)} labels={["Forward", "Slightly forward", "Stacked"]} />
          </Card>
          <Card label="Back curves (descriptive)" value={`${s.lumbarCurve.toFixed(0)}% · ${s.upperBackCurve.toFixed(0)}%`} note="Lower-back hollow and upper-back rounding as % of torso length, from the silhouette. Shown for tracking only — there is no validated photo norm, and glutes and clothing affect it." />
          {fixes.length > 0 && (
            <div className="bdd-fixes">
              <div className="mono-sm">Linked correctives</div>
              {fixes.map((x) => (
                <Link key={x.id} to="/analysis/recommendations" className="bdd-fix">
                  <span>{x.title}</span>
                  <GradeBadge grade={x.grade} />
                </Link>
              ))}
            </div>
          )}
          <div className="bd-expl">
            <div className="mono-sm">Explanation</div>
            <p>
              Your ear sits <b>{Math.max(0, s.headForward).toFixed(0)}%</b> of torso length in front of your shoulder (angle {Math.round(s.earShoulderAngle)}°).{" "}
              {s.headForward > 8 ? "A meta-analysis found targeted exercise (chin tucks, thoracic extension, deep-neck and upper-back strengthening) improves forward head posture (Sheikhhoseini 2018). " : "Your head is close to stacked — keep upper-back work in your training. "}
              Looking down or a relaxed slouch in the photo exaggerates this, so retake with eyes level before drawing conclusions.
            </p>
          </div>
        </div>
      </div>
      <MethodNote method="sidePosture" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Body symmetry                                                      */
/* ------------------------------------------------------------------ */

export function BodySymmetry(p: SectionProps) {
  const body = p.scan.body!;
  const m = body.metrics;
  const f = frame(body);
  const a = body.imageAspect;
  const rows: [string, number][] = [
    ["Shoulders", m.lrDetail.shoulder],
    ["Waist", m.lrDetail.waist],
    ["Hips", m.lrDetail.hip],
  ];
  const symScore = Math.max(0, Math.min(100, 100 - m.lrBalance * 6));
  return (
    <div className="page">
      <PageHeader kicker="Body symmetry" muted="Your" strong="left–right balance" lead={<>Each half of your silhouette is measured from the body midline. <b>Differences under ~3%</b> are within normal variation and photo error.</>} />
      <div className="bd-grid">
        <div className="bd-left">
          <div className="bd-photo">
            <Pic photo={p.bodyPhoto} aspect={a} crop={f ? cropAround([f.lm[0], f.lm[11], f.lm[12], f.lm[23], f.lm[24], ...(body.lines ? [body.lines.hip[0], body.lines.hip[1]] : [])], a, 0.18, 0.62) : undefined}>
              {f && body.lines && (
                <>
                  <line x1={toPhoto([f.sh[0], 0], a)[0]} y1={0} x2={toPhoto([f.hp[0], 1], a)[0]} y2={1000 / a} stroke="#fff" strokeOpacity={0.8} strokeDasharray="3 5" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
                  {(["shoulder", "waist", "hip"] as const).map((k) => {
                    const [l, r] = body.lines![k];
                    const mx = f.xAt(l[1]);
                    const L = toPhoto(l, a), R = toPhoto(r, a), M = toPhoto([mx, l[1]], a);
                    return (
                      <g key={k}>
                        <line x1={L[0]} y1={L[1]} x2={M[0]} y2={M[1]} stroke="#cfe0e5" strokeWidth={3} vectorEffect="non-scaling-stroke" />
                        <line x1={M[0]} y1={M[1]} x2={R[0]} y2={R[1]} stroke="#f3d7cf" strokeWidth={3} vectorEffect="non-scaling-stroke" />
                        <circle cx={M[0]} cy={M[1]} r={5} fill="#fff" />
                      </g>
                    );
                  })}
                </>
              )}
            </Pic>
          </div>
          <ScoreCard className="bd-score" label="Balance score" value={symScore} />
        </div>
        <div className="bd-right">
          <div className="bdd-card">
            <div className="bdd-card-head">
              <span className="mono-sm">Half-width difference</span>
              <span className="bdd-card-val">{m.lrBalance.toFixed(1)}% avg</span>
            </div>
            <div className="bdd-div">
              {rows.map(([name, v]) => (
                <div key={name} className="bdd-div-row">
                  <span className="mono-sm">{name}</span>
                  <div className="bdd-div-track">
                    <i className="bdd-div-mid" />
                    <b className={v >= 0 ? "r" : "l"} style={{ width: `${Math.min(50, Math.abs(v) * 5)}%` }} />
                  </div>
                  <span className="bdd-div-val">
                    {Math.abs(v) < 0.5 ? "even" : `${Math.abs(v).toFixed(1)}% ${v > 0 ? "R" : "L"}`}
                  </span>
                </div>
              ))}
              <div className="bdd-div-legend mono-sm">
                <span>← Left wider</span>
                <span>Right wider →</span>
              </div>
            </div>
          </div>
          <Card label="Arm length symmetry" value={`${Math.round(m.armSymmetry)}/100`} note="Shoulder → elbow → wrist length, left vs right." />
          <Card label="Shoulder line" value={`${m.shoulderTilt.toFixed(1)}°`} note="Uneven shoulders can make one side look wider in a photo." />
          <div className="bd-expl">
            <div className="mono-sm">Explanation</div>
            <p>
              On average your left and right halves differ by <b>{m.lrBalance.toFixed(1)}%</b>
              {m.lrBalance < 3 ? " — well within normal variation." : ". Some asymmetry is normal; consistent unilateral training (single-arm presses, rows, split squats) keeps both sides developing evenly."}{" "}
              Stance and arm position change these numbers, so compare check-ins taken the same way.
            </p>
          </div>
        </div>
      </div>
      <MethodNote method="bodySymmetry" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Body summary                                                       */
/* ------------------------------------------------------------------ */

export function BodySummary(p: SectionProps) {
  const body = p.scan.body!;
  const m = body.metrics;
  const side = p.scan.bodySide ?? null;
  const s = side?.metrics ?? null;
  const f = frame(body);
  const a = body.imageAspect;
  const female = p.profile.intake.gender === "female";
  const { strength, leanness } = physique(p);
  type Tile = { to: string; label: string; value: string; crop?: [number, number, number, number]; side?: boolean };
  const tiles: Tile[] = [
    { to: "physique-impression", label: "Physique impression", value: strength > 0.6 ? "Strong" : leanness < 0.4 ? "Soft" : "Balanced", crop: f ? cropAround([f.lm[0], f.lm[23], f.lm[24]], a, 0.12, 0.8) : undefined },
    { to: "body-proportions", label: "Shoulders & V-taper", value: m.shoulderToWaist.toFixed(2), crop: f ? cropAround([f.lm[11], f.lm[12]], a, 0.1, 1) : undefined },
    { to: "chest-arms", label: "Chest & arms", value: `${Math.round(m.armToShoulder * 100)}% arm`, crop: f ? cropAround([f.lm[11], f.lm[13], f.lm[12], f.lm[14]], a, 0.06, 1) : undefined },
    { to: "waist-core", label: "Waist & core", value: s ? `${s.waistToChestDepth.toFixed(2)} depth` : `${Math.round((m.waistWidth / m.shoulderWidth) * 100)}% waist`, crop: f ? cropAround([avgPt(f.sh, f.hp), [f.xAt(f.hp[1]), f.hp[1]]], a, 0.14, 1) : undefined },
    { to: "hips-legs", label: "Hips & legs", value: `${Math.round((m.hipWidth / m.shoulderWidth) * 100)}% hips`, crop: f ? cropAround([f.lm[23], f.lm[24]], a, 0.12, 1) : undefined },
    { to: "posture", label: "Front posture", value: `${Math.round(m.postureScore)}/100`, crop: f ? cropAround([f.lm[11], f.lm[12], f.lm[23], f.lm[24]], a, 0.1, 0.8) : undefined },
    { to: "side-posture", label: "Side posture", value: s ? `${Math.round(s.postureScore)}/100` : "Add side photo", crop: side ? sideCrop(side) : undefined, side: true },
    { to: "body-symmetry", label: "Symmetry", value: `${m.lrBalance.toFixed(1)}% diff`, crop: f ? cropAround([f.lm[11], f.lm[12], f.lm[23], f.lm[24]], a, 0.08, 0.8) : undefined },
  ];
  const rows: { name: string; you: string; norm: string; ok: boolean | null; proxy?: boolean }[] = [
    { name: "Shoulder : waist (frontal)", you: m.shoulderToWaist.toFixed(2), norm: female ? "≈ 1.35" : "≈ 1.5–1.6", ok: female ? Math.abs(m.shoulderToWaist - 1.35) < 0.12 : m.shoulderToWaist >= 1.5, proxy: true },
    { name: m.whrTape ? "Waist : hip (tape)" : "Waist : hip (frontal)", you: (m.whrTape ?? m.waistToHip).toFixed(2), norm: female ? "≈ 0.70 (< 0.85 WHO)" : "< 0.90 WHO", ok: m.whrTape ? m.whrTape < (female ? 0.85 : 0.9) : null, proxy: !m.whrTape },
    { name: "Upper arm : shoulders", you: `${Math.round(m.armToShoulder * 100)}%`, norm: "≥ 22% (trained)", ok: m.armToShoulder >= 0.22, proxy: true },
    { name: "Navel : chest depth (side)", you: s ? s.waistToChestDepth.toFixed(2) : "—", norm: "< 0.85 lean", ok: s ? s.waistToChestDepth < 0.88 : null, proxy: true },
    { name: "Head forward (side)", you: s ? pct(Math.max(0, s.headForward)) : "—", norm: "≤ 5% (stacked)", ok: s ? s.headForward <= 8 : null, proxy: true },
    { name: "Shoulder / pelvis tilt", you: `${m.shoulderTilt.toFixed(1)}° / ${m.hipTilt.toFixed(1)}°`, norm: "< 2°", ok: Math.abs(m.shoulderTilt) < 2 && Math.abs(m.hipTilt) < 2 },
    { name: "Left–right balance", you: `${m.lrBalance.toFixed(1)}%`, norm: "< 3%", ok: m.lrBalance < 3, proxy: true },
    { name: "Waist : height (tape)", you: m.whtr ? m.whtr.toFixed(2) : "—", norm: "< 0.50", ok: m.whtr ? m.whtr < 0.5 : null },
    { name: "Body fat", you: m.bodyFatEstimate ? `${m.bodyFatEstimate.toFixed(0)}%` : "—", norm: female ? "18–26%" : "10–18%", ok: m.bodyFatEstimate ? (female ? m.bodyFatEstimate <= 26 : m.bodyFatEstimate <= 18) : null },
  ];
  const items = p.plan.items.filter((i) => ["lifting", "fatloss", "protein", "forward-head", "rounded-shoulders", "posture"].includes(i.id));
  return (
    <div className="page">
      <PageHeader kicker="Body summary" muted="Summary of" strong="your body analysis" lead="Every body measurement in one place, compared with its reference — and the plan items they trigger." />
      <div className="bdd-tiles">
        {tiles.map((t) => (
          <Link key={t.to} to={`/analysis/${t.to}`} className="bdd-tile">
            <div className="bdd-tile-img">
              {t.side && !side ? <div className="bdd-tile-na mono-sm">No side photo</div> : <Pic photo={t.side ? p.sidePhoto : p.bodyPhoto} aspect={t.side && side ? side.imageAspect : a} crop={t.crop} />}
            </div>
            <div className="bdd-tile-txt">
              <span className="mono-sm">{t.label}</span>
              <span className="bdd-tile-val">{t.value}</span>
            </div>
          </Link>
        ))}
      </div>
      <section className="bdd-table">
        <h2 className="title-md">Measurements vs. reference</h2>
        <table>
          <thead>
            <tr>
              <th>Measurement</th>
              <th>You</th>
              <th>Reference</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td>
                  {r.name} {r.proxy && <span className="bdd-proxy">photo-derived proxy</span>}
                </td>
                <td className="num">{r.you}</td>
                <td className="muted">{r.norm}</td>
                <td>
                  <span className={`bdd-status ${r.ok == null ? "na" : r.ok ? "ok" : "work"}`}>{r.ok == null ? "Needs data" : r.ok ? "In range" : "To improve"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="bdd-plan">
        <h2 className="title-md">What the plan does for your body</h2>
        <div className="bdd-plan-grid">
          {items.map((i) => (
            <Link key={i.id} to="/analysis/recommendations" className="bdd-plan-card">
              <div className="bdd-plan-top">
                <span className="mono-sm">{i.category}</span>
                <GradeBadge grade={i.grade} />
              </div>
              <div className="bdd-plan-title">{i.title}</div>
              <p>{i.why}</p>
              <span className="mono-sm bdd-plan-time">{i.timeToVisible}</span>
            </Link>
          ))}
        </div>
        <AfterPlaceholder visuals={p.visuals} />
      </section>
    </div>
  );
}

function AfterPlaceholder({ visuals }: { visuals: SectionProps["visuals"] }) {
  const b = visuals.body;
  if (b?.afterFront || b?.afterSide)
    return (
      <div className="bdd-after">
        {[b.front, b.afterFront, b.side, b.afterSide].filter(Boolean).map((src, i) => (
          <img key={i} src={src} alt="" />
        ))}
      </div>
    );
  return (
    <div className="bdd-after-empty">
      <div>
        <div className="title-md">Your 12-month body</div>
        <p className="lead">Generate the standardized physique model and the end-of-plan body (fat loss, natural muscle, posture only) from the prompts in Visualization.</p>
      </div>
      <Link to="/visualization" className="btn">
        Open Visualization
      </Link>
    </div>
  );
}
