import { useId } from "react";
import type { Art } from "../lib/library";

/*
 * Line drawings for the feature library. Every drawing is generated from the
 * same parameters the type is defined by (e.g. eye height ÷ width, tilt in
 * degrees), so the pictures stay in step with the definitions.
 */

type P = [number, number];

/** Closed Catmull-Rom spline through points, as an SVG path. */
function smooth(pts: P[], closed = true): string {
  const n = pts.length;
  const at = (i: number) => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1: P = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: P = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return closed ? d + "Z" : d;
}

/** Symmetric outline from right-side half-widths [y, halfWidth] (top to bottom). */
function outline(cx: number, rows: [number, number][]): string {
  const right: P[] = rows.map(([y, w]) => [cx + w, y]);
  const left: P[] = [...rows].reverse().map(([y, w]) => [cx - w, y]);
  return smooth([...right, ...left]);
}

const FACE: Record<string, [number, number][]> = {
  oval: [[6, 12], [16, 25], [40, 30], [64, 22], [80, 9], [84, 1]],
  round: [[10, 14], [20, 29], [44, 34], [62, 28], [77, 14], [80, 2]],
  square: [[8, 18], [16, 30], [40, 31], [66, 30], [80, 17], [82, 4]],
  heart: [[8, 16], [18, 32], [40, 31], [62, 18], [80, 5], [83, 1]],
  oblong: [[2, 12], [14, 24], [42, 25], [68, 23], [84, 12], [87, 2]],
  diamond: [[8, 9], [18, 20], [42, 33], [66, 20], [81, 7], [84, 1]],
};

function eyePath(cx: number, cy: number, w: number, h: number, tilt: number) {
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const up = h * w;
  return {
    d: `M${x0},${cy} C${x0 + w * 0.25},${cy - up * 1.25} ${x1 - w * 0.3},${cy - up * 1.25} ${x1},${cy} C${x1 - w * 0.3},${cy + up * 0.75} ${x0 + w * 0.3},${cy + up * 0.75} ${x0},${cy}Z`,
    t: `rotate(${-tilt} ${cx} ${cy})`,
    up,
  };
}

function Eye({ cx, cy, w, h, tilt, clip }: { cx: number; cy: number; w: number; h: number; tilt: number; clip: string }) {
  const e = eyePath(cx, cy, w, h, tilt);
  const r = Math.min(w * 0.19, e.up * 0.9 + 3);
  return (
    <g transform={e.t}>
      <clipPath id={clip}>
        <path d={e.d} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <circle cx={cx} cy={cy - e.up * 0.12} r={r} className="fa-fill-soft" />
        <circle cx={cx} cy={cy - e.up * 0.12} r={r * 0.42} className="fa-fill" />
      </g>
      <path d={e.d} className="fa-line" />
    </g>
  );
}

const SKIN = ["#f6dccb", "#ecc4a4", "#d6a47c", "#b07a52", "#7d5235", "#4a2f20"];

export function FeatureArt({ art, active = false }: { art: Art; active?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const cls = `fa ${active ? "fa-on" : ""}`;
  const view = "0 0 120 90";
  switch (art.kind) {
    case "face":
      return (
        <svg viewBox={view} className={cls} aria-hidden>
          <path d={outline(60, FACE[art.shape])} className="fa-line" />
          <path d="M45 38h8M67 38h8M60 44v10M54 64q6 3 12 0" className="fa-guide" />
        </svg>
      );
    case "thirds": {
      const top = 8;
      const unit = 24;
      const y1 = top + unit;
      const y2 = y1 + unit * art.mid;
      const y3 = y2 + unit * art.lower;
      return (
        <svg viewBox={view} className={cls} aria-hidden>
          <path d={outline(52, [[top, 12], [top + 10, 22], [y1 + 10, 25], [y2 + 6, 20], [y3 - 4, 9], [y3, 1]])} className="fa-guide" />
          {[top, y1, y2, y3].map((y) => (
            <line key={y} x1={24} x2={96} y1={y} y2={y} className="fa-line" />
          ))}
          <path d={`M100 ${y1}v${y2 - y1}M100 ${y2}v${y3 - y2}`} className="fa-accent" />
          <text x={104} y={(y1 + y2) / 2 + 3} className="fa-txt">M</text>
          <text x={104} y={(y2 + y3) / 2 + 3} className="fa-txt">L</text>
        </svg>
      );
    }
    case "eye":
      return (
        <svg viewBox={view} className={cls} aria-hidden>
          <line x1={14} x2={106} y1={48} y2={48} className="fa-guide" />
          <Eye cx={60} cy={48} w={80} h={art.h} tilt={art.tilt} clip={`c${uid}`} />
        </svg>
      );
    case "spacing": {
      const w = 26;
      const g = art.gap * w;
      const l = 60 - g / 2 - w / 2;
      const r = 60 + g / 2 + w / 2;
      return (
        <svg viewBox={view} className={cls} aria-hidden>
          <Eye cx={l} cy={44} w={w} h={0.32} tilt={2} clip={`a${uid}`} />
          <Eye cx={r} cy={44} w={w} h={0.32} tilt={-2} clip={`b${uid}`} />
          <path d={`M${60 - g / 2} 60h${g}`} className="fa-accent" />
          <path d={`M${60 - g / 2} 56v8M${60 + g / 2} 56v8`} className="fa-accent" />
        </svg>
      );
    }
    case "lid": {
      const e = eyePath(60, 54, 76, 0.3, 2);
      return (
        <svg viewBox={view} className={cls} aria-hidden>
          {art.lid === "deep" && <path d="M14 30 Q60 6 106 30" className="fa-line" />}
          {art.lid === "deep" && <path d="M22 34 Q60 20 98 36" className="fa-guide" />}
          <Eye cx={60} cy={54} w={76} h={art.lid === "hooded" ? 0.24 : 0.3} tilt={2} clip={`l${uid}`} />
          {art.lid === "double" && <path d={`M24 ${54 - 4} C36 ${54 - e.up - 14} 82 ${54 - e.up - 14} 96 ${54 - 6}`} className="fa-line" />}
          {art.lid === "hooded" && <path d={`M22 ${54 - 6} C36 ${54 - e.up - 8} 80 ${54 - e.up - 6} 100 ${54 - 1}`} className="fa-line fa-thick" />}
          {art.lid === "mono" && <path d="M26 40 Q60 30 94 40" className="fa-guide" />}
        </svg>
      );
    }
    case "brow": {
      const L = 90;
      const x0 = 15;
      const base = 34 - (art.lift ?? 0) * 12;
      const px = x0 + art.peak * L;
      const py = base - art.arch * L;
      const t = art.thick * L * 0.5;
      const top: P[] = [[x0, base - t * 0.6], [px, py - t * 0.55], [x0 + L, base + 5 - t * 0.15]];
      const bot: P[] = [[x0 + L, base + 5 + t * 0.15], [px, py + t * 0.5], [x0, base + t * 0.7]];
      return (
        <svg viewBox={view} className={cls} aria-hidden>
          <path d={smooth([...top, ...bot])} className="fa-fill" />
          <Eye cx={60} cy={64} w={60} h={0.3} tilt={2} clip={`w${uid}`} />
        </svg>
      );
    }
    case "nose": {
      const hw = art.w * 18;
      return (
        <svg viewBox={view} className={cls} aria-hidden>
          <path d="M42 8 C46 30 44 46 50 60 M78 8 C74 30 76 46 70 60" className="fa-guide" />
          <path d={`M${60 - hw} 66 C${60 - hw - 6} 58 ${60 - hw + 4} 50 ${60 - hw + 10} 58 C${60 - 8} 70 ${60 + 8} 70 ${60 + hw - 10} 58 C${60 + hw - 4} 50 ${60 + hw + 6} 58 ${60 + hw} 66 C${60 + hw - 6} 74 ${60 - hw + 6} 74 ${60 - hw} 66Z`} className="fa-line" />
          <path d="M42 82h36" className="fa-guide" />
          <path d={`M${60 - hw} 86h${hw * 2}`} className="fa-accent" />
          <path d="M42 80v4M78 80v4" className="fa-guide" />
        </svg>
      );
    }
    case "profile": {
      const ctl = art.dorsum === "convex" ? [64, 26] : art.dorsum === "concave" ? [50, 40] : [57, 33];
      const tip: P = art.tip === "up" ? [80, 52] : art.tip === "down" ? [78, 62] : [80, 57];
      return (
        <svg viewBox={view} className={cls} aria-hidden>
          <path d={`M40 4 Q46 10 44 16 Q${ctl[0]} ${ctl[1]} ${tip[0]} ${tip[1]} Q${tip[0] + 2} ${tip[1] + 6} 70 66 Q64 66 60 68 Q60 74 62 78`} className="fa-line" />
          <circle cx={36} cy={22} r={2} className="fa-fill" />
        </svg>
      );
    }
    case "lips": {
      const W = 84;
      const x0 = 18;
      const x1 = x0 + W;
      const cy = 46 - (art.corner ?? 0) * 0;
      const cnr = cy - (art.corner ?? 0) * 6;
      const u = art.upper * W;
      const l = art.lower * W;
      return (
        <svg viewBox={view} className={cls} aria-hidden>
          <path
            d={`M${x0} ${cnr} C${x0 + 14} ${cy - u * 0.6} ${50} ${cy - u * 1.05} ${55} ${cy - u} Q60 ${cy - u + 3} 65 ${cy - u} C70 ${cy - u * 1.05} ${x1 - 14} ${cy - u * 0.6} ${x1} ${cnr} C${x1 - 16} ${cy + 1} ${x0 + 16} ${cy + 1} ${x0} ${cnr}Z`}
            className="fa-line"
          />
          <path d={`M${x0} ${cnr} C${x0 + 16} ${cy + 1} ${x1 - 16} ${cy + 1} ${x1} ${cnr} C${x1 - 12} ${cy + l * 1.3} ${x0 + 12} ${cy + l * 1.3} ${x0} ${cnr}Z`} className="fa-line" />
        </svg>
      );
    }
    case "jaw": {
      const cw = 36;
      return (
        <svg viewBox={view} className={cls} aria-hidden>
          <path d={smooth([[60 + cw, 10], [60 + art.jaw * cw, 54], [60 + art.chin * cw * 0.55, 78], [60, 82], [60 - art.chin * cw * 0.55, 78], [60 - art.jaw * cw, 54], [60 - cw, 10]], false)} className="fa-line" />
          <path d={`M${60 - cw} 10h${cw * 2}`} className="fa-guide" />
          <path d={`M${60 - art.jaw * cw} 60h${art.jaw * cw * 2}`} className="fa-accent" />
        </svg>
      );
    }
    case "chin": {
      const dx = art.proj * 9;
      return (
        <svg viewBox={view} className={cls} aria-hidden>
          <path d={`M66 6 Q70 14 72 20 Q66 22 64 26 Q72 30 72 36 Q66 40 62 42 Q${66 + dx} 48 ${66 + dx} 58 Q${62 + dx} 72 ${48} 74 Q36 76 26 70`} className="fa-line" />
          <path d="M72 30v40" className="fa-guide" />
        </svg>
      );
    }
    case "curl": {
      const strands = [36, 60, 84];
      const pts = (x0: number) => {
        const out: P[] = [];
        const N = art.tight ? Math.max(8, Math.round(art.freq * 4)) : 60;
        for (let i = 0; i <= N; i++) {
          const t = i / N;
          const ph = art.tight ? (i % 2 ? 1 : -1) * (i === 0 || i === N ? 0 : 1) : Math.sin(t * Math.PI * 2 * art.freq);
          out.push([x0 + art.amp * ph, 6 + t * 78]);
        }
        return out;
      };
      return (
        <svg viewBox={view} className={cls} aria-hidden>
          {strands.map((x) => (
            <path key={x} d={art.amp === 0 ? `M${x} 6V84` : `M${pts(x).map((p) => p.map((v) => v.toFixed(1)).join(" ")).join(" L")}`} className="fa-line fa-thick" />
          ))}
        </svg>
      );
    }
    case "hairline": {
      const L: Record<string, string> = {
        straight: "M18 30 C30 26 90 26 102 30",
        rounded: "M18 38 C24 24 96 24 102 38",
        peak: "M18 32 C34 24 50 26 60 38 C70 26 86 24 102 32",
        m: "M18 36 C26 22 44 34 52 28 C56 24 64 24 68 28 C76 34 94 22 102 36",
        receding: "M18 50 C22 30 40 44 48 26 C54 20 66 20 72 26 C80 44 98 30 102 50",
      };
      return (
        <svg viewBox={view} className={cls} aria-hidden>
          <path d="M18 80 C14 40 26 6 60 6 C94 6 106 40 102 80" className="fa-guide" />
          <path d={`${L[art.line]} L102 20 C92 2 28 2 18 20Z`} className="fa-fill-soft" />
          <path d={L[art.line]} className="fa-line" />
          <path d="M44 62h10M66 62h10" className="fa-guide" />
        </svg>
      );
    }
    case "norwood": {
      const s = art.stage;
      return (
        <svg viewBox={view} className={cls} aria-hidden>
          <clipPath id={`h${uid}`}>
            <ellipse cx={60} cy={46} rx={30} ry={40} />
          </clipPath>
          <g clipPath={`url(#h${uid})`}>
            <ellipse cx={60} cy={46} rx={30} ry={40} className="fa-fill-soft" />
            {s >= 2 && s < 5 && (
              <>
                <ellipse cx={40} cy={10} rx={5 + s * 2} ry={6 + s * 3} className="fa-bald-fill" />
                <ellipse cx={80} cy={10} rx={5 + s * 2} ry={6 + s * 3} className="fa-bald-fill" />
              </>
            )}
            {s >= 4 && s < 7 && <circle cx={60} cy={62} r={(s - 3) * 5} className="fa-bald-fill" />}
            {s >= 5 && s < 7 && <ellipse cx={60} cy={14} rx={24} ry={14 + (s - 5) * 8} className="fa-bald-fill" />}
            {s >= 7 && <ellipse cx={60} cy={38} rx={24} ry={34} className="fa-bald-fill" />}
          </g>
          <ellipse cx={60} cy={46} rx={30} ry={40} className="fa-line" />
          <path d="M54 6 L60 0 L66 6" className="fa-guide" />
        </svg>
      );
    }
    case "beard": {
      const face = "M22 6 C20 40 28 66 60 84 C92 66 100 40 98 6";
      return (
        <svg viewBox={view} className={cls} aria-hidden>
          <path d={face} className="fa-line" />
          <path d="M50 44 Q60 48 70 44" className="fa-guide" />
          {art.beard === "full" && <path d="M24 20 C26 50 36 70 60 82 C84 70 94 50 96 20 L90 22 C88 46 78 56 70 52 Q60 56 50 52 C42 56 32 46 30 22Z" className="fa-fill" />}
          {art.beard === "patchy" && (
            <g className="fa-fill">
              <path d="M24 20 C25 30 27 36 30 40 L33 24Z" />
              <path d="M96 20 C95 30 93 36 90 40 L87 24Z" />
              <path d="M44 62 C50 74 70 74 76 62 Q60 66 44 62Z" />
              <path d="M50 42 Q60 39 70 42 L68 44 Q60 42 52 44Z" />
            </g>
          )}
          {art.beard !== "full" &&
            [...Array(art.beard === "none" ? 10 : 18)].map((_, i) => <circle key={i} cx={34 + ((i * 37) % 52)} cy={50 + ((i * 23) % 24)} r={0.9} className="fa-fill" />)}
        </svg>
      );
    }
    case "swatch":
      return (
        <svg viewBox={view} className={cls} aria-hidden>
          <circle cx={60} cy={45} r={30} fill={SKIN[art.tone - 1]} className="fa-swatch" />
        </svg>
      );
    case "torso": {
      const s = art.shoulder * 22;
      const w = art.waist * 22;
      const h = art.hip * 22;
      return (
        <svg viewBox={view} className={cls} aria-hidden>
          <circle cx={60} cy={10} r={7} className="fa-line" />
          <path d={smooth([[60 + 6, 18], [60 + s, 26], [60 + w, 56], [60 + h, 76], [60 - h, 76], [60 - w, 56], [60 - s, 26], [60 - 6, 18]])} className="fa-line" />
          <path d={`M${60 - s} 26h${s * 2}M${60 - w} 56h${w * 2}`} className="fa-accent" />
        </svg>
      );
    }
    case "posture": {
      const hip: P = [58, 74];
      const sh: P = [58 + art.shoulder * 10, 32];
      const ear: P = [sh[0] + 2 + art.head * 12, 16];
      const mid: P = [54 - art.lumbar * 6 - art.shoulder * 4, 54];
      return (
        <svg viewBox={view} className={cls} aria-hidden>
          <line x1={58} x2={58} y1={4} y2={88} className="fa-guide" />
          <path d={smooth([hip, mid, [sh[0] - art.shoulder * 6, 40], sh], false)} className="fa-line fa-thick" />
          <path d={`M${sh[0]} ${sh[1]} L${ear[0]} ${ear[1] + 4}`} className="fa-line fa-thick" />
          <circle cx={ear[0]} cy={ear[1] - 2} r={7} className="fa-line" />
          <path d={`M${hip[0]} ${hip[1]} l2 14`} className="fa-line fa-thick" />
          <circle cx={sh[0]} cy={sh[1]} r={2} className="fa-fill" />
          <circle cx={hip[0]} cy={hip[1]} r={2} className="fa-fill" />
        </svg>
      );
    }
  }
}
