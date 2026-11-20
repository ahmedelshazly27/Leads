/*
 * /orders/:orderId: the customer's order after checkout.
 *
 * - ?checkout=success: the payment is confirmed by the Stripe webhook a few
 *   seconds later, so the page polls until the order leaves pending_payment.
 * - awaiting_photos / changes_requested: photo consent FIRST (it also covers
 *   the health answers in the questionnaire), then the guided scan in order
 *   mode, which sends the scan for review with submitScan.
 * - in_review: status and due time. delivered: report, approved AI
 *   illustrations, reviewer notes and the PDF.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ConsentGate, type ConsentResult } from "../../components/ConsentGate";
import { SignIn } from "../../components/SignIn";
import { NewScan } from "../NewScan";
import { OpenReport, rememberLocalScan, useLocalScan } from "./openReport";
import type { Lang } from "../../lib/i18n";
import {
  activeConsents,
  backendEnabled,
  hoursLeft,
  recordConsents,
  SLA_HOURS,
  useMyConsents,
  useMyReview,
  useMyVisuals,
  useOrder,
  useOrderScan,
  useSession,
  type CustomerVisual,
  type OrderRow,
  type OrderStatus,
} from "../../lib/backend";
import { visualCaptions } from "../review/serverShared";
import { FlowHead, FlowOff, FlowShell, flowHref, fmtDate, LegalLinks, Spinner, useFlowLang } from "./FlowShell";

/** Photos are deleted this many days after delivery. */
const PHOTO_RETENTION_DAYS = 90;
const DAY = 86_400_000;


export function Order() {
  const lang = useFlowLang();
  const [wide, setWide] = useState(false);
  if (!backendEnabled) return <FlowOff lang={lang} />;
  return (
    <FlowShell lang={lang} wide={wide}>
      <OrderInner lang={lang} setWide={setWide} />
      <LegalLinks lang={lang} />
    </FlowShell>
  );
}

function OrderInner({ lang, setWide }: { lang: Lang; setWide: (w: boolean) => void }) {
  const { orderId = "" } = useParams();
  const { session, ready } = useSession();

  if (!ready)
    return (
      <div className="fl-card" aria-busy="true">
        <p>Loading…</p>
      </div>
    );
  if (!session)
    return (
      <>
        <FlowHead strong="Your order" lead="Sign in with the email you used to pay to see your order." />
        <SignIn locale={lang} />
      </>
    );
  return <OrderView key={orderId} orderId={orderId} lang={lang} setWide={setWide} />;
}

/* --------------------------- Payment polling -------------------------- */

const FAST_POLL_MS = 2500;
const FAST_FOR_MS = 60_000;
const SLOW_POLL_MS = 10_000;

function usePaymentPolling(active: boolean, refresh: () => void) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) return;
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      refresh();
      const elapsed = Date.now() - started;
      setSlow(elapsed > FAST_FOR_MS);
      timer = setTimeout(tick, elapsed > FAST_FOR_MS ? SLOW_POLL_MS : FAST_POLL_MS);
    };
    timer = setTimeout(tick, FAST_POLL_MS);
    return () => clearTimeout(timer);
  }, [active, refresh]);
  return slow;
}

/* ------------------------------ Order view ---------------------------- */

function OrderView({ orderId, lang, setWide }: { orderId: string; lang: Lang; setWide: (w: boolean) => void }) {
  const [params, setParams] = useSearchParams();
  const justPaid = params.get("checkout") === "success";
  const q = useOrder(orderId);
  const order = q.data;
  const status = order?.status;

  // pending_payment right after checkout, or "paid" while the webhook moves it on to awaiting_photos
  const waitingForWebhook = !!order && (status === "paid" || (justPaid && status === "pending_payment"));
  // a fresh order can briefly be unreadable right after the redirect; keep trying for a while
  const pollMissing = justPaid && order === null;
  const slow = usePaymentPolling(waitingForWebhook || pollMissing, q.refresh);

  // once confirmed, drop ?checkout=success so a reload does not show the payment note again
  const [paidNote, setPaidNote] = useState(false);
  useEffect(() => {
    if (justPaid && order && status !== "pending_payment" && status !== "paid") {
      setPaidNote(true);
      // the /start progress is done with: a new visit to /start begins fresh
      try {
        localStorage.removeItem("facet-start");
      } catch {
        /* storage blocked */
      }
      const next = new URLSearchParams(params);
      next.delete("checkout");
      setParams(next, { replace: true });
    }
  }, [justPaid, order, status, params, setParams]);

  if (order === undefined) {
    if (q.error)
      return (
        <div className="fl-card">
          <p className="fl-note is-bad" role="alert">
            We could not load your order. Check your connection and try again.
          </p>
          <div className="fl-row">
            <button type="button" className="fl-btn" onClick={q.refresh}>
              Try again
            </button>
          </div>
        </div>
      );
    return (
      <div className="fl-card" aria-busy="true">
        <p>Loading your order…</p>
      </div>
    );
  }

  if (order === null) {
    if (pollMissing && !slow)
      return (
        <div className="fl-card" role="status">
          <div className="fl-row">
            <Spinner />
            <p>Confirming your payment…</p>
          </div>
        </div>
      );
    return (
      <>
        <FlowHead muted="Order" strong="not found" />
        <div className="fl-card">
          <p>We could not find this order in your account. If you paid with a different email, sign in with that one.</p>
          <div className="fl-row">
            <Link to={flowHref("/account", lang)} className="fl-btn">
              Go to my account
            </Link>
          </div>
        </div>
      </>
    );
  }

  const checkin = order.product === "checkin";
  return (
    <>
      <FlowHead strong={checkin ? "Your monthly check-in" : "Your report order"} lead={`Ordered on ${fmtDate(order.created_at, lang)}`} />
      {paidNote && (
        <p className="fl-note is-ok" role="status">
          Payment received. Thank you.
        </p>
      )}
      <Timeline order={order} lang={lang} />
      <StatusBody order={order} lang={lang} waitingForWebhook={waitingForWebhook} slow={slow} refresh={q.refresh} setWide={setWide} />
    </>
  );
}

/* ------------------------------- Timeline ----------------------------- */

const STEP_ORDER: OrderStatus[] = ["pending_payment", "awaiting_photos", "in_review", "delivered"];
function progressIndex(s: OrderStatus): number {
  if (s === "paid") return 1;
  if (s === "changes_requested") return 1;
  return STEP_ORDER.indexOf(s);
}

function Timeline({ order, lang }: { order: OrderRow; lang: Lang }) {
  if (order.status === "refunded" || order.status === "cancelled") return null;
  const at = progressIndex(order.status);
  const items: { title: string; sub?: string }[] = [
    { title: "Payment", sub: order.paid_at ? `Paid on ${fmtDate(order.paid_at, lang)}` : at === 0 ? "Waiting for confirmation" : undefined },
    {
      title: "Your photos",
      sub:
        order.status === "changes_requested"
          ? "Your reviewer asked for new photos"
          : order.submitted_at
            ? `Sent on ${fmtDate(order.submitted_at, lang)}`
            : at === 1
              ? "Your next step"
              : undefined,
    },
    { title: "Review", sub: order.status === "in_review" && order.due_at ? `Due by ${fmtDate(order.due_at, lang, true)}` : at < 2 ? `Within ${SLA_HOURS} hours of your photos` : undefined },
    { title: "Report delivered", sub: order.delivered_at ? `Delivered on ${fmtDate(order.delivered_at, lang)}` : undefined },
  ];
  const deliveredAll = order.status === "delivered";
  return (
    <div className="fl-card">
      <ol className="fl-tl" aria-label="Order progress">
        {items.map((it, i) => {
          const done = deliveredAll || i < at;
          const now = !deliveredAll && i === at;
          return (
            <li key={it.title} className={done ? "is-done" : now ? "is-now" : ""} aria-current={now ? "step" : undefined}>
              <span className="fl-tl-dot" aria-hidden="true">
                {done ? "✓" : ""}
              </span>
              <span className="fl-tl-text">
                <span className="fl-tl-title">{it.title}</span>
                {it.sub && <span className="fl-tl-sub">{it.sub}</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ------------------------------ Per status ---------------------------- */

function StatusBody({
  order,
  lang,
  waitingForWebhook,
  slow,
  refresh,
  setWide,
}: {
  order: OrderRow;
  lang: Lang;
  waitingForWebhook: boolean;
  slow: boolean;
  refresh: () => void;
  setWide: (w: boolean) => void;
}) {
  const start = lang === "ar" ? "/ar/start" : "/start";
  switch (order.status) {
    case "pending_payment":
    case "paid":
      if (waitingForWebhook)
        return (
          <div className="fl-card" role="status">
            <div className="fl-row">
              <Spinner />
              <h2>{order.status === "paid" ? "Getting your order ready…" : "Confirming your payment…"}</h2>
            </div>
            <p>This usually takes a few seconds. You can stay on this page; it updates by itself.</p>
            {slow && (
              <p className="fl-note">
                This is taking longer than usual. If your payment went through, your order will update here; you don't need to pay again.
              </p>
            )}
            <div className="fl-row">
              <button type="button" className="fl-btn is-ghost" onClick={refresh}>
                Check again
              </button>
            </div>
          </div>
        );
      return (
        <div className="fl-card">
          <h2>Waiting for payment</h2>
          <p>We have not received a payment for this order. If you didn't finish paying, you can start again. You have not been charged.</p>
          <div className="fl-row">
            <Link to={start} className="fl-btn">
              Start again
            </Link>
            <button type="button" className="fl-btn is-ghost" onClick={refresh}>
              Check again
            </button>
          </div>
        </div>
      );
    case "awaiting_photos":
    case "changes_requested":
      return <PhotosStep order={order} lang={lang} refresh={refresh} setWide={setWide} />;
    case "in_review":
      return <InReview order={order} lang={lang} />;
    case "delivered":
      return <Delivered order={order} lang={lang} />;
    case "refunded":
      return (
        <div className="fl-card">
          <h2>Refunded</h2>
          <p>This order was refunded. The money goes back to the card or wallet you paid with; your bank may take a few days to show it.</p>
          <Link to={flowHref("/account", lang)} className="fl-link">
            Go to my account
          </Link>
        </div>
      );
    case "cancelled":
      return (
        <div className="fl-card">
          <h2>Cancelled</h2>
          <p>
            {order.paid_at
              ? "This order was cancelled. If a refund is due under the refund policy, it goes back to the card or wallet you paid with; write to us if you have a question."
              : "This order was cancelled. You have not been charged for it."}
          </p>
          <div className="fl-row">
            <Link to={start} className="fl-btn">
              Start a new order
            </Link>
          </div>
        </div>
      );
  }
}

/* --------------------------- Photos (awaiting) ------------------------ */

type Phase = "intro" | "consent" | "scan";

function PhotosStep({ order, lang, refresh, setWide }: { order: OrderRow; lang: Lang; refresh: () => void; setWide: (w: boolean) => void }) {
  const consents = useMyConsents();
  /*
   * Before the photos go out we need, on record: the photo consent, and the
   * request to start the review within the 14-day withdrawal period
   * ("withdrawal_waiver"; submit-scan refuses without it). The waiver is asked
   * again for each report bought, so for a report it is only taken as given
   * when it is newer than this order's payment (a monthly check-in falls under
   * the membership's waiver). Timestamps are compared as dates, not strings
   * ("+00:00" vs "Z", fractional seconds).
   */
  const hasPhotoConsent = useMemo(() => {
    if (!consents.data) return null;
    const active = activeConsents(consents.data);
    const waiver = active.withdrawal_waiver;
    if (!active.photos || !waiver) return false;
    if (order.product !== "report") return true;
    const paidAt = Date.parse(order.paid_at ?? order.created_at);
    const givenAt = Date.parse(waiver.granted_at);
    return !Number.isFinite(paidAt) || (Number.isFinite(givenAt) && givenAt >= paidAt);
  }, [consents.data, order.product, order.paid_at, order.created_at]);
  const [phase, setPhase] = useState<Phase>("intro");
  /** the scan asked for consent again: keep it mounted (the analysis is in it) and show the consent above it */
  const [consentAgain, setConsentAgain] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setWide(phase === "scan" && !consentAgain);
    return () => setWide(false);
  }, [phase, consentAgain, setWide]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [phase, consentAgain]);

  async function onConsent(result: ConsentResult) {
    setBusy(true);
    setError(null);
    try {
      await recordConsents(
        result.consents.map((c) => c.kind),
        result.consents[0]?.version,
      );
      if (consentAgain) {
        setConsentAgain(false);
        setRetryKey((k) => k + 1);
      } else setPhase("scan");
    } catch (e) {
      console.warn("recordConsents failed", e);
      setError("We could not save your consent. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const begin = () => setPhase(hasPhotoConsent ? "scan" : "consent");

  const consentGate = (
    <>
      {consentAgain && (
        <p className="fl-note" role="status">
          Please confirm your photo consent and that you want your review to start now. Your analysis is kept, and we send it as soon as you confirm.
        </p>
      )}
      {error && (
        <p className="fl-note is-bad" role="alert">
          {error}
        </p>
      )}
      <ConsentGate
        steps={["photos"]}
        lang={lang}
        busy={busy}
        onComplete={onConsent}
        onCancel={() => (consentAgain ? setConsentAgain(false) : setPhase("intro"))}
      />
    </>
  );

  const again = order.status === "changes_requested";
  if (phase === "intro")
    return (
      <div className="fl-card">
        <h2>{again ? "Your reviewer needs new photos" : "Next: your photos"}</h2>
        {again ? (
          <>
            <p>Some of your photos could not be used for a reliable review, for example because of the light, the angle or something covering your face. Nothing is wrong with your order.</p>
            <h3>What to do</h3>
            <ol className="fl-list">
              <li>Tap Start below and answer the short questionnaire again.</li>
              <li>Take the full photo session again and follow the guide on each photo: face straight to the camera, nothing covering it, hair off the forehead.</li>
              <li>Send your new photos for review at the end. Your reviewer's time starts again from when you send them.</li>
            </ol>
            <p className="fl-muted">If you are not sure what to change, contact us before you start.</p>
          </>
        ) : (
          <p>A short questionnaire, then a guided photo session.</p>
        )}
        <ul className="fl-list">
          <li>A plain wall, soft light from the front, and someone to take the photos (or a timer)</li>
          <li>Fitted clothes for the body photos</li>
          <li>The analysis runs on your device first; you send it to your reviewer at the end</li>
        </ul>
        <div className="fl-row">
          <button type="button" className="fl-btn" onClick={begin} disabled={hasPhotoConsent === null && consents.loading}>
            {hasPhotoConsent === null && consents.loading ? "Loading…" : "Start"}
          </button>
        </div>
      </div>
    );

  if (phase === "consent") return consentGate;

  return (
    <>
      {consentAgain && consentGate}
      <div style={consentAgain ? { display: "none" } : undefined}>
        <NewScan
          order={{
            orderId: order.id,
            retryKey,
            onSubmitted: ({ localScanId }) => {
              rememberLocalScan(order.id, localScanId);
              refresh();
            },
            onConsentRequired: () => setConsentAgain(true),
            onWrongStatus: () => {
              setPhase("intro");
              refresh();
            },
          }}
        />
      </div>
    </>
  );
}

/* ------------------------------- In review ---------------------------- */

function InReview({ order, lang }: { order: OrderRow; lang: Lang }) {
  const left = hoursLeft(order);
  const local = useLocalScan(order.id, null);
  return (
    <div className="fl-card">
      <h2>Your reviewer is checking your results</h2>
      <p>
        {order.due_at
          ? `Your report is due by ${fmtDate(order.due_at, lang, true)}.`
          : `Your report is due within ${SLA_HOURS} hours of sending your photos.`}
      </p>
      {left !== null && left > 0 && <p className="fl-muted">{left < 1 ? "Less than an hour to go." : `About ${Math.ceil(left)} hours to go.`}</p>}
      <p>We email you as soon as it is ready. Nothing reaches you before a person has checked it.</p>
      {local.scan && (
        <div className="fl-row">
          <button type="button" className="fl-btn is-ghost" onClick={() => local.open("/analysis/getting-started")}>
            See your on-device results while you wait
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Delivered ---------------------------- */

function Delivered({ order, lang }: { order: OrderRow; lang: Lang }) {
  const review = useMyReview(order.id);
  const visuals = useMyVisuals(order.id);
  const server = useOrderScan(order.id);

  const photosGoneAt = server.data?.scan.photos_deleted_at ?? null;
  const deleteOn = order.delivered_at ? new Date(Date.parse(order.delivered_at) + PHOTO_RETENTION_DAYS * DAY).toISOString() : null;

  return (
    <>
      <div className="fl-card">
        <h2>Your report is ready</h2>
        <p>Checked and approved by your reviewer.</p>
        <OpenReport order={order} lang={lang} />
      </div>

      <div className="fl-card">
        <h2>Notes from your reviewer</h2>
        {review.loading && review.data === undefined ? (
          <p>Loading…</p>
        ) : review.data?.notes?.trim() ? (
          <div className="fl-notes">{review.data.notes}</div>
        ) : (
          <p>Your reviewer did not add a general note. Notes on single items are shown in your report.</p>
        )}
      </div>

      <div className="fl-card">
        <h2>Your AI illustrations</h2>
        <p className="fl-muted">Generated from your photos and approved by your reviewer. They illustrate a possible result of the plan; they are not a promise or a medical prediction.</p>
        {visuals.loading && visuals.data === undefined ? (
          <p>Loading…</p>
        ) : visuals.error ? (
          <p className="fl-note">The illustrations could not be loaded right now. Please reload the page in a moment.</p>
        ) : visuals.data && visuals.data.length ? (
          <VisualGrid visuals={visuals.data} />
        ) : (
          <p>There are no illustrations for this order.</p>
        )}
      </div>

      <div className="fl-card">
        <h3>Your photos</h3>
        <p>
          {photosGoneAt
            ? `Your photos were deleted on ${fmtDate(photosGoneAt, lang)}. Your measurements and plan stay in your account.`
            : deleteOn
              ? `Your photos are deleted automatically on ${fmtDate(deleteOn, lang)}, 90 days after delivery. Your measurements and plan stay in your account.`
              : "Your photos are deleted automatically 90 days after delivery."}
        </p>
        <Link to={flowHref("/account", lang)} className="fl-link">
          Privacy and your data
        </Link>
      </div>
    </>
  );
}

function VisualGrid({ visuals }: { visuals: CustomerVisual[] }) {
  const caps = visualCaptions(visuals);
  return (
    <div className="fl-visuals">
      {visuals.map((v) => {
        const caption = caps.get(v.generation_id) ?? v.kind;
        return (
          <figure key={v.generation_id}>
            <a href={v.url} target="_blank" rel="noopener noreferrer">
              <img src={v.url} alt={`AI illustration: ${caption}`} loading="lazy" />
            </a>
            <figcaption>{caption}</figcaption>
          </figure>
        );
      })}
    </div>
  );
}
