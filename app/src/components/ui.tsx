import { useRef, useState, type ReactNode } from "react";
import { GRADE_LABEL, REFS, type EvidenceGrade } from "../lib/science";
import { Arrows, Infinity as InfinityIcon } from "./icons";
import "./ui.css";

/* ------------------------------ Headings -------------------------- */

export function Kicker({ children }: { children: ReactNode }) {
  return (
    <span className="kicker">
      <InfinityIcon size={14} /> {children}
    </span>
  );
}

/** Title where the first part is muted slate, e.g. "An overview of" + "your prototypicality". */
export function SplitTitle({ muted, strong, size = "xl", mutedFirst = true }: { muted: string; strong: string; size?: "xl" | "lg" | "md"; mutedFirst?: boolean }) {
  const cls = size === "xl" ? "title-xl" : size === "lg" ? "title-lg" : "title-md";
  return (
    <h1 className={cls}>
      {mutedFirst ? (
        <>
          <span className="hl">{muted}</span> {strong}
        </>
      ) : (
        <>
          {strong} <span className="hl">{muted}</span>
        </>
      )}
    </h1>
  );
}

export function PageHeader({ kicker, muted, strong, lead, right, mutedFirst }: { kicker?: string; muted: string; strong: string; lead?: ReactNode; right?: ReactNode; mutedFirst?: boolean }) {
  return (
    <header className="ph">
      {kicker && <Kicker>{kicker}</Kicker>}
      <div className="ph-row">
        <div className="ph-text">
          <SplitTitle muted={muted} strong={strong} mutedFirst={mutedFirst} />
          {lead && <p className="lead">{lead}</p>}
        </div>
        {right && <div className="ph-right">{right}</div>}
      </div>
    </header>
  );
}

/* ------------------------------ Spectrum bar ---------------------- */

/** Thin track with 2 inner ticks and a dark marker (0..1). */
export function SpectrumBar({ value, labels, marker = true }: { value: number; labels: [string, string, string] | [string, string]; marker?: boolean }) {
  return (
    <div className="spectrum">
      <div className="spectrum-track">
        <i style={{ left: "33.3%" }} />
        <i style={{ left: "66.6%" }} />
        {marker && <b style={{ left: `${Math.min(99, Math.max(1, value * 100))}%` }} />}
      </div>
      <div className="spectrum-labels mono-sm">
        {labels.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ Score card ------------------------ */

/** Glass score card: label top-left, big number bottom-left, "/100" bottom-right. */
export function ScoreCard({ label, value, suffix = "/100", tone = "glass", className = "" }: { label: string; value: number | string; suffix?: string; tone?: "glass" | "dark" | "light"; className?: string }) {
  return (
    <div className={`scorecard scorecard-${tone} ${className}`}>
      <div className="scorecard-label">{label}</div>
      <div className="scorecard-bottom">
        <span className="scorecard-value">{typeof value === "number" ? Math.round(value) : value}</span>
        {suffix && <span className="scorecard-suffix">{suffix}</span>}
      </div>
    </div>
  );
}

/* ------------------------------ Ring gauge ------------------------ */

export function Ring({ value, size = 120 }: { value: number; size?: number }) {
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="ring">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.25)" strokeWidth={3} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#fff"
        strokeWidth={3}
        strokeDasharray={`${(c * value) / 100} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        strokeLinecap="round"
      />
      <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={size * 0.3} fontWeight={300} letterSpacing="-.04em">
        {Math.round(value)}
      </text>
    </svg>
  );
}

/* ------------------------------ Before / after -------------------- */

export function BeforeAfter({ before, after, caption, aspect = 0.75 }: { before: ReactNode; after: ReactNode; caption?: ReactNode; aspect?: number }) {
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const move = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  };
  return (
    <figure className="ba">
      <div
        className="ba-frame"
        ref={ref}
        style={{ aspectRatio: String(aspect) }}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          move(e.clientX);
        }}
        onPointerMove={(e) => e.buttons && move(e.clientX)}
      >
        <div className="ba-layer">{after}</div>
        <div className="ba-layer" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          {before}
        </div>
        <div className="ba-line" style={{ left: `${pos}%` }}>
          <span className="ba-handle">
            <Arrows size={14} />
          </span>
        </div>
        <span className="photo-tag ba-tag ba-tag-l">Before</span>
        <span className="photo-tag ba-tag ba-tag-r">After</span>
      </div>
      {caption && <figcaption className="fig-caption">{caption}</figcaption>}
    </figure>
  );
}

/* ------------------------------ Radar ----------------------------- */

export function Radar({ axes, series, title, size = 320 }: { axes: string[]; series: { name: string; values: number[]; tone: "a" | "b" }[]; title?: string; size?: number }) {
  const cx = size / 2, cy = size / 2 + 6, R = size * 0.32;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / axes.length;
    return [cx + Math.cos(a) * R * (v / 100), cy + Math.sin(a) * R * (v / 100)];
  };
  return (
    <div className="radar">
      <svg viewBox={`-48 0 ${size + 96} ${size + 14}`} width="100%" style={{ overflow: "visible" }}>
        {title && (
          <text x={cx} y={14} textAnchor="middle" className="radar-title">
            {title}
          </text>
        )}
        {[20, 40, 60, 80, 100].map((r) => (
          <circle key={r} cx={cx} cy={cy} r={(R * r) / 100} fill="none" stroke="#e3e8e9" />
        ))}
        {axes.map((a, i) => {
          const [x, y] = pt(i, 100);
          const [lx, ly] = pt(i, 128);
          return (
            <g key={a}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke="#e3e8e9" />
              <text x={lx} y={ly} textAnchor={Math.abs(lx - cx) < 8 ? "middle" : lx > cx ? "start" : "end"} dominantBaseline="middle" className="radar-axis">
                {a.toUpperCase()}
              </text>
            </g>
          );
        })}
        {series.map((s) => (
          <polygon
            key={s.name}
            points={s.values.map((v, i) => pt(i, v).join(",")).join(" ")}
            className={`radar-poly radar-${s.tone}`}
          />
        ))}
      </svg>
      <div className="radar-legend mono-sm">
        {series.map((s) => (
          <span key={s.name}>
            <i className={`radar-sw radar-${s.tone}`} /> {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ Evidence -------------------------- */

export function GradeBadge({ grade }: { grade: EvidenceGrade }) {
  return (
    <span className={`grade grade-${grade}`} title={GRADE_LABEL[grade]}>
      Evidence {grade}
    </span>
  );
}

export function Citations({ ids }: { ids: string[] }) {
  if (!ids.length) return null;
  return (
    <ol className="cites">
      {ids.map((id) => {
        const r = REFS[id];
        if (!r) return null;
        return (
          <li key={id}>
            {r.authors} ({r.year}). <i>{r.title}</i>. {r.source}.
          </li>
        );
      })}
    </ol>
  );
}

export const shortCite = (id: string) => {
  const r = REFS[id];
  if (!r) return id;
  const first = r.authors.split(",")[0].split(" ")[0];
  return `${first} ${r.year}`;
};

/* ------------------------------ Misc ------------------------------ */

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="title-md">{title}</div>
      {children && <div className="lead">{children}</div>}
    </div>
  );
}

export function Toggle<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="toggle">
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const money = (n: number, cur: "EUR" | "USD" | "GBP" = "EUR") =>
  new Intl.NumberFormat("en", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);
