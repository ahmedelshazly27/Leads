import type { ReactNode } from "react";
import { Logo } from "../../components/Logo";
import { GradeBadge } from "../../components/ui";
import { BASIS_LABEL, REGIONS, categoriesFor, matchFor } from "../../lib/library";
import { MODIFIABLE, SCORE_LABEL, SCORE_NOTE, band, impressionWords, restedScore, traits, type ScoreKey } from "../../lib/report";
import { GRADE_LABEL, LIMITATIONS, METHODS, type EvidenceGrade } from "../../lib/science";
import { FACE_VIEWS, type FaceView, type Intake } from "../../lib/types";
import { taperLabel } from "../analysis/BodyProportions";
import {
  AVG_NORMS,
  PLACE_LABEL,
  RATIOS,
  REGION_LABEL,
  REGION_ORDER,
  SHAPE_TEXT,
  SKIN_LABEL,
  SKIN_ORDER,
  STATE_LABEL,
  STATE_NOTE,
  VIEW_NEED_LABEL,
  adiposityLabel,
  bmiBand,
  bodySymmetryScore,
  browType,
  cheekType,
  chinType,
  contrastLabel,
  dimorphismCues,
  dimorphismLabel,
  eyeType,
  featureRows,
  fmtMarker,
  harmonyScore,
  headLabel,
  jawType,
  lipType,
  markerEntries,
  neotenyLabel,
  normText,
  noseType,
  physique,
  regionOf,
  skinLevel,
  symmetryLabel,
  tiltText,
  typicalLabel,
  type MarkerEntry,
  type MarkerState,
} from "./data";
import {
  BodyFrontFig,
  BodySideFig,
  BodySymmetryFig,
  ContrastFig,
  FaceMesh,
  FeatureFig,
  Fig,
  NoPhoto,
  Photo,
  ProfileFig,
  ShapeFig,
  SkinRegionsFig,
  SymmetryFig,
  ThirdsFifths,
  type FeatureKey,
} from "./figures";
import {
  Attrs,
  Bar,
  NOT_MEASURED,
  Pill,
  Score,
  block,
  callout,
  cap,
  fmtDate,
  h2,
  kvTable,
  note,
  notMeasured,
  para,
  pct,
  sdeg,
  table,
  title,
  type ReportCtx,
  type Tone,
} from "./kit";
import type { Block, Chapter } from "./paginate";

export const reportId = (c: ReportCtx) => `#${c.scan.id.slice(0, 5).toUpperCase()}`;

/* ------------------------------------------------------------------ */
/*  Cover                                                              */
/* ------------------------------------------------------------------ */

const VIEW_NAME: Record<FaceView | "face" | "body" | "side", string> = {
  face: "Front portrait",
  faceLeft: "Left profile",
  faceRight: "Right profile",
  face45: "Three-quarter (45°)",
  smile: "Natural smile",
  frown: "Frown",
  browRaise: "Raised brows",
  body: "Full body, front",
  side: "Full body, side",
};

function captured(c: ReportCtx) {
  const list: string[] = [];
  if (c.scan.face) list.push(VIEW_NAME.face);
  for (const v of c.scan.views ?? []) list.push(VIEW_NAME[v]);
  if (c.scan.body) list.push(VIEW_NAME.body);
  if (c.scan.bodySide) list.push(VIEW_NAME.side);
  return list;
}

export function coverChapter(c: ReportCtx): Chapter {
  const i = c.profile.intake;
  const r = c.scan.review;
  const approved = r?.status === "approved";
  const rows: [string, ReactNode][] = [
    ["Client", i.name],
    ["Profile", `${i.age} · ${cap(i.gender)}${i.ethnicity ? ` · ${i.ethnicity}` : ""}`],
    ["Report ID", reportId(c)],
    ["Scan date", fmtDate(c.scan.createdAt)],
    ["Report generated", fmtDate(c.generated)],
    ["Photos analysed", `${captured(c).length} — ${captured(c).join(", ") || "none"}`],
    [
      "Human review",
      approved ? `Reviewed and approved ${fmtDate(r?.approvedAt ?? r?.updatedAt)}${r?.reviewer ? ` by ${r.reviewer}` : ""}` : r?.status === "in-review" ? "In review — items may still change" : "Awaiting review — items may still change",
    ],
  ];
  return {
    id: "cover",
    title: "Cover",
    bare: true,
    inToc: false,
    blocks: [
      block(
        "cover",
        <div className="rp-cover">
          <div className="rp-cover-top">
            <Logo size={34} />
            <span className="rp-mono">Face &amp; body analysis</span>
          </div>
          <div className="rp-cover-main">
            <div className="rp-cover-text">
              <div className="rp-mono rp-cover-k">Client report · Confidential</div>
              <h1 className="rp-cover-title">
                Analysis <span>report</span>
              </h1>
              <div className="rp-cover-name">{i.name}</div>
              <p className="rp-cover-lead">
                A complete record of your face and body analysis: every photo, measurement, marker and score, the norms each one is compared with, and your 12-month plan.
              </p>
            </div>
            <div className="rp-cover-photo">
              <Photo src={c.photos.face ?? c.visuals.baseline} />
              <span className="pv-tag">Front portrait</span>
            </div>
          </div>
          <dl className="rp-cover-meta">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <div className={`rp-cover-review ${approved ? "ok" : "wait"}`}>
            <span className="rp-dot" />
            <div>
              <b>{approved ? (r?.reviewer ? `Reviewed by ${r.reviewer}` : "Reviewed by a person") : "Not yet reviewed"}</b>
              <p>
                {approved
                  ? `A reviewer checked the landmarks, measurements, plan and visuals in this report${r?.reviewer ? ` (${r.reviewer})` : ""} on ${fmtDate(r?.approvedAt ?? r?.updatedAt)}.`
                  : "A reviewer checks every landmark, the plan and your visuals before final release. Items in this report may still change."}
              </p>
            </div>
          </div>
          <p className="rp-cover-foot">For education and self-tracking only — not a medical diagnosis. Read the disclaimer on page 2 before acting on this report.</p>
        </div>,
      ),
    ],
  };
}

/* ------------------------------------------------------------------ */
/*  Summary                                                            */
/* ------------------------------------------------------------------ */

const SCORE_WHAT: Record<ScoreKey, string> = {
  skin: "Evenness, redness and texture across six skin regions",
  leanness: "Body-fat estimate, or facial fullness when no body data",
  rested: "Under-eye discolouration and evenness",
  symmetry: "Mirrored left–right landmark pairs after pose correction",
  harmony: "Closeness of key face ratios to published averages",
  body: "Frame proportions and body composition",
  posture: "Front and side alignment",
  core: "Navel depth compared with chest depth (side photo)",
};

export function overviewText(c: ReportCtx) {
  const plan = c.plan;
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

const ageBand = (a: number) => {
  const d = Math.floor(a / 10) * 10;
  const r = a % 10;
  return `${a} (${r < 4 ? "early" : r < 7 ? "mid" : "late"} ${d}s)`;
};
const FITZ = ["#f3dccb", "#e8c4a6", "#d2a383", "#b07d58", "#7d5435", "#4a3022"];

export function profileRows(i: Intake): [string, ReactNode][] {
  const cm = (v: number | null) => (v ? `${v} cm` : "Not provided");
  return [
    ["Name", i.name],
    ["Age", ageBand(i.age)],
    ["Gender", cap(i.gender)],
    ["Ethnicity", i.ethnicity || "Not provided"],
    ["Location", i.location || "Not provided"],
    ["Profession", i.profession || "Not provided"],
    ["Height", cm(i.heightCm)],
    ["Weight", i.weightKg ? `${i.weightKg} kg` : "Not provided"],
    ["Tape waist / hip / neck", `${cm(i.waistCm)} / ${cm(i.hipCm)} / ${cm(i.neckCm)}`],
    [
      "Skin tone",
      <span key="st" className="pv-skin">
        <i style={{ background: FITZ[i.skinTone - 1] }} /> Fitzpatrick type {["I", "II", "III", "IV", "V", "VI"][i.skinTone - 1]}
      </span>,
    ],
    ["Hair", `${cap(i.hairType)}, ${i.hairLengthCm} cm on top · hair loss: ${i.hairLoss}`],
    ["Facial hair (when grown)", cap(i.facialHair)],
    ["Active acne", i.activeAcne ? "Yes" : "No"],
    ["Sleep", `${i.sleepHours} h per night`],
    ["Training", `${i.trainingDays} day${i.trainingDays === 1 ? "" : "s"} per week`],
    ["Smoking", { no: "No", occasionally: "Occasionally", daily: "Daily" }[i.smoking]],
    ["Alcohol", { never: "Never", occasional: "Occasional social drinker", weekly: "Weekly", daily: "Daily" }[i.drinking]],
    ["Treatment preference", { "non-invasive": "Non-invasive treatments only", "open-to-clinical": "Open to clinical treatments", "open-to-surgical": "Open to surgical options" }[i.preferences]],
    ["Budget", cap(i.budget)],
    ["Goals", i.goals.length ? i.goals.join(", ") : "None given"],
    ["Limitations", i.limitations || "None reported"],
    ["Allergies", i.allergies || "None reported"],
    ["Front photo taken as", i.frontCapture === "selfie" ? "Arm's-length selfie" : i.frontCapture === "distance" ? "From a distance (timer / helper)" : "Not stated"],
  ];
}

export function summaryChapter(c: ReportCtx): Chapter {
  const plan = c.plan;
  const keys = Object.keys(plan.current) as ScoreKey[];
  const r = c.scan.review;
  const strengths = [...keys].sort((a, b) => (plan.current[b] ?? 0) - (plan.current[a] ?? 0)).slice(0, 3);
  const gains = keys
    .map((k) => ({ k, d: (plan.projected[k] ?? 0) - (plan.current[k] ?? 0) }))
    .filter((x) => x.d > 0.5)
    .sort((a, b) => b.d - a.d)
    .slice(0, 3);
  const drivers = (k: ScoreKey) =>
    plan.items
      .filter((it) => (it.impact[k] ?? 0) > 0)
      .sort((a, b) => (b.impact[k] ?? 0) - (a.impact[k] ?? 0))
      .slice(0, 3);
  const delta = Math.round(plan.overallProjected - plan.overallNow);
  const blocks: Block[] = [
    title("Summary", "of your analysis", overviewText(c)),
    block(
      "hero",
      <div className="rp-tiles">
        <Score label="Overall score now" value={Math.round(plan.overallNow)} sub={band(plan.overallNow)} />
        <Score label="Projected at 12 months" value={Math.round(plan.overallProjected)} sub={band(plan.overallProjected)} dark />
        <Score label="Realistic change" value={`${delta >= 0 ? "+" : ""}${delta}`} suffix=" pts" sub="With good adherence" />
      </div>,
    ),
    h2("scores", "Section scores"),
    table(
      "scores-t",
      [
        ["Score", "28%"],
        ["What it reflects", "34%"],
        ["Now", "9%"],
        ["Band", "11%"],
        ["12 months", "9%"],
        ["Habits?", "9%"],
      ],
      keys.map((k) => [
        <b>{SCORE_LABEL[k]}</b>,
        <span className="rp-muted">{SCORE_WHAT[k]}</span>,
        <b className="rp-num">{Math.round(plan.current[k] ?? 0)}</b>,
        band(plan.current[k] ?? 0),
        <span className="rp-num">{Math.round(plan.projected[k] ?? 0)}</span>,
        MODIFIABLE[k] ? "Yes" : "No (bone)",
      ]),
    ),
    note("score-note", `${SCORE_NOTE} Bands: Excellent ≥ 85 · Good ≥ 72 · Fair ≥ 58 · Developing ≥ 45 · Needs work < 45. Scores not listed were not measured (missing photo or data).`),
    h2("strengths", "Top strengths"),
    block(
      "strengths-b",
      <ol className="rp-rank">
        {strengths.map((k) => (
          <li key={k}>
            <b>{SCORE_LABEL[k]}</b>
            <span className="rp-num">{Math.round(plan.current[k] ?? 0)}/100 · {band(plan.current[k] ?? 0)}</span>
            <p>{SCORE_WHAT[k]}.</p>
          </li>
        ))}
      </ol>,
    ),
    h2("opps", "Biggest opportunities"),
    gains.length
      ? block(
          "opps-b",
          <ol className="rp-rank">
            {gains.map(({ k, d }) => (
              <li key={k}>
                <b>{SCORE_LABEL[k]}</b>
                <span className="rp-num">
                  {Math.round(plan.current[k] ?? 0)} → {Math.round(plan.projected[k] ?? 0)} (+{Math.round(d)})
                </span>
                <p>Driven by: {drivers(k).map((it) => it.title).join(" · ") || "general plan adherence"}.</p>
              </li>
            ))}
          </ol>,
        )
      : para("opps-none", "No score is projected to change by more than half a point."),
    h2("focus", "Plan focus"),
    block(
      "focus-b",
      <div className="rp-focus">
        <h3>
          {plan.goal.headline[0]} <span>{plan.goal.headline[1]}</span>
        </h3>
        <p>{plan.goal.summary}</p>
        <Attrs
          items={[
            ["Measured drivers", plan.drivers.join(", ") || "None flagged"],
            ["Expected improvements", plan.improvements.join("; ") || "—"],
            ["Body-fat target", plan.targetBodyFat != null ? `~${plan.targetBodyFat}%${plan.monthsToTarget ? ` in ~${plan.monthsToTarget} months` : ""}` : "No fat-loss target"],
            ["Plan items", `${plan.items.length} (${plan.items.filter((i) => i.priority === 1).length} top priority)`],
          ]}
        />
      </div>,
    ),
    h2("reviewer", "Reviewer’s note"),
    r?.status === "approved"
      ? callout(
          "review-b",
          `Approved ${fmtDate(r.approvedAt ?? r.updatedAt)}${r.reviewer ? ` · ${r.reviewer}` : ""}`,
          <>
            <p>{r.note || "Approved without a written note."}</p>
            {Object.entries(r.itemNotes).length > 0 && (
              <ul className="pv-list">
                {Object.entries(r.itemNotes).map(([id, n]) => (
                  <li key={id}>
                    <b>{plan.items.find((x) => x.id === id)?.title ?? id}:</b> {n}
                  </li>
                ))}
              </ul>
            )}
            {r.realism && <p className="rp-muted">After-image realism check: {r.realism.pass ? "passed" : "not passed"} ({fmtDate(r.realism.at)}; largest bone-proportion change {r.realism.worst}).</p>}
          </>,
          "ok",
        )
      : callout("review-b", r?.status === "in-review" ? "In review" : "Awaiting review", "A reviewer has not signed off this report yet. Measurements and plan items may still change.", "warn"),
    h2("profile", "Client profile"),
    kvTable("profile-t", profileRows(c.profile.intake), { label: "Detail" }),
  ];
  return { id: "summary", title: "Summary", blocks };
}

/* ------------------------------------------------------------------ */
/*  Photographs                                                        */
/* ------------------------------------------------------------------ */

export function photosChapter(c: ReportCtx): Chapter {
  const f = c.scan.face;
  const views = new Set(c.scan.views ?? []);
  const vfig = (v: FaceView, children?: ReactNode) => {
    const src = views.has(v) ? c.photos.views[v] ?? null : null;
    return (
      <Fig n={src ? c.fig() : undefined} h={250} caption={`${VIEW_NAME[v]}${src ? "" : " · not captured"}`}>
        {children ?? (src ? <Photo src={src} pos="50% 35%" /> : <NoPhoto />)}
      </Fig>
    );
  };
  const blocks: Block[] = [
    title("Photographs", "& landmarks", "Every photo captured with this scan, with the landmarks and lines the analysis measures from. All measurements come from these original photos, never from retouched or generated images."),
    h2("ph-front", "Front portrait"),
    f
      ? block(
          "ph-front-b",
          <div className="rp-grid2">
            <Fig n={c.fig()} h={400} caption="Front portrait · 478-point landmark mesh (pose-corrected before measuring)">
              <FaceMesh face={f} photo={c.photos.face} />
            </Fig>
            <Fig n={c.fig()} h={400} caption="Front portrait · facial thirds (I–III) and fifths">
              <ThirdsFifths face={f} photo={c.photos.face} />
            </Fig>
          </div>,
        )
      : notMeasured("ph-front-na", "No front portrait was captured, so no face measurements were made."),
    h2("ph-views", "Profile, three-quarter and expression views"),
    block(
      "ph-views-a",
      <div className="rp-grid3">
        {vfig(
          "faceLeft",
          views.has("faceLeft") ? <ProfileFig photo={c.photos.views.faceLeft ?? null} points={c.scan.profileFace?.points} /> : undefined,
        )}
        {vfig("faceRight")}
        {vfig("face45")}
      </div>,
    ),
    block(
      "ph-views-b",
      <div className="rp-grid3">
        {vfig("smile")}
        {vfig("frown")}
        {vfig("browRaise")}
      </div>,
    ),
    note("ph-views-n", "Profile labels: G glabella · N nasion · Prn nose tip · Cm columella · Sn subnasale · Ls/Li upper/lower lip · Sm supramentale · Pg pogonion · Gn gnathion · Me menton."),
    h2("ph-body", "Full body"),
    c.scan.body || c.scan.bodySide
      ? block(
          "ph-body-b",
          <div className="rp-grid2">
            {c.scan.body ? (
              <Fig n={c.fig()} h={430} caption="Full body, front · 33-point pose skeleton">
                <BodyFrontFig body={c.scan.body} photo={c.photos.body} />
              </Fig>
            ) : (
              <Fig h={430} caption="Full body, front · not captured">
                <NoPhoto />
              </Fig>
            )}
            {c.scan.bodySide ? (
              <Fig n={c.fig()} h={430} caption="Full body, side · ear–shoulder–hip alignment and plumb line">
                <BodySideFig side={c.scan.bodySide} photo={c.photos.side} mode="full" />
              </Fig>
            ) : (
              <Fig h={430} caption="Full body, side · not captured">
                <NoPhoto />
              </Fig>
            )}
          </div>,
        )
      : notMeasured("ph-body-na", "No full-body photos were captured."),
    h2("ph-list", "Capture record"),
    table(
      "ph-list-t",
      [
        ["View", "26%"],
        ["Captured", "14%"],
        ["Used for", "60%"],
      ],
      (
        [
          ["face", !!f, "All front-view face markers, skin, symmetry, proportions, assessments"],
          ...FACE_VIEWS.map((v) => [
            v,
            views.has(v),
            {
              faceLeft: "Side-profile markers (nose, lips, chin, neck angles)",
              faceRight: "Side-profile markers (either side is enough)",
              face45: "Three-quarter view markers",
              smile: "Smile markers (corridor, gum display, smile arc)",
              frown: "Expression markers (reviewer)",
              browRaise: "Expression markers (reviewer)",
            }[v],
          ]),
          ["body", !!c.scan.body, "Frame proportions, front posture, symmetry, composition"],
          ["side", !!c.scan.bodySide, "Side posture, belly and chest depth, core score"],
        ] as [keyof typeof VIEW_NAME, boolean, string][]
      ).map(([v, ok, use]) => [VIEW_NAME[v], ok ? <Pill tone="ok">Yes</Pill> : <Pill tone="na">No</Pill>, use]),
    ),
  ];
  return { id: "photos", title: "Photographs", blocks };
}

/* ------------------------------------------------------------------ */
/*  Face analysis                                                      */
/* ------------------------------------------------------------------ */

function AssessCard({ fig, name, score, suffix = "/100", label, bar, children, method }: { fig: ReactNode; name: string; score: ReactNode; suffix?: string; label: string; bar?: ReactNode; children: ReactNode; method?: string }) {
  const m = method ? METHODS[method] : null;
  return (
    <div className="rp-assess">
      <div className="rp-assess-fig">{fig}</div>
      <div className="rp-assess-body">
        <div className="rp-assess-top">
          <h3>{name}</h3>
          <span className="rp-assess-score">
            {score}
            <small>{suffix}</small>
          </span>
        </div>
        <div className="rp-assess-label">{label}</div>
        {bar}
        <p>{children}</p>
        {m && (
          <p className="rp-method">
            <b>Method.</b> {m.how} <b>Reference.</b> {m.norm}
          </p>
        )}
      </div>
    </div>
  );
}

function FeatureCard({ fig, name, type, attrs, children, method }: { fig: ReactNode; name: string; type: string; attrs: [string, ReactNode][]; children: ReactNode; method?: string }) {
  const m = method ? METHODS[method] : null;
  return (
    <div className="rp-feat">
      <div className="rp-feat-fig">{fig}</div>
      <div className="rp-feat-body">
        <div className="rp-feat-top">
          <h3>{name}</h3>
          <span className="rp-feat-type">{type}</span>
        </div>
        <Attrs items={attrs} />
        <p>{children}</p>
        {m && <p className="rp-method">{m.norm}</p>}
      </div>
    </div>
  );
}

const zStatus = (z: number): [string, Tone] => (Math.abs(z) <= 1 ? ["Typical", "ok"] : z > 0 ? ["Above typical", "warn"] : ["Below typical", "warn"]);

export function faceChapter(c: ReportCtx): Chapter {
  const face = c.scan.face;
  if (!face) return { id: "face", title: "Face analysis", blocks: [title("Face analysis"), notMeasured("na", "No front portrait was captured, so the face was not analysed.")] };
  const m = face.metrics;
  const g = c.profile.intake.gender;
  const photo = c.photos.face;
  const cap0 = face.capture;
  const close = !!cap0?.closeRange;
  const t = traits(face);
  const words = impressionWords(t);
  const harmony = harmonyScore(face, g);
  const dev = AVG_NORMS.map((n) => ({ ...n, v: m[n.key] as number, z: ((m[n.key] as number) - n.mean) / n.sd }));
  const devSorted = [...dev].sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
  const closeL = devSorted.filter((d) => Math.abs(d.z) < 0.6).map((d) => d.label.toLowerCase());
  const far = devSorted.slice(0, 2).filter((d) => Math.abs(d.z) >= 1);
  const cues = dimorphismCues(m);
  const bf = c.scan.body?.metrics.bodyFatEstimate;
  const fig = (node: ReactNode, cap: string) => (
    <Fig n={c.fig()} h={232} caption={cap}>
      {node}
    </Fig>
  );
  const ffig = (k: FeatureKey, cap: string) => (
    <Fig n={c.fig()} h={196} caption={cap}>
      <FeatureFig k={k} face={face} photo={photo} />
    </Fig>
  );
  const ue = regionOf(face, "underEye");
  const lmid = (() => {
    const lm = face.landmarks;
    if (!lm) return "Not measured";
    const mid = [10, 9, 168, 152].reduce((s, i) => s + lm[i][0], 0) / 4;
    const off = (lm[1][0] - mid) / Math.abs(lm[454][0] - lm[234][0]);
    return Math.abs(off) < 0.035 ? "Straight" : `${off > 0 ? "Right" : "Left"} of midline`;
  })();
  const corners = m.mouthCornerTilt > 1 ? "Upturned" : m.mouthCornerTilt < -1 ? "Downturned" : "Neutral";
  const lcheek = regionOf(face, "leftCheek"), rcheek = regionOf(face, "rightCheek");
  const cheekEv = lcheek && rcheek ? (lcheek.evenness + rcheek.evenness) / 2 : null;
  const def = m.adiposity < 35 ? "Sharp" : m.adiposity < 55 ? "Moderate" : "Soft";
  const chinH = 1 / Math.max(0.05, m.lipChinRatio);
  const regions = SKIN_ORDER.map((k) => face.skin.find((s) => s.key === k)).filter(Boolean) as typeof face.skin;
  const ranked = [...regions].sort((a, b) => b.coverage - a.coverage).map((r) => r.key);
  const skinItems = c.plan.items.filter((i) => i.category === "Skin");

  const blocks: Block[] = [
    title("Face analysis", "", "Every section of the in-app face analysis: the score or value, the norm it is compared with and who that norm describes, and what it means in plain English. Values come from the pose-corrected front portrait."),
    h2("capture", "Capture quality"),
    kvTable(
      "capture-t",
      [
        ["Head turn (yaw)", `${Math.abs(cap0?.yaw ?? 0).toFixed(1)}°`, "Corrected before measuring; < 5° is ideal"],
        ["Head nod (pitch)", `${Math.abs(cap0?.pitch ?? 0).toFixed(1)}°`, "Corrected before measuring"],
        ["Head tilt (roll)", `${Math.abs(cap0?.roll ?? 0).toFixed(1)}°`, "Corrected before measuring"],
        ["Face width in frame", pct((cap0?.faceWidthFrac ?? 0) * 100), "Share of image width"],
        ["Close-range selfie", close ? "Likely" : "No", close ? "Perspective widens the nose and narrows the face" : "Distance looks adequate"],
        ["Warnings", cap0?.warnings.length ? cap0.warnings.join(" · ") : "None", ""],
        ["Affected measurements", cap0?.affected.length ? cap0.affected.join(", ") : "None", ""],
      ],
      { label: "Check" },
    ),
    h2("assess", "Facial assessments", { sub: "Overall impressions computed from combinations of landmarks. Composite scores are our own scales (see Methodology)." }),

    block(
      "fi",
      <AssessCard
        fig={fig(<FaceMesh face={face} photo={photo} zoom={1.6} />, "First impression · landmarks")}
        name="First impression"
        score={words.filter((w) => w.on).map((w) => w.word).join(" · ") || "Neutral"}
        suffix=""
        label="Words your face reads as at first glance"
        method="impression"
      >
        These are perception estimates built from shape cues in face-perception research, not personality measures. Bone structure sets the baseline, but skin clarity, a rested eye area, facial
        leanness and a relaxed, genuine smile measurably shift how warm, healthy and confident a face is judged.
      </AssessCard>,
    ),
    table(
      "fi-t",
      [
        ["Index", "17%"],
        ["Reads as", "15%"],
        ["Position", "22%"],
        ["What it means", "46%"],
      ],
      t.map((x) => [
        <>
          <b>{x.name}</b>
          <div className="rp-muted">{x.features.join(", ")}</div>
        </>,
        x.value > 0.62 ? x.axis[2] : x.value < 0.38 ? x.axis[0] : x.axis[1],
        <Bar v={x.value} labels={x.axis} />,
        <span className="rp-small">{x.text}</span>,
      ]),
    ),

    block(
      "dimo",
      <AssessCard
        fig={fig(<SymmetryFig face={face} photo={photo} />, "Dimorphism · feature map")}
        name="Dimorphism"
        score={Math.round(m.dimorphism * 100)}
        label={`${dimorphismLabel(m.dimorphism, g)} · experimental`}
        bar={<Bar v={m.dimorphism} labels={["Feminine", "Androgynous", "Masculine"]} />}
        method="dimorphism"
      >
        Shape features that differ on average between male and female faces, read against your own sex. This index combines several weak cues and is not calibrated against a rated sample, so treat it
        as descriptive. Facial hair is not measured.
      </AssessCard>,
    ),
    table(
      "dimo-t",
      [
        ["Cue", "40%"],
        ["Your value", "20%"],
        ["Reads as", "40%"],
      ],
      cues.map((x) => [x.name, <span className="rp-num">{x.value}</span>, x.masc ? "Masculine" : "Feminine"]),
    ),

    block(
      "avg",
      <AssessCard
        fig={fig(<FaceMesh face={face} photo={photo} zoom={1.35} />, "Averageness · landmark mesh")}
        name="Averageness"
        score={Math.round(m.averageness)}
        label={typicalLabel(m.averageness)}
        bar={<Bar v={m.averageness / 100} labels={["Unique", "Typical"]} />}
        method="averageness"
      >
        {closeL.length > 0 && <>Your {closeL.slice(0, 3).join(", ")} sit close to population norms. </>}
        {far.length > 0 ? (
          <>The biggest departures are your {far.map((d) => `${d.label.toLowerCase()} (${d.z > 0 ? "above" : "below"} average)`).join(" and ")}, which give your face its distinctive character. </>
        ) : (
          <>No single ratio departs strongly from the reference. </>
        )}
        Averaged faces tend to be rated attractive, but distinctive features are not a flaw.
      </AssessCard>,
    ),
    table(
      "avg-t",
      [
        ["Ratio", "30%"],
        ["You", "12%"],
        ["Population mean ± SD", "24%"],
        ["Deviation (z)", "14%"],
        ["Status", "20%"],
      ],
      dev.map((d) => {
        const [s, tone] = zStatus(d.z);
        return [d.label, <b className="rp-num">{d.v.toFixed(3)}</b>, <span className="rp-num">{`${d.mean} ± ${d.sd}`}</span>, <span className="rp-num">{d.z >= 0 ? "+" : "−"}{Math.abs(d.z).toFixed(2)}</span>, <Pill tone={tone}>{s}</Pill>];
      }),
    ),
    note("avg-n", "Population means are anthropometric (Farkas-style) reference values used by the averageness score; within ±1 SD is called typical."),

    block(
      "prop",
      <AssessCard
        fig={fig(<ThirdsFifths face={face} photo={photo} />, "Proportions · thirds and fifths")}
        name="Proportional harmony"
        score={Math.round(harmony)}
        label={band(harmony)}
        bar={<Bar v={harmony / 100} labels={["0", "50", "100"]} />}
        method="proportions"
      >
        Classical thirds and fifths compared with anthropometric norms. Harmony uses published averages rather than neoclassical canons (which fail in Saudi samples); nose and mouth use Saudi
        sex-specific means. Proportions are descriptive — attractive faces vary widely.
      </AssessCard>,
    ),
    table(
      "prop-t",
      [
        ["Ratio", "24%"],
        ["You", "10%"],
        ["Reference", "34%"],
        ["Position", "32%"],
      ],
      RATIOS.map((r) => {
        const v = m[r.key] as number;
        const pos = (v - r.lo) / (r.hi - r.lo);
        return [r.label, <b className="rp-num">{v.toFixed(2)}</b>, <span className="rp-small">{r.note}</span>, <Bar v={pos} labels={r.labels} />];
      }),
    ),

    block(
      "sym",
      <AssessCard
        fig={fig(<SymmetryFig face={face} photo={photo} />, "Symmetry · mirrored landmark pairs")}
        name="Symmetry"
        score={Math.round(m.symmetry)}
        label={symmetryLabel(m.symmetry)}
        bar={<Bar v={m.symmetry / 100} labels={["Asymmetric", "Symmetric"]} />}
        method="symmetry"
      >
        White dots are landmarks on one side; rings show where the matching point on the other side lands when mirrored. Everyone has some asymmetry — scores above ~80 are typical of faces rated
        highly symmetric. Head pose was corrected (turn {Math.abs(cap0?.yaw ?? 0).toFixed(0)}°, tilt {Math.abs(cap0?.roll ?? 0).toFixed(0)}°).
      </AssessCard>,
    ),
    block(
      "neo",
      <AssessCard
        fig={fig(<FaceMesh face={face} photo={photo} zoom={1.3} />, "Neoteny · proportions")}
        name="Neoteny"
        score={Math.round(m.neoteny)}
        label={neotenyLabel(m.neoteny)}
        bar={<Bar v={m.neoteny / 100} labels={["Mature", "Balanced", "Youthful"]} />}
        method="neoteny"
      >
        Eye width is {(m.eyeWidthToFace * 100).toFixed(1)}% of face width (reference ≈ 20.5%), nose length {(m.noseLengthToFace * 100).toFixed(0)}% of face height and lip height{" "}
        {(m.lipFullness * 100).toFixed(0)}% of mouth width. Youthful proportions read as approachable; mature ones as more authoritative — neither is better in itself.
      </AssessCard>,
    ),
    block(
      "shape",
      <AssessCard
        fig={fig(<ShapeFig face={face} photo={photo} />, "Face shape · outline and widths")}
        name="Face shape"
        score={face.faceShape}
        suffix=""
        label={`Width : height ${m.faceWHR.toFixed(2)} · jaw : cheek ${m.jawToFaceWidth.toFixed(2)} · forehead : cheek ${m.foreheadToFaceWidth.toFixed(2)} · chin : mouth ${m.chinWidthToMouth.toFixed(2)}`}
        method="proportions"
      >
        {SHAPE_TEXT[face.faceShape]}
      </AssessCard>,
    ),
    block(
      "adip",
      <AssessCard
        fig={fig(<ShapeFig face={face} photo={photo} />, "Adiposity · facial outline")}
        name="Facial adiposity"
        score={Math.round(m.adiposity)}
        label={`${adiposityLabel(m.adiposity)}${close ? " · close-range selfie, reads low" : ""}`}
        bar={<Bar v={m.adiposity / 100} labels={["Lean", "Moderate", "Full"]} />}
        method="adiposity"
      >
        Estimated from face width-to-height ({m.faceWHR.toFixed(2)}) and cheek-to-jaw taper. {bf != null && <>Your body scan estimates ~{bf.toFixed(0)}% body fat. </>}
        {c.plan.targetBodyFat != null
          ? `Your plan targets ~${c.plan.targetBodyFat}% body fat, which reduces cheek and under-chin fullness and reveals more cheekbone and jaw definition.`
          : "Your fullness is already in a lean range."}
      </AssessCard>,
    ),
    block(
      "contrast",
      <AssessCard
        fig={fig(<ContrastFig face={face} photo={photo} />, "Contrast · feature regions vs skin")}
        name="Facial contrast"
        score={Math.round(m.contrast)}
        label={contrastLabel(m.contrast)}
        bar={<Bar v={m.contrast / 100} labels={["Low", "Moderate", "High"]} />}
        method="contrast"
      >
        Highlighted regions were compared with your cheek skin in CIELAB luminance. Dark brows and lashes raise contrast; sun damage and uneven tone lower it. Contrast depends on lighting, so compare
        check-ins taken in the same set-up.
      </AssessCard>,
    ),

    h2("features", "Features", { sub: "Each feature’s type, its key measurements and what they mean." }),
    block(
      "f-brows",
      <FeatureCard
        fig={ffig("brows", "Eyebrows")}
        name="Eyebrows"
        type={browType(m.browArch)}
        attrs={[
          ["Brow tilt", `${m.browTilt > 4 ? "Upswept tail" : m.browTilt < -2 ? "Tapered tail" : "Level tail"} · ${sdeg(m.browTilt)}`],
          ["Brow peak", `${m.browPeak > 0.62 ? "Outer-third apex" : m.browPeak > 0.42 ? "Central apex" : "Inner apex"} · ${(m.browPeak * 100).toFixed(0)}% along`],
          ["Brow body", `${m.browThickness > 0.17 ? "Full body" : m.browThickness > 0.1 ? "Even thickness" : "Fine body"} · ${m.browThickness.toFixed(2)}`],
          ["Brow-to-lid distance", `${m.browEyeDistance.toFixed(2)}× eye width`],
        ]}
        method="brows"
      >
        Arch height is {(m.browArch * 100).toFixed(1)}% of brow length. Your brows sit {m.browEyeDistance < 0.42 ? "low-set" : m.browEyeDistance > 0.62 ? "high-set" : "moderately set"} above the eyes, which{" "}
        {m.browEyeDistance < 0.42 ? "reads as more intense and focused" : "keeps the gaze open and approachable"}.
      </FeatureCard>,
    ),
    block(
      "f-eyes",
      <FeatureCard
        fig={ffig("eyes", "Eyes · corners and width")}
        name="Eyes"
        type={eyeType(m)}
        attrs={[
          ["Canthal tilt", sdeg(m.canthalTilt)],
          ["Eye shape", `${m.eyeAspect < 0.28 ? "Narrow / hooded" : m.eyeAspect < 0.35 ? "Almond" : "Round"} · ${(m.eyeAspect * 100).toFixed(0)}% h/w`],
          ["Eye spacing", `${m.eyeSpacingRatio < 0.95 ? "Close-set" : m.eyeSpacingRatio > 1.18 ? "Wide-set" : "Balanced"} · ${m.eyeSpacingRatio.toFixed(2)}`],
          ["Eye size", `${m.eyeWidthToFace > 0.215 ? "Large" : m.eyeWidthToFace < 0.19 ? "Small" : "Proportionate"} · ${(m.eyeWidthToFace * 100).toFixed(1)}% of face`],
        ]}
        method="canthal"
      >
        Your outer eye corners sit {Math.abs(m.canthalTilt).toFixed(1)}° {m.canthalTilt >= 0 ? "above" : "below"} the inner corners. There is no single ideal tilt — it is set by bone and isn’t a plan
        target. {m.eyeAspect < 0.3 ? "The lids sit relatively low; sleep and reduced puffiness open the eye area." : ""}
        {ue && ue.coverage > 0.06 ? ` Under-eye discolouration covers ${(ue.coverage * 100).toFixed(1)}% of that area.` : ""}
      </FeatureCard>,
    ),
    block(
      "f-nose",
      <FeatureCard
        fig={ffig("nose", "Nose · alar and intercanthal widths")}
        name="Nose"
        type={noseType(m)}
        attrs={[
          ["Alar : intercanthal", `${m.noseWidthToIntercanthal.toFixed(2)}${close ? " (selfie)" : ""}`],
          ["Nose length", `${m.noseLengthToFace > 0.34 ? "Long" : m.noseLengthToFace < 0.29 ? "Short" : "Proportional"} · ${(m.noseLengthToFace * 100).toFixed(0)}%`],
          ["Mouth : nose width", m.mouthToNoseWidth.toFixed(2)],
          ["Midline", lmid],
        ]}
        method="proportions"
      >
        Your nose base is {m.noseWidthToIntercanthal.toFixed(2)}× the distance between your inner eye corners. The classical canon is 1.0, but in Saudi adults the nose is usually wider: averages are
        1.22 for men and 1.08 for women.{close ? " A close-range selfie makes the nose look ~30% wider than at 1.5 m." : ""} Projection and bridge shape come from the side profile (next chapter).
      </FeatureCard>,
    ),
    block(
      "f-lips",
      <FeatureCard
        fig={ffig("lips", "Lips · outer and inner contours")}
        name="Lips"
        type={lipType(m)}
        attrs={[
          ["Upper : lower lip", `1 : ${(1 / Math.max(0.05, m.lipRatio)).toFixed(2)}`],
          ["Mouth corners", `${corners} · ${sdeg(m.mouthCornerTilt)}`],
          ["Fullness", `${(m.lipFullness * 100).toFixed(0)}% of mouth width`],
          ["Upper lip : chin", `1 : ${chinH.toFixed(2)}`],
        ]}
        method="lips"
      >
        Your upper lip is {m.lipRatio.toFixed(2)}× the height of your lower lip; a ratio near 1 : 2 was rated most attractive in a study of female faces. Mouth corners are {corners.toLowerCase()} at rest
        {m.mouthCornerTilt < -1 ? ", which can read as serious — a relaxed, slight smile shifts warmth judgements most" : ""}. Lip hydration and an even lip line are the realistic levers.
      </FeatureCard>,
    ),
    block(
      "f-cheeks",
      <FeatureCard
        fig={ffig("cheeks", "Cheeks · regions and bizygomatic width")}
        name="Cheeks"
        type={close ? "Retake for fullness" : cheekType(m)}
        attrs={[
          ["Width : height", m.faceWHR.toFixed(2)],
          ["Cheek : jaw taper", (1 / Math.max(0.1, m.jawToFaceWidth)).toFixed(2)],
          ["Facial fullness", `${Math.round(m.adiposity)}/100${close ? " (selfie)" : ""}`],
          ["Cheek skin evenness", cheekEv != null ? `${Math.round(cheekEv)}/100` : NOT_MEASURED],
        ]}
        method="adiposity"
      >
        Your cheekbones are the widest point of the face, {(1 / Math.max(0.1, m.jawToFaceWidth)).toFixed(2)}× your jaw width.{" "}
        {c.plan.targetBodyFat != null
          ? `Reducing body fat toward ~${c.plan.targetBodyFat}% is the evidence-backed way to make them more visible — fat loss reveals bone structure, it doesn’t change it.`
          : "Your facial fullness is already lean, so the bone outline reads clearly."}
      </FeatureCard>,
    ),
    block(
      "f-jaw",
      <FeatureCard
        fig={ffig("jaw", "Jaw · contour and bigonial width")}
        name="Jaw"
        type={jawType(m)}
        attrs={[
          ["Jaw : cheek width", m.jawToFaceWidth.toFixed(2)],
          ["fWHR", m.fWHR.toFixed(2)],
          ["Definition", def],
          ["Lower third share", `${(100 / (1 + m.midToLowerThird)).toFixed(0)}%`],
        ]}
        method="fwhr"
      >
        Your jaw is {(m.jawToFaceWidth * 100).toFixed(0)}% of your cheekbone width; typical adult values are 75–85%. Definition reads {def.toLowerCase()} — lower facial fat sharpens the edge without
        changing width.{g === "male" ? " A beard can hide or exaggerate the jawline in photos, so landmarks under facial hair are less precise." : ""} Exercises, gum and mewing have no evidence for
        changing adult jaw bone.
      </FeatureCard>,
    ),
    block(
      "f-chin",
      <FeatureCard
        fig={ffig("chin", "Chin · width and height")}
        name="Chin"
        type={chinType(m)}
        attrs={[
          ["Chin : mouth width", m.chinWidthToMouth.toFixed(2)],
          ["Lip : chin height", `1 : ${chinH.toFixed(2)}`],
          ["Chin height", chinH > 2.3 ? "Tall" : chinH < 1.7 ? "Short" : "Proportionate"],
          ["Projection", c.scan.profileFace ? "See side profile" : "Needs side profile"],
        ]}
        method="proportions"
      >
        Your chin (lower lip to menton) is {chinH.toFixed(2)}× the height of your upper lip — the classical proportion is about 2×. Its width is {(m.chinWidthToMouth * 100).toFixed(0)}% of mouth width.
      </FeatureCard>,
    ),

    h2("fsum", "Feature measurements vs reference"),
    table(
      "fsum-t",
      [
        ["Measurement", "36%"],
        ["You", "18%"],
        ["Reference", "26%"],
        ["Status", "20%"],
      ],
      featureRows(m).map((r) => [r.name, <b className="rp-num">{r.v}</b>, r.norm, <Pill tone={r.ok ? "ok" : "warn"}>{r.ok ? "Within range" : "Outside range"}</Pill>]),
    ),
    note("fsum-n", "References are classical or anthropometric bands used by the in-app summary; “outside range” is descriptive, not a defect."),

    h2("skin", "Skin by region"),
    block(
      "skin-b",
      <div className="rp-assess">
        <div className="rp-assess-fig">
          <Fig n={c.fig()} h={260} caption="Skin · measured regions (brighter = more flagged)">
            <SkinRegionsFig face={face} photo={photo} />
          </Fig>
        </div>
        <div className="rp-assess-body">
          <div className="rp-tiles rp-tiles-2">
            <Score label="Skin score" value={Math.round(m.skinScore)} sub={band(m.skinScore)} />
            <Score label="Rested look" value={Math.round(restedScore(face))} sub={band(restedScore(face))} />
          </div>
          <p>
            Skin quality covers pigmentation, redness and texture. Even colour distribution is one of the strongest cues to perceived age and health. Your most flagged region is the{" "}
            <b>{ranked[0] ? SKIN_LABEL[ranked[0]].toLowerCase() : "—"}</b>; the least flagged is the {ranked.length ? SKIN_LABEL[ranked[ranked.length - 1]].toLowerCase() : "—"}.
            {skinItems.length > 0 && <> Your plan addresses skin with {skinItems.map((i) => i.title.toLowerCase()).join(", ")}.</>}
          </p>
          <p className="rp-method">
            <b>Method.</b> {METHODS.skin.how} <b>Reference.</b> {METHODS.skin.norm}
          </p>
        </div>
      </div>,
    ),
    table(
      "skin-t",
      [
        ["Region", "18%"],
        ["Flagged area", "15%"],
        ["Level", "13%"],
        ["Evenness", "14%"],
        ["Redness", "13%"],
        ["Texture", "13%"],
        ["Rank", "14%"],
      ],
      regions.map((r) => [
        <b>{SKIN_LABEL[r.key]}</b>,
        <span className="rp-num">{(r.coverage * 100).toFixed(1)}%</span>,
        skinLevel(r.coverage * 100),
        <span className="rp-num">{Math.round(r.evenness)}/100</span>,
        <span className="rp-num">{Math.round(r.redness)}/100</span>,
        <span className="rp-num">{Math.round(r.texture)}/100</span>,
        `${ranked.indexOf(r.key) + 1} of ${regions.length}`,
      ]),
    ),
    note("skin-n", "Flagged area: share of pixels darker than their neighbourhood (pigmentation) or redder than the regional median (redness). Evenness: higher is more even. Redness and texture: higher is redder / rougher. Levels: minimal < 3% · mild < 7% · moderate < 14% · marked ≥ 14%. Rank 1 = most flagged. Lighting affects these values; compare check-ins taken in the same set-up."),
  ];
  return { id: "face", title: "Face analysis", blocks };
}

/* ------------------------------------------------------------------ */
/*  Marker rows (shared by profile/smile and the full table)           */
/* ------------------------------------------------------------------ */

const STATE_TONE: Record<MarkerState, Tone> = { measured: "ok", photo: "na", covered: "warn", review: "info", soon: "na" };

function markerStatus(e: MarkerEntry): ReactNode {
  if (e.state === "measured") {
    const s = e.placed?.status ?? "none";
    return <Pill tone={s === "typical" ? "ok" : s === "above" || s === "below" ? "warn" : "ref"}>{PLACE_LABEL[s]}</Pill>;
  }
  if (e.state === "photo") return <Pill tone="na">Needs {e.view ? VIEW_NEED_LABEL[e.view] : "photo"}</Pill>;
  if (e.state === "review") return <Pill tone="info">{e.grade ? "Graded by reviewer" : "Awaiting reviewer"}</Pill>;
  return <Pill tone={STATE_TONE[e.state]}>{STATE_LABEL[e.state]}</Pill>;
}

function markerValue(e: MarkerEntry): ReactNode {
  if (e.state === "measured" && e.value) return <b className="rp-num">{fmtMarker(e.value)}</b>;
  if (e.state === "review" && e.grade) return <b>{e.grade}</b>;
  return <span className="rp-muted">{NOT_MEASURED}</span>;
}

function markerNorm(e: MarkerEntry): ReactNode {
  const n = e.placed?.norm;
  if (n)
    return (
      <span className="rp-small">
        <span className="rp-num">
          {n.mean}
          {n.sd != null ? ` ± ${n.sd}` : ""}
        </span>{" "}
        · {n.group}
        {e.placed?.status === "reference" && n.sd != null ? " · approximate landmark" : ""}
      </span>
    );
  if (e.state === "measured") return <span className="rp-small rp-muted">No numeric norm · see Appendix A</span>;
  return <span className="rp-small rp-muted">—</span>;
}

const markerCols: [string, string][] = [
  ["Marker", "41%"],
  ["Your value", "17%"],
  ["Compared with", "25%"],
  ["Status", "17%"],
];

function markerRow(e: MarkerEntry) {
  return {
    key: e.r.id,
    cells: [
      <>
        <b>{e.r.name}</b>
        {e.r.definition && <div className="rp-def">{e.r.definition}</div>}
      </>,
      markerValue(e),
      markerNorm(e),
      markerStatus(e),
    ],
  };
}

/* ------------------------------------------------------------------ */
/*  Side profile & smile                                               */
/* ------------------------------------------------------------------ */

export function profileChapter(c: ReportCtx): Chapter {
  const pf = c.scan.profileFace;
  const sm = c.scan.smileFace;
  const views = new Set(c.scan.views ?? []);
  const entries = markerEntries(c.catalog, c.scan, c.profile.intake.gender);
  const prof = entries.filter((e) => e.view === "faceLeft");
  const smile = entries.filter((e) => e.view === "smile");
  const profPhoto = c.photos.views.faceLeft ?? c.photos.views.faceRight ?? null;
  const measuredP = prof.filter((e) => e.state === "measured").length;
  const coveredP = prof.filter((e) => e.state === "covered").length;
  const blocks: Block[] = [
    title("Side profile", "& smile", "Markers read from the profile and smile photos: nose angles and projection, lip and chin position, neck angles, and smile display. Values in millimetres are scaled from the front portrait (iris as a ruler)."),
    h2("profile", "Side profile"),
  ];
  if (pf && profPhoto) {
    blocks.push(
      block(
        "pf-b",
        <div className="rp-assess">
          <div className="rp-assess-fig rp-fig-tall">
            <Fig n={c.fig()} h={330} caption="Side profile · soft-tissue landmarks">
              <ProfileFig photo={profPhoto} points={pf.points} />
            </Fig>
          </div>
          <div className="rp-assess-body">
            <div className="rp-tiles rp-tiles-2">
              <Score label="Profile markers measured" value={measuredP} suffix={` / ${prof.length}`} />
              <Score label="Hidden by facial hair" value={coveredP} suffix="" />
            </div>
            <Attrs
              items={[
                ["Facing", cap(String(pf.points.facing ?? "—"))],
                ["Millimetre scale", pf.mmPerPx ? `${pf.mmPerPx.toFixed(3)} mm per pixel, from the front portrait` : "Not available — lengths shown as ratios only"],
                ["Facial hair", pf.flags.beard ? "Beard or moustache detected" : "None detected"],
                ["Fringe", pf.flags.fringe ? "Hair over the forehead — forehead points skipped" : "Forehead visible"],
              ]}
            />
            {pf.flags.beard && (
              <p className="rp-warnline">
                Hidden by facial hair: {coveredP} outline markers (lip, chin and neck lines under the beard or moustache) were not measured, because the skin outline is covered. They are listed below as
                “Hidden by facial hair”.
              </p>
            )}
          </div>
        </div>,
      ),
    );
  } else {
    blocks.push(notMeasured("pf-na", views.has("faceLeft") || views.has("faceRight") ? "A profile photo was captured but the profile outline could not be traced." : "No profile photo was captured, so side-profile markers were not measured."));
  }
  blocks.push(table("pf-t", markerCols, prof.map(markerRow), { className: "rp-markers" }));
  blocks.push(h2("smile", "Smile"));
  if (sm && c.photos.views.smile) {
    blocks.push(
      block(
        "sm-b",
        <div className="rp-assess">
          <div className="rp-assess-fig">
            <Fig n={c.fig()} h={232} caption="Natural smile">
              <Photo src={c.photos.views.smile} pos="50% 55%" />
            </Fig>
          </div>
          <div className="rp-assess-body">
            <div className="rp-tiles rp-tiles-2">
              <Score label="Smile markers measured" value={smile.filter((e) => e.state === "measured").length} suffix={` / ${smile.length}`} />
              <Score label="Reviewer-graded" value={smile.filter((e) => e.state === "review").length} suffix="" />
            </div>
            <p>
              Smile markers describe how much tooth and gum show, how the teeth fill the smile and whether the smile is symmetric. A genuine (Duchenne) smile narrows the eyes — the analysis compares eye
              openness with your neutral portrait.
            </p>
          </div>
        </div>,
      ),
    );
  } else blocks.push(notMeasured("sm-na", "No smile photo was captured (or no face was found in it), so smile markers were not measured."));
  blocks.push(table("sm-t", markerCols, smile.map(markerRow), { className: "rp-markers" }));
  return { id: "profile", title: "Side profile & smile", blocks };
}

/* ------------------------------------------------------------------ */
/*  All markers                                                        */
/* ------------------------------------------------------------------ */

export function markersChapter(c: ReportCtx): Chapter {
  const entries = markerEntries(c.catalog, c.scan, c.profile.intake.gender);
  const count = (s: MarkerState) => entries.filter((e) => e.state === s).length;
  const regions = REGION_ORDER.filter((g) => entries.some((e) => e.r.region === g));
  const placed = entries.filter((e) => e.state === "measured");
  const rows = regions.flatMap((g) => {
    const list = entries.filter((e) => e.r.region === g);
    const meas = list.filter((e) => e.state === "measured").length;
    return [
      { key: `g-${g}`, group: true, cells: [<>{REGION_LABEL[g] ?? g} <span>{list.length} markers · {meas} measured</span></>] },
      ...list.map(markerRow),
    ];
  });
  const blocks: Block[] = [
    title("All markers", `· ${entries.length}`, "Every marker in the research catalogue, grouped by region, with your value, the norm it is compared with (and who that norm describes) and its status. Definitions, formulas, published norms by population and sources are in Appendix A."),
    block(
      "stats",
      <div className="rp-stats">
        {(["measured", "photo", "covered", "review", "soon"] as MarkerState[]).map((s) => (
          <div key={s} className="rp-stat">
            <b>{count(s)}</b>
            <span>{STATE_LABEL[s]}</span>
            <small>{STATE_NOTE[s]}</small>
          </div>
        ))}
      </div>,
    ),
    block(
      "placed",
      <p className="rp-p">
        Of the {placed.length} measured markers, <b>{placed.filter((e) => e.placed?.status === "typical").length}</b> are typical (within 1 SD of their norm),{" "}
        <b>{placed.filter((e) => e.placed?.status === "above").length}</b> above and <b>{placed.filter((e) => e.placed?.status === "below").length}</b> below typical,{" "}
        <b>{placed.filter((e) => e.placed?.status === "reference").length}</b> shown against a reference value only, and <b>{placed.filter((e) => !e.placed || e.placed.status === "none").length}</b> without a
        numeric norm.
      </p>,
    ),
    table("all-t", markerCols, rows, { className: "rp-markers" }),
    note(
      "foot",
      "Typical = within ±1 SD of the named group’s mean. Reference = the source gives a mean without a spread, or the mesh point only approximates the clinical landmark; such values are never called high or low. Millimetre values use the iris as a ruler (about 11.7 mm across in adults). Norms come from Saudi samples where published, otherwise from the best-documented group.",
    ),
  ];
  return { id: "markers", title: "All markers", blocks };
}

/* ------------------------------------------------------------------ */
/*  Feature types                                                      */
/* ------------------------------------------------------------------ */

export function typesChapter(c: ReportCtx): Chapter {
  const i = c.profile.intake;
  const ctx = { face: c.scan.face, body: c.scan.body?.metrics ?? null, side: c.scan.bodySide?.metrics ?? null, intake: i };
  const cats = categoriesFor(i.gender);
  const rows = REGIONS.flatMap((reg) => {
    const list = cats.filter((x) => x.region === reg.id);
    if (!list.length) return [];
    return [
      { key: `g-${reg.id}`, group: true, cells: [<>{reg.label}</>] },
      ...list.map((cat) => {
        const m = matchFor(cat, ctx, c.scan.featureTypes);
        const type = m?.typeId ? cat.types.find((t) => t.id === m.typeId) : null;
        const fam = !type && m?.family ? cat.types.filter((t) => t.family === m.family) : [];
        return {
          key: cat.id,
          cells: [
            <>
              <b>{cat.title}</b>
              <div className="rp-def">{cat.what}</div>
            </>,
            type ? (
              <b>{type.name}</b>
            ) : m?.family ? (
              <b>{cap(m.family)} family</b>
            ) : (
              <span className="rp-muted">Not classified</span>
            ),
            m ? (
              <span className="rp-small">
                {m.by === "reviewer" ? "Set by your reviewer" : BASIS_LABEL[m.by]}
                {m.value ? ` · ${m.value}` : ""}
              </span>
            ) : (
              <span className="rp-small rp-muted">{cat.basis === "reviewer" ? "Awaiting reviewer" : cat.basis === "you" ? "No answer given" : "Not measured (photo missing)"}</span>
            ),
            <span className="rp-small">
              {type ? type.definition : fam.length ? `${fam.map((t) => t.name).join(", ")} — your reviewer confirms the exact pattern.` : cat.how}
              {type?.criteria ? ` Rule: ${type.criteria}.` : ""}
            </span>,
          ],
        };
      }),
    ];
  });
  return {
    id: "types",
    title: "Feature types",
    blocks: [
      title("Feature types", "", "Your type in each category of the feature library: face shape, eyes, brows, nose, lips, jaw, hair, facial hair, skin and body. Types are descriptive, not grades — no type is better than another."),
      table(
        "types-t",
        [
          ["Category", "27%"],
          ["Your type", "17%"],
          ["Decided by", "18%"],
          ["What it means", "38%"],
        ],
        rows,
      ),
      note("types-n", "Anything a single front photo can’t settle (eyelid crease, nose profile, hairline, chin projection, curl sub-type) is set by you or confirmed by your reviewer."),
    ],
  };
}

/* ------------------------------------------------------------------ */
/*  Body                                                               */
/* ------------------------------------------------------------------ */

export function bodyChapter(c: ReportCtx): Chapter {
  const body = c.scan.body;
  const side = c.scan.bodySide ?? null;
  const i = c.profile.intake;
  if (!body)
    return {
      id: "body",
      title: "Body analysis",
      blocks: [title("Body analysis"), notMeasured("na", "No full-body photo was captured, so body proportions, posture and composition were not measured.")],
    };
  const m = body.metrics;
  const s = side?.metrics ?? null;
  const female = i.gender === "female";
  const ph = physique(c.scan, i);
  const symScore = bodySymmetryScore(m.lrBalance);
  const bfIdeal = female ? [18, 26] : i.gender === "male" ? [10, 18] : [14, 22];
  const swrRef = female ? "≈ 1.35" : "≈ 1.5–1.6";
  const reading = (v: number, ax: [string, string, string]) => (v > 0.62 ? ax[2] : v < 0.38 ? ax[0] : ax[1]);
  const sub: [string, number | null][] = [
    ["Body score", m.bodyScore],
    ["Proportions", m.proportionScore],
    ["Front posture", m.postureScore],
    ["Side posture", s?.postureScore ?? null],
    ["Core & waist", s?.coreScore ?? null],
    ["Left–right balance", symScore],
    ["Composition", m.compositionScore],
  ];
  const statusRows: { name: string; you: string; norm: string; ok: boolean | null; proxy?: boolean }[] = [
    { name: "Shoulder : waist (frontal)", you: m.shoulderToWaist.toFixed(2), norm: swrRef, ok: female ? Math.abs(m.shoulderToWaist - 1.35) < 0.12 : m.shoulderToWaist >= 1.5, proxy: true },
    { name: m.whrTape ? "Waist : hip (tape)" : "Waist : hip (frontal)", you: (m.whrTape ?? m.waistToHip).toFixed(2), norm: female ? "≈ 0.70 (< 0.85 WHO)" : "< 0.90 WHO", ok: m.whrTape ? m.whrTape < (female ? 0.85 : 0.9) : null, proxy: !m.whrTape },
    { name: "Upper arm : shoulders", you: `${Math.round(m.armToShoulder * 100)}%`, norm: "≥ 22% (trained)", ok: m.armToShoulder >= 0.22, proxy: true },
    { name: "Navel : chest depth (side)", you: s ? s.waistToChestDepth.toFixed(2) : NOT_MEASURED, norm: "< 0.85 lean", ok: s ? s.waistToChestDepth < 0.88 : null, proxy: true },
    { name: "Head forward (side)", you: s ? pct(Math.max(0, s.headForward)) : NOT_MEASURED, norm: "≤ 5% (stacked)", ok: s ? s.headForward <= 8 : null, proxy: true },
    { name: "Shoulder / pelvis tilt", you: `${m.shoulderTilt.toFixed(1)}° / ${m.hipTilt.toFixed(1)}°`, norm: "< 2°", ok: Math.abs(m.shoulderTilt) < 2 && Math.abs(m.hipTilt) < 2 },
    { name: "Left–right balance", you: `${m.lrBalance.toFixed(1)}%`, norm: "< 3%", ok: m.lrBalance < 3, proxy: true },
    { name: "Waist : height", you: m.whtr ? m.whtr.toFixed(2) : NOT_MEASURED, norm: "< 0.50", ok: m.whtr ? m.whtr < 0.5 : null },
    { name: "Body fat", you: m.bodyFatEstimate ? `${m.bodyFatEstimate.toFixed(0)}%` : NOT_MEASURED, norm: female ? "18–26%" : "10–18%", ok: m.bodyFatEstimate ? (female ? m.bodyFatEstimate <= 26 : m.bodyFatEstimate <= 18) : null },
  ];
  const lr = (v: number) => (Math.abs(v) < 0.5 ? "Even" : `${Math.abs(v).toFixed(1)}% ${v > 0 ? "right" : "left"} side wider`);
  const blocks: Block[] = [
    title("Body analysis", "", "Silhouette proportions, alignment and composition from your full-body photos and measurements. Widths are frontal silhouette widths normalised to torso length (shoulder line to hip line), not circumferences."),
    block(
      "figs",
      <div className="rp-grid2">
        <Fig n={c.fig()} h={360} caption="Front · shoulder, waist and hip width lines">
          <BodyFrontFig body={body} photo={c.photos.body} mode="widths" />
        </Fig>
        {side ? (
          <Fig n={c.fig()} h={360} caption="Side · chest and navel depth">
            <BodySideFig side={side} photo={c.photos.side} mode="depth" />
          </Fig>
        ) : (
          <Fig h={360} caption="Side · not captured">
            <NoPhoto />
          </Fig>
        )}
      </div>,
    ),
    h2("b-scores", "Body scores"),
    table(
      "b-scores-t",
      [
        ["Score", "40%"],
        ["Value", "20%"],
        ["Band", "40%"],
      ],
      sub.map(([k, v]) => [<b>{k}</b>, v == null ? <span className="rp-muted">{NOT_MEASURED}</span> : <b className="rp-num">{Math.round(v)}/100</b>, v == null ? "Needs side photo" : band(v)]),
    ),
    h2("b-impr", "Physique impression"),
    table(
      "b-impr-t",
      [
        ["Cue", "18%"],
        ["Reads as", "14%"],
        ["Position", "24%"],
        ["What it means", "44%"],
      ],
      [
        [
          <b>Strength cue</b>,
          reading(ph.strength, ["Slight", "Average", "Strong"]),
          <Bar v={ph.strength} labels={["Slight", "Average", "Strong"]} />,
          <span className="rp-small">
            Shoulder-to-waist {m.shoulderToWaist.toFixed(2)} and upper-arm width {Math.round(m.armToShoulder * 100)}% of shoulder width. Perceived upper-body strength explained ~70% of the variance in men’s
            bodily attractiveness ratings (Sell 2017).
          </span>,
        ],
        [
          <b>Leanness cue</b>,
          reading(ph.leanness, ["Soft", "Average", "Lean"]),
          <Bar v={ph.leanness} labels={["Soft", "Average", "Lean"]} />,
          <span className="rp-small">
            {s
              ? `Navel-level depth is ${Math.round(s.waistToChestDepth * 100)}% of chest depth and the belly sits ${Math.max(0, s.bellyProtrusion).toFixed(0)}% of torso length ahead of the chest. Central fat changes only with overall fat loss.`
              : `Waist width is ${Math.round((m.waistWidth / m.shoulderWidth) * 100)}% of shoulder width. A side photo adds belly depth.`}
          </span>,
        ],
        [
          <b>Posture cue</b>,
          reading(ph.postureV, ["Slouched", "Neutral", "Upright"]),
          <Bar v={ph.postureV} labels={["Slouched", "Neutral", "Upright"]} />,
          <span className="rp-small">
            {s
              ? `Ear sits ${s.headForward.toFixed(0)}% of torso length ahead of the shoulder. An upright, stacked posture makes the same physique read taller and more confident.`
              : `Shoulder line ${m.shoulderTilt.toFixed(1)}°, pelvis ${m.hipTilt.toFixed(1)}°.`}
          </span>,
        ],
      ],
    ),
    h2("b-frame", "Frame & proportions", { sub: `Classified frame: ${taperLabel(m.shoulderToWaist, i.gender)}.` }),
    kvTable(
      "b-frame-t",
      [
        ["Shoulder : waist", m.shoulderToWaist.toFixed(2), `Reference ${swrRef} (frontal width ratio)`],
        [m.whrTape ? "Waist : hip (tape)" : "Waist : hip (frontal)", (m.whrTape ?? m.waistToHip).toFixed(2), m.whrTape ? `WHO threshold ${female ? "0.85" : "0.90"}` : "Width ratio, not circumference"],
        ["Shoulder width", `${m.shoulderWidth.toFixed(2)} × torso`, "Silhouette width at shoulder level"],
        ["Chest width", `${m.chestWidth.toFixed(2)} × torso`, `${Math.round((m.chestWidth / m.shoulderWidth) * 100)}% of shoulder width`],
        ["Waist width", `${m.waistWidth.toFixed(2)} × torso`, `${Math.round((m.waistWidth / m.shoulderWidth) * 100)}% of shoulder width`],
        ["Hip width", `${m.hipWidth.toFixed(2)} × torso`, `${Math.round((m.hipWidth / m.shoulderWidth) * 100)}% of shoulder width`],
        ["Upper-arm width", `${m.upperArmWidth.toFixed(2)} × torso`, `${Math.round(m.armToShoulder * 100)}% of shoulder width · ≥ 22% reads trained`],
        ["Thigh width", m.thighWidth != null ? `${m.thighWidth.toFixed(2)} × torso` : NOT_MEASURED, m.thighWidth != null ? "" : "Legs touching or out of frame"],
        ["Leg : height", m.legToHeight != null ? m.legToHeight.toFixed(2) : NOT_MEASURED, m.feetVisible ? "" : "Feet out of frame"],
        ["Torso : leg", m.torsoToLeg != null ? m.torsoToLeg.toFixed(2) : NOT_MEASURED, m.feetVisible ? "" : "Feet out of frame"],
      ],
    ),
    h2("b-front", "Front posture"),
    kvTable(
      "b-front-t",
      [
        ["Posture score", `${Math.round(m.postureScore)}/100`, band(m.postureScore)],
        ["Shoulder line", `${m.shoulderTilt.toFixed(1)}°`, tiltText(m.shoulderTilt)],
        ["Pelvis line", `${m.hipTilt.toFixed(1)}°`, tiltText(m.hipTilt)],
        ["Head position", `${m.headOffset.toFixed(1)}%`, Math.abs(m.headOffset) < 4 ? "Centred over the body" : `${Math.abs(m.headOffset).toFixed(0)}% ${m.headOffset > 0 ? "right" : "left"} of midline`],
        ["Arm length symmetry", `${Math.round(m.armSymmetry)}/100`, "Shoulder → elbow → wrist, left vs right"],
      ],
    ),
    note("b-front-n", "Reference alignment has level shoulders and pelvis (≈ 0°) with the head centred. Single photos are sensitive to stance — retake standing evenly on both feet before acting on small values."),
    h2("b-side", "Side posture & core"),
    s
      ? kvTable(
          "b-side-t",
          [
            ["Side posture score", `${Math.round(s.postureScore)}/100`, band(s.postureScore)],
            ["Facing", cap(s.facing), ""],
            ["Ear–shoulder angle", `${Math.round(s.earShoulderAngle)}°`, "CVA proxy (uses the shoulder joint, not C7); target ≈ 80–90°"],
            ["Head forward", pct(Math.max(0, s.headForward)), `${headLabel(s.headForward)} · % of torso length · ≤ 5% stacked`],
            ["Shoulders ahead of hips", pct(Math.abs(s.shoulderForward) < 0.5 ? 0 : s.shoulderForward), Math.abs(s.shoulderForward) < 5 ? "Stacked" : s.shoulderForward > 0 ? "Rounded / slumped forward" : "Leaning back"],
            ["Trunk lean", `${s.trunkLean.toFixed(1)}°`, Math.abs(s.trunkLean) < 3 ? "Upright" : s.trunkLean > 0 ? "Leaning forward" : "Leaning back"],
            ["Lower-back curve", pct(s.lumbarCurve), "Descriptive only — no validated photo norm"],
            ["Upper-back rounding", pct(s.upperBackCurve), "Descriptive only — no validated photo norm"],
            ["Core score", `${Math.round(s.coreScore)}/100`, band(s.coreScore)],
            ["Navel : chest depth", s.waistToChestDepth.toFixed(2), "Lean men usually < 0.85; > 1.0 = belly deeper than chest"],
            ["Belly ahead of chest", pct(Math.max(0, s.bellyProtrusion)), "% of torso length"],
            ["Chest depth", `${s.chestDepth.toFixed(2)} × torso`, ""],
            ["Navel-level depth", `${s.waistDepth.toFixed(2)} × torso`, ""],
          ],
        )
      : notMeasured("b-side-na", "No side photo was captured, so head position, belly depth and back curves were not measured."),
    h2("b-sym", "Left–right balance"),
    kvTable(
      "b-sym-t",
      [
        ["Balance score", `${Math.round(symScore)}/100`, band(symScore)],
        ["Average half-width difference", `${m.lrBalance.toFixed(1)}%`, m.lrBalance < 3 ? "Within normal variation (< 3%)" : "Above 3% — compare with the next check-in"],
        ["Shoulders", `${m.lrDetail.shoulder.toFixed(1)}%`, lr(m.lrDetail.shoulder)],
        ["Waist", `${m.lrDetail.waist.toFixed(1)}%`, lr(m.lrDetail.waist)],
        ["Hips", `${m.lrDetail.hip.toFixed(1)}%`, lr(m.lrDetail.hip)],
      ],
    ),
    block(
      "b-sym-fig",
      <div className="rp-grid2">
        <Fig n={c.fig()} h={300} caption="Balance · half-widths from the body midline">
          <BodySymmetryFig body={body} photo={c.photos.body} />
        </Fig>
        {side ? (
          <Fig n={c.fig()} h={300} caption="Side posture · ear–shoulder angle">
            <BodySideFig side={side} photo={c.photos.side} />
          </Fig>
        ) : (
          <Fig h={300} caption="Side posture · not captured">
            <NoPhoto />
          </Fig>
        )}
      </div>,
    ),
    h2("b-comp", "Composition"),
    kvTable(
      "b-comp-t",
      [
        ["Height / weight", `${i.heightCm ? `${i.heightCm} cm` : "—"} / ${i.weightKg ? `${i.weightKg} kg` : "—"}`, "From your answers"],
        ["Body-mass index", m.bmi ? m.bmi.toFixed(1) : NOT_MEASURED, m.bmi ? `${bmiBand(m.bmi)} · can’t separate muscle from fat` : "Needs height and weight"],
        ["Body fat estimate", m.bodyFatEstimate ? `${m.bodyFatEstimate.toFixed(1)}%` : NOT_MEASURED, `Reference ${bfIdeal[0]}–${bfIdeal[1]}% for ${i.gender === "other" ? "adults" : `${i.gender}s`}`],
        [
          "Body-fat method",
          m.bodyFatMethod === "navy" ? "US Navy" : m.bodyFatMethod === "rfm-photo" ? "BMI + photo waist" : m.bodyFatMethod === "deurenberg" ? "Deurenberg (BMI)" : NOT_MEASURED,
          m.bodyFatMethod === "navy" ? "Hodgdon & Beckett 1984, ± 3–4%" : m.bodyFatMethod === "rfm-photo" ? "Deurenberg 1991 + Relative Fat Mass, ± 5 points" : m.bodyFatMethod === "deurenberg" ? "Deurenberg 1991, ± 4%" : "",
        ],
        ["Waist (photo estimate)", m.waistEstCm ? `${m.waistEstCm.toFixed(0)} cm` : NOT_MEASURED, m.waistEstCm ? "From front width + side depth + height" : "Needs height and a side photo"],
        ["Waist : height", m.whtr ? m.whtr.toFixed(2) : NOT_MEASURED, "< 0.50 healthy; ≥ 0.50 raised cardiometabolic risk (Ashwell 2012)"],
        ["Waist : hip (tape)", m.whrTape ? m.whrTape.toFixed(2) : NOT_MEASURED, `WHO thresholds ≥ 0.90 men, ≥ 0.85 women${m.whrTape ? "" : " · add tape waist and hip"}`],
        ["Composition score", `${Math.round(m.compositionScore)}/100`, band(m.compositionScore)],
      ],
    ),
    h2("b-sum", "Body measurements vs reference"),
    table(
      "b-sum-t",
      [
        ["Measurement", "38%"],
        ["You", "18%"],
        ["Reference", "24%"],
        ["Status", "20%"],
      ],
      statusRows.map((r) => [
        <>
          {r.name}
          {r.proxy && <div className="rp-def">Photo-derived proxy</div>}
        </>,
        <b className="rp-num">{r.you}</b>,
        r.norm,
        <Pill tone={r.ok == null ? "na" : r.ok ? "ok" : "warn"}>{r.ok == null ? "Needs data" : r.ok ? "In range" : "To improve"}</Pill>,
      ]),
    ),
  ];
  return { id: "body", title: "Body analysis", blocks };
}

/* ------------------------------------------------------------------ */
/*  Methodology & limitations                                          */
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
  posture: "Front posture",
  composition: "Composition",
  sidePosture: "Side posture",
  core: "Core & waist",
  bodySymmetry: "Body symmetry",
  physique: "Physique impression",
};

export function methodologyChapter(c: ReportCtx, shortCite: (id: string) => string): Chapter {
  return {
    id: "method",
    title: "Methodology & limitations",
    blocks: [
      title(
        "Methodology",
        "& limitations",
        `This report was built from ${c.scan.face ? "a 478-point facial landmark analysis" : "your intake"}${c.scan.body ? ", a full-body silhouette analysis" : ""} and your intake answers. Landmark detection runs on your device (MediaPipe face mesh; pose: 33 points + body segmentation). The face is rotated into a frontal pose before any ratio is computed.`,
      ),
      h2("grades", "Evidence grades"),
      block(
        "grades-b",
        <div className="rp-grades">
          {(Object.keys(GRADE_LABEL) as EvidenceGrade[]).map((g) => (
            <div key={g}>
              <GradeBadge grade={g} /> <span>{GRADE_LABEL[g]}</span>
            </div>
          ))}
        </div>,
      ),
      para("grades-p", "Every plan recommendation is triggered by one of your measurements or answers and graded by the strength of the published evidence behind it. The plan focuses on what can realistically change within 12 months; bone structure is not changed by habits, and nothing in this report pretends otherwise."),
      h2("states", "How markers are reported"),
      kvTable(
        "states-t",
        [
          [STATE_LABEL.measured, STATE_NOTE.measured],
          [STATE_LABEL.photo, STATE_NOTE.photo],
          [STATE_LABEL.covered, STATE_NOTE.covered],
          [STATE_LABEL.review, STATE_NOTE.review],
          [STATE_LABEL.soon, STATE_NOTE.soon],
          ["Typical / above / below", "Within ±1 SD of the named group’s mean, or above / below it"],
          ["Reference", "Shown against a published mean only (no spread published, or approximate landmark) — never called high or low"],
          [NOT_MEASURED, "The photo or data needed was not provided, so no value is shown. Nothing is estimated in its place."],
        ],
        { label: "Status" },
      ),
      h2("methods", "Metric methods and reference norms"),
      table(
        "methods-t",
        [
          ["Metric", "17%"],
          ["How it is measured", "37%"],
          ["Reference norm", "34%"],
          ["Sources", "12%"],
        ],
        Object.entries(METHODS).map(([k, m]) => [<b>{METHOD_NAMES[k] ?? k}</b>, <span className="rp-small">{m.how}</span>, <span className="rp-small">{m.norm}</span>, <span className="rp-small">{m.refs.map(shortCite).join("; ")}</span>]),
      ),
      h2("scores-n", "About the scores"),
      para("scores-p", SCORE_NOTE),
      h2("limits", "Limitations"),
      block(
        "limits-b",
        <ul className="rp-list">
          {LIMITATIONS.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>,
      ),
    ],
  };
}

/* ------------------------------------------------------------------ */
/*  Appendix A: marker definitions & sources                           */
/* ------------------------------------------------------------------ */

export function appendixChapter(c: ReportCtx): Chapter {
  const sex = c.profile.intake.gender;
  const regions = REGION_ORDER.filter((g) => c.catalog.some((r) => r.region === g));
  const KIND: Record<string, string> = { auto: "Automatic", semi: "Semi-automatic", review: "Reviewer-graded" };
  const rows = regions.flatMap((g) => [
    { key: `g-${g}`, group: true, cells: [<>{REGION_LABEL[g] ?? g}</>] },
    ...c.catalog
      .filter((r) => r.region === g)
      .map((r) => ({
        key: r.id,
        cells: [
          <>
            <b>{r.name}</b>
            <div className="rp-def">
              {KIND[r.methodKind] ?? r.methodKind} · {r.catalogue} catalogue
            </div>
            {r.photo && <div className="rp-def">Photo: {r.photo}</div>}
          </>,
          <p className="rp-appx">
            {(
              [
                ["Definition", r.definition],
                ["How measured", r.formula],
                ["Published norms", normText(r, sex)],
                ["By population", r.ethnicNorms],
                ["Research says", r.perception],
                ["Sources", r.sources],
              ] as [string, string | undefined][]
            )
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <span key={k}>
                  <em>{k}</em> {v}{" "}
                </span>
              ))}
          </p>,
        ],
      })),
  ]);
  return {
    id: "appendix",
    title: "Appendix A · Marker definitions",
    blocks: [
      title("Appendix A", "· Definitions & sources", `Definitions, measurement formulas, published norms (${sex === "female" ? "women" : "men"}), norms by population, perception research and sources for all ${c.catalog.length} catalogue markers.`),
      table(
        "appx-t",
        [
          ["Marker", "24%"],
          ["Definition, method, norms and sources", "76%"],
        ],
        rows,
        { className: "rp-appx-t" },
      ),
    ],
  };
}

