import { useMemo, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { GradeBadge } from "../../components/ui";
import { refreshBody, bmiOf } from "../../lib/bodyAnalysis";
import { afterPrompt, BASELINE_PROMPT, buildPlan } from "../../lib/plan";
import { SCORE_LABEL, type ScoreKey } from "../../lib/report";
import { photoUrl, setActiveProfile, setReview, setVisuals, updateScan, useAppState } from "../../lib/store";
import { faceNeeds, rankBeard, rankHair } from "../../lib/styles";
import type { Review, Scan } from "../../lib/types";
import { checklistFor, type Check } from "./checklist";
import { statusOf } from "./Review";
import { BodyVisuals, MeshViewer, PoseViewer, PromptBlock, RealismPanel, Slot, StyleGallery, StyleLibrary, bodyAfterPrompt } from "./tools";
import "./review.css";

const SECTIONS: { id: Check["section"]; n: string; title: string }[] = [
  { id: "capture", n: "1", title: "Capture & landmarks" },
  { id: "measure", n: "2", title: "Measurements" },
  { id: "plan", n: "3", title: "Plan" },
  { id: "style", n: "4", title: "Hair & beard" },
  { id: "visuals", n: "5", title: "Visuals" },
];

export function ReviewScan() {
  const { scanId } = useParams();
  const state = useAppState();
  const raw = state.scans.find((s) => s.id === scanId);
  const profile = raw && state.profiles.find((p) => p.id === raw.profileId);
  const scan: Scan | undefined = useMemo(
    () => (raw && profile && raw.body ? { ...raw, body: refreshBody(raw.body, profile.intake, raw.bodySide?.metrics ?? null) } : raw),
    [raw, profile],
  );
  const plan = useMemo(() => (scan && profile ? buildPlan(scan, profile.intake, { includeHidden: true }) : null), [scan, profile]);
  if (!scan || !profile || !plan)
    return (
      <div className="page">
        <p className="lead">Scan not found.</p>
        <Link className="btn" to="/review">
          Back to queue
        </Link>
      </div>
    );

  const intake = profile.intake;
  const r: Review = scan.review ?? { status: "awaiting", checks: {}, hiddenItems: [], itemNotes: {}, note: "", updatedAt: "" };
  const st = statusOf(scan);
  const list = checklistFor(scan);
  const done = list.filter((c) => r.checks[c.id]).length;
  const allDone = done === list.length;
  const v = state.visuals[scan.id] ?? {};
  const face = photoUrl(scan.id, "face");
  const body = photoUrl(scan.id, "body");
  const side = photoUrl(scan.id, "side");
  const toggle = (id: string) => setReview(scan.id, { checks: { ...r.checks, [id]: !r.checks[id] }, status: st === "approved" ? "in-review" : st === "awaiting" ? "in-review" : st });
  const checks = (sec: Check["section"]) => (
    <div className="rv-checks">
      {list
        .filter((c) => c.section === sec)
        .map((c) => (
          <label key={c.id} className={`rv-check ${r.checks[c.id] ? "on" : ""}`}>
            <input type="checkbox" checked={!!r.checks[c.id]} onChange={() => toggle(c.id)} />
            <span>{c.label}</span>
          </label>
        ))}
    </div>
  );
  const cap = scan.face?.capture;
  const bmi = bmiOf(intake);
  const needs = faceNeeds(scan.face);
  const hair = rankHair(intake, scan.face);
  const beard = rankBeard(intake, scan.face);
  const hairPick = scan.stylePick?.hair ?? hair[0]?.item.id;
  const beardPick = scan.stylePick?.beard ?? beard[0]?.item.id;
  const scores = Object.entries(plan.current) as [ScoreKey, number][];

  return (
    <div className="page rv-page">
      <div className="rv-top">
        <Link to="/review" className="mono-sm rv-back">
          ← Queue
        </Link>
        <div className="rv-title">
          {face && <img src={face} alt="" />}
          <div>
            <h1 className="title-md">{intake.name}</h1>
            <span className="rv-sub">
              {intake.age} · {intake.gender} · {intake.ethnicity || "—"} · {intake.heightCm ?? "?"} cm / {intake.weightKg ?? "?"} kg · scanned{" "}
              {new Date(scan.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
          <span className={`rv-status rv-${st}`}>{st === "approved" ? "Approved" : st === "in-review" ? "In review" : "Awaiting review"}</span>
        </div>
        <nav className="rv-steps" aria-label="Review sections">
          {SECTIONS.map((s) => {
            const items = list.filter((c) => c.section === s.id);
            const ok = items.length > 0 && items.every((c) => r.checks[c.id]);
            return (
              <a key={s.id} href={`#rv-${s.id}`} className={ok ? "ok" : ""}>
                <i>{ok ? "✓" : s.n}</i>
                {s.title}
              </a>
            );
          })}
        </nav>
      </div>

      {/* 1 · Capture */}
      <Section id="capture" n="1" title="Capture & landmarks" lead="Confirm the detector marked the right points. Every measurement is computed from these.">
        {cap && (
          <div className="rv-facts">
            <Fact k="Head turn (yaw)" v={`${cap.yaw.toFixed(1)}°`} warn={Math.abs(cap.yaw) > 8} />
            <Fact k="Nod (pitch)" v={`${cap.pitch.toFixed(1)}°`} warn={Math.abs(cap.pitch) > 10} />
            <Fact k="Tilt (roll)" v={`${cap.roll.toFixed(1)}°`} warn={Math.abs(cap.roll) > 6} />
            <Fact k="Capture" v={cap.closeRange ? "Close-range selfie" : "Distance shot"} warn={cap.closeRange} />
          </div>
        )}
        {scan.face?.landmarks && <MeshViewer photo={face} lm={scan.face.landmarks} aspect={scan.face.imageAspect} />}
        {(scan.body?.landmarks || scan.bodySide?.landmarks) && (
          <div className="rv-poses">
            {scan.body?.landmarks && <PoseViewer photo={body} lm={scan.body.landmarks} aspect={scan.body.imageAspect} label="Front body" />}
            {scan.bodySide?.landmarks && <PoseViewer photo={side} lm={scan.bodySide.landmarks} aspect={scan.bodySide.imageAspect} label="Side body" />}
          </div>
        )}
        {checks("capture")}
      </Section>

      {/* 2 · Measurements */}
      <Section id="measure" n="2" title="Measurements" lead="Scores below 15 or above 95 are unusual — check the photo before approving.">
        <div className="rv-facts">
          {scores.map(([k, val]) => (
            <Fact key={k} k={SCORE_LABEL[k]} v={Math.round(val).toString()} warn={val < 15 || val > 95} />
          ))}
          {bmi != null && <Fact k="BMI" v={bmi.toFixed(1)} warn={bmi < 16 || bmi > 40} />}
          {scan.body && (
            <Fact
              k={`Body fat (${scan.body.metrics.bodyFatMethod ?? "n/a"})`}
              v={scan.body.metrics.bodyFatEstimate != null ? `${scan.body.metrics.bodyFatEstimate.toFixed(1)}%` : "—"}
              warn={scan.body.metrics.bodyFatEstimate != null && (scan.body.metrics.bodyFatEstimate < 6 || scan.body.metrics.bodyFatEstimate > 45)}
            />
          )}
          {scan.face && <Fact k="Face shape" v={scan.face.faceShape} />}
        </div>
        <Link to="/analysis/getting-started" className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => setActiveProfile(profile.id)}>
          Open the client's full analysis
        </Link>
        {checks("measure")}
      </Section>

      {/* 3 · Plan */}
      <Section id="plan" n="3" title="Plan" lead="Remove anything that doesn't fit. Notes appear to the client on that item.">
        <div className="rv-intake">
          <Fact k="Preferences" v={intake.preferences} />
          <Fact k="Allergies" v={intake.allergies || "None reported"} warn={!!intake.allergies && !/none/i.test(intake.allergies)} />
          <Fact k="Limitations" v={intake.limitations || "None reported"} warn={!!intake.limitations && !/none/i.test(intake.limitations)} />
          <Fact k="Training" v={`${intake.trainingDays} d/week`} />
          <Fact k="Sleep" v={`${intake.sleepHours} h`} />
        </div>
        <div className="rv-items">
          {plan.items.map((it) => (
            <div key={it.id} className={`rv-item ${it.hidden ? "off" : ""}`}>
              <label className="rv-item-head">
                <input
                  type="checkbox"
                  checked={!it.hidden}
                  onChange={() =>
                    setReview(scan.id, { hiddenItems: it.hidden ? r.hiddenItems.filter((x) => x !== it.id) : [...r.hiddenItems, it.id], status: st === "approved" ? "in-review" : st })
                  }
                />
                <b>{it.title}</b>
                <span className="rv-cat">{it.category}</span>
                {it.clinical && <span className="rv-flag">clinical</span>}
                <GradeBadge grade={it.grade} />
              </label>
              <p className="rv-why">{it.why}</p>
              <input
                className="rv-note"
                placeholder="Note to the client (optional)"
                defaultValue={r.itemNotes[it.id] ?? ""}
                onBlur={(e) => e.target.value !== (r.itemNotes[it.id] ?? "") && setReview(scan.id, { itemNotes: { ...r.itemNotes, [it.id]: e.target.value } })}
              />
            </div>
          ))}
        </div>
        {checks("plan")}
      </Section>

      {/* 4 · Style */}
      {scan.face && (
        <Section id="style" n="4" title="Hair & beard" lead={`Ranked by fit for this face${needs?.notes.length ? ` (${needs.notes.join("; ")})` : ""}. Close scores are a judgment call — pick what suits the person.`}>
          <div className="rv-fit">
            {[
              { t: "Haircut", rows: hair, pick: hairPick, key: "hair" as const },
              { t: "Beard", rows: beard, pick: beardPick, key: "beard" as const },
            ].map((col) => (
              <div key={col.t} className="rv-fit-col">
                <span className="mono-sm">{col.t}</span>
                {col.rows.map((row) => (
                  <label key={row.item.id} className={`rv-fit-row ${col.pick === row.item.id ? "on" : ""}`}>
                    <input
                      type="radio"
                      name={col.key}
                      checked={col.pick === row.item.id}
                      onChange={() => updateScan(scan.id, { stylePick: { ...scan.stylePick, [col.key]: row.item.id } })}
                    />
                    <div>
                      <div className="rv-fit-top">
                        <b>{row.item.name}</b>
                        <span>{Math.round(row.fit)}%</span>
                      </div>
                      {row.reasons.length > 0 && <small>{row.reasons.join(" · ")}</small>}
                    </div>
                  </label>
                ))}
              </div>
            ))}
          </div>
          {checks("style")}
        </Section>
      )}

      {/* 5 · Visuals */}
      <Section id="visuals" n="5" title="Visuals" lead="Generate from the prompts (FLUX for the baseline, Nano Banana Pro for edits), upload the results, then run the realism check. Always edit from the baseline, never from a previous after.">
        <div className="vz-slots">
          <Slot label="Standardized model" tag="Before" value={v.baseline} onChange={(x) => setVisuals(scan.id, { baseline: x })} fallback={face} />
          <Slot label="12-month after" tag="After" value={v.after} onChange={(x) => setVisuals(scan.id, { after: x })} />
        </div>
        {v.after && (
          <RealismPanel
            before={v.baseline ?? face}
            after={v.after}
            onResult={(res) => {
              const worst = [...res.rows].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))[0];
              setReview(scan.id, {
                realism: { pass: res.pass, at: new Date().toISOString(), worst: `${worst.label.toLowerCase()} ${worst.changePct > 0 ? "+" : "−"}${Math.abs(worst.changePct).toFixed(1)}%` },
              });
            }}
          />
        )}
        <PromptBlock title="Face baseline (standardized model)" text={BASELINE_PROMPT} />
        <PromptBlock title="Face after (end of plan)" text={afterPrompt(plan, intake)} />
        {(scan.body || scan.bodySide) && <BodyVisuals scanId={scan.id} visuals={v} bodyPhoto={body} sidePhoto={side} afterText={bodyAfterPrompt(plan.items.map((i) => i.visual ?? ""))} />}
        <StyleGallery scanId={scan.id} visuals={v} />
        {checks("visuals")}
      </Section>

      {/* Release */}
      <section className="rv-release">
        <div className="field">
          <label htmlFor="rv-msg">Message to the client</label>
          <textarea
            id="rv-msg"
            rows={3}
            defaultValue={r.note}
            placeholder="e.g. Start with sleep and protein; the after image assumes 12 months of the training plan."
            onBlur={(e) => e.target.value !== r.note && setReview(scan.id, { note: e.target.value })}
          />
        </div>
        <div className="rv-release-bar">
          <span>
            {done}/{list.length} checks{r.realism ? ` · realism ${r.realism.pass ? "passed" : "flagged"}` : ""}
          </span>
          {st === "approved" ? (
            <button className="btn btn-ghost" onClick={() => setReview(scan.id, { status: "in-review" })}>
              Reopen
            </button>
          ) : (
            <button
              className="btn"
              disabled={!allDone || (!!v.after && r.realism?.pass === false)}
              title={!allDone ? "Complete every check first" : r.realism?.pass === false ? "The after image failed the realism check" : ""}
              onClick={() => setReview(scan.id, { status: "approved", approvedAt: new Date().toISOString() })}
            >
              Approve & release
            </button>
          )}
        </div>
      </section>

      <details className="rv-lib">
        <summary>Style library & sources</summary>
        <StyleLibrary />
      </details>
    </div>
  );
}

function Section({ id, n, title, lead, children }: { id: string; n: string; title: string; lead: string; children: ReactNode }) {
  return (
    <section id={`rv-${id}`} className="rv-sec">
      <div className="rv-sec-head">
        <span className="rv-n">{n}</span>
        <div>
          <h2 className="title-md">{title}</h2>
          <p className="lead">{lead}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Fact({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div className={`rv-fact ${warn ? "warn" : ""}`}>
      <span>{k}</span>
      <b>{v}</b>
    </div>
  );
}
