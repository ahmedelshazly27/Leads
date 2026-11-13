import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/*
 * Measure-then-paginate engine for the A4 report.
 *
 * A report is a list of chapters; each chapter starts on a new page and is a
 * vertical flow of blocks. A block is either atomic (never split) or a table
 * whose rows are split across pages with the header repeated. Everything is
 * rendered once off-screen at the real page width, each block / row is
 * measured, and the flow is packed into fixed-height pages. Page numbers in
 * the Contents come from that packing, so they are always right.
 *
 * Rules for content: anything with an image or SVG must have a fixed height
 * (CSS), so its measured height doesn't depend on loading.
 */

export interface FlowBlock {
  kind?: "block";
  key: string;
  node: ReactNode;
  /** keep on the same page as the next block (headings) */
  keep?: boolean;
  /** contents entry for this block (subsection) */
  toc?: string;
  /** keep on the same page as the previous block (footnotes under a table) */
  tail?: boolean;
}

export interface FlowRow {
  key: string;
  /** a <tr> element */
  node: ReactNode;
  keep?: boolean;
  toc?: string;
}

export interface FlowTable {
  kind: "table";
  key: string;
  className?: string;
  /** column widths, e.g. ["40%", "20%", "40%"] (table-layout: fixed) */
  cols: string[];
  /** a <tr> of <th> */
  head: ReactNode;
  rows: FlowRow[];
  /** contents entry for the table as a whole */
  toc?: string;
  keep?: boolean;
}

export type Block = FlowBlock | FlowTable;

export interface Chapter {
  id: string;
  title: string;
  /** listed in the Contents (default true) */
  inToc?: boolean;
  /** cover-style page without running head / foot */
  bare?: boolean;
  blocks: Block[];
}

/** One placed piece: a whole block, or rows [from, to) of a table. */
export interface Piece {
  b: number;
  from?: number;
  to?: number;
}

export interface PageLayout {
  chapter: number;
  pieces: Piece[];
}

export interface Layout {
  pages: PageLayout[];
  /** "chapterId" or "chapterId/tocKey" -> 1-based page number */
  pageOf: Record<string, number>;
  /** blocks taller than a page (clipped); should stay empty */
  oversize: string[];
}

export const tocId = (chapterId: string, key: string) => `${chapterId}/${key}`;

/* ------------------------------------------------------------------ */
/*  Rendering pieces                                                   */
/* ------------------------------------------------------------------ */

export function TableView({ t, from = 0, to = t.rows.length, cont = false }: { t: FlowTable; from?: number; to?: number; cont?: boolean }) {
  return (
    <table className={`rp-table ${t.className ?? ""} ${cont ? "rp-cont" : ""}`}>
      <colgroup>
        {t.cols.map((w, i) => (
          <col key={i} style={{ width: w }} />
        ))}
      </colgroup>
      <thead>{t.head}</thead>
      <tbody>{t.rows.slice(from, to).map((r) => <FragmentRow key={r.key}>{r.node}</FragmentRow>)}</tbody>
    </table>
  );
}

const FragmentRow = ({ children }: { children: ReactNode }) => <>{children}</>;

export function PieceView({ ch, p }: { ch: Chapter; p: Piece }) {
  const b = ch.blocks[p.b];
  if (!b) return null;
  if (b.kind === "table")
    return (
      <div className="pv-blk">
        <TableView t={b} from={p.from} to={p.to} cont={(p.from ?? 0) > 0} />
      </div>
    );
  return <div className="pv-blk">{b.node}</div>;
}

/* ------------------------------------------------------------------ */
/*  Measuring                                                          */
/* ------------------------------------------------------------------ */

interface Measured {
  /** per block: height, or for tables: overhead (wrapper + thead) and row heights */
  blocks: ({ h: number } | { overhead: number; rows: number[] })[];
}

const SAFETY = 6; // px left free at the bottom of every page (sub-pixel rounding, borders)

function measureChapter(el: HTMLElement): Measured {
  const blocks: Measured["blocks"] = [];
  el.querySelectorAll<HTMLElement>(":scope > .pv-blk").forEach((blk) => {
    const h = blk.getBoundingClientRect().height;
    const tbody = blk.querySelector(":scope > table > tbody");
    if (blk.dataset.kind === "table" && tbody) {
      const rows = [...tbody.children].map((r) => r.getBoundingClientRect().height);
      const sum = rows.reduce((s, x) => s + x, 0);
      blocks.push({ overhead: h - sum, rows });
    } else blocks.push({ h });
  });
  return { blocks };
}

function pack(chapters: Chapter[], measured: Measured[], avail: number): Layout {
  const pages: PageLayout[] = [];
  const pageOf: Record<string, number> = {};
  const oversize: string[] = [];
  const cap = avail - SAFETY;

  chapters.forEach((ch, ci) => {
    const m = measured[ci];
    let cur: Piece[] = [];
    let used = 0;
    const flush = () => {
      pages.push({ chapter: ci, pieces: cur });
      cur = [];
      used = 0;
    };
    pageOf[ch.id] = pages.length + 1;
    if (ch.bare) {
      // full-bleed single page (cover): laid out by its own CSS
      pages.push({ chapter: ci, pieces: ch.blocks.map((_, b) => ({ b })) });
      return;
    }
    // minimum height the next block needs on this page (keep-with-next chains are followed)
    const minOf = (bi: number, depth = 0): number => {
      const mb = m.blocks[bi];
      const b = ch.blocks[bi];
      if (!mb || !b || depth > 4) return 0;
      if ("h" in mb) return Math.min(cap, mb.h + (b.keep ? minOf(bi + 1, depth + 1) : 0));
      return mb.overhead + (mb.rows[0] ?? 0) + (mb.rows[1] ?? 0);
    };
    // height of a footnote that must stay with block bi
    const tailOf = (bi: number) => {
      const nb = ch.blocks[bi + 1];
      const mb = m.blocks[bi + 1];
      return nb && nb.kind !== "table" && nb.tail && mb && "h" in mb ? mb.h : 0;
    };
    ch.blocks.forEach((b, bi) => {
      const mb = m.blocks[bi];
      if (!mb) return;
      if ("h" in mb) {
        if (mb.h > cap) oversize.push(`${ch.id}/${b.key} (${Math.round(mb.h)} > ${Math.round(cap)})`);
        const need = mb.h + (b.keep ? minOf(bi + 1) : 0) + tailOf(bi);
        if (cur.length && used + need > cap) flush();
        cur.push({ b: bi });
        used += mb.h;
        if (b.toc) pageOf[tocId(ch.id, b.key)] = pages.length + 1;
        return;
      }
      // table
      const t = b as FlowTable;
      const n = mb.rows.length;
      let k = 0;
      if (n === 0) {
        if (cur.length && used + mb.overhead > cap) flush();
        cur.push({ b: bi, from: 0, to: 0 });
        used += mb.overhead;
        if (t.toc) pageOf[tocId(ch.id, t.key)] = pages.length + 1;
        return;
      }
      while (k < n) {
        const firstNeed = mb.overhead + mb.rows[k] + (t.rows[k].keep && k + 1 < n ? mb.rows[k + 1] : 0);
        if (cur.length && used + firstNeed > cap) flush();
        const start = k;
        let h = mb.overhead;
        while (k < n) {
          const extra = (t.rows[k].keep && k + 1 < n ? mb.rows[k + 1] : 0) + (k === n - 1 ? tailOf(bi) : 0);
          if (k > start && used + h + mb.rows[k] + extra > cap) break;
          h += mb.rows[k];
          if (t.rows[k].toc) pageOf[tocId(ch.id, t.rows[k].key)] = pages.length + 1;
          k++;
        }
        if (start === 0 && t.toc) pageOf[tocId(ch.id, t.key)] = pages.length + 1;
        if (used + h > cap + 0.5) oversize.push(`${ch.id}/${t.key} row ${start}`);
        cur.push({ b: bi, from: start, to: k });
        used += h;
        if (k < n) flush();
      }
    });
    if (cur.length || pages.length < (pageOf[ch.id] ?? 0)) flush();
  });
  return { pages, pageOf, oversize };
}

/* ------------------------------------------------------------------ */
/*  Hook: measure off-screen, then pack                                */
/* ------------------------------------------------------------------ */

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

async function fontsReady() {
  const f = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!f) return;
  try {
    await Promise.all(
      ["300 13px Inter", "400 13px Inter", "500 13px Inter", "400 11px 'JetBrains Mono'", "500 11px 'JetBrains Mono'"].map((s) => f.load(s).catch(() => null)),
    );
    await f.ready;
  } catch {
    /* fonts are best-effort; fallbacks measure consistently */
  }
}

/**
 * Renders `draft` chapters in an off-screen layer, measures them, and returns
 * the page layout. `frame` renders an empty page so the usable body height can
 * be read from real CSS. `key` changes when the content changes.
 */
export function usePagination(draft: Chapter[], key: string, frame: (body: ReactNode) => ReactNode) {
  const [layout, setLayout] = useState<(Layout & { key: string }) | null>(null);
  const [fontRev, setFontRev] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const measuring = !layout || layout.key !== `${key}:${fontRev}`;

  // re-measure if a web font finishes loading after the first pass
  useEffect(() => {
    const f = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!f) return;
    const on = () => setFontRev((x) => x + 1);
    f.addEventListener("loadingdone", on);
    return () => f.removeEventListener("loadingdone", on);
  }, []);

  useLayoutEffect(() => {
    if (!measuring) return;
    let live = true;
    (async () => {
      await fontsReady();
      await nextFrame();
      await nextFrame();
      const root = ref.current;
      if (!live || !root) return;
      const body = root.querySelector<HTMLElement>(".pv-measure-frame .pv-page-body");
      if (!body) return;
      const cs = getComputedStyle(body);
      const avail = body.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const measured = [...root.querySelectorAll<HTMLElement>(".pv-measure-ch")].map(measureChapter);
      const L = pack(draft, measured, avail);
      if (L.oversize.length) console.warn("[report] blocks taller than a page:", L.oversize);
      if (live) setLayout({ ...L, key: `${key}:${fontRev}` });
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measuring, key, fontRev]);

  const layer = measuring ? (
    <div className="pv-measure" ref={ref} aria-hidden>
      <div className="pv-measure-frame">{frame(null)}</div>
      {draft.map((ch) => (
        <div key={ch.id} className="pv-page-body pv-measure-ch">
          {ch.blocks.map((b) =>
            b.kind === "table" ? (
              <div key={b.key} className="pv-blk" data-kind="table">
                <TableView t={b} />
              </div>
            ) : (
              <div key={b.key} className="pv-blk">
                {b.node}
              </div>
            ),
          )}
        </div>
      ))}
    </div>
  ) : null;

  // while re-measuring after a late font load, keep showing the previous layout of the same content
  const usable = layout && layout.key.startsWith(`${key}:`) ? layout : null;
  return { layout: usable, ready: !measuring, layer };
}
