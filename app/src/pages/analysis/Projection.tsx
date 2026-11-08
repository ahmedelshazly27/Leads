import { useState } from "react";
import { BeforeAfter, PageHeader } from "../../components/ui";
import type { SectionProps } from "./types";
import "../pages.css";

/**
 * Client view of the reviewed visuals (only passed in once approved).
 * Production — prompts, uploads, QA — lives in the reviewer console.
 */
export function Projection({ scan, plan, facePhoto, bodyPhoto, sidePhoto, visuals: v }: SectionProps) {
  const [styleIdx, setStyleIdx] = useState(0);
  const approved = scan.review?.status === "approved";
  const styles = (v.styles ?? []).filter((s) => s.front);
  const faceAfter = styles[styleIdx]?.front ?? v.after;
  const b = v.body ?? {};
  const hair = plan.items.find((i) => i.id === "haircut");
  const beard = plan.items.find((i) => i.id === "beard");
  const img = (src: string) => <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />;
  const ready = approved && !!v.after;

  return (
    <div className="page">
      <PageHeader
        kicker="Projection"
        muted="Your 12-month"
        strong="projection"
        lead="A standardized studio portrait of you, and the same portrait after the plan's realistic 12-month changes — fat loss, skin, sleep, grooming and training. Bone structure is never changed."
      />

      {!ready ? (
        <section className="vc-pending">
          <div className="vc-pending-img">{facePhoto && <img src={facePhoto} alt="Your photo" />}</div>
          <div>
            <span className="mono-sm">In preparation</span>
            <h2 className="title-md" style={{ marginTop: 8 }}>
              Your visuals are being prepared
            </h2>
            <p className="lead">
              Your reviewer creates a standardized studio model of you and a realistic after image from your plan, then checks that bone structure and identity are unchanged before
              releasing them. You'll find them here once approved.
            </p>
          </div>
        </section>
      ) : (
        <>
          <section className="vc-grid">
            <div className="vc-face">
              <BeforeAfter before={img(v.baseline ?? facePhoto ?? "")} after={img(faceAfter!)} aspect={0.75} caption="Drag to compare · face" />
              {styles.length > 1 && (
                <div className="vc-styles" role="tablist" aria-label="Style options">
                  {styles.map((s, i) => (
                    <button key={s.name} role="tab" aria-selected={i === styleIdx} className={`vc-style ${i === styleIdx ? "on" : ""}`} onClick={() => setStyleIdx(i)}>
                      <img src={s.front} alt="" />
                      <span>{s.name.replace(/\s*\(reviewer pick\)/i, "")}</span>
                      {i === 0 && <em>Recommended</em>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <aside className="vc-side">
              {scan.review?.realism?.pass && (
                <div className="vc-verified">
                  <b>Realism verified</b>
                  <span>Bone proportions re-measured on the after image: all within tolerance (largest change {scan.review.realism.worst}).</span>
                </div>
              )}
              {hair && (
                <div className="vc-card">
                  <span className="mono-sm">Hair</span>
                  <b>{hair.title.replace(/^Haircut:\s*/, "")}</b>
                  {hair.reviewerNote && <p className="vc-note">{hair.reviewerNote}</p>}
                  <p>{hair.how[0]?.replace(/^Ask your barber:\s*/, "")}</p>
                </div>
              )}
              {beard && (
                <div className="vc-card">
                  <span className="mono-sm">Beard</span>
                  <b>{beard.title.replace(/^Beard:\s*/, "")}</b>
                  {beard.reviewerNote && <p className="vc-note">{beard.reviewerNote}</p>}
                  <p>{beard.why}</p>
                </div>
              )}
              <div className="vc-card">
                <span className="mono-sm">What changes · what doesn't</span>
                <ul className="vc-list">
                  {plan.improvements.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                  <li className="no">Bone structure, eye shape, nose and skin tone stay the same</li>
                </ul>
              </div>
            </aside>
          </section>

          {(b.afterFront || b.afterSide) && (
            <section className="vz-section">
              <h2 className="title-md">Body</h2>
              <p className="lead">Same camera, same background: fat loss, natural muscle gain and posture from the training and nutrition plan.</p>
              <div className="vc-body">
                {b.afterFront && <BeforeAfter before={img(b.front ?? bodyPhoto ?? "")} after={img(b.afterFront)} aspect={0.75} caption="Front" />}
                {b.afterSide && <BeforeAfter before={img(b.side ?? sidePhoto ?? "")} after={img(b.afterSide)} aspect={0.75} caption="Side" />}
              </div>
            </section>
          )}

          <p className="vc-foot">
            Projections are illustrations of a realistic outcome with good adherence, not a guarantee. Individual results vary with genetics, consistency and starting point.
          </p>
        </>
      )}
    </div>
  );
}
