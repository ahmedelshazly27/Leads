"use client";

import { useEffect, useState } from "react";
import { featureDesc, features, sectors as missions } from "./data";
import { Chevron, SplitText, useInView } from "./motion";
import { OpsConsole } from "./ops-console";

// One tab cycle; the console's scenario loops on the same clock.
const TAB_MS = 14000;

export function Missions() {
  const [active, setActive] = useState(0);
  const [ref, inView] = useInView<HTMLElement>(0.2, false);
  const [cycle, setCycle] = useState(0);
  const [hold, setHold] = useState(false);

  useEffect(() => {
    if (!inView || hold) return;
    const t = window.setTimeout(() => setActive((a) => (a + 1) % missions.length), TAB_MS);
    return () => window.clearTimeout(t);
  }, [active, inView, cycle, hold]);

  const select = (i: number) => {
    setActive(i);
    setCycle((c) => c + 1);
  };
  const m = missions[active];

  return (
    <section
      ref={ref}
      className="ic-missions ic-missions--ops"
      id="sectors"
      aria-label="Sectors"
      data-hold={hold}
      style={{ "--ic-tab-ms": `${TAB_MS}ms` } as React.CSSProperties}
    >
      <div className="ic-missions__inner">
        <div className="ic-tabs" role="tablist">
          {missions.map((x, i) => (
            <button
              key={`${x.key}-${i === active ? cycle : "idle"}-${inView}`}
              type="button"
              role="tab"
              aria-selected={i === active}
              className="ic-tab"
              data-active={i === active && inView}
              onClick={() => select(i)}
            >
              <div className="ic-tab__bar">
                <div className="ic-tab__fill" />
              </div>
              <span className="ic-mono ic-label">{x.label}</span>
            </button>
          ))}
        </div>

        <div className="ic-mission__head">
          <div className="ic-mission__copy" role="tabpanel" key={m.key}>
            <h3 className="ic-display">{m.title}</h3>
            <SplitText text={m.tagline} as="p" className="ic-h-card" />
            <a href="#contact" className="ic-link ic-mono">
              Discuss a program <Chevron />
            </a>
          </div>
          <ul className="ic-mission__features">
            {[m.f01, ...features].map((title, i) => (
              <li key={i} title={i === 0 ? featureDesc : undefined}>
                <span className="ic-feature__num">F.0{i + 1}</span>
                <span className="ic-body">{title}</span>
              </li>
            ))}
          </ul>
        </div>

        <OpsConsole key={m.key} scenario={m.key} cycleMs={TAB_MS} running={inView} onInteract={setHold} />
        <p className="ic-ops__note ic-mono">Illustrative simulation · fictional data</p>
      </div>
    </section>
  );
}
