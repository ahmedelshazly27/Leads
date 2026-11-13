import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { Logo } from "../components/Logo";
import { ChevronDown, ChevronLeft, ChevronUp, Download, Expand, ZoomIn, ZoomOut } from "../components/icons";
import { buildPlan } from "../lib/plan";
import { buildNutrition } from "../lib/nutrition";
import { buildTraining } from "../lib/training";
import { photoUrl } from "../lib/store";
import { useActive } from "../lib/useActive";
import { FACE_VIEWS, type FaceView } from "../lib/types";
import {
  appendixChapter,
  bodyChapter,
  coverChapter,
  faceChapter,
  markersChapter,
  methodologyChapter,
  overviewText,
  photosChapter,
  profileChapter,
  profileRows,
  reportId,
  summaryChapter,
  typesChapter,
} from "./report/chapters";
import { shortCite } from "../components/ui";
import type { MarkerRow } from "./report/data";
import type { ReportCtx } from "./report/kit";
import { PieceView, usePagination, type Chapter } from "./report/paginate";
import {
  actionChapter,
  contentsChapter,
  costsChapter,
  disclaimerChapter,
  nutritionChapter,
  protocolChapter,
  recommendationsChapter,
  referencesChapter,
  trainingChapter,
  visualChapter,
} from "./report/planChapters";
import "./ProtocolViewer.css";
import "./report/report.css";

type BaseCtx = Omit<ReportCtx, "pageNo" | "fig">;

/** Builds every chapter of the report, in order. `pageOf` is null while measuring. */
function buildReport(base: BaseCtx, pageOf: Record<string, number> | null): Chapter[] {
  let fig = 0;
  const c: ReportCtx = {
    ...base,
    pageNo: (id) => (pageOf ? String(pageOf[id] ?? "–").padStart(2, "0") : "00"),
    fig: () => ++fig,
  };
  const body: Chapter[] = [
    summaryChapter(c),
    photosChapter(c),
    faceChapter(c),
    profileChapter(c),
    markersChapter(c),
    typesChapter(c),
    bodyChapter(c),
    protocolChapter(c),
    recommendationsChapter(c),
    actionChapter(c),
    costsChapter(c),
    nutritionChapter(c),
    trainingChapter(c),
    visualChapter(c),
    referencesChapter(c),
    methodologyChapter(c, shortCite),
    appendixChapter(c),
  ];
  const cover = coverChapter(c);
  const disclaimer = disclaimerChapter();
  // the contents lists itself out; its rows don't depend on the page numbers' values
  const contents = contentsChapter(c, [disclaimer, ...body]);
  return [cover, disclaimer, contents, ...body];
}

export function ProtocolViewer() {
  const { profile, scan, facePhoto, state } = useActive();
  const plan = useMemo(() => (scan && profile ? buildPlan(scan, profile.intake) : null), [scan, profile]);
  const [catalog, setCatalog] = useState<MarkerRow[] | null>(null);
  const [zoom, setZoom] = useState(1);
  const [current, setCurrent] = useState(0);
  const docRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    import("../lib/markers/catalog.json").then((m) => setCatalog((m.default as { markers: MarkerRow[] }).markers));
  }, []);

  const visuals = useMemo(() => (scan && scan.review?.status === "approved" ? state.visuals[scan.id] ?? {} : {}), [scan, state.visuals]);
  const base = useMemo<BaseCtx | null>(() => {
    if (!profile || !scan || !plan || !catalog) return null;
    const views: Partial<Record<FaceView, string | null>> = {};
    for (const v of FACE_VIEWS) views[v] = photoUrl(scan.id, v);
    return {
      profile,
      scan,
      plan,
      visuals,
      currency: state.settings.currency,
      photos: { face: photoUrl(scan.id, "face"), body: photoUrl(scan.id, "body"), side: photoUrl(scan.id, "side"), views },
      catalog,
      generated: new Date(),
      nutrition: buildNutrition(scan, profile.intake, plan),
      training: buildTrainingSafe(scan, profile.intake, plan),
    };
  }, [profile, scan, plan, catalog, visuals, state.settings.currency]);

  const draft = useMemo(() => (base ? buildReport(base, null) : []), [base]);
  const contentKey = useMemo(
    () => (base ? [base.scan.id, base.scan.review?.updatedAt ?? "", JSON.stringify(base.profile.intake), base.currency, base.catalog.length, Object.keys(base.visuals).join()].join("|") : "none"),
    [base],
  );
  const name = profile?.intake.name ?? "";
  const rid = base ? reportId({ scan: base.scan } as ReportCtx) : "";
  const frame = (bodyNode: ReactNode) => (
    <Page index={0} total={1} chapter="Measure" name={name} rid={rid}>
      {bodyNode}
    </Page>
  );
  const { layout, layer } = usePagination(draft, contentKey, frame);
  const final = useMemo(() => (base && layout ? buildReport(base, layout.pageOf) : null), [base, layout]);
  const pages = layout && final ? layout.pages : [];

  // Fit A4 pages (794 px wide) to narrow screens; user zoom multiplies on top.
  const [fit, setFit] = useState(1);
  useEffect(() => {
    const el = docRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const cs = getComputedStyle(el);
      const inner = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      setFit(Math.min(1, inner / 794));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [plan]);

  useEffect(() => {
    const root = docRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (vis) setCurrent(Number((vis.target as HTMLElement).dataset.index));
      },
      { root, threshold: [0.3, 0.6] },
    );
    pageRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [pages.length, zoom]);

  // name the saved PDF after the client
  useEffect(() => {
    const prev = document.title;
    const before = () => (document.title = `Analysis report — ${name}`);
    const after = () => (document.title = prev);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, [name]);

  if (!profile || !scan || !plan) return <Navigate to="/home" replace />;

  const go = (i: number) => {
    const n = Math.max(0, Math.min(pages.length - 1, i));
    pageRefs.current[n]?.scrollIntoView({ behavior: "smooth", block: "start" });
    setCurrent(n);
  };
  const side = { name: profile.intake.name, rid: `#${scan.id.slice(0, 5).toUpperCase()}`, avatar: facePhoto ?? visuals.baseline ?? null };
  const renderPage = (i: number) => {
    const pl = pages[i];
    const ch = final![pl.chapter];
    return (
      <Page index={i} total={pages.length} chapter={ch.title} bare={ch.bare} name={name} rid={rid}>
        {pl.pieces.map((p, k) => (
          <PieceView key={k} ch={ch} p={p} />
        ))}
      </Page>
    );
  };

  return (
    <div className="pv">
      <header className="pv-bar">
        <Link to="/analysis/summary" className="pv-back" title="Back to analysis">
          <ChevronLeft size={18} />
        </Link>
        <div className="pv-title">Report</div>
        <div className="pv-group pv-zoomgroup">
          <button className="pv-btn" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))} aria-label="Zoom out">
            <ZoomOut size={20} />
          </button>
          <span className="pv-zoom">{Math.round(zoom * 100)}%</span>
          <button className="pv-btn" onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))} aria-label="Zoom in">
            <ZoomIn size={20} />
          </button>
        </div>
        <span className="pv-sep" />
        <div className="pv-group">
          <button className="pv-btn" onClick={() => go(current - 1)} aria-label="Previous page">
            <ChevronUp size={20} />
          </button>
          <span className="pv-zoom pv-pageof" style={{ width: 40 }}>
            {pages.length ? current + 1 : "–"}
            <span className="pv-total"> / {pages.length || "–"}</span>
          </span>
          <button className="pv-btn" onClick={() => go(current + 1)} aria-label="Next page">
            <ChevronDown size={20} />
          </button>
        </div>
        <button
          className="pv-btn pv-expand"
          aria-label="Full screen"
          onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())}
        >
          <Expand size={18} />
        </button>
        <button className="pv-download" onClick={() => window.print()} disabled={!pages.length}>
          <span className="pv-dl-text">Download PDF</span>
          <span className="pv-dl-short">PDF</span> <span className="pv-div" /> <Download size={20} />
        </button>
      </header>

      <div className="pv-body">
        <aside className="pv-thumbs">
          {pages.map((_, i) => (
            <button key={i} className={`pv-thumb ${i === current ? "on" : ""}`} onClick={() => go(i)} title={`Page ${i + 1} · ${final![pages[i].chapter].title}`}>
              <div className="pv-thumb-inner">{renderPage(i)}</div>
            </button>
          ))}
        </aside>

        <main className="pv-doc" ref={docRef}>
          <details className="pv-mprofile">
            <summary>
              <span>User profile & overview</span>
              <ChevronDown size={16} />
            </summary>
            <UserProfile {...side} rows={profileRows(profile.intake).slice(1, 12)} />
            <div className="pv-card">
              <h2>Overview</h2>
              <p className="pv-overview">{base ? overviewText({ ...base, pageNo: () => "", fig: () => 0 }) : ""}</p>
            </div>
          </details>
          {!pages.length && <div className="pv-loading">Preparing your report…</div>}
          <div className="pv-pages" data-ready={pages.length ? "true" : "false"} data-pages={pages.length} style={{ zoom: +(zoom * fit).toFixed(3) }}>
            {pages.map((_, i) => (
              <div key={i} data-index={i} ref={(el) => (pageRefs.current[i] = el)} className="pv-page-wrap">
                {renderPage(i)}
              </div>
            ))}
          </div>
        </main>

        <aside className="pv-side">
          <UserProfile {...side} rows={profileRows(profile.intake).slice(1, 12)} />
          <div className="pv-card">
            <h2>Overview</h2>
            <p className="pv-overview">{base ? overviewText({ ...base, pageNo: () => "", fig: () => 0 }) : ""}</p>
          </div>
          {final && layout && (
            <div className="pv-card">
              <h2>Contents</h2>
              <ol className="pv-contents">
                {final
                  .filter((ch) => ch.inToc !== false)
                  .map((ch) => (
                    <li key={ch.id}>
                      <button onClick={() => go((layout.pageOf[ch.id] ?? 1) - 1)}>{ch.title}</button>
                      <i>{String(layout.pageOf[ch.id] ?? "").padStart(2, "0")}</i>
                    </li>
                  ))}
              </ol>
            </div>
          )}
        </aside>
      </div>
      {layer}
    </div>
  );
}

/** Training needs at least a face or body scan; it handles missing data itself. */
function buildTrainingSafe(...args: Parameters<typeof buildTraining>) {
  try {
    return buildTraining(...args);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Page frame                                                         */
/* ------------------------------------------------------------------ */

function Page({ index, total, chapter, bare, name, rid, children }: { index: number; total: number; chapter: string; bare?: boolean; name: string; rid: string; children: ReactNode }) {
  if (bare)
    return (
      <section className="pv-page pv-page-bare" aria-label={`Page ${index + 1} of ${total}`}>
        <div className="pv-page-body">{children}</div>
      </section>
    );
  return (
    <section className="pv-page" aria-label={`Page ${index + 1} of ${total}`}>
      <div className="pv-page-head">
        <Logo size={24} />
        <span className="pv-runhead">{chapter}</span>
        <span className="pv-pageno">
          PAGE <i>/</i> {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <div className="pv-page-body">{children}</div>
      <div className="pv-page-foot">
        <span>
          {name} · Report {rid}
        </span>
        <span>Confidential · education and self-tracking only</span>
        <span>
          {index + 1} of {total}
        </span>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Right column                                                       */
/* ------------------------------------------------------------------ */

function UserProfile({ name, rid, avatar, rows }: { name: string; rid: string; avatar: string | null; rows: [string, ReactNode][] }) {
  return (
    <div className="pv-card">
      <h2>User Profile</h2>
      <div className="pv-user">
        <div className="pv-avatar">{avatar && <img src={avatar} alt="" />}</div>
        <div>
          <div className="pv-name">{name}</div>
          <div className="pv-pid">
            Report ID: <b>{rid}</b>
          </div>
        </div>
      </div>
      <dl className="pv-rows">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
