import type { ReactNode } from "react";
import { SpectrumBar } from "../../components/ui";
import type { Plan } from "../../lib/plan";
import type { NutritionResult } from "../../lib/nutrition";
import type { Training } from "../../lib/training";
import type { Currency, FaceView, Profile, Scan, Visuals } from "../../lib/types";
import type { FlowBlock, FlowRow, FlowTable } from "./paginate";
import type { MarkerRow } from "./data";

/** Everything the report knows about the client. */
export interface ReportCtx {
  profile: Profile;
  scan: Scan;
  plan: Plan;
  visuals: Visuals;
  currency: Currency;
  photos: { face: string | null; body: string | null; side: string | null; views: Partial<Record<FaceView, string | null>> };
  catalog: MarkerRow[];
  generated: Date;
  nutrition: NutritionResult;
  training: Training | null;
  /** page number of a chapter / contents entry, "00" while measuring */
  pageNo: (id: string) => string;
  /** running figure counter */
  fig: () => number;
}

export const NOT_MEASURED = "Not measured";

export const fmtDate = (iso?: string | Date | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—";

export const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
export const f2 = (n: number | null | undefined, d = 2) => (n == null || !Number.isFinite(n) ? NOT_MEASURED : n.toFixed(d));
export const pct = (n: number | null | undefined, d = 0) => (n == null || !Number.isFinite(n) ? NOT_MEASURED : `${n.toFixed(d)}%`);
export const sdeg = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}°`;

/* ------------------------------ Blocks ---------------------------- */

export const H = ({ strong, muted }: { strong: string; muted?: string }) => (
  <h1 className="pv-h">
    {strong} {muted && <span>{muted}</span>}
  </h1>
);

/** Chapter title block, optionally with a lead paragraph. */
export function title(strong: string, muted?: string, lead?: ReactNode): FlowBlock {
  return {
    key: "title",
    keep: true,
    node: (
      <div className="rp-title">
        <H strong={strong} muted={muted} />
        {lead && <p className="rp-lead">{lead}</p>}
      </div>
    ),
  };
}

/** Subsection heading; listed in the Contents when `toc` is true. */
export function h2(key: string, text: string, opts: { toc?: boolean; sub?: ReactNode } = {}): FlowBlock {
  return {
    key,
    keep: true,
    toc: opts.toc === false ? undefined : text,
    node: (
      <div className="rp-h2">
        <h2>{text}</h2>
        {opts.sub && <p>{opts.sub}</p>}
      </div>
    ),
  };
}

export function h3(key: string, text: string, sub?: ReactNode): FlowBlock {
  return {
    key,
    keep: true,
    node: (
      <div className="rp-h3">
        <h3>{text}</h3>
        {sub && <p>{sub}</p>}
      </div>
    ),
  };
}

export const para = (key: string, node: ReactNode, cls = ""): FlowBlock => ({ key, node: <p className={`rp-p ${cls}`}>{node}</p> });
export const note = (key: string, node: ReactNode): FlowBlock => ({ key, node: <p className="rp-note">{node}</p> });
export const block = (key: string, node: ReactNode, keep = false): FlowBlock => ({ key, node, keep });

export function callout(key: string, label: string, body: ReactNode, tone: "info" | "warn" | "ok" = "info"): FlowBlock {
  return {
    key,
    node: (
      <div className={`rp-callout rp-${tone}`}>
        <span className="rp-mono">{label}</span>
        <div>{body}</div>
      </div>
    ),
  };
}

export const notMeasured = (key: string, why: string): FlowBlock => callout(key, NOT_MEASURED, why, "warn");

/* ------------------------------ Tables ---------------------------- */

export function table(key: string, cols: [string, string][], rows: (ReactNode[] | { cells: ReactNode[]; key?: string; group?: boolean; toc?: string })[], opts: { className?: string; toc?: string } = {}): FlowTable {
  return {
    kind: "table",
    key,
    className: opts.className,
    toc: opts.toc,
    cols: cols.map((c) => c[1]),
    head: (
      <tr>
        {cols.map(([h], i) => (
          <th key={i}>{h}</th>
        ))}
      </tr>
    ),
    rows: rows.map((r, i): FlowRow => {
      const o = Array.isArray(r) ? { cells: r } : r;
      return {
        key: o.key ?? String(i),
        keep: o.group,
        toc: o.toc,
        node: o.group ? (
          <tr className="rp-group">
            <td colSpan={cols.length}>{o.cells[0]}</td>
          </tr>
        ) : (
          <tr>
            {o.cells.map((c, j) => (
              <td key={j}>{c}</td>
            ))}
          </tr>
        ),
      };
    }),
  };
}

/** Two-column label / value table. */
export const kvTable = (key: string, rows: [ReactNode, ReactNode, ReactNode?][], opts: { label?: string; className?: string; toc?: string; widths?: [string, string, string] } = {}) => {
  const hasNote = rows.some((r) => r[2] != null);
  const w = opts.widths ?? (hasNote ? ["30%", "26%", "44%"] : ["38%", "62%", ""]);
  return table(
    key,
    hasNote
      ? [
          [opts.label ?? "Measure", w[0]],
          ["Value", w[1]],
          ["Reference / note", w[2]],
        ]
      : [
          [opts.label ?? "Item", w[0]],
          ["Value", w[1]],
        ],
    rows.map((r) => (hasNote ? [r[0], <b className="rp-num">{r[1]}</b>, <span className="rp-muted">{r[2] ?? ""}</span>] : [r[0], r[1]])),
    { className: `rp-kv ${opts.className ?? ""}`, toc: opts.toc },
  );
};

/* ------------------------------ Bits ------------------------------ */

export type Tone = "ok" | "warn" | "na" | "ref" | "info";
export const Pill = ({ tone, children }: { tone: Tone; children: ReactNode }) => <span className={`rp-pill rp-pill-${tone}`}>{children}</span>;

export const Bar = ({ v, labels }: { v: number; labels: [string, string] | [string, string, string] }) => (
  <div className="rp-bar">
    <SpectrumBar value={Math.min(1, Math.max(0, v))} labels={labels} />
  </div>
);

export function Score({ label, value, suffix = "/100", sub, dark }: { label: string; value: ReactNode; suffix?: string; sub?: ReactNode; dark?: boolean }) {
  return (
    <div className={`rp-score ${dark ? "dark" : ""}`}>
      <span>{label}</span>
      <b>
        {value}
        {suffix && <small>{suffix}</small>}
      </b>
      {sub && <em>{sub}</em>}
    </div>
  );
}

export function Attrs({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="rp-attrs">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
