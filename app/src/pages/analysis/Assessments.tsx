import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { CaptureWarning } from "../../components/CaptureWarning";
import { FacePhoto, toPhoto } from "../../components/FacePhoto";
import { Doc, Info, ListIcon, Play, Search } from "../../components/icons";
import { MethodNote } from "../../components/MethodNote";
import { Kicker, PageHeader, SpectrumBar, Toggle } from "../../components/ui";
import { IDX, PAIRS } from "../../lib/faceAnalysis";
import { band, harmonyScore, impressionWords, traits } from "../../lib/report";
import type { FaceResult, Pt } from "../../lib/types";
import { faceCrop } from "./crop";
import { BROW_L, BROW_R, EYE_L, EYE_R, FACE_OVAL, LIPS_OUTER, MaskView, fmt, poly, pts } from "./faceViz";
import type { SectionProps } from "./types";
import "./analysis.css";

/* ------------------------------------------------------------------ */
/*  Shared "overview" layout (averageness screenshot)                  */
/* ------------------------------------------------------------------ */

interface OverviewProps {
  face: FaceResult;
  photo: string | null;
  kicker: string;
  muted: string;
  strong: string;
  lead: ReactNode;
  compareTag: string;
  figCaption: string;
  scoreLabel: string;
  score: number;
  scoreSuffix?: string;
  rangeTitle: string;
  rangeLabel: string;
  rangeValue: number;
  rangeLabels: [string, string] | [string, string, string];
  explanation: ReactNode;
  method: string;
  captureMetrics?: string[];
  overlay?: (mode: "face" | "mask") => ReactNode;
  extra?: ReactNode;
  experimental?: boolean;
}

function Overview(p: OverviewProps) {
  const [mode, setMode] = useState<"face" | "mask">("mask");
  const lm = p.face.landmarks;
  const crop = lm ? faceCrop(lm, p.face.imageAspect, 1.35, 0.85) : undefined;
  return (
    <div className="page">
      {p.captureMetrics && <CaptureWarning capture={p.face.capture} metrics={p.captureMetrics} />}
      <PageHeader
        kicker={p.kicker}
        muted={p.muted}
        strong={p.strong}
        lead={p.lead}
        right={
          lm ? (
            <Toggle
              value={mode}
              onChange={setMode}
              options={[
                { value: "face", label: "Face" },
                { value: "mask", label: "Mask" },
              ]}
            />
          ) : undefined
        }
      />
      <div className="ov-grid">
        <figure className="ov-fig">
          <div className="ov-fig-frame">
            {mode === "mask" && lm ? (
              <MaskView face={p.face} crop={crop}>
                {p.overlay?.("mask")}
              </MaskView>
            ) : (
              <FacePhoto src={p.photo} aspect={p.face.imageAspect} crop={crop} placeholderTone="slate">
                {lm && p.overlay?.("face")}
              </FacePhoto>
            )}
            <span className="ov-centre" />
            <span className="photo-tag ov-tag ov-tag-l">You</span>
            <span className="photo-tag ov-tag ov-tag-r">{p.compareTag}</span>
          </div>
          <figcaption className="fig-caption">
            <b>FIG 1</b> {p.figCaption}
          </figcaption>
        </figure>
        <div className="ov-side">
          <div className="ov-score">
            <div className="ov-score-glass">
              <div className="mono-sm ov-score-label">{p.scoreLabel}</div>
              <div className="ov-score-num">
                <span>{Math.round(p.score)}</span>
                <small>{p.scoreSuffix ?? "/100"}</small>
              </div>
            </div>
            <div className="ov-score-track">
              <div className="ov-track">
                {[20, 40, 60, 80].map((t) => (
                  <i key={t} style={{ left: `${t}%` }} />
                ))}
                <b style={{ left: `${Math.min(99, Math.max(1, p.score))}%` }} />
              </div>
              <div className="ov-track-labels mono-sm">
                <span>0</span>
                <span>100</span>
              </div>
            </div>
            <Info size={14} className="ov-info" />
          </div>
          <div className="ov-range">
            <div className="mono-sm ov-range-k">{p.rangeTitle}</div>
            <div className="title-md ov-range-label">
              {p.rangeLabel}
              {p.experimental && <span className="ov-exp">Experimental</span>}
            </div>
            <SpectrumBar value={p.rangeValue} labels={p.rangeLabels} />
          </div>
          <div className="ov-expl">
            <p>{p.explanation}</p>
            <Doc size={14} className="ov-doc" />
          </div>
        </div>
      </div>
      {p.extra}
      <MethodNote method={p.method} />
    </div>
  );
}

const typicalLabel = (v: number) => (v >= 82 ? "Very typical" : v >= 68 ? "Quite typical" : v >= 52 ? "Moderately distinctive" : "Distinctive");

/* Population means used for the averageness explanation (mirrors lib/faceAnalysis NORMS). */
const NORMS: { key: keyof FaceResult["metrics"]; label: string; mean: number; sd: number }[] = [
  { key: "faceWHR", label: "face width-to-height", mean: 0.86, sd: 0.06 },
  { key: "midToLowerThird", label: "middle-to-lower third", mean: 0.95, sd: 0.09 },
  { key: "lipChinRatio", label: "lip-to-chin height", mean: 0.5, sd: 0.08 },
  { key: "eyeSpacingRatio", label: "eye spacing", mean: 1.08, sd: 0.1 },
  { key: "eyeWidthToFace", label: "eye width", mean: 0.205, sd: 0.016 },
  { key: "noseWidthToIntercanthal", label: "nose width", mean: 1.05, sd: 0.12 },
  { key: "mouthToNoseWidth", label: "mouth-to-nose width", mean: 1.45, sd: 0.15 },
  { key: "lipRatio", label: "upper-to-lower lip", mean: 0.72, sd: 0.18 },
  { key: "jawToFaceWidth", label: "jaw width", mean: 0.8, sd: 0.06 },
  { key: "foreheadToFaceWidth", label: "forehead width", mean: 0.82, sd: 0.06 },
];

function deviations(face: FaceResult) {
  return NORMS.map((n) => ({ ...n, z: ((face.metrics[n.key] as number) - n.mean) / n.sd })).sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
}

/* ------------------------------------------------------------------ */
/*  Averageness                                                        */
/* ------------------------------------------------------------------ */

export function Averageness({ scan, facePhoto, profile }: SectionProps) {
  const face = scan.face!;
  const v = face.metrics.averageness;
  const dev = deviations(face);
  const close = dev.filter((d) => Math.abs(d.z) < 0.6).map((d) => d.label);
  const far = dev.slice(0, 2).filter((d) => Math.abs(d.z) >= 1);
  return (
    <Overview
      face={face}
      photo={facePhoto}
      kicker="Averageness"
      muted="An overview of"
      strong="your prototypicality"
      lead="Facial averageness is the degree to which a face resembles the mathematical average of a population's faces in its proportions and features."
      compareTag={`Average ${profile.intake.ethnicity || "adult"}`.slice(0, 28)}
      figCaption="Averageness comparison"
      scoreLabel="Averageness"
      score={v}
      rangeTitle="Averageness range"
      rangeLabel={typicalLabel(v)}
      rangeValue={v / 100}
      rangeLabels={["Unique", "Typical"]}
      captureMetrics={["averageness"]}
      method="averageness"
      explanation={
        <>
          {close.length > 0 && <>Your {close.slice(0, 3).join(", ")} sit close to population norms. </>}
          {far.length > 0 ? (
            <>
              The biggest departures are your {far.map((d) => `${d.label} (${d.z > 0 ? "above" : "below"} average)`).join(" and ")}, which give your face its distinctive character.
            </>
          ) : (
            <>No single ratio departs strongly from the reference — your proportions are close to the population prototype.</>
          )}{" "}
          Averaged faces tend to be rated attractive, but distinctive features are not a flaw.
        </>
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Dimorphism                                                         */
/* ------------------------------------------------------------------ */

export function Dimorphism({ scan, facePhoto, profile }: SectionProps) {
  const face = scan.face!;
  const m = face.metrics;
  const d = m.dimorphism;
  const label = d > 0.7 ? "Strongly masculine" : d > 0.55 ? "Moderately masculine" : d > 0.45 ? "Androgynous" : d > 0.3 ? "Moderately feminine" : "Strongly feminine";
  const cues = [
    { name: "Jaw width", masc: m.jawToFaceWidth > 0.8 },
    { name: "Brow-to-eye distance", masc: m.browEyeDistance < 0.75 },
    { name: "Facial width (fWHR)", masc: m.fWHR > 1.9 },
    { name: "Lip fullness", masc: m.lipFullness < 0.3 },
    { name: "Eye openness", masc: m.eyeAspect < 0.33 },
  ];
  return (
    <Overview
      face={face}
      photo={facePhoto}
      kicker="Dimorphism"
      muted="How your face reads on"
      strong="sexual dimorphism"
      lead="Sexual dimorphism describes shape features that differ on average between male and female faces, such as jaw width, brow height and lip fullness."
      compareTag={profile.intake.gender === "female" ? "Female reference" : "Male reference"}
      figCaption="Dimorphic feature map"
      scoreLabel="Masculinity index"
      score={d * 100}
      rangeTitle="Dimorphism range"
      rangeLabel={label}
      rangeValue={d}
      rangeLabels={["Feminine", "Androgynous", "Masculine"]}
      captureMetrics={["dimorphism"]}
      method="dimorphism"
      experimental
      overlay={() =>
        face.landmarks && (
          <g>
            {[[IDX.gonL, IDX.gonR], [IDX.zygL, IDX.zygR]].map(([a, b], i) => {
              const p = toPhoto(face.landmarks![a], face.imageAspect), q = toPhoto(face.landmarks![b], face.imageAspect);
              return <line key={i} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="#fff" strokeWidth={1.4} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />;
            })}
          </g>
        )
      }
      explanation={
        <>
          Cues reading masculine: {cues.filter((c) => c.masc).map((c) => c.name.toLowerCase()).join(", ") || "none"}. Cues reading feminine:{" "}
          {cues.filter((c) => !c.masc).map((c) => c.name.toLowerCase()).join(", ") || "none"}. This index combines several weak cues and is not calibrated against a
          rated sample, so treat it as descriptive. Facial hair is not measured.
        </>
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Symmetry                                                           */
/* ------------------------------------------------------------------ */

function SymmetryOverlay({ face }: { face: FaceResult }) {
  const lm = face.landmarks!;
  const a = face.imageAspect;
  const mids = [10, 9, 168, 6, 1, 2, 0, 17, 152].map((i) => toPhoto(lm[i], a));
  const midX = mids.reduce((s, p) => s + p[0], 0) / mids.length;
  return (
    <g>
      <polyline points={poly(mids)} fill="none" stroke="#fff" strokeWidth={1.2} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      {PAIRS.map(([i, j]) => {
        const p = toPhoto(lm[i], a), q = toPhoto(lm[j], a);
        const mirror: [number, number] = [2 * midX - q[0], q[1]];
        return (
          <g key={i}>
            <circle cx={p[0]} cy={p[1]} r={3} fill="#fff" />
            <circle cx={mirror[0]} cy={mirror[1]} r={3.6} fill="none" stroke="#2f3b40" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <line x1={p[0]} y1={p[1]} x2={mirror[0]} y2={mirror[1]} stroke="#2f3b40" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          </g>
        );
      })}
    </g>
  );
}

export function Symmetry({ scan, facePhoto }: SectionProps) {
  const face = scan.face!;
  const v = face.metrics.symmetry;
  return (
    <Overview
      face={face}
      photo={facePhoto}
      kicker="Symmetry"
      muted="How balanced is"
      strong="your face"
      lead="Bilateral symmetry compares matching points on the left and right side of your face after correcting for head tilt and turn."
      compareTag="Mirrored half"
      figCaption="Mirrored landmark pairs"
      scoreLabel="Symmetry"
      score={v}
      rangeTitle="Symmetry range"
      rangeLabel={v >= 88 ? "Highly symmetric" : v >= 78 ? "Quite symmetric" : v >= 65 ? "Moderately symmetric" : "Noticeably asymmetric"}
      rangeValue={v / 100}
      rangeLabels={["Asymmetric", "Symmetric"]}
      captureMetrics={["symmetry"]}
      method="symmetry"
      overlay={() => face.landmarks && <SymmetryOverlay face={face} />}
      explanation={
        <>
          White dots are landmarks on one side; rings show where the matching point on the other side lands when mirrored. Short connecting lines mean close
          agreement. Everyone has some asymmetry — scores above ~80 are typical of faces rated highly symmetric. Head pose was corrected (turn{" "}
          {Math.abs(face.capture?.yaw ?? 0).toFixed(0)}°, tilt {Math.abs(face.capture?.roll ?? 0).toFixed(0)}°).
        </>
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Neoteny                                                            */
/* ------------------------------------------------------------------ */

export function Neoteny({ scan, facePhoto }: SectionProps) {
  const face = scan.face!;
  const m = face.metrics;
  const v = m.neoteny;
  return (
    <Overview
      face={face}
      photo={facePhoto}
      kicker="Neoteny"
      muted="How youthful are"
      strong="your proportions"
      lead="Neoteny describes youthful facial proportions: relatively large eyes, a shorter lower face, a smaller nose and fuller lips."
      compareTag="Adult reference"
      figCaption="Neotenous proportions"
      scoreLabel="Neoteny"
      score={v}
      rangeTitle="Neoteny range"
      rangeLabel={v >= 75 ? "Very youthful" : v >= 58 ? "Youthful" : v >= 42 ? "Balanced" : "Mature"}
      rangeValue={v / 100}
      rangeLabels={["Mature", "Balanced", "Youthful"]}
      captureMetrics={["neoteny"]}
      method="neoteny"
      explanation={
        <>
          Eye width is {fmt(m.eyeWidthToFace * 100, 1)}% of face width (reference ≈ 20.5%), nose length {fmt(m.noseLengthToFace * 100, 0)}% of face height and lip
          height {fmt(m.lipFullness * 100, 0)}% of mouth width. Youthful proportions read as approachable; mature ones read as more authoritative — neither is
          better in itself.
        </>
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Adiposity                                                          */
/* ------------------------------------------------------------------ */

export function Adiposity({ scan, facePhoto, plan }: SectionProps) {
  const face = scan.face!;
  const v = face.metrics.adiposity;
  const bf = scan.body?.metrics.bodyFatEstimate;
  return (
    <Overview
      face={face}
      photo={facePhoto}
      kicker="Adiposity"
      muted="An estimate of"
      strong="your facial fullness"
      lead="Facial adiposity is the perceived amount of fat in the face. It tracks body fat closely and is one of the strongest cues to perceived health."
      compareTag="Lean reference"
      figCaption="Facial outline"
      scoreLabel="Facial adiposity"
      score={v}
      rangeTitle="Fullness range"
      rangeLabel={v >= 60 ? "Full" : v >= 42 ? "Moderate" : v >= 28 ? "Lean" : "Very lean"}
      rangeValue={v / 100}
      rangeLabels={["Lean", "Moderate", "Full"]}
      captureMetrics={["adiposity"]}
      method="adiposity"
      overlay={() =>
        face.landmarks && <polygon points={poly(pts(face.landmarks, FACE_OVAL, face.imageAspect))} fill="none" stroke="#fff" strokeWidth={1.4} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
      }
      explanation={
        <>
          Estimated from face width-to-height ({fmt(face.metrics.faceWHR)}) and cheek-to-jaw taper. {bf != null && <>Your body scan estimates ~{bf.toFixed(0)}% body fat. </>}
          {plan.targetBodyFat != null
            ? `Your plan targets ~${plan.targetBodyFat}% body fat, which reduces cheek and under-chin fullness and reveals more cheekbone and jaw definition.`
            : "Your fullness is already in a lean range."}
        </>
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Contrast                                                           */
/* ------------------------------------------------------------------ */

export function Contrast({ scan, facePhoto, profile }: SectionProps) {
  const face = scan.face!;
  const v = face.metrics.contrast;
  return (
    <Overview
      face={face}
      photo={facePhoto}
      kicker="Facial contrast"
      muted="The contrast of"
      strong="your features"
      lead="Facial contrast is the luminance difference between your brows, eyes and lips and the surrounding skin. It declines with age and is a cue to youth."
      compareTag="Measured regions"
      figCaption="Feature regions vs. skin"
      scoreLabel="Contrast"
      score={v}
      rangeTitle="Contrast range"
      rangeLabel={v >= 75 ? "High contrast" : v >= 50 ? "Moderate contrast" : "Low contrast"}
      rangeValue={v / 100}
      rangeLabels={["Low", "Moderate", "High"]}
      method="contrast"
      overlay={() =>
        face.landmarks && (
          <g>
            {[BROW_L, BROW_R, EYE_L, EYE_R, LIPS_OUTER].map((g, i) => (
              <polygon key={i} points={poly(pts(face.landmarks!, g, face.imageAspect))} fill="rgba(255,255,255,.28)" stroke="#fff" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
        )
      }
      explanation={
        <>
          Highlighted regions were compared with your cheek skin in CIELAB luminance. Dark brows and lashes raise contrast; {profile.intake.gender === "female" ? "makeup on eyes and lips exaggerates it, " : ""}
          sun damage and uneven tone lower it. Contrast depends on lighting, so compare check-ins taken in the same set-up.
        </>
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Proportions                                                        */
/* ------------------------------------------------------------------ */

const RATIOS: { key: keyof FaceResult["metrics"]; label: string; norm: number; lo: number; hi: number; labels: [string, string, string]; note: string }[] = [
  { key: "midToLowerThird", label: "Middle : lower third", norm: 1, lo: 0.75, hi: 1.25, labels: ["Long lower", "Equal", "Long middle"], note: "Classical canon: equal thirds" },
  { key: "lipChinRatio", label: "Upper lip : chin height", norm: 0.5, lo: 0.3, hi: 0.7, labels: ["Short lip", "1 : 2", "Long lip"], note: "Ideal ≈ 1 : 2" },
  { key: "eyeSpacingRatio", label: "Eye spacing : eye width", norm: 1.05, lo: 0.8, hi: 1.3, labels: ["Close-set", "≈ 1 eye", "Wide-set"], note: "Rule of fifths ≈ 1" },
  { key: "eyeWidthToFace", label: "Eye width : face width", norm: 0.205, lo: 0.17, hi: 0.24, labels: ["Small", "≈ 1/5", "Large"], note: "Rule of fifths ≈ 0.2" },
  { key: "noseWidthToIntercanthal", label: "Nose : eye spacing", norm: 1.05, lo: 0.8, hi: 1.4, labels: ["Narrow", "≈ 1", "Wide"], note: "Farkas norm ≈ 1" },
  { key: "mouthToNoseWidth", label: "Mouth : nose width", norm: 1.5, lo: 1.1, hi: 1.9, labels: ["Narrow", "≈ 1.5", "Wide"], note: "Neoclassical ≈ 1.5" },
];

export function Proportions({ scan, facePhoto }: SectionProps) {
  const face = scan.face!;
  const lm = face.landmarks;
  const a = face.imageAspect;
  const crop = lm ? faceCrop(lm, a, 1.25, 0.85) : undefined;
  const score = harmonyScore(face);
  return (
    <div className="page">
      <CaptureWarning capture={face.capture} metrics={["noseWidthToIntercanthal", "mouthToNoseWidth", "midToLowerThird", "lipChinRatio"]} />
      <PageHeader kicker="Proportions" muted="The proportions of" strong="your face" lead="Classical thirds and fifths compared with anthropometric norms. Proportions are descriptive — attractive faces vary widely." />
      <div className="ov-grid">
        <figure className="ov-fig">
          <div className="ov-fig-frame">
            <FacePhoto src={facePhoto} aspect={a} crop={crop} placeholderTone="slate">
              {lm && <ThirdsFifths lm={lm} aspect={a} />}
            </FacePhoto>
          </div>
          <figcaption className="fig-caption">
            <b>FIG 1</b> Thirds and fifths
          </figcaption>
        </figure>
        <div className="ov-side">
          <div className="ov-range">
            <div className="mono-sm ov-range-k">Proportional harmony</div>
            <div className="prop-score">
              <span>{Math.round(score)}</span>
              <small>/100 · {band(score)}</small>
            </div>
          </div>
          <div className="prop-rows">
            {RATIOS.map((r) => {
              const v = face.metrics[r.key] as number;
              return (
                <div key={r.key} className="prop-row">
                  <div className="prop-row-top">
                    <span>{r.label}</span>
                    <span className="prop-val">
                      {fmt(v)} <small>{r.note}</small>
                    </span>
                  </div>
                  <SpectrumBar value={(v - r.lo) / (r.hi - r.lo)} labels={r.labels} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <MethodNote method="proportions" />
    </div>
  );
}

function ThirdsFifths({ lm, aspect }: { lm: Pt[]; aspect: number }) {
  const P = (i: number) => toPhoto(lm[i], aspect);
  const xL = P(IDX.zygL)[0], xR = P(IDX.zygR)[0];
  const ys = [IDX.top, IDX.glabella, IDX.subnasale, IDX.menton].map((i) => P(i)[1]);
  const xs = [IDX.zygL, IDX.eyeL.outer, IDX.eyeL.inner, IDX.eyeR.inner, IDX.eyeR.outer, IDX.zygR].map((i) => P(i)[0]);
  const yT = ys[0], yB = ys[3];
  return (
    <g>
      {ys.map((y, i) => (
        <line key={`h${i}`} x1={xL - 30} x2={xR + 30} y1={y} y2={y} stroke="#fff" strokeWidth={1.2} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
      ))}
      {xs.map((x, i) => (
        <line key={`v${i}`} x1={x} x2={x} y1={yT - 10} y2={yB + 10} stroke="#fff" strokeOpacity={0.7} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      ))}
      {["II", "III"].map((t, i) => (
        <text key={t} x={xR + 36} y={(ys[i + 1] + ys[i + 2]) / 2} fill="#fff" fontSize={11} fontFamily="JetBrains Mono" dominantBaseline="middle">
          {t}
        </text>
      ))}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/*  Face shape                                                         */
/* ------------------------------------------------------------------ */

const SHAPE_TEXT: Record<FaceResult["faceShape"], string> = {
  Oval: "Length slightly exceeds width, with a forehead a little wider than the jaw and softly rounded contours. Oval faces suit most hairstyles.",
  Round: "Width and length are similar with soft, curved contours. Height on top and tidier sides visually lengthen the face.",
  Square: "A broad, angular jaw roughly as wide as the cheekbones. Softer textures on top balance the strong jaw line.",
  Heart: "A wider forehead and cheekbones tapering to a narrower chin. Some volume at jaw level (beard or hair length) balances the taper.",
  Oblong: "Length clearly exceeds width with fairly straight sides. Keeping some width at the sides and avoiding extra height balances length.",
  Diamond: "Cheekbones are the widest point, with a narrower forehead and jaw. Fringe or fuller sides at the temples balance the cheekbones.",
};

export function FaceShape({ scan, facePhoto }: SectionProps) {
  const face = scan.face!;
  const m = face.metrics;
  const lm = face.landmarks;
  const a = face.imageAspect;
  const crop = lm ? faceCrop(lm, a, 1.3, 0.85) : undefined;
  return (
    <div className="page">
      <CaptureWarning capture={face.capture} metrics={["faceWHR"]} />
      <PageHeader kicker="Face shape" muted="The shape of" strong="your face" lead="Face shape is classified from the ratios of face width, height, forehead, cheekbone and jaw widths." />
      <div className="ov-grid">
        <figure className="ov-fig">
          <div className="ov-fig-frame">
            <FacePhoto src={facePhoto} aspect={a} crop={crop} placeholderTone="slate">
              {lm && (
                <g>
                  <polygon points={poly(pts(lm, FACE_OVAL, a))} fill="rgba(255,255,255,.1)" stroke="#fff" strokeWidth={1.6} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
                  {[[IDX.templeL, IDX.templeR], [IDX.zygL, IDX.zygR], [IDX.gonL, IDX.gonR]].map(([i, j], k) => {
                    const p = toPhoto(lm[i], a), q = toPhoto(lm[j], a);
                    return <line key={k} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="#fff" strokeWidth={1} strokeOpacity={0.8} vectorEffect="non-scaling-stroke" />;
                  })}
                </g>
              )}
            </FacePhoto>
          </div>
          <figcaption className="fig-caption">
            <b>FIG 1</b> Face outline
          </figcaption>
        </figure>
        <div className="ov-side">
          <div className="fs-type">
            <div className="mono-sm">Classified shape</div>
            <div className="fs-name">{face.faceShape}</div>
          </div>
          <div className="fv-attrs">
            {[
              ["Width : height", fmt(m.faceWHR)],
              ["Jaw : cheek width", fmt(m.jawToFaceWidth)],
              ["Forehead : cheek", fmt(m.foreheadToFaceWidth)],
              ["Chin : mouth width", fmt(m.chinWidthToMouth)],
            ].map(([l, v], i) => (
              <div key={l} className="fv-attr">
                <div className="mono-sm">
                  {l} [{i}]
                </div>
                <div className="fv-attr-value">{v}</div>
              </div>
            ))}
          </div>
          <div className="ov-expl">
            <p>{SHAPE_TEXT[face.faceShape]}</p>
          </div>
        </div>
      </div>
      <MethodNote method="proportions" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  First impression                                                   */
/* ------------------------------------------------------------------ */

const HOTSPOTS: { id: number; label: string }[] = [
  { id: 151, label: "Forehead · openness" },
  { id: 105, label: "Brow height · trust" },
  { id: 334, label: "Brow height · trust" },
  { id: 33, label: "Eye shape · confidence" },
  { id: 263, label: "Eye shape · confidence" },
  { id: 1, label: "Nose · harmony" },
  { id: 61, label: "Mouth corners · warmth" },
  { id: 291, label: "Mouth corners · warmth" },
  { id: 152, label: "Chin · dominance" },
  { id: 172, label: "Jaw width · dominance" },
  { id: 397, label: "Jaw width · dominance" },
];

export function FirstImpression({ scan, facePhoto, plan }: SectionProps) {
  const face = scan.face!;
  const lm = face.landmarks;
  const a = face.imageAspect;
  const t = traits(face);
  const words = impressionWords(t);
  const [hover, setHover] = useState<string | null>(null);
  const crop = lm ? faceCrop(lm, a, 1.6, 1.35) : undefined;
  const top = plan.items.slice(0, 3);
  const strongest = [...t].sort((x, y) => Math.abs(y.value - 0.5) - Math.abs(x.value - 0.5))[0];
  return (
    <div className="page">
      <div className="fi-head">
        <div>
          <Kicker>First impression</Kicker>
          <h1 className="title-lg fi-title">First impression of your face</h1>
          <p className="lead">This section outlines the immediate impression your facial features create and how your face is perceived at first glance.</p>
        </div>
        <a className="fi-why" href="#fi-method">
          Why first impression matters? <Play size={14} />
        </a>
      </div>

      <div className="fi-hero">
        <div className="fi-photo">
          <FacePhoto src={facePhoto} aspect={a} crop={crop} placeholderTone="slate">
            {lm &&
              HOTSPOTS.map((h, i) => {
                const p = toPhoto(lm[h.id], a);
                return (
                  <g key={i} onMouseEnter={() => setHover(h.label)} onMouseLeave={() => setHover(null)} onClick={() => setHover(h.label)} style={{ cursor: "pointer" }}>
                    <circle cx={p[0]} cy={p[1]} r={9} fill="rgba(255,255,255,.25)" />
                    <circle cx={p[0]} cy={p[1]} r={3.5} fill="#fff" />
                  </g>
                );
              })}
          </FacePhoto>
          <span className="fi-tip">{hover ?? "Click/Hover here"}</span>
        </div>
        <div className="fi-panel">
          <span className="fi-grip" />
          <div className="fi-pills">
            {words.map((w) => (
              <span key={w.word} className={`fi-pill ${w.on ? "on" : ""}`}>
                {w.word}
              </span>
            ))}
          </div>
        </div>
      </div>

      <section className="fi-social">
        <h2 className="title-md">Social perception of your face</h2>
        <p className="lead">Facial characteristics are known to play a role in shaping first impressions in social settings.</p>
        <div className="fi-rows">
          {t.map((x) => (
            <div key={x.key} className="fi-row">
              <div className="fi-row-l">
                <div className="fi-row-name">{x.name}</div>
                <div>
                  <div className="mono-sm">Features involved</div>
                  <div className="fi-chips">
                    {x.features.map((f) => (
                      <span key={f} className="chip">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="fi-row-r">
                <p>{x.text}</p>
                <SpectrumBar value={x.value} labels={x.axis} />
              </div>
              <Doc size={14} className="fi-doc" />
            </div>
          ))}
        </div>
      </section>

      <section className="fi-summary">
        <div className="mono-sm fi-sum-k">Summary</div>
        <h2 className="title-md">Summary of your first impression</h2>
        <div className="fi-sum-block">
          <div className="mono-sm">
            <Search size={12} /> Observation
          </div>
          <p>
            Your face reads most strongly on <b>{strongest.name.replace(" index", "").toLowerCase()}</b> ({strongest.value > 0.5 ? strongest.axis[strongest.axis.length - 1] : strongest.axis[0]}).
            {plan.drivers.length > 0 && <> Measured drivers to work on: {plan.drivers.join(", ").toLowerCase()}.</>}
          </p>
        </div>
        <div className="fi-sum-block">
          <div className="mono-sm">
            <Doc size={12} /> Takeaway
          </div>
          <p>
            Bone structure sets the baseline, but skin clarity, a rested eye area, facial leanness and a relaxed genuine smile measurably shift how warm, healthy and
            confident a face is judged.
          </p>
        </div>
        <div className="fi-sum-block">
          <div className="mono-sm">
            <ListIcon size={12} /> Actions
          </div>
          <ul className="bullets">
            {top.map((i) => (
              <li key={i.id}>
                <Link to="/analysis/recommendations">{i.title}</Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <div id="fi-method">
        <MethodNote method="impression" />
      </div>
    </div>
  );
}
