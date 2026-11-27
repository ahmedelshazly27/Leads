"use client";

import { useEffect, useState } from "react";
import { featureDesc, features, sectors as missions } from "./data";
import { MissionHud } from "./mission-hud";
import { Chevron, SplitText, useInView } from "./motion";

// Measured on the source: the active bar fills over ~10.5s, then the next tab takes over.
const TAB_MS = 10500;

export function Missions() {
  const [active, setActive] = useState(0);
  const [ref, inView] = useInView<HTMLElement>(0.25, false);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const t = window.setTimeout(() => setActive((a) => (a + 1) % missions.length), TAB_MS);
    return () => window.clearTimeout(t);
  }, [active, inView, cycle]);

  const select = (i: number) => {
    setActive(i);
    setCycle((c) => c + 1);
  };
  const m = missions[active];

  return (
    <section
      ref={ref}
      className="ic-missions"
      id="sectors"
      aria-label="Sectors"
      style={{ "--ic-tab-ms": `${TAB_MS}ms` } as React.CSSProperties}
    >
      {missions.map((x, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={x.key}
          className="ic-missions__bg"
          src={x.img}
          alt={i === active ? x.alt : ""}
          data-active={i === active}
          loading="lazy"
        />
      ))}
      <MissionHud key={m.key} kind={m.key} />
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

        <div className="ic-mission__copy" role="tabpanel" key={m.key}>
          <h3 className="ic-display">{m.title}</h3>
          <SplitText text={m.tagline} as="p" className="ic-h-card" />
          <a href="#contact" className="ic-link ic-mono">
            Discuss a program <Chevron />
          </a>
        </div>

        <div className="ic-features">
          {[m.f01, ...features].map(
            (title, i) => (
              <div key={i} className="ic-feature">
                <span className="ic-feature__num">F.0{i + 1}</span>
                {i > 0 && <span className="ic-feature__sq" />}
                <div>
                  <p className="ic-feature__title ic-body">{title}</p>
                  {i === 0 && <p className="ic-feature__desc ic-body">{featureDesc}</p>}
                </div>
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  );
}
