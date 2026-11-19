/*
 * Shared frame for the customer flow (/start, /orders/:id, /account): top bar,
 * language switch (Arabic is a text swap over the English page, see lib/i18n),
 * and the notice shown when the online service is not configured.
 *
 * Dynamic text is always built as one string (`Due by ${date}`), never as
 * `Due by {date}` in JSX, so the Arabic templates ("Due by {0}") match a
 * single text node.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { BRAND_NAME } from "../../lib/brand";
import { setLang, useArabicPage, useLang, type Lang } from "../../lib/i18n";
import { backendEnabled, BackendError } from "../../lib/backend";
import { legalHref } from "../legal/content";
import "./flow.css";

/** Language of a flow page: the URL wins (/ar/...), else the language chosen elsewhere on the site. */
export function useFlowLang(): Lang {
  const { pathname } = useLocation();
  const stored = useLang();
  if (pathname === "/ar" || pathname.startsWith("/ar/")) return "ar";
  return stored;
}

/** For pages whose URL decides the language (/start vs /ar/start): remember it for the next pages. */
export function useRememberLang(lang: Lang) {
  useEffect(() => {
    setLang(lang);
  }, [lang]);
}

export function FlowShell({
  lang,
  children,
  wide = false,
  onSwitchLang,
  showAccount = true,
}: {
  lang: Lang;
  children: ReactNode;
  wide?: boolean;
  /** custom switch (e.g. navigate /start <-> /ar/start); defaults to the stored language */
  onSwitchLang?: () => void;
  showAccount?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  useArabicPage(root, lang);
  const other: Lang = lang === "ar" ? "en" : "ar";
  return (
    <div className="fl" ref={root} dir={lang === "ar" ? "rtl" : "ltr"} lang={lang}>
      <header className="fl-top">
        <div className="fl-top-in">
          <Link to={lang === "ar" ? "/ar" : "/"} className="fl-brand" translate="no">
            {BRAND_NAME}
          </Link>
          {showAccount && backendEnabled && (
            <Link to="/account" className="fl-toplink">
              Account
            </Link>
          )}
          <button type="button" className="fl-lang" lang={other} onClick={onSwitchLang ?? (() => setLang(other))}>
            {/* written so neither label is a dictionary key: it must not be swapped */}
            {other === "ar" ? "العربية" : "English​"}
          </button>
        </div>
      </header>
      <main className={`fl-main${wide ? " is-wide" : ""}`}>{children}</main>
    </div>
  );
}

export function FlowHead({ muted, strong, lead }: { muted?: string; strong: string; lead?: ReactNode }) {
  return (
    <div className="fl-head">
      <h1 className="fl-title">
        {muted && <span className="hl">{muted}</span>}
        {muted ? " " : ""}
        {strong}
      </h1>
      {lead && <p className="fl-lead">{lead}</p>}
    </div>
  );
}

/** Shown on every flow page when backendMode is "off". */
export function FlowOff({ lang }: { lang: Lang }) {
  return (
    <FlowShell lang={lang} showAccount={false}>
      <FlowHead muted="Online service" strong="not set up here" />
      <div className="fl-card">
        <p>Ordering, payment, sign-in and human review are not configured on this copy of the app.</p>
        <p>You can still try the analysis on your own device. Your photos stay in this browser and nothing is uploaded.</p>
        <div className="fl-row">
          <Link to="/new" className="fl-btn">
            Try the on-device demo
          </Link>
          <Link to={lang === "ar" ? "/ar" : "/"} className="fl-btn is-ghost">
            Back to the home page
          </Link>
        </div>
      </div>
      <LegalLinks lang={lang} />
    </FlowShell>
  );
}

export function LegalLinks({ lang }: { lang: Lang }) {
  return (
    <nav className="fl-legal" aria-label="Legal">
      <Link to={legalHref("privacy", lang)}>Privacy policy</Link>
      <Link to={legalHref("terms", lang)}>Terms</Link>
      <Link to={legalHref("refunds", lang)}>Refund policy</Link>
    </nav>
  );
}

export function Spinner() {
  return <span className="fl-spin" aria-hidden="true" />;
}

/* ------------------------------ Helpers ------------------------------ */

/** "20 KWD", "5 KWD", "12.500 KWD" (KWD has 3 decimals; whole amounts are shown without them). */
export function kwd(amount: number): string {
  return `${amt(amount)} KWD`;
}
/** The number part of a KWD amount. Inside sentences write `${amt(x)} KWD` so the Arabic template keeps the unit. */
export function amt(amount: number): string {
  const n = Math.round(amount * 1000) / 1000;
  return Number.isInteger(n) ? String(n) : n.toFixed(3);
}

export const errCode = (e: unknown): string => (e instanceof BackendError ? e.code : "");
export const errStatus = (e: unknown): number | undefined => (e instanceof BackendError ? e.status : undefined);

/** Dates in the page language, always with Latin digits (like the rest of the Arabic copy). */
export function fmtDate(iso: string | null | undefined, lang: Lang, withTime = false): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const locale = lang === "ar" ? "ar-KW-u-nu-latn" : "en-GB";
  return d.toLocaleString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}
