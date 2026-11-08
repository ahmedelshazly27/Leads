import { FacePhoto, toPhoto } from "../../components/FacePhoto";
import { IDX } from "../../lib/faceAnalysis";
import type { FaceResult, Pt } from "../../lib/types";
import { faceCrop } from "./crop";
import { FeatureView } from "./FeatureView";
import { CaptureWarning } from "../../components/CaptureWarning";

export function browType(arch: number) {
  if (arch > 0.19) return "High Arch";
  if (arch > 0.13) return "Arched";
  if (arch > 0.08) return "Soft Arch";
  return "Straight";
}

export function Eyebrows({ face, photo }: { face: FaceResult; photo: string | null }) {
  const m = face.metrics;
  const type = browType(m.browArch);
  const tilt = m.browTilt > 4 ? "Upswept Tail" : m.browTilt < -2 ? "Tapered Tail" : "Level Tail";
  const peak = m.browPeak > 0.62 ? "Outer-Third Apex" : m.browPeak > 0.42 ? "Central Apex" : "Inner Apex";
  const medial = m.browPeak > 0.5 ? "Gradual Rise" : "Steep Rise";
  const body = m.browThickness > 0.17 ? "Full Body" : m.browThickness > 0.1 ? "Even Thickness" : "Fine Body";
  const position = m.browEyeDistance < 0.42 ? "low-set" : m.browEyeDistance > 0.62 ? "high-set" : "moderately set";

  return (
    <FeatureView
      title="Your eyebrow"
      highlight="shape"
      lead={
        <>
          The shape of the brow significantly impacts how we perceive human <b>emotions</b> when the face is at rest.
        </>
      }
      photo={
        <FacePhoto src={photo} aspect={face.imageAspect} crop={face.landmarks ? faceCrop(face.landmarks, face.imageAspect, 1.5) : undefined}>
          {face.landmarks && <BrowOverlay lm={face.landmarks} aspect={face.imageAspect} />}
        </FacePhoto>
      }
      diagram={<BrowDiagram face={face} />}
      typeLabel={type}
      attrs={[
        { label: "Brow tilt", value: tilt },
        { label: "Brow peak", value: peak },
        { label: "Medial brow", value: medial },
        { label: "Brow body", value: body },
      ]}
      explanation={
        <>
          Your {type.toLowerCase()} brows create a{" "}
          <b>{m.browArch > 0.13 ? "lifted, structured" : m.browArch > 0.08 ? "soft, balanced" : "calm, grounded"}</b> look,
          {" "}peaking around the {m.browPeak > 0.62 ? "outer third" : m.browPeak > 0.42 ? "centre" : "inner third"} of the eye
          {" "}with a {tilt.toLowerCase()}. They sit {position} above the eyes (brow-to-lid {(m.browEyeDistance).toFixed(2)}× eye
          width), which {m.browEyeDistance < 0.42 ? "reads as more intense and focused" : "keeps the gaze open and approachable"}.
        </>
      }
      method="brows"
      banner={<CaptureWarning capture={face.capture} metrics={["browEyeDistance", "browArch"]} />}
    />
  );
}

function BrowOverlay({ lm, aspect }: { lm: Pt[]; aspect: number }) {
  const brows = [IDX.browL.upper, IDX.browR.upper];
  return (
    <g>
      {brows.map((ids, k) => {
        const pts = ids.map((i) => toPhoto(lm[i], aspect));
        return (
          <g key={k}>
            <polyline
              points={pts.map((p) => p.join(",")).join(" ")}
              fill="none"
              stroke="#fff"
              strokeWidth={1.4}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            {[pts[0], pts[2], pts[pts.length - 1]].map((p, i) => (
              <g key={i}>
                <circle cx={p[0]} cy={p[1]} r={7} fill="rgba(255,255,255,.35)" />
                <circle cx={p[0]} cy={p[1]} r={3.5} fill="#fff" stroke="#55646a" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              </g>
            ))}
          </g>
        );
      })}
    </g>
  );
}

/** The user's actual brow curves, normalized and drawn as a schematic. */
function BrowDiagram({ face }: { face: FaceResult }) {
  const lm = face.landmarks;
  let left: Pt[];
  let right: Pt[];
  if (lm) {
    const a = face.imageAspect;
    const pick = (ids: number[]) => ids.map((i) => [lm[i][0] * a, lm[i][1]] as Pt);
    left = pick([...IDX.browL.upper].reverse());
    right = pick(IDX.browR.upper);
  } else {
    // sample data: synthesise from metrics
    const h = face.metrics.browArch;
    const curve = (x0: number, dir: number) =>
      [0, 0.25, 0.5, 0.75, 1].map((t) => [x0 + dir * t * 0.3, -h * 0.3 * Math.sin(Math.PI * Math.min(1, t / face.metrics.browPeak / 2 + 0.25))] as Pt);
    left = curve(0.35, -1).reverse();
    right = curve(0.65, 1);
  }
  const all = [...left, ...right];
  const minX = Math.min(...all.map((p) => p[0]));
  const maxX = Math.max(...all.map((p) => p[0]));
  const minY = Math.min(...all.map((p) => p[1]));
  const maxY = Math.max(...all.map((p) => p[1]));
  const W = 320, H = 120, pad = 22;
  const s = Math.min((W - pad * 2) / (maxX - minX), (H - pad * 2) / Math.max(1e-6, maxY - minY), 9999);
  const tx = (p: Pt): Pt => [pad + (p[0] - minX) * s, H / 2 - ((maxY - minY) * s) / 2 + (p[1] - minY) * s];
  const L = left.map(tx);
  const R = right.map(tx);
  const shape = (pts: Pt[]) => {
    const top = pts.map((p) => p.join(",")).join(" ");
    const bottom = [...pts].reverse().map((p) => `${p[0]},${p[1] + 9}`).join(" ");
    return `${top} ${bottom}`;
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
      {[L, R].map((pts, k) => (
        <g key={k}>
          <polygon points={shape(pts)} fill="#e3e8e9" stroke="#b9c4c7" strokeWidth={0.8} />
          <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="#7f8f94" strokeWidth={1} strokeDasharray="2 3" />
          {pts.map((p, i) => (
            <circle key={i} cx={p[0]} cy={p[1]} r={2.2} fill="#fff" stroke="#8a989c" strokeWidth={0.8} />
          ))}
        </g>
      ))}
      <line x1={L[L.length - 1][0]} y1={L[L.length - 1][1]} x2={R[0][0]} y2={R[0][1]} stroke="#c9d1d3" strokeWidth={0.8} />
    </svg>
  );
}
