import { useState } from "react";
import { METHODS, REFS } from "../lib/science";
import { ChevronDown, ChevronRight, Doc } from "./icons";

/** Collapsible "How this is measured" block with citations. */
export function MethodNote({ method }: { method: string }) {
  const m = METHODS[method];
  const [open, setOpen] = useState(false);
  if (!m) return null;
  return (
    <div className="method">
      <button className="method-head" onClick={() => setOpen((o) => !o)}>
        <Doc size={14} />
        <span className="mono">How this is measured</span>
        <span className="method-refs">{m.refs.length} {m.refs.length === 1 ? "source" : "sources"}</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && (
        <div className="method-body">
          <p><b>Method.</b> {m.how}</p>
          <p><b>Reference.</b> {m.norm}</p>
          <ol>
            {m.refs.map((id) => {
              const r = REFS[id];
              return (
                <li key={id}>
                  {r.authors} ({r.year}). <i>{r.title}</i>. {r.source}. <span className="method-finding">{r.finding}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
      <style>{`
        .method { margin-top: 12px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); }
        .method-head { width: 100%; display: flex; align-items: center; gap: 10px; padding: 12px 16px; color: var(--ink-3); }
        .method-refs { margin-left: auto; font-size: 12px; color: var(--muted); }
        .method-body { padding: 0 16px 14px 40px; font-size: 12.5px; color: var(--ink-2); line-height: 1.55; }
        .method-body p { margin: 0 0 8px; }
        .method-body b { font-weight: 500; color: var(--ink); }
        .method-body ol { margin: 8px 0 0; padding-left: 18px; display: grid; gap: 6px; color: var(--ink-3); }
        .method-finding { color: var(--muted); }
      `}</style>
    </div>
  );
}
