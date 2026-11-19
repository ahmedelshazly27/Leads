/*
 * Small hand-built charts for the operator dashboard (SVG + HTML, no library).
 *
 * Colors are validated as a pair (light surface #fff): burgundy for revenue,
 * blue for ad spend. Every chart keeps a legend or a title naming its series,
 * a hover / keyboard readout, and a table view so no value hides behind hover.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export const SERIES = { revenue: "#8a3a4c", adSpend: "#2a78d6" } as const;

/** Width of an element, kept up to date (0 until measured). */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceStep(span: number, target: number) {
  const raw = span / Math.max(1, target);
  const p = 10 ** Math.floor(Math.log10(raw || 1));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

export function niceTicks(min: number, max: number, target = 4): number[] {
  if (min === max) max = min + 1;
  const step = niceStep(max - min, target);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

const shortDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const axisNum = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v * 10) / 10));

export interface LineSeries {
  key: string;
  name: string;
  color: string;
  values: (number | null)[];
}

/**
 * Daily lines on one KWD axis. Crosshair snaps to the nearest day; arrow keys
 * move it when the chart has focus. Null values break the line.
 */
export function LineChart({ dates, series, height = 230, unit, format }: { dates: string[]; series: LineSeries[]; height?: number; unit: string; format: (v: number | null) => string }) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const M = { t: 12, r: 92, b: 26, l: 44 };
  const w = Math.max(0, width - M.l - M.r);
  const h = height - M.t - M.b;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  const ticks = niceTicks(Math.min(0, ...all), Math.max(0, ...all, 1));
  const y0 = ticks[0];
  const y1 = ticks[ticks.length - 1];
  const x = (i: number) => (dates.length <= 1 ? w / 2 : (i / (dates.length - 1)) * w);
  const y = (v: number) => h - ((v - y0) / (y1 - y0 || 1)) * h;

  const paths = series.map((s) => {
        let d = "";
        let pen = false;
        s.values.forEach((v, i) => {
          if (v == null) {
            pen = false;
            return;
          }
          d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
          pen = true;
        });
        return d;
      });

  // End labels: at each series' last value, nudged apart when they collide.
  const ends = series
    .map((s) => {
      let i = s.values.length - 1;
      while (i >= 0 && s.values[i] == null) i--;
      return i < 0 ? null : { key: s.key, name: s.name, i, yy: y(s.values[i] as number) };
    })
    .filter((e): e is { key: string; name: string; i: number; yy: number } => e != null)
    .sort((a, b) => a.yy - b.yy);
  for (let k = 1; k < ends.length; k++) if (ends[k].yy - ends[k - 1].yy < 14) ends[k].yy = ends[k - 1].yy + 14;

  const pick = (clientX: number, el: Element) => {
    const r = el.getBoundingClientRect();
    const px = clientX - r.left - M.l;
    const i = dates.length <= 1 ? 0 : Math.round((px / (w || 1)) * (dates.length - 1));
    setHover(Math.max(0, Math.min(dates.length - 1, i)));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setHover((i) => {
      const cur = i ?? dates.length - 1;
      return Math.max(0, Math.min(dates.length - 1, cur + (e.key === "ArrowLeft" ? -1 : 1)));
    });
  };
  const labelIdx = dates.length <= 8 ? dates.map((_, i) => i) : [0, Math.round((dates.length - 1) / 3), Math.round(((dates.length - 1) * 2) / 3), dates.length - 1];
  const tipLeft = hover == null ? 0 : M.l + x(hover);
  const flip = hover != null && tipLeft > width - 190;

  return (
    <div className="ad-chart" ref={wrapRef}>
      <div className="ad-legend" aria-hidden="true">
        {series.map((s) => (
          <span key={s.key}>
            <i style={{ background: s.color }} className="is-line" />
            {s.name}
          </span>
        ))}
        <span className="ad-legend-unit">{unit}</span>
      </div>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${series.map((s) => s.name).join(" and ")} per day, ${unit}. Use the arrow keys to read each day; the table below lists every value.`}
          tabIndex={0}
          onPointerMove={(e: PointerEvent<SVGSVGElement>) => pick(e.clientX, e.currentTarget)}
          onPointerLeave={() => setHover(null)}
          onFocus={() => setHover((i) => i ?? dates.length - 1)}
          onBlur={() => setHover(null)}
          onKeyDown={onKey}
        >
          <g transform={`translate(${M.l},${M.t})`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={0} x2={w} y1={y(t)} y2={y(t)} className={t === 0 ? "ad-axis-zero" : "ad-grid"} />
                <text x={-8} y={y(t)} dy="0.32em" textAnchor="end" className="ad-tick">
                  {axisNum(t)}
                </text>
              </g>
            ))}
            {labelIdx.map((i) => (
              <text key={i} x={x(i)} y={h + 18} textAnchor={i === 0 && dates.length > 1 ? "start" : i === dates.length - 1 && dates.length > 1 ? "end" : "middle"} className="ad-tick">
                {shortDate(dates[i])}
              </text>
            ))}
            {series.map((s, k) => (
              <path key={s.key} d={paths[k]} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {series.map((s) =>
              s.values.map((v, i) =>
                v != null && (dates.length <= 10 || i === hover) ? <circle key={`${s.key}${i}`} cx={x(i)} cy={y(v)} r={4} fill={s.color} stroke="#fff" strokeWidth={2} /> : null,
              ),
            )}
            {ends.map((e) => (
              <text key={e.key} x={w + 8} y={e.yy} dy="0.32em" className="ad-endlabel">
                {e.name}
              </text>
            ))}
            {hover != null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={h} className="ad-crosshair" />}
          </g>
        </svg>
      )}
      {hover != null && (
        <div className="ad-tip" style={{ left: flip ? tipLeft - 12 : tipLeft + 12, top: 34, transform: flip ? "translateX(-100%)" : undefined }} role="status">
          <div className="ad-tip-head">{shortDate(dates[hover])}</div>
          {series.map((s) => (
            <div key={s.key} className="ad-tip-row">
              <i style={{ background: s.color }} />
              <b>{format(s.values[hover])}</b>
              <span>{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Horizontal bars for a short list of categories (one series, one color). */
export function BarList({ rows, color = SERIES.revenue, total, unit }: { rows: { key: string; label: string; value: number }[]; color?: string; total?: number; unit: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...rows.map((r) => r.value));
  const sumAll = total ?? rows.reduce((a, r) => a + r.value, 0);
  return (
    <ul className="ad-bars">
      {rows.map((r) => {
        const share = sumAll ? Math.round((r.value / sumAll) * 100) : 0;
        return (
          <li
            key={r.key}
            className={hover === r.key ? "is-hover" : ""}
            tabIndex={0}
            onPointerEnter={() => setHover(r.key)}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(r.key)}
            onBlur={() => setHover(null)}
            aria-label={`${r.label}: ${r.value} ${unit} (${share}%)`}
          >
            <span className="ad-bars-label">{r.label}</span>
            <span className="ad-bars-track">
              <span className="ad-bars-bar" style={{ width: `${Math.max(r.value ? 1.5 : 0, (r.value / max) * 100)}%`, background: color }} />
              {hover === r.key && (
                <span className="ad-tip is-inline" role="status">
                  <b>{r.value}</b> {unit} · {share}%
                </span>
              )}
            </span>
            <span className="ad-bars-value">{r.value}</span>
          </li>
        );
      })}
    </ul>
  );
}
