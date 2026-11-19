import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { GradeBadge } from "../../components/ui";
import { bmiOf, refreshBody } from "../../lib/bodyAnalysis";
import { afterPrompt, bodyAfterPrompt, buildPlan, type Plan } from "../../lib/plan";
import { SCORE_LABEL, type ScoreKey } from "../../lib/report";
import type { Intake, Scan } from "../../lib/types";
import {
  approveDelivery,
  backendEnabled,
  backendMode,
  generateVisual,
  invalidate,
  isMock,
  OPEN_REVIEW_STATUSES,
  saveReview,
  scanResults,
  setOrderStatus,
  useReviewBundle,
  type GenerationKind,
  type GenerationWithUrl,
  type ReviewBundle,
  type ScanPhotoView,
} from "../../lib/backend";
import { callFunction } from "../../lib/backend/client";
import { checklistFor, type Check } from "./checklist";
import { dueText, errorText, fmtDateTime, ORDER_STATUS_LABEL, shortId, StaffGate, statusClass } from "./serverShared";
import { StaffOnly } from "./StaffOnly";
import "./review.css";

/* ------------------------------------------------------------------ */
/*  Reviewer console for one order (server mode)                       */
/* ------------------------------------------------------------------ */

export function ReviewOrder() {
  if (!backendEnabled) return <StaffOnly />;
  return (
    <StaffGate>
      <OrderConsole />
    </StaffGate>
  );
}

const SECTIONS: { id: Check["section"]; title: string }[] = [
  { id: "capture", title: "Capture" },
  { id: "measure", title: "Measurements" },
  { id: "plan", title: "Plan" },
  { id: "style", title: "Hair & beard" },
  { id: "visuals", title: "Visuals" },
];

const PHOTO_LABEL: Record<ScanPhotoView, string> = {
  face: "Face · front",
  face45: "Face · 45°",
  faceLeft: "Face · left profile",
  faceRight: "Face · right profile",
  smile: "Smile",
  frown: "Frown",
  browRaise: "Brow raise",
  body: "Body · front",
  side: "Body · side",
};
const PHOTO_ORDER: ScanPhotoView[] = ["face", "face45", "faceLeft", "faceRight", "smile", "frown", "browRaise", "body", "side"];

interface KindSpec {
  kind: GenerationKind;
  label: string;
  hint: string;
  optional?: boolean;
}

const KIND_SPECS: KindSpec[] = [
  { kind: "face_after", label: "Face after", hint: "Edits the customer's front face photo." },
  { kind: "body_after_front", label: "Body after · front", hint: "Edits the front body photo." },
  { kind: "body_after_side", label: "Body after · side", hint: "Edits the side body photo (falls back to the front one)." },
  { kind: "face_after_alt", label: "Face after · other angle", hint: "Optional. Edits the 45° or profile face photo.", optional: true },
];

const usd = (n: number) => `$${n.toFixed(n < 1 ? 3 : 2)}`;

type GenRow = GenerationWithUrl & { error?: string | null };

/** Build the stored scan back into a `Scan` the plan code can use (or null when the results are missing). */
function useScanModel(bundle: ReviewBundle | undefined) {
  return useMemo(() => {
    if (!bundle?.scan) return { scan: null, intake: null, plan: null };
    const raw = scanResults(bundle.scan);
    const intake = (bundle.scan.intake as Intake | null) ?? null;
    if (!raw || !intake) return { scan: raw, intake, plan: null };
    try {
      const scan: Scan = raw.body ? { ...raw, body: refreshBody(raw.body, intake, raw.bodySide?.metrics ?? null) } : raw;
      return { scan, intake, plan: buildPlan(scan, intake) as Plan | null };
    } catch {
      return { scan: raw, intake, plan: null };
    }
  }, [bundle?.scan]);
}

/** The prompt the local console builds for each after image. */
function basePrompt(kind: GenerationKind, plan: Plan | null, intake: Intake | null): string {
  if (!plan || !intake) return "";
  try {
    if (kind === "face_after" || kind === "face_after_alt") return afterPrompt(plan, intake);
    if (kind === "body_after_front") return bodyAfterPrompt(plan, "front");
    return bodyAfterPrompt(plan, "side");
  } catch {
    return "";
  }
}

/**
 * Approve the chosen visuals and deliver. Calls the approve-delivery function
 * directly so the reviewer's notes go with it and we can show whether the
 * customer email went out; the demo backend has no email.
 */
async function approveAndSend(orderId: string, generationIds: string[], notes: string): Promise<{ emailed: boolean | null }> {
  if (backendMode === "supabase") {
    const res = await callFunction<{ emailed?: boolean } | null>("approve-delivery", { order_id: orderId, generation_ids: generationIds, notes });
    invalidate();
    return { emailed: typeof res?.emailed === "boolean" ? res.emailed : null };
  }
  await approveDelivery(orderId, generationIds);
  invalidate();
  return { emailed: null };
}

function OrderConsole() {
  const { orderId = "" } = useParams();
  const q = useReviewBundle(orderId);
  const bundle = q.data;

  if (!bundle)
    return (
      <div className="page rv-page">
        <Link to="/review" className="mono-sm rv-back">
          ← Queue
        </Link>
        {q.error ? (
          <div className="rv-error" role="alert" style={{ marginTop: 16 }}>
            Could not load this order: {errorText(q.error)}
            <div style={{ marginTop: 10 }}>
              <button className="btn btn-ghost" onClick={q.refresh}>
                Try again
              </button>
            </div>
          </div>
        ) : (
          <p className="lead" aria-busy="true" style={{ marginTop: 16 }}>
            Loading order…
          </p>
        )}
      </div>
    );
  return <OrderBody key={bundle.order.id} bundle={bundle} reload={q.refresh} loadError={q.error} />;
}

function OrderBody({ bundle, reload, loadError }: { bundle: ReviewBundle; reload: () => void; loadError: Error | null }) {
  const { order, review, photos } = bundle;
  const { scan, intake, plan } = useScanModel(bundle);
  const open = OPEN_REVIEW_STATUSES.includes(order.status);
  // approve-delivery approves the review before it delivers the order; if that last step failed the
  // review is locked server-side (guard_review) while the order is still in review, so only a retry of
  // "Approve and send" is possible.
  const reviewLocked = review?.status === "approved" || !!review?.approved_at;
  const readOnly = !open || reviewLocked;

  // Form state, seeded once from the saved review.
  const [checks, setChecks] = useState<Record<string, boolean>>(() => review?.checklist ?? {});
  const [notes, setNotes] = useState(() => review?.notes ?? "");
  const [itemNotes, setItemNotes] = useState<Record<string, string>>(() => review?.item_notes ?? {});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusErr, setStatusErr] = useState<string | null>(null);
  const selection = useSelection(bundle.generations as GenRow[]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const scanLike: Scan = (scan ?? {
    hasFacePhoto: !!photos.face,
    hasBodyPhoto: !!photos.body,
    hasSidePhoto: !!photos.side,
  }) as Scan;
  // Server mode has no studio baseline portrait, so its check does not apply here.
  const list = checklistFor(scanLike).filter((c) => c.id !== "baseline");
  const done = list.filter((c) => checks[c.id]).length;
  const allDone = list.length > 0 && done === list.length;

  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setDirty(true);
    setSaveMsg(null);
  };

  const save = async (): Promise<boolean> => {
    setSaving(true);
    setSaveMsg(null);
    try {
      await saveReview(order.id, { checklist: checks, notes, item_notes: itemNotes });
      invalidate();
      setDirty(false);
      setSaveMsg({ ok: true, text: `Saved ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` });
      return true;
    } catch (e) {
      setSaveMsg({ ok: false, text: `Not saved: ${errorText(e)}` });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (to: "changes_requested" | "in_review") => {
    const msg =
      to === "changes_requested"
        ? "Mark this order as needing changes (for example new photos)? Save a note explaining what is needed first. You can move it back to review later."
        : "Move this order back to in review?";
    if (!window.confirm(msg)) return;
    setStatusBusy(true);
    setStatusErr(null);
    try {
      if (dirty && !(await save())) throw new Error("Save the review first.");
      await setOrderStatus(order.id, to);
      invalidate();
    } catch (e) {
      setStatusErr(errorText(e));
    } finally {
      setStatusBusy(false);
    }
  };

  const d = dueText(order);
  const views = PHOTO_ORDER.filter((v) => photos[v]);
  const face = photos.face ?? null;

  return (
    <div className="page rv-page">
      <div className="rv-top">
        <Link to="/review" className="mono-sm rv-back">
          ← Queue
        </Link>
        <div className="rv-title">
          {face && <img src={face} alt="" />}
          <div>
            <h1 className="title-md">
              {intake?.name?.trim() || "Customer"} · order {shortId(order.id)}
            </h1>
            <span className="rv-sub">
              {order.product === "checkin" ? "Monthly check-in" : "Report"}
              {intake ? ` · ${intake.age} · ${intake.heightCm ?? "?"} cm / ${intake.weightKg ?? "?"} kg` : ""} · submitted {fmtDateTime(order.submitted_at)} · due {fmtDateTime(order.due_at)}{" "}
              {open && <b className={d.overdue ? "rv-due-over" : d.soon ? "rv-due-soon" : ""}>({d.text})</b>}
            </span>
          </div>
          <span className={`rv-status ${statusClass(order.status)}`}>{ORDER_STATUS_LABEL[order.status]}</span>
        </div>
        <nav className="rv-steps" aria-label="Review sections">
          <a href="#rv-photos">
            <i>1</i>Photos
          </a>
          <a href="#rv-results">
            <i>2</i>Results
          </a>
          <a href="#rv-checklist" className={allDone ? "ok" : ""}>
            <i>{allDone ? "✓" : "3"}</i>Checklist {done}/{list.length}
          </a>
          {plan && (
            <a href="#rv-plan">
              <i>4</i>Plan notes
            </a>
          )}
          <a href="#rv-visuals">
            <i>5</i>Visuals
          </a>
          <a href="#rv-release">
            <i>6</i>Send
          </a>
        </nav>
      </div>

      {loadError && (
        <div className="rv-error" role="alert">
          Could not refresh this order: {errorText(loadError)}{" "}
          <button className="btn btn-ghost" onClick={reload}>
            Retry
          </button>
        </div>
      )}
      {isMock && <p className="rv-foot" style={{ marginTop: 0 }}>Demo backend: images are placeholders and no email is sent.</p>}
      {readOnly && (
        <div className="rv-banner">
          {order.status === "delivered"
            ? `Delivered ${fmtDateTime(order.delivered_at)}. This review is locked.`
            : open && reviewLocked
              ? "This review was approved but the order was not delivered. The review is locked; use Approve and send below to retry the delivery."
              : `This order is ${ORDER_STATUS_LABEL[order.status].toLowerCase()}; the review can no longer be changed.`}
        </div>
      )}
      {order.status === "changes_requested" && (
        <div className="rv-banner rv-banner-warn">
          Changes requested. The order cannot be delivered until it is back in review.
          <button className="btn btn-ghost" disabled={statusBusy} onClick={() => changeStatus("in_review")}>
            Back to in review
          </button>
        </div>
      )}

      {/* 1 · Photos */}
      <Section id="photos" n="1" title="Photos" lead="Signed links that expire after an hour; reload the page if they stop showing.">
        {bundle.scan?.photos_deleted_at ? (
          <p className="lead">Photos were deleted on {fmtDateTime(bundle.scan.photos_deleted_at)}.</p>
        ) : !bundle.scan ? (
          <p className="lead">No scan has been submitted for this order yet.</p>
        ) : views.length === 0 ? (
          <p className="lead">No photos stored for this scan.</p>
        ) : (
          <div className="rv-photos">
            {views.map((v) => (
              <a key={v} href={photos[v]} target="_blank" rel="noreferrer" className="rv-photo">
                <img src={photos[v]} alt={PHOTO_LABEL[v]} loading="lazy" />
                <span className="photo-tag">{PHOTO_LABEL[v]}</span>
              </a>
            ))}
          </div>
        )}
      </Section>

      {/* 2 · Key results */}
      <Section id="results" n="2" title="Key results" lead="Measured on the customer's device. Scores below 15 or above 95 are unusual: check the photo before approving.">
        {scan ? <KeyResults scan={scan} intake={intake} plan={plan} /> : <p className="lead">No analysis results stored for this scan.</p>}
      </Section>

      {/* 3 · Checklist */}
      <Section id="checklist" n="3" title="Checklist" lead="Tick every check before approving.">
        {SECTIONS.map((sec) => {
          const items = list.filter((c) => c.section === sec.id);
          if (!items.length) return null;
          return (
            <div key={sec.id} className="rv-check-group">
              <span className="mono-sm">{sec.title}</span>
              <div className="rv-checks">
                {items.map((c) => (
                  <label key={c.id} className={`rv-check ${checks[c.id] ? "on" : ""}`}>
                    <input type="checkbox" disabled={readOnly} checked={!!checks[c.id]} onChange={() => edit(setChecks)({ ...checks, [c.id]: !checks[c.id] })} />
                    <span>{c.label}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </Section>

      {/* 4 · Plan items with per-item notes */}
      {plan && (
        <Section id="plan" n="4" title="Plan notes" lead="A note on an item is shown to the customer on that item.">
          <div className="rv-items">
            {plan.items.map((it) => (
              <div key={it.id} className="rv-item">
                <div className="rv-item-head">
                  <b>{it.title}</b>
                  <span className="rv-cat">{it.category}</span>
                  {it.clinical && <span className="rv-flag">clinical</span>}
                  <GradeBadge grade={it.grade} />
                </div>
                <p className="rv-why">{it.why}</p>
                <input
                  className="rv-note"
                  disabled={readOnly}
                  placeholder="Note to the customer (optional)"
                  value={itemNotes[it.id] ?? ""}
                  onChange={(e) => edit(setItemNotes)({ ...itemNotes, [it.id]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 5 · Visuals */}
      <Section
        id="visuals"
        n="5"
        title="After images"
        lead="Generate each after image from the customer's photo, then refine it with remarks. Every attempt is kept with its cost. Tick the attempts to send; nothing reaches the customer before you approve below."
      >
        <Visuals bundle={bundle} plan={plan} intake={intake} readOnly={readOnly} reload={reload} selection={selection} />
      </Section>

      {/* 6 · Notes, save, request changes, approve */}
      <section id="rv-release" className="rv-release">
        <div className="field">
          <label htmlFor="rv-msg">Message to the customer</label>
          <textarea
            id="rv-msg"
            rows={4}
            disabled={readOnly}
            value={notes}
            placeholder="e.g. Start with sleep and protein; the after image assumes 12 months of the training plan."
            onChange={(e) => edit(setNotes)(e.target.value)}
          />
        </div>
        <div className="rv-release-bar">
          <span>
            {saveMsg ? <span className={saveMsg.ok ? "" : "rv-due-over"}>{saveMsg.text}</span> : dirty ? "Unsaved changes" : review ? "Saved" : "Not saved yet"}
          </span>
          <div className="rv-actions">
            {order.status === "in_review" && (
              <button className="btn btn-ghost" disabled={statusBusy || saving} onClick={() => changeStatus("changes_requested")}>
                Request changes
              </button>
            )}
            <button className="btn" disabled={readOnly || saving || !dirty} onClick={save}>
              {saving ? "Saving…" : "Save review"}
            </button>
          </div>
        </div>
        {statusErr && (
          <div className="rv-error" role="alert">
            Status not changed: {statusErr}
          </div>
        )}
      </section>

      <Approve bundle={bundle} allDone={allDone} done={done} total={list.length} notes={notes} saveFirst={save} readOnly={readOnly} reviewLocked={reviewLocked} selected={selection.selected} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

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

function KeyResults({ scan, intake, plan }: { scan: Scan; intake: Intake | null; plan: Plan | null }) {
  const cap = scan.face?.capture;
  const bmi = intake ? bmiOf(intake) : null;
  const scores = plan ? (Object.entries(plan.current) as [ScoreKey, number][]) : [];
  return (
    <>
      {cap && (
        <div className="rv-facts">
          <Fact k="Head turn (yaw)" v={`${cap.yaw.toFixed(1)}°`} warn={Math.abs(cap.yaw) > 8} />
          <Fact k="Nod (pitch)" v={`${cap.pitch.toFixed(1)}°`} warn={Math.abs(cap.pitch) > 10} />
          <Fact k="Tilt (roll)" v={`${cap.roll.toFixed(1)}°`} warn={Math.abs(cap.roll) > 6} />
          <Fact k="Capture" v={cap.closeRange ? "Close-range selfie" : "Distance shot"} warn={cap.closeRange} />
        </div>
      )}
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
      {intake && (
        <div className="rv-intake">
          <Fact k="Preferences" v={intake.preferences} />
          <Fact k="Allergies" v={intake.allergies || "None reported"} warn={!!intake.allergies && !/none/i.test(intake.allergies)} />
          <Fact k="Limitations" v={intake.limitations || "None reported"} warn={!!intake.limitations && !/none/i.test(intake.limitations)} />
          <Fact k="Training" v={`${intake.trainingDays} d/week`} />
          <Fact k="Sleep" v={`${intake.sleepHours} h`} />
          <Fact k="Hair" v={`${intake.hairType} · ${intake.hairLengthCm} cm · loss: ${intake.hairLoss}`} />
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  After images: generate, iterate with remarks, choose               */
/* ------------------------------------------------------------------ */

interface Selection {
  selected: Set<string>;
  toggle: (id: string) => void;
}

/** Which generations the reviewer will send, seeded from rows already marked approved. Only finished attempts count. */
function useSelection(gens: GenRow[]): Selection {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(gens.filter((g) => g.approved).map((g) => g.id)));
  const selected = useMemo(() => new Set(gens.filter((g) => g.status === "succeeded" && picked.has(g.id)).map((g) => g.id)), [gens, picked]);
  const toggle = (id: string) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return { selected, toggle };
}

function Visuals({
  bundle,
  plan,
  intake,
  readOnly,
  reload,
  selection: { selected, toggle },
}: {
  bundle: ReviewBundle;
  plan: Plan | null;
  intake: Intake | null;
  readOnly: boolean;
  reload: () => void;
  selection: Selection;
}) {
  const gens = bundle.generations as GenRow[];
  const hasBody = !!bundle.photos.body || !!bundle.photos.side;
  const hasAlt = !!(bundle.photos.face45 || bundle.photos.faceLeft || bundle.photos.faceRight);
  const [showAlt, setShowAlt] = useState(() => gens.some((g) => g.kind === "face_after_alt"));
  const total = gens.reduce((s, g) => s + (g.cost_usd || 0), 0);
  const specs = KIND_SPECS.filter((k) => {
    if (k.kind === "body_after_front" || k.kind === "body_after_side") return hasBody || gens.some((g) => g.kind === k.kind);
    if (k.optional) return showAlt;
    return true;
  });
  const photosGone = !!bundle.scan?.photos_deleted_at;

  return (
    <div className="rv-visuals">
      {!plan && (
        <p className="rv-foot" style={{ marginTop: 0 }}>
          The plan could not be rebuilt from this scan, so the prompts start empty. Write a prompt before generating.
        </p>
      )}
      {photosGone && <div className="rv-banner rv-banner-warn">The photos have been deleted, so new images cannot be generated.</div>}
      {specs.map((spec) => (
        <KindCard
          key={spec.kind}
          spec={spec}
          orderId={bundle.order.id}
          gens={gens.filter((g) => g.kind === spec.kind)}
          all={gens}
          base={basePrompt(spec.kind, plan, intake)}
          selected={selected}
          toggle={toggle}
          readOnly={readOnly || photosGone}
          reload={reload}
        />
      ))}
      <div className="rv-visuals-foot">
        <span className="mono-sm">
          {gens.length} attempt{gens.length === 1 ? "" : "s"} · total cost {usd(total)}
        </span>
        {!showAlt && hasAlt && !readOnly && (
          <button className="btn btn-ghost" onClick={() => setShowAlt(true)}>
            Add an optional face after from another angle
          </button>
        )}
      </div>
    </div>
  );
}

function KindCard({
  spec,
  orderId,
  gens,
  all,
  base,
  selected,
  toggle,
  readOnly,
  reload,
}: {
  spec: KindSpec;
  orderId: string;
  gens: GenRow[];
  all: GenRow[];
  base: string;
  selected: Set<string>;
  toggle: (id: string) => void;
  readOnly: boolean;
  reload: () => void;
}) {
  const [prompt, setPrompt] = useState(base);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState<"generate" | "regenerate" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ok = gens.filter((g) => g.status === "succeeded" && g.url);
  const [parentId, setParentId] = useState<string | null>(null);
  const parent = gens.find((g) => g.id === parentId && g.status === "succeeded") ?? ok[ok.length - 1] ?? null;
  const num = useMemo(() => new Map(all.map((g) => [g.id, all.filter((x) => x.kind === g.kind).indexOf(g) + 1])), [all]);
  const cost = gens.reduce((s, g) => s + (g.cost_usd || 0), 0);
  const chosen = gens.filter((g) => selected.has(g.id)).length;
  const prevCount = useRef(gens.length);
  const threadEnd = useRef<HTMLDivElement>(null);

  // keep the newest attempt in view after a generation
  useEffect(() => {
    if (gens.length > prevCount.current) threadEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    prevCount.current = gens.length;
  }, [gens.length]);

  const run = async (mode: "generate" | "regenerate") => {
    setBusy(mode);
    setErr(null);
    try {
      if (mode === "generate") {
        if (!prompt.trim()) throw new Error("Write a prompt first.");
        await generateVisual({ order_id: orderId, kind: spec.kind, prompt: prompt.trim() });
      } else {
        if (!parent) throw new Error("There is no finished attempt to refine yet.");
        // kind comes from the parent; the base prompt is resent as context and the server adds the iteration instructions
        const root = rootOf(parent, all);
        await generateVisual({
          order_id: orderId,
          parent_id: parent.id,
          kind: parent.kind,
          remarks: remarks.trim() || null,
          prompt: prompt.trim() || root.prompt,
        });
        setRemarks("");
        setParentId(null);
      }
      invalidate();
    } catch (e) {
      setErr(errorText(e));
      // a failed attempt is stored as a row with its error; show it in the thread
      reload();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rv-kind">
      <div className="rv-kind-head">
        <div>
          <h3 className="title-md" style={{ fontSize: 17 }}>
            {spec.label} {spec.optional && <span className="rv-cat">optional</span>}
          </h3>
          <span className="rv-sub">
            {spec.hint} {gens.length > 0 && `${gens.length} attempt${gens.length === 1 ? "" : "s"} · ${usd(cost)} · ${chosen} chosen`}
          </span>
        </div>
        <button className="btn" disabled={readOnly || busy !== null} onClick={() => run("generate")}>
          {busy === "generate" ? "Generating…" : gens.length ? "Generate new from the photo" : "Generate"}
        </button>
      </div>
      <details className="rv-prompt">
        <summary>Prompt{prompt !== base ? " (edited)" : ""}</summary>
        <textarea rows={8} value={prompt} disabled={readOnly} onChange={(e) => setPrompt(e.target.value)} />
        {prompt !== base && base && (
          <button className="btn btn-ghost" style={{ height: 30, fontSize: 12 }} onClick={() => setPrompt(base)}>
            Reset to the built prompt
          </button>
        )}
      </details>
      {err && (
        <div className="rv-error" role="alert">
          {err}
        </div>
      )}

      {gens.length > 0 && (
        <div className="rv-thread">
          {gens.map((g) => {
            const n = num.get(g.id);
            const from = g.parent_id ? num.get(g.parent_id) : null;
            const isParent = parent?.id === g.id;
            return (
              <div key={g.id} className={`rv-attempt ${selected.has(g.id) ? "on" : ""} ${isParent ? "parent" : ""}`}>
                <div className="rv-attempt-img">
                  {g.url ? (
                    <a href={g.url} target="_blank" rel="noreferrer">
                      <img src={g.url} alt={`${spec.label}, attempt ${n}`} loading="lazy" />
                    </a>
                  ) : (
                    <span className="rv-attempt-empty">{g.status === "failed" ? "Failed" : g.status === "succeeded" ? "Image unavailable" : "Working…"}</span>
                  )}
                </div>
                <div className="rv-attempt-body">
                  <div className="rv-attempt-top">
                    <b>#{n}</b>
                    <span className={`rv-gen rv-gen-${g.status}`}>{g.status}</span>
                    <span className="mono-sm">{usd(g.cost_usd || 0)}</span>
                    <span className="mono-sm">{fmtDateTime(g.created_at)}</span>
                    {g.approved && <span className="rv-flag">sent</span>}
                  </div>
                  <span className="rv-sub">{from ? `Refined from #${from}` : "From the original photo"}</span>
                  {g.remarks && <p className="rv-remarks">“{g.remarks}”</p>}
                  {g.status === "failed" && g.error && <p className="rv-due-over rv-attempt-err">{g.error}</p>}
                  {g.status === "succeeded" && (
                    <div className="rv-attempt-actions">
                      <label className={`rv-check rv-check-sm ${selected.has(g.id) ? "on" : ""}`}>
                        <input type="checkbox" disabled={readOnly} checked={selected.has(g.id)} onChange={() => toggle(g.id)} />
                        <span>Send this one</span>
                      </label>
                      {!readOnly && g.url && (
                        <button className="btn btn-ghost" style={{ height: 30, fontSize: 12 }} disabled={isParent} onClick={() => setParentId(g.id)}>
                          {isParent ? "Refining this" : "Refine this"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={threadEnd} />
        </div>
      )}

      {!readOnly && parent && (
        <div className="rv-iterate">
          <label htmlFor={`rv-rem-${spec.kind}`} className="mono-sm">
            Remarks for attempt #{num.get(parent.id)}
          </label>
          <textarea
            id={`rv-rem-${spec.kind}`}
            rows={2}
            maxLength={2000}
            value={remarks}
            placeholder="e.g. Keep the original nose and skin tone; beard shorter on the cheeks; less muscle on the arms."
            onChange={(e) => setRemarks(e.target.value)}
          />
          <div className="rv-actions">
            <span className="rv-sub">Edits attempt #{num.get(parent.id)} and keeps the original photo as the identity reference.</span>
            <button className="btn" disabled={busy !== null} onClick={() => run("regenerate")}>
              {busy === "regenerate" ? "Regenerating…" : "Regenerate"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function rootOf(g: GenRow, all: GenRow[]): GenRow {
  const byId = new Map(all.map((x) => [x.id, x]));
  let cur = g;
  for (let i = 0; i < 50 && cur.parent_id && byId.has(cur.parent_id); i++) cur = byId.get(cur.parent_id)!;
  return cur;
}

/* ------------------------------------------------------------------ */
/*  Approve and send                                                   */
/* ------------------------------------------------------------------ */

function Approve({
  bundle,
  allDone,
  done,
  total,
  notes,
  saveFirst,
  readOnly,
  reviewLocked,
  selected,
}: {
  bundle: ReviewBundle;
  allDone: boolean;
  done: number;
  total: number;
  notes: string;
  saveFirst: () => Promise<boolean>;
  readOnly: boolean;
  reviewLocked: boolean;
  selected: Set<string>;
}) {
  const gens = bundle.generations as GenRow[];
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ emailed: boolean | null } | null>(null);
  const chosen = gens.filter((g) => selected.has(g.id));
  const missing = KIND_SPECS.filter((k) => !k.optional && gens.some((g) => g.kind === k.kind) && !chosen.some((g) => g.kind === k.kind));
  const inReview = bundle.order.status === "in_review";
  const blocked = !inReview ? "The order must be in review to deliver it." : !allDone ? `Finish the checklist first (${done}/${total}).` : null;

  const send = async () => {
    setBusy(true);
    setErr(null);
    try {
      // persist the checklist and per-item notes while the review is still editable
      if (!reviewLocked && !(await saveFirst())) throw new Error("The review could not be saved, so nothing was sent.");
      const r = await approveAndSend(
        bundle.order.id,
        chosen.map((g) => g.id),
        notes,
      );
      setResult(r);
      setConfirming(false);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (result)
    return (
      <section className="rv-approve done" role="status">
        <h2 className="title-md">Delivered</h2>
        <p className="lead">
          {result.emailed === true
            ? "The report and the chosen visuals are now available to the customer, and the email went out."
            : result.emailed === false
              ? "The report and the chosen visuals are now available to the customer, but the email did NOT go out. Check the email settings, and let the customer know another way."
              : isMock
                ? "Delivered in the demo backend. No email is sent in demo mode."
                : "Delivered. The server did not report whether the email went out."}
        </p>
        <Link className="btn btn-ghost" to="/review">
          Back to the queue
        </Link>
      </section>
    );

  if (readOnly && bundle.order.status === "delivered") return null;

  return (
    <section className="rv-approve">
      <h2 className="title-md">Approve and send</h2>
      <p className="lead">
        Delivers the report, your message and the chosen visuals to the customer and emails them. Nothing is visible to the customer before this step.
      </p>
      <ul className="rv-approve-list">
        {KIND_SPECS.map((k) => {
          const c = chosen.filter((g) => g.kind === k.kind);
          if (!c.length && !gens.some((g) => g.kind === k.kind)) return null;
          return (
            <li key={k.kind}>
              <b>{k.label}:</b> {c.length ? `${c.length} chosen` : "none chosen"}
            </li>
          );
        })}
        {gens.length === 0 && <li>No after images generated. The report will be sent without visuals.</li>}
      </ul>
      {missing.length > 0 && <p className="rv-due-soon">No attempt chosen for: {missing.map((m) => m.label.toLowerCase()).join(", ")}.</p>}
      {blocked && <p className="rv-sub">{blocked}</p>}
      {err && (
        <div className="rv-error" role="alert">
          Not delivered: {err}
        </div>
      )}
      {!confirming ? (
        <button className="btn" disabled={!!blocked || (readOnly && !(reviewLocked && inReview)) || busy} onClick={() => setConfirming(true)}>
          Approve and send…
        </button>
      ) : (
        <div className="rv-confirm">
          <p>
            Send this report{chosen.length ? ` with ${chosen.length} visual${chosen.length === 1 ? "" : "s"}` : " without visuals"} to the customer now? The review is locked afterwards and this cannot be undone from the console.
          </p>
          <div className="rv-actions">
            <button className="btn btn-ghost" disabled={busy} onClick={() => setConfirming(false)}>
              Cancel
            </button>
            <button className="btn" disabled={busy} onClick={send}>
              {busy ? "Sending…" : "Yes, approve and send"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
