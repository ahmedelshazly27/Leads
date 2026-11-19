/*
 * Email sign-in: email -> one-time code (sendCode / verifyCode).
 *
 * Until custom SMTP is set up, the default Supabase email contains only a
 * sign-in LINK, not a code. So the screen offers both: type the code, or tap
 * the link in the email. When the link is opened in this browser the session
 * appears (also in this tab, through the auth client's cross-tab sync) and
 * `useSession` picks it up, so this component reacts to the session rather
 * than only to verifyCode.
 *
 * The link comes back to the current page (sendCode's `emailRedirectTo`; the
 * URL must be allowed under Supabase Auth > URL Configuration > Redirect URLs).
 *
 * Copy is English; on Arabic pages the surrounding page's text swap
 * (useArabicPage) translates it.
 */
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { BackendError, sendCode, useSession, verifyCode, type GenderCode, type Locale } from "../lib/backend";
import "../pages/flow/flow.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_AFTER_S = 60;
/** Where the person was when they asked for a sign-in email (for a landing page to send them back). */
export const SIGNIN_RETURN_KEY = "facet-signin-return";

export interface SignInProps {
  /** stored on a new profile with the account */
  locale?: Locale;
  gender?: GenderCode;
  /** called once when a session exists (right away if already signed in) */
  onSignedIn?: () => void;
  title?: string;
  lead?: string;
}

export function SignIn({ locale, gender, onSignedIn, title = "Sign in with your email", lead }: SignInProps) {
  const { session, ready } = useSession();
  const id = useId();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  // React to the session however it arrived: code, magic link (this or another tab), or already signed in.
  useEffect(() => {
    if (session && !done.current) {
      done.current = true;
      try {
        localStorage.removeItem(SIGNIN_RETURN_KEY);
      } catch {
        /* storage blocked */
      }
      onSignedIn?.();
    }
  }, [session, onSignedIn]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (sentTo) codeRef.current?.focus();
  }, [sentTo]);

  async function send(target: string) {
    setBusy(true);
    setError(null);
    const redirectTo = window.location.href;
    try {
      localStorage.setItem(SIGNIN_RETURN_KEY, JSON.stringify({ path: window.location.pathname + window.location.search, at: Date.now() }));
    } catch {
      /* storage blocked */
    }
    try {
      await sendCode(target, { locale, gender, emailRedirectTo: redirectTo });
      setSentTo(target);
      setCode("");
      setCooldown(RESEND_AFTER_S);
    } catch (e) {
      setError(sendError(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitEmail(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const v = email.trim();
    if (!EMAIL_RE.test(v)) return setError("Please enter a valid email address.");
    await send(v);
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault();
    if (busy || !sentTo) return;
    const c = code.replace(/\s+/g, "");
    if (!/^\d{6,10}$/.test(c)) return setError("Please enter the 6-digit code from the email.");
    setBusy(true);
    setError(null);
    try {
      await verifyCode(sentTo, c);
      // the session effect above calls onSignedIn
    } catch (err) {
      setError(verifyError(err));
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <div className="fl-card" aria-busy="true">
        <p>Checking whether you are signed in…</p>
      </div>
    );
  }

  if (session) {
    return (
      <div className="fl-card" role="status">
        <p>{session.email ? `Signed in as ${session.email}` : "You are signed in."}</p>
      </div>
    );
  }

  if (!sentTo) {
    return (
      <form className="fl-card" onSubmit={submitEmail} noValidate>
        <h2>{title}</h2>
        <p>{lead ?? "No password needed. We email you a sign-in code. New here? This creates your account."}</p>
        <div className="fl-field">
          <label htmlFor={`${id}-email`}>Email</label>
          <input
            id={`${id}-email`}
            className="fl-input"
            type="email"
            inputMode="email"
            autoComplete="email"
            dir="ltr"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            placeholder="name@example.com"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-err` : undefined}
          />
        </div>
        {error && (
          <p id={`${id}-err`} className="fl-note is-bad" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="fl-btn is-block" disabled={busy} aria-busy={busy || undefined}>
          {busy ? "Sending…" : "Email me a sign-in code"}
        </button>
      </form>
    );
  }

  return (
    <form className="fl-card" onSubmit={submitCode} noValidate>
      <h2>Check your email</h2>
      <p>{`We sent an email to ${sentTo}.`}</p>
      <p>Enter the 6-digit code, or tap the link in the email.</p>
      <p className="fl-muted">Open the link on this device, in this browser. This page continues by itself once you are signed in.</p>
      <div className="fl-field">
        <label htmlFor={`${id}-code`}>6-digit code</label>
        <input
          ref={codeRef}
          id={`${id}-code`}
          className="fl-input is-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={10}
          dir="ltr"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/[^\d]/g, ""));
            setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err2` : undefined}
        />
      </div>
      {error && (
        <p id={`${id}-err2`} className="fl-note is-bad" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="fl-btn is-block" disabled={busy || code.length < 6} aria-busy={busy || undefined}>
        {busy ? "Checking…" : "Sign in"}
      </button>
      <div className="fl-row">
        <button type="button" className="fl-link" disabled={busy || cooldown > 0} onClick={() => send(sentTo)}>
          {cooldown > 0 ? `Send a new email in ${cooldown}s` : "Send a new email"}
        </button>
        <span className="fl-muted">·</span>
        <button
          type="button"
          className="fl-link"
          onClick={() => {
            setSentTo(null);
            setCode("");
            setError(null);
          }}
        >
          Use a different email
        </button>
      </div>
      <p className="fl-muted">Nothing arrived? Check your spam or junk folder.</p>
    </form>
  );
}

function sendError(e: unknown): string {
  const code = e instanceof BackendError ? e.code : "";
  if (code === "invalid_email" || code === "email_address_invalid" || code === "validation_failed") return "Please enter a valid email address.";
  if (/rate_limit/.test(code) || code === "over_email_send_rate_limit" || code === "over_request_rate_limit")
    return "Too many emails were requested. Please wait a minute and try again.";
  if (code === "backend_disabled") return "Sign-in is not available on this copy of the app.";
  console.warn("sendCode failed", e);
  return "We could not send the email. Please check the address and try again.";
}

function verifyError(e: unknown): string {
  const code = e instanceof BackendError ? e.code : "";
  if (code === "otp_expired" || code === "otp_invalid" || code === "invalid_code" || code === "invalid_credentials")
    return "That code is not right or has expired. Check the latest email, or send a new one.";
  if (/rate_limit/.test(code)) return "Too many tries. Please wait a minute and try again.";
  console.warn("verifyCode failed", e);
  return "Sign-in did not work. Please try again, or send a new email.";
}

export default SignIn;
