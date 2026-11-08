import type { ReactNode } from "react";
import { MethodNote } from "../../components/MethodNote";
import "./FeatureView.css";

export interface Attr {
  label: string;
  value: string;
}

/** Layout of the feature analysis screens (eyebrow, eye, nose, …). */
export function FeatureView({
  title,
  highlight,
  lead,
  photo,
  diagram,
  typeLabel,
  attrs,
  explanation,
  method,
  banner,
}: {
  title: string;
  highlight: string;
  lead: ReactNode;
  photo: ReactNode;
  diagram: ReactNode;
  typeLabel: string;
  attrs: Attr[];
  explanation: ReactNode;
  method: string;
  banner?: ReactNode;
}) {
  return (
    <div className="page">
      {banner}
      <section className="page-card fv">
        <header className="fv-head">
          <h1 className="title-md fv-title">
            {title} <span className="hl">{highlight}</span>
          </h1>
          <p className="lead">{lead}</p>
        </header>
        <div className="fv-grid">
          <div className="fv-photo">{photo}</div>
          <div className="fv-side">
            <div className="fv-diagram">
              <div className="fv-diagram-art">{diagram}</div>
              <div className="fv-type">{typeLabel}</div>
            </div>
            <div className="fv-attrs">
              {attrs.map((a, i) => (
                <div key={a.label} className="fv-attr">
                  <div className="mono-sm">
                    {a.label} [{i}]
                  </div>
                  <div className="fv-attr-value">{a.value}</div>
                </div>
              ))}
            </div>
            <div className="fv-expl">
              <div className="mono-sm">Explanation</div>
              <p>{explanation}</p>
            </div>
          </div>
        </div>
      </section>
      <MethodNote method={method} />
    </div>
  );
}
