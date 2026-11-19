import { createElement, Fragment, useEffect, useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from "react";

/*
 * Language switch for the landing page. The Arabic copy (src/i18n/ar.json)
 * is keyed by the exact English string, so the page's rendered text is
 * swapped in place and restored when switching back. Templates use {0}, {1}.
 * First version: a later pass can move strings into components with t().
 */

export type Lang = "en" | "ar";
const KEY = "lang";
const subs = new Set<() => void>();

function read(): Lang {
  try {
    return localStorage.getItem(KEY) === "ar" ? "ar" : "en";
  } catch {
    return "en";
  }
}
let lang: Lang = read();

export function setLang(l: Lang) {
  lang = l;
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* private mode: keep it for this visit only */
  }
  subs.forEach((f) => f());
}
/** The current language outside React (e.g. for formatting in plain functions). */
export const getLang = (): Lang => lang;

/** Locale for dates and numbers: Arabic month names with Latin digits, like the rest of the copy. */
export const dateLocale = (l: Lang = lang): string | undefined => (l === "ar" ? "ar-KW-u-nu-latn" : undefined);

/**
 * Parts of a list as separate text nodes, so each one is swapped on its own
 * (a list joined into one string never matches a dictionary key).
 */
export function joinNodes(parts: ReactNode[], sep: string): ReactNode {
  return parts.map((p, i) => createElement(Fragment, { key: i }, i > 0 ? sep : null, p));
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => lang,
  );
}

type Dict = Record<string, string>;

/* The Arabic dictionary, shared by every page; loaded once, on demand. */
let AR: Dict | null = null;
let arPending: Promise<Dict> | null = null;
export function loadArDict(): Promise<Dict> {
  if (AR) return Promise.resolve(AR);
  return (arPending ??= import("../i18n/ar.json").then(
    (m) => (AR = m.default as Dict),
    (e) => {
      arPending = null; // allow a retry after a failed download
      throw e;
    },
  ));
}

/*
 * Marker names, definitions and research notes (from lib/markers/catalog.json) are a
 * second, separate dictionary: only the report, the PDF and the /analysis pages show
 * them, so neither English visitors nor the rest of the Arabic app download it.
 * Entries in ar.json win where both have the same key.
 */
let ARM: Dict | null = null;
let armPending: Promise<Dict> | null = null;
export function loadArMarkers(): Promise<Dict> {
  if (ARM) return Promise.resolve(ARM);
  return (armPending ??= import("../i18n/ar-markers.json").then(
    (m) => (ARM = m.default as Dict),
    (e) => {
      armPending = null;
      throw e;
    },
  ));
}
let MERGED: Dict | null = null;
/** ar.json plus the marker dictionary, built once (templates and lookups are cached per object). */
function withMarkers(ar: Dict, markers: Dict): Dict {
  return (MERGED ??= { ...markers, ...ar });
}
const current = (markers: boolean): Dict | null => (AR && markers && ARM ? withMarkers(AR, ARM) : AR);

const ORIGINAL = new WeakMap<Node, string>();
const APPLIED = new WeakMap<Node, string>();
const ATTR_ORIGINAL = new WeakMap<Element, Record<string, string>>();
const ATTRS = ["alt", "aria-label", "placeholder", "title"];

const norm = (s: string) => s.replace(/\s+/g, " ").replace(/&amp;/g, "&").trim();

const TEMPLATES = new WeakMap<Dict, { re: RegExp; v: string; lit: number; weak: boolean }[]>();
function templates(dict: Dict) {
  const hit = TEMPLATES.get(dict);
  if (hit) return hit;
  const list = Object.entries(dict)
    .filter(([k]) => /\{\d\}/.test(k))
    .map(([k, v]) => {
      const re = new RegExp("^" + k.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\\?\{(\d)\\?\}/g, "(.+?)") + "$");
      const lit = k.replace(/\{\d\}/g, "");
      // "{0} of {1}", "{0} + {1}", "{0}'s": so little fixed text that it matches any English sentence
      return { re, v, lit: lit.length, weak: (lit.match(/[A-Za-z]/g)?.length ?? 0) < 6 };
    })
    // the most specific template first ("{0} KWD–{1} KWD" before "{0} KWD")
    .sort((a, b) => b.lit - a.lit);
  TEMPLATES.set(dict, list);
  return list;
}

/** Arabic has no case: "front posture", "Front posture" and "FRONT POSTURE" are the same entry. */
const LOWER = new WeakMap<Dict, Map<string, string>>();
function exact(t: string, dict: Dict): string | undefined {
  if (dict[t] != null) return dict[t];
  let low = LOWER.get(dict);
  if (!low) {
    low = new Map();
    for (const [k, v] of Object.entries(dict)) if (!low.has(k.toLowerCase())) low.set(k.toLowerCase(), v);
    LOWER.set(dict, low);
  }
  return low.get(t.toLowerCase());
}

/** Results per dictionary: the same strings are looked up again on every re-render pass. */
const MEMO = new WeakMap<Dict, Map<string, string | null>>();
function lookup(text: string, dict: Dict, tpl: ReturnType<typeof templates>, depth = 0): string | null {
  const t = norm(text);
  if (!t) return null;
  if (depth === 0) {
    let memo = MEMO.get(dict);
    if (!memo) MEMO.set(dict, (memo = new Map()));
    const hit = memo.get(t);
    if (hit !== undefined) return hit;
    const r = find(t, dict, tpl, 0);
    if (memo.size > 20000) memo.clear();
    memo.set(t, r);
    return r;
  }
  return find(t, dict, tpl, depth);
}
function find(t: string, dict: Dict, tpl: ReturnType<typeof templates>, depth: number): string | null {
  const e = exact(t, dict);
  if (e != null) return e;
  for (const { re, v, weak } of tpl) {
    const m = t.match(re);
    if (!m) continue;
    // a filled-in part can itself be a template ("6% behind" inside a sentence), one level deep
    const parts = m.slice(1).map((g) => ({ g, ar: (depth < 1 ? lookup(g, dict, tpl, depth + 1) : exact(g, dict)) ?? null }));
    // a weak template only fills in numbers, single words (a name) or parts that are themselves
    // translated: otherwise a citation title would come out as half-English "Anthropometry من the Head"
    if (weak && parts.some(({ g, ar }) => ar == null && /[A-Za-z]/.test(g) && /\s/.test(g.trim()))) continue;
    return v.replace(/\{(\d)\}/g, (_, i) => { const p = parts[Number(i)]; return p ? p.ar ?? p.g : ""; });
  }
  return null;
}

/**
 * Headings split into a muted part and the rest ("Higher" + "pay", "Nutrition" + "Plan")
 * are keyed whole when the Arabic word order differs: the first Arabic word takes the
 * place of the heading's first part.
 */
// only static headings: React must not update a heading whose nodes were replaced
const SPLIT = ".ls-card h3, h1.pv-h";
/** Subtrees marked translate="no" (staff pages, the brand) are never swapped. */
const NO_SWAP = '[translate="no"]';
const keep = (el: Element | null | undefined) => !!el?.closest(NO_SWAP);
function translateSplitHeadings(root: HTMLElement, dict: Dict) {
  root.querySelectorAll<HTMLElement>(SPLIT).forEach((h) => {
    if (h.dataset.en != null || keep(h)) return;
    const span = h.querySelector(":scope > span");
    if (!span || h.children.length !== 1) return;
    const full = norm(h.textContent ?? "");
    const ar = dict[full];
    if (!ar) return;
    const spanFirst = h.firstChild === span || !norm(h.firstChild?.textContent ?? "");
    h.dataset.en = h.innerHTML;
    const [first, ...rest] = ar.split(" ");
    const s = document.createElement("span");
    s.className = span.className;
    h.innerHTML = "";
    if (spanFirst || h.matches(".ls-card h3")) {
      s.textContent = first;
      h.append(s, " " + rest.join(" "));
    } else {
      s.textContent = rest.join(" ");
      h.append(first + " ", s);
    }
  });
}

export function translateTree(root: HTMLElement, dict: Dict) {
  const tpl = templates(dict);
  translateSplitHeadings(root, dict);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (keep(n.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const n of nodes) {
    // React may have rewritten the node since we translated it: then its value is the new source
    const cur = n.nodeValue ?? "";
    const src = APPLIED.get(n) === cur ? ORIGINAL.get(n) ?? cur : cur;
    const ar = lookup(src, dict, tpl);
    if (ar == null) continue;
    ORIGINAL.set(n, src);
    const lead = src.match(/^\s*/)?.[0] ?? "";
    const trail = src.match(/\s*$/)?.[0] ?? "";
    const next = lead + ar + trail;
    APPLIED.set(n, next);
    if (n.nodeValue !== next) n.nodeValue = next;
  }
  root.querySelectorAll<HTMLElement>("[alt],[aria-label],[placeholder],[title]").forEach((el) => {
    if (keep(el)) return;
    const saved = ATTR_ORIGINAL.get(el) ?? {};
    for (const a of ATTRS) {
      const v = saved[a] ?? el.getAttribute(a);
      if (!v) continue;
      const ar = lookup(v, dict, tpl);
      if (ar == null) continue;
      saved[a] = v;
      el.setAttribute(a, ar);
    }
    ATTR_ORIGINAL.set(el, saved);
  });
}

export function restoreTree(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("[data-en]").forEach((h) => {
    h.innerHTML = h.dataset.en!;
    delete h.dataset.en;
  });
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const n = walker.currentNode;
    const o = ORIGINAL.get(n);
    if (o != null && APPLIED.get(n) === n.nodeValue) n.nodeValue = o;
    APPLIED.delete(n);
  }
  root.querySelectorAll<HTMLElement>("*").forEach((el) => {
    const saved = ATTR_ORIGINAL.get(el);
    if (saved) for (const [a, v] of Object.entries(saved)) el.setAttribute(a, v);
  });
}

/**
 * Swap the page under `root` to Arabic while lang is "ar", and back.
 * `markers`: the page shows marker definitions, so the marker dictionary is loaded too.
 * Returns true once every dictionary the page asked for is applied (always true in English):
 * the PDF waits for it before measuring its pages.
 */
export function useArabicPage(ref: { current: HTMLElement | null }, lang: Lang, markers = false): boolean {
  // imported lazily so English visitors don't download the Arabic copy; once loaded
  // (or preloaded before the first render) it applies before the first paint
  const [dict, setDict] = useState<Dict | null>(() => current(markers));
  const [armFailed, setFailed] = useState(false);
  useEffect(() => {
    if (lang !== "ar") return;
    let live = true;
    const want = current(markers);
    if (want !== dict) setDict(want);
    if (!AR) loadArDict().then(() => live && setDict(current(markers)), () => undefined);
    // the base copy is applied first; marker definitions follow when their file arrives
    if (markers && !ARM && !armFailed)
      loadArMarkers().then(
        () => live && setDict(current(true)),
        () => live && setFailed(true), // offline: the page stays usable with the base copy
      );
    return () => {
      live = false;
    };
  }, [lang, dict, markers, armFailed]);
  useLayoutEffect(() => {
    const root = ref.current;
    const html = document.documentElement;
    if (!root) return;
    if (lang !== "ar") {
      restoreTree(root);
      html.lang = "en";
      html.dir = "ltr";
      return;
    }
    // Arabic chosen but the copy is still downloading: keep what is on screen
    // (an Arabic pre-rendered page stays Arabic) instead of resetting it to English
    if (!dict) return;
    html.lang = "ar";
    html.dir = "rtl";
    translateTree(root, dict);
    let queued = false;
    const mo = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        mo.disconnect();
        translateTree(root, dict);
        mo.observe(root, OPTS);
      });
    });
    const OPTS = { subtree: true, childList: true, characterData: true };
    mo.observe(root, OPTS);
    return () => {
      mo.disconnect();
      html.lang = "en";
      html.dir = "ltr";
    };
  }, [ref, lang, dict]);
  return lang !== "ar" || (!!dict && (!markers || dict === MERGED || armFailed));
}

/** One string in Arabic when the Arabic copy is loaded (e.g. a name in the document title), else unchanged. */
export function arText(s: string): string {
  const d = current(true);
  return d ? lookup(s, d, templates(d)) ?? s : s;
}

/** The Arabic dictionary, loaded on demand (null until loaded or when not needed). */
export function useArDict(enabled: boolean) {
  const [dict, setDict] = useState<Dict | null>(() => AR);
  useEffect(() => {
    if (enabled && !dict) loadArDict().then(setDict, () => undefined);
  }, [enabled, dict]);
  return enabled ? dict : null;
}
