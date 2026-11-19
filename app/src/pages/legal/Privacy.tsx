/*
 * Legal pages: privacy policy, terms and refund policy, in English and Arabic.
 * DRAFT: have a Dutch lawyer review before launch (see content.ts).
 *
 * Language comes from the `lang` prop, else from the URL (/ar/privacy), else
 * from the language the visitor chose elsewhere on the site.
 */
import { Fragment, useLayoutEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { BRAND_NAME } from "../../lib/brand";
import { useLang } from "../../lib/i18n";
import { useSeo } from "../../lib/seo";
import {
  LEGAL_DOCS,
  LEGAL_KEYS,
  LEGAL_UI,
  LEGAL_VERSION,
  legalHref,
  parseInline,
  type LegalBlock,
  type LegalKey,
  type LegalLang,
} from "./content";
import "./legal.css";

/** Resolves the language for a legal page or component. */
export function useLegalLang(prop?: LegalLang): LegalLang {
  const { pathname } = useLocation();
  const chosen = useLang();
  if (prop) return prop;
  if (pathname === "/ar" || pathname.startsWith("/ar/")) return "ar";
  return chosen;
}

/** Renders text with links and highlighted placeholders. */
export function LegalText({ text, lang, newTab = false }: { text: string; lang: LegalLang; newTab?: boolean }) {
  return (
    <>
      {parseInline(text, lang).map((p, i) => {
        if (p.kind === "placeholder") return <mark key={i} className="legal-ph" dir="ltr">{p.text}</mark>;
        if (p.kind === "link") {
          if (p.external || newTab)
            return (
              <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" className="legal-link">
                {p.text}
              </a>
            );
          return (
            <Link key={i} to={p.href} className="legal-link">
              {p.text}
            </Link>
          );
        }
        return <Fragment key={i}>{p.text}</Fragment>;
      })}
    </>
  );
}

function Block({ block, lang }: { block: LegalBlock; lang: LegalLang }) {
  if (typeof block === "string")
    return (
      <p>
        <LegalText text={block} lang={lang} />
      </p>
    );
  if ("list" in block)
    return (
      <ul className="legal-list">
        {block.list.map((item, i) => (
          <li key={i}>
            <LegalText text={item} lang={lang} />
          </li>
        ))}
      </ul>
    );
  if ("note" in block)
    return (
      <p className="legal-note">
        <LegalText text={block.note} lang={lang} />
      </p>
    );
  const { head, rows } = block.table;
  return (
    <div className="legal-table-wrap">
      <table className="legal-table">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} data-label={head[c]}>
                  <LegalText text={cell} lang={lang} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Small note shown only in development builds while the texts are drafts. */
export function LegalDraftNote({ lang }: { lang: LegalLang }) {
  if (!import.meta.env.DEV) return null;
  return (
    <p className="legal-draft" role="note">
      {LEGAL_UI[lang].draft}
    </p>
  );
}

export interface LegalPageProps {
  doc: LegalKey;
  lang?: LegalLang;
}

export function LegalPage({ doc, lang: langProp }: LegalPageProps) {
  const lang = useLegalLang(langProp);
  const d = LEGAL_DOCS[doc][lang];
  const ui = LEGAL_UI[lang];
  const other: LegalLang = lang === "ar" ? "en" : "ar";

  // The legal pages sit outside the layouts that switch the language, so they
  // mark <html> themselves (screen readers, fonts, the browser's own RTL handling).
  useLayoutEffect(() => {
    const html = document.documentElement;
    const prev = { lang: html.lang, dir: html.dir };
    html.lang = lang;
    html.dir = lang === "ar" ? "rtl" : "ltr";
    return () => {
      html.lang = prev.lang || "en";
      html.dir = prev.dir || "ltr";
    };
  }, [lang]);

  useSeo({
    title: `${d.title} · ${BRAND_NAME}`,
    description: d.description,
    path: legalHref(doc, lang),
    lang,
    alternates: { en: legalHref(doc, "en"), ar: legalHref(doc, "ar") },
  });

  return (
    <div className="legal" dir={lang === "ar" ? "rtl" : "ltr"} lang={lang}>
      <header className="legal-top">
        <div className="legal-top-in">
          <Link to={lang === "ar" ? "/ar" : "/"} className="legal-brand" aria-label={ui.home}>
            {BRAND_NAME}
          </Link>
          <nav className="legal-tabs" aria-label={d.title}>
            {LEGAL_KEYS.map((k) => (
              <Link key={k} to={legalHref(k, lang)} className={`legal-tab${k === doc ? " is-on" : ""}`} aria-current={k === doc ? "page" : undefined}>
                {ui.nav[k]}
              </Link>
            ))}
          </nav>
          <Link to={legalHref(doc, other)} className="legal-lang" lang={other} hrefLang={other}>
            {ui.switchLang}
          </Link>
        </div>
      </header>

      <main className="legal-main">
        <LegalDraftNote lang={lang} />
        <h1 className="legal-title">{d.title}</h1>
        <p className="legal-meta">
          {ui.version} <span dir="ltr">{LEGAL_VERSION}</span>
          <button type="button" className="legal-print" onClick={() => window.print()}>
            {ui.print}
          </button>
        </p>
        {ui.translationNote && <p className="legal-note">{ui.translationNote}</p>}

        <section className="legal-summary" aria-labelledby="legal-summary-h">
          <h2 id="legal-summary-h" className="legal-kicker">
            {ui.inShort}
          </h2>
          <ul>
            {d.summary.map((s, i) => (
              <li key={i}>
                <LegalText text={s} lang={lang} />
              </li>
            ))}
          </ul>
        </section>

        <nav className="legal-toc" aria-labelledby="legal-toc-h">
          <h2 id="legal-toc-h" className="legal-kicker">
            {ui.contents}
          </h2>
          <ol>
            {d.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.heading.replace(/^\d+\.\s*/, "")}</a>
              </li>
            ))}
          </ol>
        </nav>

        {d.sections.map((s) => (
          <section key={s.id} id={s.id} className="legal-sec">
            <h2>{s.heading}</h2>
            {s.blocks.map((b, i) => (
              <Block key={i} block={b} lang={lang} />
            ))}
          </section>
        ))}

        <footer className="legal-foot">
          <p className="legal-foot-q">{ui.questions}</p>
          <p>
            <LegalText text={ui.contactLine} lang={lang} />
          </p>
        </footer>
      </main>
    </div>
  );
}

export function Privacy({ lang }: { lang?: LegalLang }) {
  return <LegalPage doc="privacy" lang={lang} />;
}

export default Privacy;
