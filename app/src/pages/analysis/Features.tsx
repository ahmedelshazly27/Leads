import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CaptureWarning } from "../../components/CaptureWarning";
import { FacePhoto, toPhoto } from "../../components/FacePhoto";
import { MethodNote } from "../../components/MethodNote";
import { PageHeader } from "../../components/ui";
import { IDX } from "../../lib/faceAnalysis";
import { regionOf } from "../../lib/report";
import type { FaceResult } from "../../lib/types";
import { browType } from "./Eyebrows";
import { FeatureView } from "./FeatureView";
import {
  BROW_L,
  BROW_R,
  CHIN,
  ContourDiagram,
  ContourOverlay,
  EYE_L,
  EYE_R,
  JAW,
  LIPS_INNER,
  LIPS_OUTER,
  MeasureLine,
  NOSE,
  NOSE_BASE,
  deg,
  fmt,
  regionCrop,
} from "./faceViz";
import type { SectionProps } from "./types";
import "./analysis.css";

/* ------------------------------------------------------------------ */
/*  Classification helpers (shared with the summary)                   */
/* ------------------------------------------------------------------ */

const eyeType = (m: FaceResult["metrics"]) =>
  m.canthalTilt > 4 ? "Positive Canthal Tilt" : m.canthalTilt > 0.5 ? "Mild Positive Tilt" : m.canthalTilt > -2 ? "Neutral Tilt" : "Negative Canthal Tilt";
const noseType = (m: FaceResult["metrics"]) => (m.noseWidthToIntercanthal > 1.2 ? "Wide Base" : m.noseWidthToIntercanthal < 0.92 ? "Narrow Base" : "Balanced Width");
const lipType = (m: FaceResult["metrics"]) => (m.lipFullness > 0.38 ? "Full Lips" : m.lipFullness > 0.29 ? "Medium Fullness" : "Thin Lips");
const cheekType = (m: FaceResult["metrics"]) => (m.adiposity < 35 ? "Defined Cheekbones" : m.adiposity < 55 ? "Soft Definition" : "Full Cheeks");
const jawType = (m: FaceResult["metrics"]) => (m.jawToFaceWidth > 0.86 ? "Broad Jaw" : m.jawToFaceWidth > 0.77 ? "Moderate Jaw" : "Tapered Jaw");
const chinType = (m: FaceResult["metrics"]) => (m.chinWidthToMouth > 0.62 ? "Broad Chin" : m.chinWidthToMouth > 0.44 ? "Balanced Chin" : "Narrow Chin");

function photoFor(face: FaceResult, photo: string | null, ids: number[], pad: number, overlay: (lm: NonNullable<FaceResult["landmarks"]>) => ReactNode) {
  const lm = face.landmarks;
  return (
    <FacePhoto src={photo} aspect={face.imageAspect} crop={lm ? regionCrop(lm, ids, face.imageAspect, pad, 0.78) : undefined}>
      {lm && overlay(lm)}
    </FacePhoto>
  );
}

/* ------------------------------------------------------------------ */
/*  Eyes                                                               */
/* ------------------------------------------------------------------ */

export function Eyes({ scan, facePhoto }: SectionProps) {
  const face = scan.face!;
  const m = face.metrics;
  const shape = m.eyeAspect < 0.28 ? "Narrow / Hooded" : m.eyeAspect < 0.35 ? "Almond" : "Round";
  const spacing = m.eyeSpacingRatio < 0.95 ? "Close-Set" : m.eyeSpacingRatio > 1.18 ? "Wide-Set" : "Balanced Spacing";
  const size = m.eyeWidthToFace > 0.215 ? "Large" : m.eyeWidthToFace < 0.19 ? "Small" : "Proportionate";
  const ue = regionOf(face, "underEye");
  return (
    <FeatureView
      title="Your eye"
      highlight="shape"
      lead={
        <>
          The eye area carries most of the cues people read for <b>alertness</b>, warmth and fatigue.
        </>
      }
      photo={photoFor(face, facePhoto, [...EYE_L, ...EYE_R, ...BROW_L, ...BROW_R], 1.25, (lm) => (
        <g>
          <ContourOverlay lm={lm} aspect={face.imageAspect} groups={[EYE_L, EYE_R]} />
          <MeasureLine lm={lm} aspect={face.imageAspect} a={IDX.eyeL.outer} b={IDX.eyeL.inner} />
          <MeasureLine lm={lm} aspect={face.imageAspect} a={IDX.eyeR.inner} b={IDX.eyeR.outer} />
        </g>
      ))}
      diagram={<ContourDiagram face={face} groups={[EYE_L, EYE_R]} lines={[[IDX.eyeL.outer, IDX.eyeL.inner], [IDX.eyeR.inner, IDX.eyeR.outer]]} />}
      typeLabel={eyeType(m)}
      attrs={[
        { label: "Canthal tilt", value: deg(m.canthalTilt) },
        { label: "Eye shape", value: shape },
        { label: "Eye spacing", value: `${spacing} · ${fmt(m.eyeSpacingRatio)}` },
        { label: "Eye size", value: `${size} · ${fmt(m.eyeWidthToFace * 100, 1)}%` },
      ]}
      explanation={
        <>
          Your outer eye corners sit <b>{Math.abs(m.canthalTilt).toFixed(1)}° {m.canthalTilt >= 0 ? "above" : "below"}</b> the inner corners — a mildly positive tilt (+2° to +6°)
          is most often rated attractive. Eye height is {fmt(m.eyeAspect * 100, 0)}% of eye width
          {m.eyeAspect < 0.3 ? ", so the lids sit relatively low; sleep and reduced puffiness open the eye area." : "."}
          {ue && ue.coverage > 0.06 && <> Under-eye discolouration covers {(ue.coverage * 100).toFixed(1)}% of that area.</>}
        </>
      }
      method="canthal"
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Nose                                                               */
/* ------------------------------------------------------------------ */

export function Nose({ scan, facePhoto }: SectionProps) {
  const face = scan.face!;
  const m = face.metrics;
  const lm = face.landmarks;
  const len = m.noseLengthToFace > 0.34 ? "Long" : m.noseLengthToFace < 0.29 ? "Short" : "Proportional";
  let deviation = "—";
  if (lm) {
    const mid = [10, 9, 168, 152].reduce((s, i) => s + lm[i][0], 0) / 4;
    const off = (lm[IDX.noseTip][0] - mid) / Math.abs(lm[IDX.zygR][0] - lm[IDX.zygL][0]);
    deviation = Math.abs(off) < 0.035 ? "Straight" : `${off > 0 ? "Right" : "Left"} of midline`;
  }
  const close = face.capture?.closeRange;
  return (
    <FeatureView
      title="Your nose"
      highlight="proportions"
      lead={
        <>
          The nose sits at the centre of the face, so its <b>width</b> relative to the eyes strongly affects overall harmony.
        </>
      }
      photo={photoFor(face, facePhoto, [...NOSE, ...NOSE_BASE, IDX.eyeL.inner, IDX.eyeR.inner], 2.5, (l) => (
        <g>
          <ContourOverlay lm={l} aspect={face.imageAspect} groups={[NOSE]} closed={false} />
          <MeasureLine lm={l} aspect={face.imageAspect} a={129} b={358} label="ALAR" />
          <MeasureLine lm={l} aspect={face.imageAspect} a={IDX.eyeL.inner} b={IDX.eyeR.inner} label="INTERCANTHAL" />
        </g>
      ))}
      diagram={<ContourDiagram face={face} groups={[NOSE, NOSE_BASE]} closed={false} lines={[[129, 358], [IDX.eyeL.inner, IDX.eyeR.inner]]} />}
      typeLabel={noseType(m)}
      attrs={[
        { label: "Alar : intercanthal", value: `${fmt(m.noseWidthToIntercanthal)}${close ? " *" : ""}` },
        { label: "Nose length", value: `${len} · ${fmt(m.noseLengthToFace * 100, 0)}%` },
        { label: "Mouth : nose width", value: fmt(m.mouthToNoseWidth) },
        { label: "Midline", value: deviation },
      ]}
      explanation={
        <>
          Your nose base is <b>{fmt(m.noseWidthToIntercanthal)}×</b> the distance between your inner eye corners (anthropometric norm ≈ 1.0).
          {close && (
            <>
              {" "}
              * This photo looks like a close-range selfie, which makes the nose appear ~30% wider than at 1.5 m (Ward et al. 2018) — retake from further away for an
              accurate width.
            </>
          )}{" "}
          Projection and bridge shape need a side profile and aren't measured here.
        </>
      }
      method="proportions"
      banner={<CaptureWarning capture={face.capture} metrics={["noseWidthToIntercanthal", "mouthToNoseWidth"]} />}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Lips                                                               */
/* ------------------------------------------------------------------ */

export function Lips({ scan, facePhoto }: SectionProps) {
  const face = scan.face!;
  const m = face.metrics;
  const corners = m.mouthCornerTilt > 1 ? "Upturned" : m.mouthCornerTilt < -1 ? "Downturned" : "Neutral";
  return (
    <FeatureView
      title="Your lip"
      highlight="balance"
      lead={
        <>
          Lip fullness and the angle of the mouth corners shape how <b>warm</b> a face looks at rest.
        </>
      }
      photo={photoFor(face, facePhoto, [...LIPS_OUTER, 2, 152], 1.9, (lm) => <ContourOverlay lm={lm} aspect={face.imageAspect} groups={[LIPS_OUTER, LIPS_INNER]} />)}
      diagram={<ContourDiagram face={face} groups={[LIPS_OUTER, LIPS_INNER]} />}
      typeLabel={lipType(m)}
      attrs={[
        { label: "Upper : lower lip", value: `1 : ${(1 / Math.max(0.05, m.lipRatio)).toFixed(2)}` },
        { label: "Mouth corners", value: `${corners} · ${deg(m.mouthCornerTilt)}` },
        { label: "Fullness", value: `${fmt(m.lipFullness * 100, 0)}% of width` },
        { label: "Upper lip : chin", value: `1 : ${(1 / Math.max(0.05, m.lipChinRatio)).toFixed(2)}` },
      ]}
      explanation={
        <>
          Your upper lip is <b>{fmt(m.lipRatio)}×</b> the height of your lower lip; a ratio near 1 : 2 was rated most attractive in a quantitative study of female faces.
          Mouth corners are {corners.toLowerCase()} at rest{m.mouthCornerTilt < -1 ? ", which can read as serious — a relaxed, slight smile shifts warmth judgements most" : ""}.
          Lip hydration and an even lip line are the realistic levers here.
        </>
      }
      method="lips"
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Cheeks                                                             */
/* ------------------------------------------------------------------ */

export function Cheeks({ scan, facePhoto, plan }: SectionProps) {
  const face = scan.face!;
  const m = face.metrics;
  const l = regionOf(face, "leftCheek");
  const r = regionOf(face, "rightCheek");
  const ev = l && r ? (l.evenness + r.evenness) / 2 : null;
  return (
    <FeatureView
      title="Your cheek"
      highlight="structure"
      lead={
        <>
          Cheekbone visibility depends mostly on <b>facial fat</b>, which sits over the bone and softens its outline.
        </>
      }
      photo={photoFor(face, facePhoto, [IDX.zygL, IDX.zygR, IDX.top, IDX.menton], 1.05, (lm) => (
        <g>
          {[...(l?.polygons ?? []), ...(r?.polygons ?? [])].map((p, i) => (
            <polygon
              key={i}
              points={p.map((q) => toPhoto(q, face.imageAspect).join(",")).join(" ")}
              fill="rgba(255,255,255,.14)"
              stroke="#fff"
              strokeWidth={1.2}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <MeasureLine lm={lm} aspect={face.imageAspect} a={IDX.zygL} b={IDX.zygR} label="BIZYGOMATIC" />
        </g>
      ))}
      diagram={<ContourDiagram face={face} groups={[JAW]} closed={false} lines={[[IDX.zygL, IDX.zygR], [IDX.gonL, IDX.gonR]]} />}
      typeLabel={face.capture?.closeRange ? "Retake for fullness" : cheekType(m)}
      attrs={[
        { label: "Width : height", value: fmt(m.faceWHR) },
        { label: "Cheek : jaw taper", value: fmt(1 / Math.max(0.1, m.jawToFaceWidth)) },
        { label: "Facial fullness", value: face.capture?.closeRange ? `${Math.round(m.adiposity)}/100 *` : `${Math.round(m.adiposity)}/100` },
        { label: "Cheek skin evenness", value: ev != null ? `${Math.round(ev)}/100` : "—" },
      ]}
      explanation={
        <>
          Your cheekbones are the widest point of the face, {fmt(1 / Math.max(0.1, m.jawToFaceWidth))}× your jaw width.{" "}
          {face.capture?.closeRange && "* A close-range selfie makes the face look narrower, so facial fullness reads lower than it is. "}
          {plan.targetBodyFat != null
            ? `Reducing body fat toward ~${plan.targetBodyFat}% is the evidence-backed way to make them more visible — fat loss reveals bone structure, it doesn't change it.`
            : "Your facial fullness is already lean, so the bone outline reads clearly."}
        </>
      }
      method="adiposity"
      banner={<CaptureWarning capture={face.capture} metrics={["faceWHR", "adiposity"]} />}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Jaw                                                                */
/* ------------------------------------------------------------------ */

export function Jaw({ scan, facePhoto, profile }: SectionProps) {
  const face = scan.face!;
  const m = face.metrics;
  const def = m.adiposity < 35 ? "Sharp" : m.adiposity < 55 ? "Moderate" : "Soft";
  return (
    <FeatureView
      title="Your jaw"
      highlight="line"
      lead={
        <>
          Jaw width and definition are central cues to <b>dominance</b> and masculinity, and to perceived leanness.
        </>
      }
      photo={photoFor(face, facePhoto, [...JAW, IDX.noseTip], 1.15, (lm) => (
        <g>
          <ContourOverlay lm={lm} aspect={face.imageAspect} groups={[JAW]} closed={false} />
          <MeasureLine lm={lm} aspect={face.imageAspect} a={IDX.gonL} b={IDX.gonR} label="BIGONIAL" />
        </g>
      ))}
      diagram={<ContourDiagram face={face} groups={[JAW]} closed={false} lines={[[IDX.gonL, IDX.gonR]]} />}
      typeLabel={jawType(m)}
      attrs={[
        { label: "Jaw : cheek width", value: fmt(m.jawToFaceWidth) },
        { label: "fWHR", value: fmt(m.fWHR) },
        { label: "Definition", value: def },
        { label: "Lower third share", value: `${fmt(100 / (1 + m.midToLowerThird), 0)}%` },
      ]}
      explanation={
        <>
          Your jaw is <b>{fmt(m.jawToFaceWidth * 100, 0)}%</b> of your cheekbone width; typical adult values are 75–85%. Definition reads {def.toLowerCase()} — lower facial fat
          sharpens the edge and angle without changing width.
          {profile.intake.gender === "male" && " A beard can hide or exaggerate the jawline in photos, so landmarks under facial hair are less precise."} Exercises, gum and mewing
          have no evidence for changing adult jaw bone.
        </>
      }
      method="fwhr"
      banner={<CaptureWarning capture={face.capture} metrics={["fWHR"]} />}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Chin                                                               */
/* ------------------------------------------------------------------ */

export function Chin({ scan, facePhoto }: SectionProps) {
  const face = scan.face!;
  const m = face.metrics;
  const height = 1 / Math.max(0.05, m.lipChinRatio);
  return (
    <FeatureView
      title="Your chin"
      highlight="shape"
      lead={
        <>
          The chin anchors the lower third; its <b>height and width</b> balance the mouth and jaw.
        </>
      }
      photo={photoFor(face, facePhoto, [...CHIN, ...LIPS_OUTER], 1.5, (lm) => (
        <g>
          <ContourOverlay lm={lm} aspect={face.imageAspect} groups={[CHIN]} closed={false} />
          <MeasureLine lm={lm} aspect={face.imageAspect} a={IDX.chinL} b={IDX.chinR} />
          <MeasureLine lm={lm} aspect={face.imageAspect} a={IDX.lowerLipInner} b={IDX.menton} />
        </g>
      ))}
      diagram={<ContourDiagram face={face} groups={[CHIN]} closed={false} lines={[[IDX.chinL, IDX.chinR], [IDX.lowerLipInner, IDX.menton]]} />}
      typeLabel={chinType(m)}
      attrs={[
        { label: "Chin : mouth width", value: fmt(m.chinWidthToMouth) },
        { label: "Lip : chin height", value: `1 : ${height.toFixed(2)}` },
        { label: "Chin height", value: height > 2.3 ? "Tall" : height < 1.7 ? "Short" : "Proportionate" },
        { label: "Projection", value: "Needs side profile" },
      ]}
      explanation={
        <>
          Your chin (lower lip to menton) is <b>{height.toFixed(2)}×</b> the height of your upper lip — the classical proportion is about 2×. Its width is{" "}
          {fmt(m.chinWidthToMouth * 100, 0)}% of mouth width. Forward projection, the main driver of a strong chin in profile, requires a side photo.
        </>
      }
      method="proportions"
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Summary of facial analysis                                         */
/* ------------------------------------------------------------------ */

export function FeaturesSummary({ scan, facePhoto }: SectionProps) {
  const face = scan.face!;
  const m = face.metrics;
  const lm = face.landmarks;
  const a = face.imageAspect;
  const cards: { to: string; name: string; type: string; ids: number[]; pad: number }[] = [
    { to: "eyebrows", name: "Eyebrows", type: browType(m.browArch), ids: [...BROW_L, ...BROW_R], pad: 1.2 },
    { to: "eyes", name: "Eyes", type: eyeType(m), ids: [...EYE_L, ...EYE_R], pad: 1.15 },
    { to: "nose", name: "Nose", type: noseType(m), ids: [...NOSE, ...NOSE_BASE], pad: 1.5 },
    { to: "lips", name: "Lips", type: lipType(m), ids: LIPS_OUTER, pad: 1.5 },
    { to: "cheeks", name: "Cheeks", type: face.capture?.closeRange ? "Retake for fullness" : cheekType(m), ids: [IDX.zygL, IDX.zygR, IDX.noseTip], pad: 1.1 },
    { to: "jaw", name: "Jaw", type: jawType(m), ids: JAW, pad: 1.1 },
    { to: "chin", name: "Chin", type: chinType(m), ids: CHIN, pad: 1.5 },
    { to: "skin", name: "Skin", type: `${Math.round(m.skinScore)}/100`, ids: [IDX.zygL, IDX.zygR, IDX.top, IDX.menton], pad: 1 },
  ];
  const rows: { name: string; v: string; norm: string; ok: boolean }[] = [
    { name: "Canthal tilt", v: deg(m.canthalTilt), norm: "+2° to +6°", ok: m.canthalTilt >= 0 },
    { name: "Eye spacing : eye width", v: fmt(m.eyeSpacingRatio), norm: "≈ 1.0", ok: Math.abs(m.eyeSpacingRatio - 1.05) < 0.15 },
    { name: "Nose : intercanthal width", v: fmt(m.noseWidthToIntercanthal), norm: "≈ 1.0", ok: Math.abs(m.noseWidthToIntercanthal - 1.05) < 0.15 },
    { name: "Mouth : nose width", v: fmt(m.mouthToNoseWidth), norm: "≈ 1.5", ok: Math.abs(m.mouthToNoseWidth - 1.5) < 0.2 },
    { name: "Upper : lower lip", v: fmt(m.lipRatio), norm: "≈ 0.5–0.7", ok: m.lipRatio > 0.45 && m.lipRatio < 0.8 },
    { name: "Upper lip : chin", v: fmt(m.lipChinRatio), norm: "≈ 0.5", ok: Math.abs(m.lipChinRatio - 0.5) < 0.1 },
    { name: "Middle : lower third", v: fmt(m.midToLowerThird), norm: "≈ 1.0", ok: Math.abs(m.midToLowerThird - 1) < 0.12 },
    { name: "Jaw : cheek width", v: fmt(m.jawToFaceWidth), norm: "0.75–0.85", ok: m.jawToFaceWidth > 0.74 && m.jawToFaceWidth < 0.88 },
    { name: "fWHR", v: fmt(m.fWHR), norm: "1.7–2.1", ok: m.fWHR > 1.7 && m.fWHR < 2.1 },
    { name: "Symmetry", v: `${Math.round(m.symmetry)}/100`, norm: "> 80", ok: m.symmetry > 80 },
  ];
  return (
    <div className="page">
      <CaptureWarning capture={face.capture} />
      <PageHeader kicker="Summary" muted="Summary of" strong="your facial analysis" lead="Every feature at a glance. Open a card for the full breakdown and the research behind it." />
      <div className="fsum-grid">
        {cards.map((c) => (
          <Link key={c.to} to={`/analysis/${c.to}`} className="fsum-card">
            <div className="fsum-thumb">
              <FacePhoto src={facePhoto} aspect={a} crop={lm ? regionCrop(lm, c.ids, a, c.pad, 1.25) : undefined} />
            </div>
            <div className="fsum-meta">
              <span className="mono-sm">{c.name}</span>
              <b>{c.type}</b>
            </div>
          </Link>
        ))}
      </div>
      <table className="mtable">
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
              <td>{r.name}</td>
              <td className="num">{r.v}</td>
              <td className="num">{r.norm}</td>
              <td>
                <span className={`status-dot ${r.ok ? "" : "off"}`} />
                {r.ok ? "Within range" : "Outside range"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <MethodNote method="proportions" />
    </div>
  );
}
