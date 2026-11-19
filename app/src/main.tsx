import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./styles/global.css";
import mobileCss from "./styles/mobile.css?inline";
import { App, preloadRoute } from "./App";
import { initStore } from "./lib/store";
import { getLang, loadArDict } from "./lib/i18n";

if (import.meta.env.DEV) import("./dev").then((m) => m.installDevHooks());

/**
 * mobile.css overrides page layouts on small screens with selectors of the same
 * weight, so it has to come after every page stylesheet. Pages are lazy chunks
 * whose CSS is added to <head> when they load, so keep this sheet at the end of
 * <head> whenever another stylesheet arrives. The pre-rendered pages already carry
 * it (as the same element), so it is reused rather than added twice.
 */
function keepMobileCssLast() {
  const head = document.head;
  let el = head.querySelector<HTMLStyleElement>("style[data-mobile-css]");
  if (!el) {
    el = document.createElement("style");
    el.setAttribute("data-mobile-css", "");
    head.appendChild(el);
  }
  if (el.textContent !== mobileCss) el.textContent = mobileCss;
  const sheet = el;
  const isSheet = (n: Element) => n.tagName === "STYLE" || (n.tagName === "LINK" && /\bstylesheet\b/i.test((n as HTMLLinkElement).rel));
  const fix = () => {
    for (let n = sheet.nextElementSibling; n; n = n.nextElementSibling) {
      if (isSheet(n)) {
        head.appendChild(sheet);
        return;
      }
    }
  };
  fix();
  new MutationObserver(fix).observe(head, { childList: true });
}
keepMobileCssLast();

/**
 * Load the saved state and the first page's chunk in parallel, then render once.
 * Until then the pre-rendered HTML (landing, Arabic landing, library) stays on screen,
 * so there is no blank flash between the static page and the app taking over.
 * An Arabic page (/ar..., or the app with Arabic chosen) also waits for the Arabic
 * copy, so the first render is swapped before it is painted, never English first.
 */
const path = window.location.pathname;
const arabic = path === "/ar" || path.startsWith("/ar/") || getLang() === "ar";
Promise.all([initStore(), preloadRoute(path), arabic ? loadArDict().catch(() => null) : null]).finally(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <BrowserRouter future={{ v7_startTransition: true }}>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  );
});
