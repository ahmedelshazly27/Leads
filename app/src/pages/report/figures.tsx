import { useEffect, useState, type ReactNode } from "react";
import { FacePhoto, toPhoto } from "../../components/FacePhoto";
import { IDX, PAIRS } from "../../lib/faceAnalysis";
import type { BodyResult, FaceResult, Pt, SideResult } from "../../lib/types";
import { SideLines, cropAround, sideCrop } from "../analysis/BodyDetail";
import { faceCrop } from "../analysis/crop";
import {
  BROW_L,
  BROW_R,
  CHIN,
  ContourOverlay,
  EYE_L,
  EYE_R,
  FACE_OVAL,
  JAW,
  LIPS_INNER,
  LIPS_OUTER,
  MeasureLine,
  MeshLines,
  NOSE,
  NOSE_BASE,
  poly,
  pts,
  regionCrop,
} from "../analysis/faceViz";
import { SKIN_LABEL } from "./data";

/*
 * Report figures. Every figure sits in a box of fixed height so the paginator
 * can measure it before the image has loaded. Overlays reuse the analysis
 * pages' drawing primitives (faceViz, BodyDetail).
 */

export function Fig({ n, caption, h, children, className = "" }: { n?: number; caption: ReactNode; h: number; children: ReactNode; className?: string }) {
  return (
    <figure className={`rp-fig ${className}`}>
      <div className="rp-fig-frame" style={{ height: h }}>
        {children}
      </div>
      <figcaption className="rp-fig-cap">
        {n != null && <b>FIG {n}</b>} {caption}
      </figcaption>
    </figure>
  );
}

export function NoPhoto({ label = "Not captured" }: { label?: string }) {
  return <div className="rp-nophoto">{label}</div>;
}

/** Plain photo, cover-cropped. */
export function Photo({ src, pos = "50% 30%", fit = "cover" }: { src: string | null | undefined; pos?: string; fit?: "cover" | "contain" }) {
  if (!src) return <NoPhoto />;
  return <img className="rp-img" src={src} alt="" style={{ objectPosition: pos, objectFit: fit }} />;
}

/* ------------------------------ Face ------------------------------ */

export function FaceMesh({ face, photo, zoom = 1.45 }: { face: FaceResult; photo: string | null; zoom?: number }) {
  const lm = face.landmarks;
  if (!photo) return <NoPhoto />;
  return (
    <FacePhoto src={photo} aspect={face.imageAspect} crop={lm ? faceCrop(lm, face.imageAspect, zoom, 0.8) : undefined}>
      {lm && <MeshLines lm={lm} aspect={face.imageAspect} opacity={0.6} />}
    </FacePhoto>
  );
}

export function ThirdsFifths({ face, photo }: { face: FaceResult; photo: string | null }) {
  const lm = face.landmarks;
  if (!photo) return <NoPhoto />;
  const a = face.imageAspect;
  return (
    <FacePhoto src={photo} aspect={a} crop={lm ? faceCrop(lm, a, 1.3, 0.8) : undefined}>
      {lm && <ThirdsFifthsLines lm={lm} aspect={a} />}
    </FacePhoto>
  );
}

function ThirdsFifthsLines({ lm, aspect }: { lm: Pt[]; aspect: number }) {
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
      {["I", "II", "III"].map((t, i) => (
        <text key={t} x={xR + 36} y={(ys[i] + ys[i + 1]) / 2} fill="#fff" fontSize={11} fontFamily="JetBrains Mono" dominantBaseline="middle">
          {t}
        </text>
      ))}
    </g>
  );
}

export function SymmetryFig({ face, photo }: { face: FaceResult; photo: string | null }) {
  const lm = face.landmarks;
  if (!photo) return <NoPhoto />;
  const a = face.imageAspect;
  let overlay: ReactNode = null;
  if (lm) {
    const mids = [10, 9, 168, 6, 1, 2, 0, 17, 152].map((i) => toPhoto(lm[i], a));
    const midX = mids.reduce((s, p) => s + p[0], 0) / mids.length;
    overlay = (
      <g>
        <polyline points={poly(mids)} fill="none" stroke="#fff" strokeWidth={1.2} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        {PAIRS.map(([i, j]) => {
          const p = toPhoto(lm[i], a), q = toPhoto(lm[j], a);
          const mirror: [number, number] = [2 * midX - q[0], q[1]];
          return (
            <g key={i}>
              <circle cx={p[0]} cy={p[1]} r={3} fill="#fff" />
              <circle cx={mirror[0]} cy={mirror[1]} r={3.6} fill="none" stroke="#3f3033" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              <line x1={p[0]} y1={p[1]} x2={mirror[0]} y2={mirror[1]} stroke="#3f3033" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}
      </g>
    );
  }
  return (
    <FacePhoto src={photo} aspect={a} crop={lm ? faceCrop(lm, a, 1.35, 0.8) : undefined}>
      {overlay}
    </FacePhoto>
  );
}

export function ShapeFig({ face, photo }: { face: FaceResult; photo: string | null }) {
  const lm = face.landmarks;
  if (!photo) return <NoPhoto />;
  const a = face.imageAspect;
  return (
    <FacePhoto src={photo} aspect={a} crop={lm ? faceCrop(lm, a, 1.3, 0.8) : undefined}>
      {lm && (
        <g>
          <polygon points={poly(pts(lm, FACE_OVAL, a))} fill="rgba(255,255,255,.1)" stroke="#fff" strokeWidth={1.6} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
          {[
            [IDX.templeL, IDX.templeR],
            [IDX.zygL, IDX.zygR],
            [IDX.gonL, IDX.gonR],
          ].map(([i, j], k) => {
            const p = toPhoto(lm[i], a), q = toPhoto(lm[j], a);
            return <line key={k} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="#fff" strokeWidth={1} strokeOpacity={0.8} vectorEffect="non-scaling-stroke" />;
          })}
        </g>
      )}
    </FacePhoto>
  );
}

export function ContrastFig({ face, photo }: { face: FaceResult; photo: string | null }) {
  const lm = face.landmarks;
  if (!photo) return <NoPhoto />;
  const a = face.imageAspect;
  return (
    <FacePhoto src={photo} aspect={a} crop={lm ? faceCrop(lm, a, 1.35, 0.8) : undefined}>
      {lm && (
        <g>
          {[BROW_L, BROW_R, EYE_L, EYE_R, LIPS_OUTER].map((g, i) => (
            <polygon key={i} points={poly(pts(lm, g, a))} fill="rgba(255,255,255,.28)" stroke="#fff" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
        </g>
      )}
    </FacePhoto>
  );
}

/** Close-up crops with the same overlays as the feature pages. */
export type FeatureKey = "brows" | "eyes" | "nose" | "lips" | "cheeks" | "jaw" | "chin";

export function FeatureFig({ k, face, photo }: { k: FeatureKey; face: FaceResult; photo: string | null }) {
  const lm = face.landmarks;
  if (!photo) return <NoPhoto />;
  const a = face.imageAspect;
  if (!lm) return <FacePhoto src={photo} aspect={a} />;
  const spec: Record<FeatureKey, { ids: number[]; pad: number; draw: () => ReactNode }> = {
    brows: {
      ids: [...BROW_L, ...BROW_R, ...EYE_L, ...EYE_R],
      pad: 1.15,
      draw: () => <ContourOverlay lm={lm} aspect={a} groups={[IDX.browL.upper, IDX.browR.upper]} closed={false} />,
    },
    eyes: {
      ids: [...EYE_L, ...EYE_R, ...BROW_L, ...BROW_R],
      pad: 1.25,
      draw: () => (
        <g>
          <ContourOverlay lm={lm} aspect={a} groups={[EYE_L, EYE_R]} />
          <MeasureLine lm={lm} aspect={a} a={IDX.eyeL.outer} b={IDX.eyeL.inner} />
          <MeasureLine lm={lm} aspect={a} a={IDX.eyeR.inner} b={IDX.eyeR.outer} />
        </g>
      ),
    },
    nose: {
      ids: [...NOSE, ...NOSE_BASE, IDX.eyeL.inner, IDX.eyeR.inner],
      pad: 2.5,
      draw: () => (
        <g>
          <ContourOverlay lm={lm} aspect={a} groups={[NOSE]} closed={false} />
          <MeasureLine lm={lm} aspect={a} a={129} b={358} />
          <MeasureLine lm={lm} aspect={a} a={IDX.eyeL.inner} b={IDX.eyeR.inner} />
        </g>
      ),
    },
    lips: { ids: [...LIPS_OUTER, 2, 152], pad: 1.9, draw: () => <ContourOverlay lm={lm} aspect={a} groups={[LIPS_OUTER, LIPS_INNER]} /> },
    cheeks: {
      ids: [IDX.zygL, IDX.zygR, IDX.top, IDX.menton],
      pad: 1.05,
      draw: () => (
        <g>
          {face.skin
            .filter((s) => s.key === "leftCheek" || s.key === "rightCheek")
            .flatMap((s) => s.polygons)
            .map((p, i) => (
              <polygon key={i} points={p.map((q) => toPhoto(q, a).join(",")).join(" ")} fill="rgba(255,255,255,.14)" stroke="#fff" strokeWidth={1.2} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            ))}
          <MeasureLine lm={lm} aspect={a} a={IDX.zygL} b={IDX.zygR} />
        </g>
      ),
    },
    jaw: {
      ids: [...JAW, IDX.noseTip],
      pad: 1.15,
      draw: () => (
        <g>
          <ContourOverlay lm={lm} aspect={a} groups={[JAW]} closed={false} />
          <MeasureLine lm={lm} aspect={a} a={IDX.gonL} b={IDX.gonR} />
        </g>
      ),
    },
    chin: {
      ids: [...CHIN, ...LIPS_OUTER],
      pad: 1.5,
      draw: () => (
        <g>
          <ContourOverlay lm={lm} aspect={a} groups={[CHIN]} closed={false} />
          <MeasureLine lm={lm} aspect={a} a={IDX.chinL} b={IDX.chinR} />
          <MeasureLine lm={lm} aspect={a} a={IDX.lowerLipInner} b={IDX.menton} />
        </g>
      ),
    },
  };
  const s = spec[k];
  return (
    <FacePhoto src={photo} aspect={a} crop={regionCrop(lm, s.ids, a, s.pad, 0.78)}>
      {s.draw()}
    </FacePhoto>
  );
}

/** All six skin regions outlined and numbered on the front photo. */
export function SkinRegionsFig({ face, photo }: { face: FaceResult; photo: string | null }) {
  const lm = face.landmarks;
  if (!photo) return <NoPhoto />;
  const a = face.imageAspect;
  return (
    <FacePhoto src={photo} aspect={a} crop={lm ? faceCrop(lm, a, 1.4, 0.8) : undefined}>
      {face.skin.map((r) =>
        r.polygons.map((p, i) => {
          const P = p.map((q) => toPhoto(q, a));
          const cx = P.reduce((s, q) => s + q[0], 0) / P.length;
          const cy = P.reduce((s, q) => s + q[1], 0) / P.length;
          return (
            <g key={`${r.key}${i}`}>
              <polygon points={poly(P)} fill={`rgba(255,255,255,${0.08 + Math.min(0.4, r.coverage * 2.5)})`} stroke="#fff" strokeWidth={1.1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
              {i === 0 && (
                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={10} fontFamily="JetBrains Mono" style={{ paintOrder: "stroke" }} stroke="rgba(60,30,38,.55)" strokeWidth={2.5}>
                  {SKIN_LABEL[r.key].toUpperCase()}
                </text>
              )}
            </g>
          );
        }),
      )}
    </FacePhoto>
  );
}

/* --------------------------- Side profile -------------------------- */

function useNaturalSize(src: string | null | undefined) {
  const [size, setSize] = useState<[number, number] | null>(null);
  useEffect(() => {
    if (!src) return;
    let live = true;
    const img = new Image();
    img.onload = () => live && setSize([img.naturalWidth, img.naturalHeight]);
    img.src = src;
    return () => {
      live = false;
    };
  }, [src]);
  return size;
}

const PROFILE_LABELS: Record<string, string> = { G: "G", N: "N", Prn: "Prn", Sn: "Sn", Ls: "Ls", Li: "Li", Pg: "Pg", Me: "Me", Cm: "Cm", Sm: "Sm", Gn: "Gn" };

/** Profile photo with the soft-tissue landmarks the profile analysis found (points are in image pixels). */
export function ProfileFig({ photo, points }: { photo: string | null; points: Record<string, unknown> | null | undefined }) {
  const size = useNaturalSize(photo);
  if (!photo) return <NoPhoto />;
  if (!size || !points) return <Photo src={photo} />;
  const [W, H] = size;
  const P = (k: string) => {
    const v = points[k];
    return Array.isArray(v) && typeof v[0] === "number" ? (v as [number, number]) : null;
  };
  const chain = ["G", "N", "dorsum", "Prn", "Cm", "Sn", "Ls", "Sto", "Li", "Sm", "Pg", "Gn", "Me"].map(P).filter(Boolean) as [number, number][];
  const xs = chain.map((p) => p[0]), ys = chain.map((p) => p[1]);
  // crop around the profile points, portrait box
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const hgt = Math.min(H, (Math.max(...ys) - Math.min(...ys)) * 1.9);
  const wid = Math.min(W, hgt * 0.8);
  const x0 = Math.max(0, Math.min(W - wid, cx - wid / 2)), y0 = Math.max(0, Math.min(H - hgt, cy - hgt / 2));
  const r = hgt / 140;
  return (
    <svg viewBox={`${x0} ${y0} ${wid} ${hgt}`} preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%", display: "block" }}>
      <image href={photo} x={0} y={0} width={W} height={H} />
      <polyline points={chain.map((p) => p.join(",")).join(" ")} fill="none" stroke="#fff" strokeWidth={1.2} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
      {Object.keys(PROFILE_LABELS).map((k) => {
        const p = P(k);
        if (!p) return null;
        const dir = points.facing === "right" ? 1 : -1;
        return (
          <g key={k}>
            <circle cx={p[0]} cy={p[1]} r={r * 1.4} fill="#fff" stroke="#69565a" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <text x={p[0] + dir * r * 4} y={p[1]} textAnchor={dir < 0 ? "end" : "start"} dominantBaseline="middle" fill="#fff" fontSize={r * 4.2} fontFamily="JetBrains Mono" style={{ paintOrder: "stroke" }} stroke="rgba(60,30,38,.6)" strokeWidth={r * 0.8}>
              {PROFILE_LABELS[k]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------ Body ------------------------------ */

const SKELETON: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28], [27, 29], [28, 30], [29, 31], [30, 32],
];

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
      {[11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
        .filter((i) => inFrame(lm[i]))
        .map((i) => {
          const [x, y] = P(i);
          return <circle key={i} cx={x} cy={y} r={5} fill="#fff" stroke="#69565a" strokeWidth={1} vectorEffect="non-scaling-stroke" />;
        })}
    </g>
  );
}

function WidthLines({ body }: { body: BodyResult }) {
  if (!body.lines) return null;
  const a = body.imageAspect;
  return (
    <g>
      {(["shoulder", "waist", "hip"] as const).map((k) => {
        const [p, q] = body.lines![k].map((x) => toPhoto(x, a));
        return (
          <g key={k}>
            <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="#fff" strokeWidth={1.4} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            {[p, q].map((x, i) => (
              <circle key={i} cx={x[0]} cy={x[1]} r={6} fill="#fff" stroke="#69565a" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            <g transform={`translate(${(p[0] + q[0]) / 2}, ${p[1] - 14})`}>
              <rect x={-40} y={-16} width={80} height={22} rx={6} fill="rgba(87, 71, 75,.6)" />
              <text x={0} y={-1} textAnchor="middle" fill="#f2f0f0" fontSize={12} fontFamily="JetBrains Mono" letterSpacing=".08em">
                {k.toUpperCase()}
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
}

export function BodyFrontFig({ body, photo, mode = "skeleton" }: { body: BodyResult; photo: string | null; mode?: "skeleton" | "widths" }) {
  if (!photo) return <NoPhoto />;
  return (
    <FacePhoto src={photo} aspect={body.imageAspect} placeholderTone="slate">
      {mode === "skeleton" ? <Skeleton body={body} /> : <WidthLines body={body} />}
    </FacePhoto>
  );
}

export function BodySideFig({ side, photo, mode = "plumb" }: { side: SideResult; photo: string | null; mode?: "plumb" | "depth" | "full" }) {
  if (!photo) return <NoPhoto />;
  return (
    <FacePhoto src={photo} aspect={side.imageAspect} crop={mode === "full" ? undefined : sideCrop(side, 0.62, 0.12, 0.2)} placeholderTone="slate">
      <SideLines side={side} showPlumb={mode !== "depth"} showArc={mode === "plumb"} showDepth={mode === "depth"} />
    </FacePhoto>
  );
}

export function BodySymmetryFig({ body, photo }: { body: BodyResult; photo: string | null }) {
  const lm = body.landmarks;
  if (!photo) return <NoPhoto />;
  const a = body.imageAspect;
  if (!lm || !body.lines) return <FacePhoto src={photo} aspect={a} />;
  const sh: Pt = [(lm[11][0] + lm[12][0]) / 2, (lm[11][1] + lm[12][1]) / 2];
  const hp: Pt = [(lm[23][0] + lm[24][0]) / 2, (lm[23][1] + lm[24][1]) / 2];
  const torso = Math.max(1e-3, hp[1] - sh[1]);
  const xAt = (y: number) => sh[0] + ((hp[0] - sh[0]) * (y - sh[1])) / torso;
  return (
    <FacePhoto src={photo} aspect={a} crop={cropAround([lm[0], lm[11], lm[12], lm[23], lm[24], body.lines.hip[0], body.lines.hip[1]], a, 0.18, 0.62)}>
      <line x1={toPhoto([sh[0], 0], a)[0]} y1={0} x2={toPhoto([hp[0], 1], a)[0]} y2={1000 / a} stroke="#fff" strokeOpacity={0.8} strokeDasharray="3 5" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
      {(["shoulder", "waist", "hip"] as const).map((k) => {
        const [l, r] = body.lines![k];
        const L = toPhoto(l, a), R = toPhoto(r, a), M = toPhoto([xAt(l[1]), l[1]], a);
        return (
          <g key={k}>
            <line x1={L[0]} y1={L[1]} x2={M[0]} y2={M[1]} stroke="#e8ccd2" strokeWidth={3} vectorEffect="non-scaling-stroke" />
            <line x1={M[0]} y1={M[1]} x2={R[0]} y2={R[1]} stroke="#f3d7cf" strokeWidth={3} vectorEffect="non-scaling-stroke" />
            <circle cx={M[0]} cy={M[1]} r={5} fill="#fff" />
          </g>
        );
      })}
    </FacePhoto>
  );
}
