/*
 * /account: orders, membership, and privacy (download my data, withdraw photo
 * consent, delete my account). Membership-only checkout returns here with
 * ?checkout=success.
 *
 * The membership is cancelled, resumed or (yearly, once paid) ended early with
 * a refund through manage-membership. The 30 days included with a report-only
 * purchase (isIncluded) never renew: they show their end date and the
 * buttons to join monthly or yearly instead.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SignIn } from "../../components/SignIn";
import { BRAND_NAME } from "../../lib/brand";
import type { Lang } from "../../lib/i18n";
import {
  activeConsents,
  backendEnabled,
  deleteMyData,
  downloadMyData,
  isActiveMember,
  includedUntil,
  isCancelling,
  isIncluded,
  manageMembership,
  yearlyEndNowRefund,
  type MembershipAction,
  signOut,
  useMyConsents,
  useMyOrders,
  useMySubscription,
  useSession,
  withdrawConsent,
  withdrawPhotoConsent,
  type OrderRow,
  type OrderStatus,
  type SubscriptionRow,
} from "../../lib/backend";
import { legalHref } from "../legal/content";
import { CountrySelect } from "../../components/CountrySelect";
import { fmt, priceFor, priceIn, useMarket } from "../../lib/pricing";
import { errCode, FlowHead, FlowOff, FlowShell, flowHref, fmtDate, goToCheckout, LegalLinks, money, Spinner, useFlowLang } from "./FlowShell";
import { OpenReport } from "./openReport";

export function Account() {
  const lang = useFlowLang();
  const [deleted, setDeleted] = useState(false);
  if (!backendEnabled) return <FlowOff lang={lang} />;
  return (
    <FlowShell lang={lang}>
      {deleted ? <Deleted lang={lang} /> : <AccountInner lang={lang} onDeleted={() => setDeleted(true)} />}
      <LegalLinks lang={lang} />
    </FlowShell>
  );
}

function Deleted({ lang }: { lang: Lang }) {
  return (
    <>
      <FlowHead muted="Account" strong="deleted" />
      <div className="fl-card" role="status">
        <p>Your account, photos, scans and illustrations have been deleted, and you have been signed out. Payment records are kept for our accounts, without your name or email.</p>
        <div className="fl-row">
          <Link to={lang === "ar" ? "/ar" : "/"} className="fl-btn">
            Back to the home page
          </Link>
        </div>
      </div>
    </>
  );
}

function AccountInner({ lang, onDeleted }: { lang: Lang; onDeleted: () => void }) {
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
        <FlowHead strong="Your account" lead="Sign in to see your orders, your membership and your data." />
        <SignIn locale={lang} />
      </>
    );
  return (
    <>
      <FlowHead strong="Your account" lead={session.email ? `Signed in as ${session.email}` : undefined} />
      <CheckoutNote />
      <Orders lang={lang} />
      <Membership lang={lang} />
      <Privacy lang={lang} onDeleted={onDeleted} />
      <div className="fl-row">
        <button type="button" className="fl-btn is-ghost" onClick={() => signOut()}>
          Sign out
        </button>
      </div>
    </>
  );
}

/* --------------------------- After checkout --------------------------- */

function CheckoutNote() {
  const [params, setParams] = useSearchParams();
  const justPaid = params.get("checkout") === "success";
  const cancelledPay = params.get("checkout") === "cancelled";
  const sub = useMySubscription();
  // only memberships are paid for on /account: the included month (already active) does not count as the payment arriving
  const member = isActiveMember(sub.data) && !isIncluded(sub.data);
  const { refresh } = sub;

  // the subscription is written by the payment webhook a few seconds after checkout
  useEffect(() => {
    if (!justPaid || member) return;
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      refresh();
      if (Date.now() - started < 90_000) timer = setTimeout(tick, 3000);
    };
    timer = setTimeout(tick, 2500);
    return () => clearTimeout(timer);
  }, [justPaid, member, refresh]);

  useEffect(() => {
    if (justPaid && member) {
      const next = new URLSearchParams(params);
      next.delete("checkout");
      const t = setTimeout(() => setParams(next, { replace: true }), 8000);
      return () => clearTimeout(t);
    }
  }, [justPaid, member, params, setParams]);

  if (cancelledPay)
    return (
      <p className="fl-note" role="status">
        Payment cancelled. You have not been charged.
      </p>
    );
  if (!justPaid) return null;
  return member ? (
    <p className="fl-note is-ok" role="status">
      Payment received. Your membership is active.
    </p>
  ) : (
    <div className="fl-note" role="status">
      <div className="fl-row">
        <Spinner />
        <span>Payment received. Your membership will show here in a moment.</span>
      </div>
    </div>
  );
}

/* -------------------------------- Orders ------------------------------- */

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Waiting for payment",
  paid: "Paid",
  awaiting_photos: "Waiting for your photos",
  in_review: "In review",
  changes_requested: "New photos needed",
  delivered: "Delivered",
  refunded: "Refunded",
  cancelled: "Cancelled",
};
const statusTone = (s: OrderStatus) => (s === "delivered" ? " is-ok" : s === "awaiting_photos" || s === "changes_requested" ? " is-wait" : "");

function Orders({ lang }: { lang: Lang }) {
  const orders = useMyOrders();
  const { country } = useMarket();
  // abandoned checkouts are not orders from the customer's point of view
  // (a paid order cancelled later, e.g. after the photo consent was withdrawn, stays visible)
  const list = (orders.data ?? []).filter((o) => o.status !== "pending_payment" && !(o.status === "cancelled" && !o.paid_at));
  return (
    <section className="fl-card" aria-labelledby="acc-orders">
      <h2 id="acc-orders">Your orders</h2>
      {orders.data === undefined ? (
        orders.error ? (
          <p className="fl-note is-bad">We could not load your orders. Please reload the page.</p>
        ) : (
          <p>Loading…</p>
        )
      ) : list.length === 0 ? (
        <>
          <p>No orders yet.</p>
          <div className="fl-row">
            <Link to={lang === "ar" ? "/ar/start" : "/start"} className="fl-btn">
              {`Get your report (${fmt(priceFor("report", country), lang)})`}
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className="fl-orders">
            {list.map((o) => (
              <OrderLine key={o.id} order={o} lang={lang} />
            ))}
          </div>
          <LatestReport orders={list} lang={lang} />
        </>
      )}
    </section>
  );
}

function OrderLine({ order, lang }: { order: OrderRow; lang: Lang }) {
  return (
    <Link to={flowHref(`/orders/${order.id}`, lang)} className="fl-order">
      <span className="fl-choice-body">
        <span className="fl-order-title">{order.product === "checkin" ? "Monthly check-in" : "Report and 12-month plan"}</span>
        <span className="fl-muted">{order.amount > 0 ? `${fmtDate(order.created_at, lang)} · ${money(order.amount, order.currency, lang)} paid` : fmtDate(order.created_at, lang)}</span>
      </span>
      <span className={`fl-status${statusTone(order.status)}`}>{STATUS_LABEL[order.status]}</span>
    </Link>
  );
}

/** The newest delivered report: open the plan (first) or the detailed analysis. */
function LatestReport({ orders, lang }: { orders: OrderRow[]; lang: Lang }) {
  const latest = orders.find((o) => o.status === "delivered");
  if (!latest) return null;
  return (
    <div className="fl-report-open">
      <h3>Your latest report</h3>
      <OpenReport order={latest} lang={lang} />
    </div>
  );
}

/* ------------------------------ Membership ----------------------------- */

function Membership({ lang }: { lang: Lang }) {
  const sub = useMySubscription();
  const orders = useMyOrders();
  const hasReport = (orders.data ?? []).some((o) => o.product === "report" && !["pending_payment", "cancelled", "refunded"].includes(o.status));
  const s = sub.data;
  const member = isActiveMember(s);
  return (
    <section className="fl-card" aria-labelledby="acc-member">
      <h2 id="acc-member">Membership</h2>
      {sub.data === undefined ? (
        sub.error ? (
          <p className="fl-note is-bad">We could not load your membership. Please reload the page.</p>
        ) : (
          <p>Loading…</p>
        )
      ) : s && member && isIncluded(s) ? (
        <IncludedDetails sub={s} lang={lang} />
      ) : s && member ? (
        <MemberDetails sub={s} lang={lang} />
      ) : (
        <>
          <p>
            {s && isIncluded(s) && s.current_period_end
              ? `The month of membership included with your report ended on ${fmtDate(s.current_period_end, lang)}.`
              : s?.status === "canceled"
                ? `Your membership ended${s.current_period_end ? ` on ${fmtDate(s.current_period_end, lang)}` : ""}.`
                : "You don't have a membership."}
          </p>
          <p className="fl-muted">Membership adds a monthly check-in scan with updated scores and plan, and a reviewer note each month. Cancel any time.</p>
          {hasReport ? (
            <JoinMembership lang={lang} />
          ) : (
            <p>
              <Link to={lang === "ar" ? "/ar/start" : "/start"} className="fl-link">
                Every report includes 30 days of membership
              </Link>
            </p>
          )}
        </>
      )}
    </section>
  );
}

/** The 30 days of membership included with a report: nothing to pay, nothing renews. */
function IncludedDetails({ sub, lang }: { sub: SubscriptionRow; lang: Lang }) {
  const until = fmtDate(includedUntil(sub) ?? sub.current_period_end, lang);
  return (
    <>
      <dl className="fl-dl">
        <dt>Billing</dt>
        <dd>Included with your report</dd>
        <dt>Price</dt>
        <dd>Nothing to pay</dd>
        <dt>Status</dt>
        <dd>Active</dd>
        {until && (
          <>
            <dt>Ends on</dt>
            <dd>{until}</dd>
          </>
        )}
      </dl>
      <p>
        {until
          ? `Your report includes 30 days of membership. It ends on ${until} and nothing renews, so there is nothing to cancel.`
          : "Your report includes 30 days of membership. It ends by itself and nothing renews, so there is nothing to cancel."}
      </p>
      <h3>Keep your monthly check-ins</h3>
      <p className="fl-muted">
        {until
          ? `Join monthly or yearly to keep the monthly check-in scan and reviewer note after your included month. Nothing is charged before ${until}.`
          : "Join monthly or yearly to keep the monthly check-in scan and reviewer note after your included month. Nothing is charged before it ends."}
      </p>
      <JoinMembership lang={lang} />
    </>
  );
}

function MemberDetails({ sub, lang }: { sub: SubscriptionRow; lang: Lang }) {
  // the currency the membership was bought in (the visitor's country may differ)
  const { currency: visitorCurrency } = useMarket();
  const cur = sub.currency || visitorCurrency;
  const monthly = fmt(priceIn("monthly", cur), lang);
  const yearlyPrice = priceIn("yearly", cur);
  const price = sub.plan === "monthly" ? `${monthly} a month` : `${fmt(yearlyPrice, lang)} for 12 months, then ${monthly} a month`;
  const end = fmtDate(sub.current_period_end, lang);
  const ending = isCancelling(sub) ? fmtDate(sub.cancel_at, lang) || end : null;
  const [confirm, setConfirm] = useState<null | "cancel" | "end_now">(null);
  const [busy, setBusy] = useState<MembershipAction | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // sub.amount is what was actually paid for the year, as the server uses
  const refundPreview = yearlyEndNowRefund(sub);
  const canEndNow = !ending && !!refundPreview;

  const act = async (action: MembershipAction) => {
    setBusy(action);
    setMsg(null);
    try {
      const res = await manageMembership(action);
      setConfirm(null);
      if (action === "cancel") setMsg({ ok: true, text: "Your membership is cancelled. It stays active until the end of the current period and will not renew." });
      else if (action === "resume") setMsg({ ok: true, text: "Your membership continues and will renew as before." });
      else
        setMsg({
          ok: true,
          text: res.refund
            ? res.refund.pending
              ? `Your membership has ended. We will refund ${money(res.refund.amount, res.refund.currency ?? cur, lang)} to your card; our team sends it within a few days.`
              : `Your membership has ended. ${money(res.refund.amount, res.refund.currency ?? cur, lang)} is refunded to your card; your bank may take a few days to show it.`
            : "Your membership has ended.",
        });
    } catch (e) {
      const code = errCode(e);
      if (!["no_membership", "ended", "not_yearly", "trialing", "not_stripe", "included"].includes(code)) console.warn("manage membership failed", e);
      setMsg({
        ok: false,
        text:
          code === "included"
            ? "The month included with your report has nothing to cancel or refund. It simply ends on its date."
            : code === "ended" || code === "no_membership"
            ? "This membership has already ended. Reload the page to see the latest status."
            : code === "not_stripe"
              ? "This membership can't be changed here. Please contact us and we will do it for you."
              : code === "trialing"
                ? "Nothing has been charged for the membership yet, so it can only be cancelled."
                : code === "not_yearly"
                  ? "A monthly membership can only be cancelled; it ends at the end of the month you paid for."
                  : "That did not work. Please try again in a moment.",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <dl className="fl-dl">
        <dt>Billing</dt>
        <dd>{sub.plan === "monthly" ? "Monthly" : "12 months, then monthly"}</dd>
        <dt>Price</dt>
        <dd>{price}</dd>
        <dt>Status</dt>
        <dd>
          {sub.status === "trialing"
            ? ending
              ? "Included with your report, ending"
              : "Included with your report"
            : sub.status === "past_due"
              ? "Payment overdue"
              : ending
                ? "Active, ending"
                : "Active"}
        </dd>
        {(ending || end) && (
          <>
            <dt>{ending ? "Ends on" : sub.status === "trialing" ? "First payment" : "Renews on"}</dt>
            <dd>{ending ?? end}</dd>
          </>
        )}
      </dl>
      {sub.status === "past_due" && (
        <p className="fl-note is-bad">Your last membership payment did not go through. Your bank or card may have declined it. Contact us and we will help you sort it out.</p>
      )}

      {ending ? (
        <>
          <h3>Changed your mind?</h3>
          <p>{`Your membership stops on ${ending} and won't renew. You can keep it until then.`}</p>
          <div className="fl-row">
            <button type="button" className="fl-btn is-ghost" disabled={!!busy} onClick={() => act("resume")}>
              {busy === "resume" && <Spinner />}
              Keep my membership
            </button>
          </div>
        </>
      ) : (
        <>
          <h3>Cancel any time</h3>
          {confirm !== "cancel" && confirm !== "end_now" && (
            <div className="fl-row">
              <button type="button" className="fl-btn is-ghost" disabled={!!busy} onClick={() => setConfirm("cancel")}>
                Cancel membership
              </button>
              {canEndNow && (
                <button type="button" className="fl-btn is-ghost" disabled={!!busy} onClick={() => setConfirm("end_now")}>
                  End now with a refund
                </button>
              )}
            </div>
          )}
          {confirm === "cancel" && (
            <div className="fl-note">
              <p>
                {end
                  ? `Your membership stays active until ${end}, then it ends. You won't be charged again.`
                  : "Your membership stays active until the end of the current period, then it ends. You won't be charged again."}
              </p>
              <div className="fl-row" style={{ marginTop: 10 }}>
                <button type="button" className="fl-btn is-danger" disabled={!!busy} onClick={() => act("cancel")}>
                  {busy === "cancel" && <Spinner />}
                  Yes, cancel
                </button>
                <button type="button" className="fl-btn is-ghost" disabled={!!busy} onClick={() => setConfirm(null)}>
                  Keep it
                </button>
              </div>
            </div>
          )}
          {confirm === "end_now" && refundPreview && (
            <div className="fl-note">
              <p>
                {refundPreview.months > 1
                  ? `Your membership ends today and we refund ${money(refundPreview.amount, refundPreview.currency, lang)} for the ${refundPreview.months} full months left, to the card you paid with.`
                  : refundPreview.months === 1
                    ? `Your membership ends today and we refund ${money(refundPreview.amount, refundPreview.currency, lang)} for the one full month left, to the card you paid with.`
                  : "Your membership ends today. Less than a full month is left, so there is no refund."}
              </p>
              <div className="fl-row" style={{ marginTop: 10 }}>
                <button type="button" className="fl-btn is-danger" disabled={!!busy} onClick={() => act("end_now")}>
                  {busy === "end_now" && <Spinner />}
                  End my membership now
                </button>
                <button type="button" className="fl-btn is-ghost" disabled={!!busy} onClick={() => setConfirm(null)}>
                  Keep it
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {msg && (
        <p className={`fl-note${msg.ok ? " is-ok" : " is-bad"}`} role={msg.ok ? "status" : "alert"}>
          {msg.text}
        </p>
      )}
      <p className="fl-muted">
        Read the details in the{" "}
        <Link to={legalHref("refunds", lang)} className="fl-link">
          refund policy
        </Link>
        .
      </p>
    </>
  );
}

function JoinMembership({ lang }: { lang: Lang }) {
  const { country, selling } = useMarket();
  const monthly = fmt(priceFor("monthly", country), lang);
  const yearly = fmt(priceFor("yearly", country), lang);
  const [busy, setBusy] = useState<"membership_monthly" | "membership_yearly" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // the reminder email links to /account?join=membership_monthly|membership_yearly: highlight that choice
  const [params] = useSearchParams();
  const joinParam = params.get("join");
  const picked = joinParam === "membership_monthly" || joinParam === "membership_yearly" ? joinParam : null;
  const pickedRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!picked) return;
    pickedRef.current?.scrollIntoView({ block: "center" });
    pickedRef.current?.focus({ preventScroll: true });
  }, [picked]);
  const btnClass = (plan: "membership_monthly" | "membership_yearly") =>
    (picked ? picked === plan : plan === "membership_monthly") ? "fl-btn" : "fl-btn is-ghost";
  const start = async (plan: "membership_monthly" | "membership_yearly") => {
    setBusy(plan);
    setError(null);
    try {
      await goToCheckout(plan, lang, country);
    } catch (e) {
      setBusy(null);
      const code = errCode(e);
      setError(
        code === "already_member"
          ? "You already have a membership. Reload the page to see it."
          : code === "age_required" || code === "profile_incomplete"
            ? "We could not start the membership. Please write to us and we will help."
            : code === "payment_provider"
              ? "We could not start the payment. Please try again in a moment."
              : code === "country_not_available"
                ? "We don't take payments from this country yet. If you live in one of the countries we serve, choose it above."
                : code === "currency_mismatch"
                  ? "Your account is already billed in another currency. Please choose the country you used before, or contact us."
                  : "Something went wrong on our side. Please try again in a moment.",
      );
      if (code !== "already_member" && code !== "payment_provider" && code !== "country_not_available" && code !== "currency_mismatch") console.warn("membership checkout failed", e);
    }
  };
  return (
    <>
      {picked && (
        <p className="fl-note" role="status">
          {picked === "membership_yearly" ? "To keep going for 12 months, press “Join for 12 months” below. You pay on the next page." : "To keep going monthly, press “Join monthly” below. You pay on the next page."}
        </p>
      )}
      {!selling && (
        <div className="fl-note">
          <p>Membership is paid in the currency of the country you live in. Choose your country to see your price.</p>
          <CountrySelect lang={lang} label={lang === "ar" ? "دولتك" : "Your country"} />
        </div>
      )}
      <div className="fl-row">
        <button type="button" ref={picked === "membership_monthly" ? pickedRef : undefined} className={btnClass("membership_monthly")} disabled={!!busy || !selling} onClick={() => start("membership_monthly")}>
          {busy === "membership_monthly" && <Spinner />}
          {`Join monthly (${monthly} a month)`}
        </button>
        <button type="button" ref={picked === "membership_yearly" ? pickedRef : undefined} className={btnClass("membership_yearly")} disabled={!!busy || !selling} onClick={() => start("membership_yearly")}>
          {busy === "membership_yearly" && <Spinner />}
          {`Join for 12 months (${yearly})`}
        </button>
      </div>
      <p className="fl-muted">{`After the first 12 months, the 12-month membership continues at ${monthly} a month. Cancel any time.`}</p>
      <p className="fl-muted">Prices include VAT where it applies. Paid by card, Apple Pay or Google Pay on a secure Stripe page.</p>
      {error && (
        <p className="fl-note is-bad" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

/* -------------------------------- Privacy ------------------------------ */

type Confirm = null | "withdraw" | "delete";

function Privacy({ lang, onDeleted }: { lang: Lang; onDeleted: () => void }) {
  const consents = useMyConsents();
  const active = consents.data ? activeConsents(consents.data) : {};
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [understood, setUnderstood] = useState(false);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setMsg(null);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const download = () =>
    run("download", async () => {
      try {
        await downloadMyData(`${BRAND_NAME.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-my-data.json`);
        setMsg({ ok: true, text: "Your data was downloaded as a JSON file. Photo links in it work for 24 hours." });
      } catch (e) {
        console.warn("export failed", e);
        setMsg({ ok: false, text: "The download did not work. Please try again." });
      }
    });

  const withdraw = () =>
    run("withdraw", async () => {
      try {
        const r = await withdrawPhotoConsent();
        setConfirm(null);
        const cancelled = r.cancelledOrders?.length ?? 0;
        setMsg({
          ok: true,
          text: cancelled
            ? cancelled === 1
              ? "Done. Photo consent withdrawn and your photos deleted. Your review was stopped because we can't finish it without your photos. We will contact you about a refund under the refund policy."
              : `Done. Photo consent withdrawn and your photos deleted. ${cancelled} reviews were stopped because we can't finish them without your photos. We will contact you about a refund under the refund policy.`
            : "Done. Photo consent withdrawn and your photos deleted.",
        });
      } catch (e) {
        console.warn("withdraw failed", e);
        setMsg({ ok: false, text: "That did not work. Please try again, or write to us and we do it for you." });
      }
    });

  const stopMarketing = () =>
    run("marketing", async () => {
      try {
        await withdrawConsent("marketing");
        setMsg({ ok: true, text: "You won't receive news and offers by email any more." });
      } catch (e) {
        console.warn("withdraw marketing failed", e);
        setMsg({ ok: false, text: "That did not work. Please try again." });
      }
    });

  const del = () =>
    run("delete", async () => {
      try {
        await deleteMyData({ confirm: true });
        onDeleted();
      } catch (e) {
        const code = errCode(e);
        if (code !== "staff_account") console.warn("delete failed", e);
        setMsg({
          ok: false,
          text: code === "staff_account" ? "Staff accounts can't be deleted here. An admin removes them." : "Your account could not be deleted. Please try again, or write to us.",
        });
      }
    });

  return (
    <section className="fl-card" aria-labelledby="acc-privacy">
      <h2 id="acc-privacy">Privacy and your data</h2>
      <p>
        {`${BRAND_NAME} is run from the Netherlands, so your data is protected by the EU's GDPR. Photos are deleted automatically 90 days after your report is delivered.`}
      </p>

      <div className="fl-setrow">
        <div>
          <h3>Download my data</h3>
          <p className="fl-muted">Everything we hold about you, as one file.</p>
        </div>
        <button type="button" className="fl-btn is-ghost" disabled={!!busy} onClick={download}>
          {busy === "download" && <Spinner />}
          Download
        </button>
      </div>

      {active.photos && (
        <div className="fl-setrow" style={{ flexWrap: "wrap" }}>
          <div>
            <h3>Withdraw photo consent</h3>
            <p className="fl-muted">Deletes your photos and the measurements and health answers taken from them.</p>
          </div>
          {confirm !== "withdraw" && (
            <button type="button" className="fl-btn is-ghost" disabled={!!busy} onClick={() => setConfirm("withdraw")}>
              Withdraw
            </button>
          )}
          {confirm === "withdraw" && (
            <div className="fl-note" style={{ flexBasis: "100%" }}>
              <p>
                We delete your photos and what was measured from them. If a report is not delivered yet, we can't finish it; see the{" "}
                <Link to={legalHref("refunds", lang)} className="fl-link">
                  refund policy
                </Link>
                .
              </p>
              <div className="fl-row" style={{ marginTop: 10 }}>
                <button type="button" className="fl-btn is-danger" disabled={!!busy} onClick={withdraw}>
                  {busy === "withdraw" && <Spinner />}
                  Withdraw and delete my photos
                </button>
                <button type="button" className="fl-btn is-ghost" disabled={!!busy} onClick={() => setConfirm(null)}>
                  Keep them
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {active.marketing && (
        <div className="fl-setrow">
          <div>
            <h3>News and offers by email</h3>
            <p className="fl-muted">You agreed to receive these.</p>
          </div>
          <button type="button" className="fl-btn is-ghost" disabled={!!busy} onClick={stopMarketing}>
            {busy === "marketing" && <Spinner />}
            Unsubscribe
          </button>
        </div>
      )}

      <div className="fl-setrow" style={{ flexWrap: "wrap" }}>
        <div>
          <h3>Delete my account</h3>
          <p className="fl-muted">Deletes your account, photos, scans and illustrations for good.</p>
        </div>
        {confirm !== "delete" && (
          <button
            type="button"
            className="fl-btn is-ghost is-danger-text"
            disabled={!!busy}
            onClick={() => {
              setUnderstood(false);
              setConfirm("delete");
            }}
          >
            Delete
          </button>
        )}
        {confirm === "delete" && (
          <div className="fl-note is-bad" style={{ flexBasis: "100%" }}>
            <p>This can't be undone. An order still in review stops, and an active membership is cancelled.</p>
            <label className="fl-row" style={{ marginTop: 10, gap: 8 }}>
              <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
              <span>I understand that my account and data will be deleted for good.</span>
            </label>
            <div className="fl-row" style={{ marginTop: 10 }}>
              <button type="button" className="fl-btn is-danger" disabled={!understood || !!busy} onClick={del}>
                {busy === "delete" && <Spinner />}
                Delete my account
              </button>
              <button type="button" className="fl-btn is-ghost" disabled={!!busy} onClick={() => setConfirm(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {msg && (
        <p className={`fl-note${msg.ok ? " is-ok" : " is-bad"}`} role={msg.ok ? "status" : "alert"}>
          {msg.text}
        </p>
      )}
      <p className="fl-muted">
        Read how we handle your data in the{" "}
        <Link to={legalHref("privacy", lang)} className="fl-link">
          privacy policy
        </Link>
        .
      </p>
    </section>
  );
}

