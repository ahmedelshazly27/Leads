import { useMemo } from "react";
import { toPhoto } from "../../components/FacePhoto";
import type { FaceResult, Pt } from "../../lib/types";

/* MediaPipe contour index lists */
export const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
export const EYE_L = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7];
export const EYE_R = [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249];
export const LIPS_OUTER = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
export const LIPS_INNER = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
export const NOSE = [168, 6, 197, 195, 5, 4, 1, 19, 94, 2];
export const NOSE_BASE = [129, 64, 98, 97, 2, 326, 327, 294, 358];
export const JAW = [234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454];
export const CHIN = [172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397];
export const BROW_L = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46];
export const BROW_R = [300, 293, 334, 296, 336, 285, 295, 282, 283, 276];

/**
 * Crop (normalized x,y,w,h) around a set of landmarks, keeping a visual
 * width/height `shape`. `pad` multiplies the larger bbox side.
 */
export function regionCrop(lm: Pt[], ids: number[], aspect: number, pad = 2, shape = 0.8): [number, number, number, number] {
  const xs = ids.map((i) => lm[i][0]);
  const ys = ids.map((i) => lm[i][1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  // visual units: x*1000, y*1000/aspect
  const bw = (Math.max(...xs) - Math.min(...xs)) * 1000;
  const bh = ((Math.max(...ys) - Math.min(...ys)) * 1000) / aspect;
  let vw = Math.max(bw, bh * shape) * pad;
  let vh = vw / shape;
  const H = 1000 / aspect;
  if (vw > 1000) { vw = 1000; vh = vw / shape; }
  if (vh > H) { vh = H; vw = vh * shape; }
  const w = vw / 1000;
  const h = vh / H;
  const x = Math.min(Math.max(cx - w / 2, 0), 1 - w);
  const y = Math.min(Math.max(cy - h / 2, 0), 1 - h);
  return [x, y, w, h];
}

export const pts = (lm: Pt[], ids: number[], aspect: number) => ids.map((i) => toPhoto(lm[i], aspect));
export const poly = (p: [number, number][]) => p.map((q) => q.join(",")).join(" ");

/** Wireframe mesh: each landmark joined to its 3 nearest neighbours (deterministic, light). */
export function useMeshEdges(lm: Pt[] | null, aspect: number) {
  return useMemo(() => {
    if (!lm) return [] as [number, number][];
    const P = lm.slice(0, 468).map((p) => toPhoto(p, aspect));
    const edges = new Set<string>();
    for (let i = 0; i < P.length; i++) {
      const d: [number, number][] = [];
      for (let j = 0; j < P.length; j++) {
        if (i === j) continue;
        const dx = P[i][0] - P[j][0], dy = P[i][1] - P[j][1];
        d.push([dx * dx + dy * dy, j]);
      }
      d.sort((a, b) => a[0] - b[0]);
      for (let k = 0; k < 3; k++) {
        const j = d[k][1];
        edges.add(i < j ? `${i}-${j}` : `${j}-${i}`);
      }
    }
    return [...edges].map((e) => e.split("-").map(Number) as [number, number]);
  }, [lm, aspect]);
}

export function MeshLines({ lm, aspect, opacity = 0.85 }: { lm: Pt[]; aspect: number; opacity?: number }) {
  const edges = useMeshEdges(lm, aspect);
  const P = useMemo(() => lm.map((p) => toPhoto(p, aspect)), [lm, aspect]);
  const d = useMemo(() => edges.map(([a, b]) => `M${P[a][0].toFixed(1)} ${P[a][1].toFixed(1)}L${P[b][0].toFixed(1)} ${P[b][1].toFixed(1)}`).join(""), [edges, P]);
  return <path d={d} fill="none" stroke="#fff" strokeOpacity={opacity} strokeWidth={0.6} vectorEffect="non-scaling-stroke" />;
}

/** Slate panel with only the mesh (the "Mask" view). Same coordinate system as FacePhoto. */
export function MaskView({ face, crop, children }: { face: FaceResult; crop?: [number, number, number, number]; children?: React.ReactNode }) {
  const H = 1000 / face.imageAspect;
  const vb = crop ? [crop[0] * 1000, crop[1] * H, crop[2] * 1000, crop[3] * H] : [0, 0, 1000, H];
  return (
    <svg viewBox={vb.join(" ")} preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%", display: "block" }}>
      <rect x={vb[0] - 2000} y={vb[1] - 2000} width={vb[2] + 4000} height={vb[3] + 4000} fill="#a9bdc4" />
      {face.landmarks && <MeshLines lm={face.landmarks} aspect={face.imageAspect} />}
      {children}
    </svg>
  );
}

/** Schematic of one or more landmark contours, normalized into a 320x120 box. */
export function ContourDiagram({ face, groups, closed = true, lines = [] }: { face: FaceResult; groups: number[][]; closed?: boolean; lines?: [number, number][] }) {
  const lm = face.landmarks;
  if (!lm) {
    return (
      <svg viewBox="0 0 320 120" width="100%" height="100%">
        <ellipse cx={160} cy={60} rx={90} ry={26} fill="#e3e8e9" stroke="#b9c4c7" />
      </svg>
    );
  }
  const a = face.imageAspect;
  const map = (i: number): Pt => [lm[i][0] * a, lm[i][1]];
  const all = [...groups.flat(), ...lines.flat()].map(map);
  const minX = Math.min(...all.map((p) => p[0])), maxX = Math.max(...all.map((p) => p[0]));
  const minY = Math.min(...all.map((p) => p[1])), maxY = Math.max(...all.map((p) => p[1]));
  const W = 320, Hh = 120, pad = 18;
  const s = Math.min((W - pad * 2) / Math.max(1e-6, maxX - minX), (Hh - pad * 2) / Math.max(1e-6, maxY - minY));
  const ox = (W - (maxX - minX) * s) / 2, oy = (Hh - (maxY - minY) * s) / 2;
  const tx = (p: Pt): [number, number] => [ox + (p[0] - minX) * s, oy + (p[1] - minY) * s];
  return (
    <svg viewBox={`0 0 ${W} ${Hh}`} width="100%" height="100%">
      {groups.map((g, k) => {
        const p = g.map((i) => tx(map(i)));
        return (
          <g key={k}>
            {closed ? (
              <polygon points={poly(p)} fill="#e3e8e9" stroke="#8a989c" strokeWidth={0.8} strokeDasharray="2 3" />
            ) : (
              <polyline points={poly(p)} fill="none" stroke="#8a989c" strokeWidth={0.8} strokeDasharray="2 3" />
            )}
            {p.filter((_, i) => i % 2 === 0).map((q, i) => (
              <circle key={i} cx={q[0]} cy={q[1]} r={2} fill="#fff" stroke="#8a989c" strokeWidth={0.8} />
            ))}
          </g>
        );
      })}
      {lines.map(([i, j], k) => {
        const p = tx(map(i)), q = tx(map(j));
        return <line key={k} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="#55646a" strokeWidth={0.8} />;
      })}
    </svg>
  );
}

/** Dashed contour + dots overlay on the photo. */
export function ContourOverlay({ lm, aspect, groups, closed = true, dots = true }: { lm: Pt[]; aspect: number; groups: number[][]; closed?: boolean; dots?: boolean }) {
  return (
    <g>
      {groups.map((g, k) => {
        const p = pts(lm, g, aspect);
        const Tag = closed ? "polygon" : "polyline";
        return (
          <g key={k}>
            <Tag points={poly(p)} fill={closed ? "rgba(255,255,255,.12)" : "none"} stroke="#fff" strokeWidth={1.3} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            {dots &&
              p.filter((_, i) => i % 3 === 0).map((q, i) => (
                <circle key={i} cx={q[0]} cy={q[1]} r={2.6} fill="#fff" stroke="#55646a" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
              ))}
          </g>
        );
      })}
    </g>
  );
}

export function MeasureLine({ lm, aspect, a, b, label }: { lm: Pt[]; aspect: number; a: number; b: number; label?: string }) {
  const p = toPhoto(lm[a], aspect), q = toPhoto(lm[b], aspect);
  return (
    <g>
      <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="#fff" strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
      {[p, q].map((r, i) => (
        <circle key={i} cx={r[0]} cy={r[1]} r={3.2} fill="#fff" stroke="#55646a" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      ))}
      {label && (
        <text x={(p[0] + q[0]) / 2} y={Math.min(p[1], q[1]) - 6} textAnchor="middle" fill="#fff" fontSize={9} fontFamily="JetBrains Mono" letterSpacing=".06em">
          {label}
        </text>
      )}
    </g>
  );
}

export const fmt = (n: number, d = 2) => n.toFixed(d);
export const deg = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}°`;
