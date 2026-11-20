/*
 * /start and /ar/start: choose a plan -> who it is for (women join the
 * waitlist) -> 18+ and terms -> sign in -> Stripe Checkout.
 *
 * The URL decides the language, like the landing page. Progress is kept for
 * this browser for two hours, so a reload, a cancelled payment or the sign-in link opened in a new tab does not send
 * the customer back to the beginning.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ConsentGate, type ConsentResult } from "../../components/ConsentGate";
import { SignIn } from "../../components/SignIn";
import { WaitlistForm } from "../../components/WaitlistForm";
import { useLang, type Lang } from "../../lib/i18n";
import { CountrySelect } from "../../components/CountrySelect";
import { backendEnabled, BUNDLE_TRIAL_DAYS, recordConsents, signOut, updateMyProfile, useSession, type CheckoutPlan } from "../../lib/backend";
import { countryName, fmt, priceFor, syncCountryFromUrl, useMarket, yearlySaving, type CountryCode } from "../../lib/pricing";
import { errCode, FlowHead, FlowOff, FlowShell, flowHref, goToCheckout, LegalLinks, Spinner, useRememberLang } from "./FlowShell";

type StartPlan = "report" | "report_membership_monthly" | "report_membership_yearly";
const START_PLANS: StartPlan[] = ["report", "report_membership_monthly", "report_membership_yearly"];
type Step = "plan" | "gender" | "consent" | "signin" | "pay";
type Gender = "male" | "female";

interface Saved {
  plan: StartPlan;
  gender: Gender | null;
  consented: boolean;
  birthYear: number | null;
}

const KEY = "facet-start";
const FRESH: Saved = { plan: "report", gender: null, consented: false, birthYear: null };
/** Progress older than this is dropped (the held consents expire after the same time). */
const MAX_AGE_MS = 2 * 3600_000;

/*
 * Kept in localStorage (with a time stamp), not sessionStorage: the sign-in
 * link in the email opens a new tab, which must continue at the payment step.
 * The language is stored with it: progress made on /start is not resumed on
 * /ar/start (or the other way round) beyond the chosen plan, so e.g. the
 * women's waitlist reached in English does not greet a visitor of /ar/start.
 */
function load(lang: Lang): Saved {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as (Partial<Saved> & { at?: number; lang?: Lang }) | null;
    if (!v || typeof v.at !== "number" || Date.now() - v.at > MAX_AGE_MS) return FRESH;
    const plan = START_PLANS.includes(v.plan as StartPlan) ? (v.plan as StartPlan) : "report";
    if (v.lang !== lang) return { ...FRESH, plan };
    return {
      plan: START_PLANS.includes(v.plan as StartPlan) ? (v.plan as StartPlan) : "report",
      gender: v.gender === "male" || v.gender === "female" ? v.gender : null,
      consented: v.consented === true,
      birthYear: typeof v.birthYear === "number" ? v.birthYear : null,
    };
  } catch {
    return FRESH;
  }
}
function save(v: Saved, lang: Lang) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...v, lang, at: Date.now() }));
  } catch {
    /* storage blocked: progress lasts for this page view only */
  }
}

export function Start() {
  const { pathname, search } = useLocation();
  const lang: Lang = pathname === "/ar" || pathname.startsWith("/ar/") ? "ar" : "en";
  const stored = useLang();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const cancelled = params.get("checkout") === "cancelled";

  // Stripe always returns to /start; send Arabic visitors back to /ar/start.
  const [toArabic] = useState(() => lang === "en" && cancelled && stored === "ar");
  useEffect(() => {
    if (toArabic) navigate(`/ar/start${search}`, { replace: true });
  }, [toArabic, navigate, search]);
  useRememberLang(toArabic ? "ar" : lang);

  if (!backendEnabled) return <FlowOff lang={lang} />;
  if (toArabic) return null;
  return <StartFlow lang={lang} cancelled={cancelled} />;
}

function StartFlow({ lang, cancelled }: { lang: Lang; cancelled: boolean }) {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const [params] = useSearchParams();
  const { session } = useSession();
  const [saved, setSaved] = useState<Saved>(() => {
    const s = load(lang);
    const fromUrl = params.get("plan");
    return START_PLANS.includes(fromUrl as StartPlan) ? { ...s, plan: fromUrl as StartPlan } : s;
  });
  const [step, setStep] = useState<Step>(() => {
    const s = load(lang);
    if (s.gender === "female") return "gender";
    // a cancelled payment, a reload, or the sign-in link opened in a new tab: continue where they were
    if (s.gender === "male" && s.consented) return session || cancelled ? "pay" : "signin";
    return "plan";
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ code: string; text: string } | null>(null);
  const { country, selling } = useMarket();
  // /start?country=sa (ads, links from a country page) sets the country
  useEffect(() => {
    syncCountryFromUrl();
  }, [search]);

  const update = (patch: Partial<Saved>) =>
    setSaved((cur) => {
      const next = { ...cur, ...patch };
      save(next, lang);
      return next;
    });

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  // switching language inside the flow keeps the progress: store it under the new language
  const firstLang = useRef(lang);
  const savedRef = useRef(saved);
  savedRef.current = saved;
  useEffect(() => {
    if (lang !== firstLang.current) {
      firstLang.current = lang;
      save(savedRef.current, lang);
    }
  }, [lang]);

  const switchLang = () => {
    const to = lang === "ar" ? pathname.replace(/^\/ar(?=\/|$)/, "") || "/start" : `/ar${pathname}`;
    navigate(`${to}${search}`, { replace: true });
  };

  const onSignedIn = useCallback(() => setStep((s) => (s === "signin" ? "pay" : s)), []);
  // however the session arrives (code, or the email link in another tab), move on
  useEffect(() => {
    if (session && step === "signin") setStep("pay");
  }, [session, step]);

  async function onConsent(result: ConsentResult) {
    setBusy(true);
    try {
      // Kept for this tab and saved right after sign-in when nobody is signed in yet.
      await recordConsents(
        result.consents.map((c) => c.kind),
        result.consents[0]?.version,
      );
      update({ consented: true, birthYear: result.birthYear });
      setError(null);
      setStep(session ? "pay" : "signin");
    } catch (e) {
      console.warn("recordConsents failed", e);
      setError({ code: "consent_failed", text: "We could not save your answers. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await updateMyProfile({ gender: "male", locale: lang, ...(saved.birthYear ? { birth_year: saved.birthYear } : {}) });
      await goToCheckout(saved.plan as CheckoutPlan, lang, country);
      // the browser is leaving for the payment page; keep the button busy
    } catch (e) {
      setBusy(false);
      const code = errCode(e);
      if (code === "waitlist") {
        update({ gender: "female" });
        setStep("gender");
        return;
      }
      if (code === "age_required") {
        update({ consented: false });
        setStep("consent");
        setError({ code, text: "Please confirm your age and accept the terms again, then continue to payment." });
        return;
      }
      if (code === "not_signed_in") {
        setStep("signin");
        return;
      }
      if (code !== "already_member" && code !== "under_18" && code !== "profile_incomplete" && code !== "payment_provider") console.warn("checkout failed", e);
      setError({ code, text: checkoutError(code) });
    }
  }

  const stepIndex = { plan: 0, gender: 1, consent: 2, signin: 3, pay: 4 }[step];

  return (
    <FlowShell lang={lang} onSwitchLang={switchLang}>
      <div className="fl-steps" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={i <= stepIndex ? "is-on" : ""} />
        ))}
      </div>

      {cancelled && (
        <p className="fl-note" role="status">
          Payment cancelled. You have not been charged.
        </p>
      )}

      {/* not selling in this country yet: prices for reference and the waitlist, never checkout */}
      {!selling && step !== "gender" && <PlanStep lang={lang} country={country} plan={saved.plan} onPlan={(plan) => update({ plan })} onNext={() => setStep("gender")} />}

      {selling && step === "plan" && <PlanStep lang={lang} country={country} plan={saved.plan} onPlan={(plan) => update({ plan })} onNext={() => setStep("gender")} />}

      {step === "gender" && (
        <GenderStep
          lang={lang}
          gender={saved.gender}
          onGender={(gender) => update({ gender })}
          onBack={() => setStep("plan")}
          onNext={() => setStep(saved.consented ? (session ? "pay" : "signin") : "consent")}
        />
      )}

      {selling && step === "consent" && (
        <>
          <FlowHead muted="A few checks" strong="before you pay" lead="This service is for adults only. We also need you to accept the terms and privacy policy." />
          {error && (
            <p className="fl-note is-bad" role="alert">
              {error.text}
            </p>
          )}
          <ConsentGate steps={["age", "terms"]} askMarketing lang={lang} busy={busy} onComplete={onConsent} onCancel={() => setStep("gender")} />
        </>
      )}

      {selling && step === "signin" && (
        <>
          <FlowHead strong="Your account" lead="Your order, report and photos are kept in your account, so you can open them on any device." />
          <SignIn locale={lang} gender="male" onSignedIn={onSignedIn} />
          <button type="button" className="fl-link" onClick={() => setStep("consent")}>
            Back
          </button>
        </>
      )}

      {selling && step === "pay" && (
        <PayStep
          lang={lang}
          country={country}
          plan={saved.plan}
          email={session?.email ?? null}
          signedIn={!!session}
          busy={busy}
          error={error}
          onPay={pay}
          onReportOnly={() => {
            update({ plan: "report" });
            setError(null);
          }}
          onChangePlan={() => {
            setError(null);
            setStep("plan");
          }}
          onSignIn={() => setStep("signin")}
        />
      )}

      <LegalLinks lang={lang} />
    </FlowShell>
  );
}

function checkoutError(code: string): string {
  switch (code) {
    case "already_member":
      return "You already have a membership, so you can't add a second one. You can buy the report on its own.";
    case "under_18":
      return "This service is only for people aged 18 or older, so we can't take your order.";
    case "profile_incomplete":
      return "We could not save your details. Please try again.";
    case "payment_provider":
      return "We could not start the payment. Please try again in a moment.";
    case "country_not_available":
      return "We don't take orders from this country yet. Choose your country above, or join the waitlist.";
    case "currency_mismatch":
      return "Your account is already billed in another currency. Please choose the country you used before, or contact us.";
    default:
      return "Something went wrong on our side. Please try again in a moment.";
  }
}

/* ------------------------------ Steps ------------------------------ */

function PlanStep({ lang, country, plan, onPlan, onNext }: { lang: Lang; country: CountryCode; plan: StartPlan; onPlan: (p: StartPlan) => void; onNext: () => void }) {
  const { selling } = useMarket();
  const report = fmt(priceFor("report", country), lang);
  const monthly = fmt(priceFor("monthly", country), lang);
  const yearly = fmt(priceFor("yearly", country), lang);
  const saves = fmt(yearlySaving(country), lang);
  const choices: { plan: StartPlan; title: string; price: string; sub: string; tag?: string }[] = [
    {
      plan: "report",
      title: "Report only",
      price: report,
      sub: `One payment. Includes ${BUNDLE_TRIAL_DAYS} days of membership, which then simply ends. Nothing renews.`,
    },
    {
      plan: "report_membership_monthly",
      title: "Report + monthly membership",
      price: report,
      sub: `${report} today. After the first ${BUNDLE_TRIAL_DAYS} days, ${monthly} a month. Cancel any time.`,
    },
    {
      plan: "report_membership_yearly",
      title: "Report + 12-month membership",
      price: report,
      sub: `${report} today. After the first ${BUNDLE_TRIAL_DAYS} days, ${yearly} for 12 months, then ${monthly} a month. Cancel any time.`,
      tag: `Saves ${saves} over the first 12 months compared with monthly`,
    },
  ];
  const place = countryName(country, lang);
  return (
    <>
      <FlowHead
        muted="Choose"
        strong="your plan"
        lead="Your face and body analysis and a 12-month plan, checked by a person before you receive it. Non-surgical."
      />
      <div className="fl-country">
        <CountrySelect lang={lang} label={lang === "ar" ? "الأسعار لـ" : "Prices for"} />
      </div>
      <div className="fl-card">
        <h2>What you get</h2>
        <ul className="fl-list">
          <li>A guided photo session with the analysis done on your device</li>
          <li>A reviewer checks your results and adds notes</li>
          <li>Your 12-month plan, your analysis and AI illustrations of possible results, after review</li>
          <li>The plan as a PDF you can keep</li>
        </ul>
        <hr className="fl-sep" />
        <h3>{`Every report includes ${BUNDLE_TRIAL_DAYS} days of membership`}</h3>
        <p>Membership adds a monthly check-in scan with updated scores and plan, and a reviewer note each month.</p>
        <p>{`After the first ${BUNDLE_TRIAL_DAYS} days you can keep it for ${monthly} a month, or ${yearly} for 12 months and then ${monthly} a month, or let it end. Cancel any time.`}</p>
      </div>

      <fieldset className="fl-card" style={{ border: 0, margin: 0 }}>
        <legend className="fl-muted fl-legend">
          {selling ? "Choose one" : "Prices when we open in your country"}
        </legend>
        <div className="fl-choices">
          {choices.map((c) => (
            <label key={c.plan} className={`fl-choice${selling && plan === c.plan ? " is-on" : ""}${selling ? "" : " is-preview"}`}>
              <input type="radio" name="plan" value={c.plan} checked={plan === c.plan} disabled={!selling} onChange={() => onPlan(c.plan)} />
              <span className="fl-radio" aria-hidden="true" />
              <span className="fl-choice-body">
                <span className="fl-choice-head">
                  <span className="fl-choice-title">{c.title}</span>
                  <span className="fl-price">{c.price}</span>
                </span>
                <span className="fl-choice-sub">{c.sub}</span>
                {c.tag && <span className="fl-tag">{c.tag}</span>}
              </span>
            </label>
          ))}
        </div>
        <p className="fl-muted">Prices include VAT where it applies. Pay by card, Apple Pay or Google Pay.</p>
        {selling && (
          <div className="fl-row is-end">
            <button type="button" className="fl-btn" onClick={onNext}>
              Continue
            </button>
          </div>
        )}
      </fieldset>

      {!selling && (
        <>
          <div className="fl-card fl-soon" id="waitlist">
            <h2>{`Coming to ${place} soon`}</h2>
            <p>We are open in Kuwait, Saudi Arabia, the UAE, Qatar, Bahrain and Oman. Leave your email and we will write to you when we open in your country. You won't be charged anything.</p>
          </div>
          <WaitlistForm source="start-country" lang={lang} country={country} bare />
        </>
      )}
      <p className="fl-muted">
        Just looking? <Link to="/new" className="fl-link">Try the analysis on your device first</Link>
      </p>
    </>
  );
}

function GenderStep({
  lang,
  gender,
  onGender,
  onBack,
  onNext,
}: {
  lang: Lang;
  gender: Gender | null;
  onGender: (g: Gender) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <FlowHead muted="Who is" strong="this for?" lead="Plans and reviewers are matched to men and women separately." />
      <fieldset className="fl-card" style={{ border: 0, margin: 0 }}>
        <legend className="fl-muted fl-legend">
          I am
        </legend>
        <div className="fl-choices is-2">
          {(
            [
              ["male", "A man"],
              ["female", "A woman"],
            ] as [Gender, string][]
          ).map(([g, label]) => (
            <label key={g} className={`fl-choice${gender === g ? " is-on" : ""}`}>
              <input type="radio" name="gender" value={g} checked={gender === g} onChange={() => onGender(g)} />
              <span className="fl-radio" aria-hidden="true" />
              <span className="fl-choice-body">
                <span className="fl-choice-title">{label}</span>
              </span>
            </label>
          ))}
        </div>
        {gender !== "female" && (
          <div className="fl-row" style={{ justifyContent: "space-between" }}>
            <button type="button" className="fl-btn is-ghost" onClick={onBack}>
              Back
            </button>
            <button type="button" className="fl-btn" disabled={gender !== "male"} onClick={onNext}>
              Continue
            </button>
          </div>
        )}
      </fieldset>
      {gender === "female" && (
        <>
          <div className="fl-card">
            <h2>We are opening for women soon</h2>
            <p>
              At launch the service is for men only. The version for women will have its own plans and women reviewers. Join the waitlist and we will email you when it opens. You
              won't be charged anything.
            </p>
          </div>
          <WaitlistForm source="start" gender="female" lang={lang} bare />
          <button type="button" className="fl-link" onClick={onBack}>
            Back
          </button>
        </>
      )}
    </>
  );
}

function PayStep({
  lang,
  country,
  plan,
  email,
  signedIn,
  busy,
  error,
  onPay,
  onReportOnly,
  onChangePlan,
  onSignIn,
}: {
  lang: Lang;
  country: CountryCode;
  plan: StartPlan;
  email: string | null;
  signedIn: boolean;
  busy: boolean;
  error: { code: string; text: string } | null;
  onPay: () => void;
  onReportOnly: () => void;
  onChangePlan: () => void;
  onSignIn: () => void;
}) {
  const report = fmt(priceFor("report", country), lang);
  const monthly = fmt(priceFor("monthly", country), lang);
  const yearly = fmt(priceFor("yearly", country), lang);
  const recurring = plan !== "report";
  const title = plan === "report" ? "Report only" : plan === "report_membership_monthly" ? "Report + monthly membership" : "Report + 12-month membership";
  const stop = error?.code === "under_18";
  return (
    <>
      <FlowHead muted="Review and" strong="pay" />
      <div className="fl-card">
        <dl className="fl-dl">
          <dt>Selected plan</dt>
          <dd>{title}</dd>
          <dt>Due today</dt>
          <dd className="fl-amount">{report}</dd>
          {recurring && (
            <>
              <dt>Then</dt>
              <dd>
                {plan === "report_membership_monthly"
                  ? `${monthly} a month, starting ${BUNDLE_TRIAL_DAYS} days after you pay`
                  : `${yearly} for 12 months, starting ${BUNDLE_TRIAL_DAYS} days after you pay, then ${monthly} a month`}
              </dd>
            </>
          )}
          <dt>Membership</dt>
          <dd>{recurring ? `${BUNDLE_TRIAL_DAYS} days included, then renews until you cancel` : `${BUNDLE_TRIAL_DAYS} days included, then it ends`}</dd>
          <dt>Country</dt>
          <dd>{countryName(country, lang)}</dd>
          {email && (
            <>
              <dt>Account</dt>
              <dd>
                <span dir="ltr">{email}</span>{" "}
                <button type="button" className="fl-link fl-muted" onClick={() => signOut()} disabled={busy}>
                  Not you?
                </button>
              </dd>
            </>
          )}
        </dl>
        <p className="fl-muted">Prices include VAT where it applies.</p>
        {recurring && <p className="fl-muted">You can cancel the membership any time before it renews, and you won't be charged again.</p>}
        <p className="fl-muted">
          You pay on a secure Stripe page by card, Apple Pay or Google Pay. After paying you come back here to take your photos. Your reviewer has 72 hours from when you send your
          photos.
        </p>
        {error && (
          <div className="fl-note is-bad" role="alert">
            {error.text}
            {error.code === "already_member" && plan !== "report" && (
              <div className="fl-row" style={{ marginTop: 10 }}>
                <button type="button" className="fl-btn is-ghost" onClick={onReportOnly}>
                  {`Buy the report only (${report})`}
                </button>
                <Link to={flowHref("/account", lang)} className="fl-link">
                  See my membership
                </Link>
              </div>
            )}
            {error.code === "country_not_available" && (
              <div className="fl-row" style={{ marginTop: 10 }}>
                <CountrySelect lang={lang} label={lang === "ar" ? "دولتك" : "Your country"} />
              </div>
            )}
          </div>
        )}
        {!stop && (
          <div className="fl-row is-split">
            <button type="button" className="fl-btn is-ghost" onClick={onChangePlan} disabled={busy}>
              Change plan
            </button>
            {signedIn ? (
              <button type="button" className="fl-btn" onClick={onPay} disabled={busy} aria-busy={busy || undefined}>
                {busy && <Spinner />}
                {busy ? "Opening the payment page…" : `Continue to payment (${report})`}
              </button>
            ) : (
              <button type="button" className="fl-btn" onClick={onSignIn}>
                Sign in to pay
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
