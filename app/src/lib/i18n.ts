import { useEffect, useState, useSyncExternalStore } from "react";

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
const ORIGINAL = new WeakMap<Node, string>();
const APPLIED = new WeakMap<Node, string>();
const ATTR_ORIGINAL = new WeakMap<Element, Record<string, string>>();
const ATTRS = ["alt", "aria-label", "placeholder", "title"];

const norm = (s: string) => s.replace(/\s+/g, " ").replace(/&amp;/g, "&").trim();

function templates(dict: Dict) {
  return Object.entries(dict)
    .filter(([k]) => /\{\d\}/.test(k))
    .map(([k, v]) => {
      const re = new RegExp("^" + k.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\\?\{(\d)\\?\}/g, "(.+?)") + "$");
      return { re, v };
    });
}

function lookup(text: string, dict: Dict, tpl: ReturnType<typeof templates>): string | null {
  const t = norm(text);
  if (!t) return null;
  if (dict[t] != null) return dict[t];
  for (const { re, v } of tpl) {
    const m = t.match(re);
    if (m) return v.replace(/\{(\d)\}/g, (_, i) => { const g = m[Number(i) + 1] ?? ""; return dict[g] ?? g; });
  }
  return null;
}

/** Headings split into a muted first word and the rest ("Higher" + "pay") are keyed whole. */
function translateSplitHeadings(root: HTMLElement, dict: Dict) {
  root.querySelectorAll<HTMLElement>(".ls-card h3").forEach((h) => {
    const span = h.querySelector("span");
    if (!span) return;
    const full = norm(h.textContent ?? "");
    const ar = dict[full];
    if (!ar || h.dataset.en) return;
    h.dataset.en = h.innerHTML;
    const [first, ...rest] = ar.split(" ");
    h.innerHTML = "";
    const s = document.createElement("span");
    s.textContent = first;
    h.append(s, " " + rest.join(" "));
  });
}

export function translateTree(root: HTMLElement, dict: Dict) {
  const tpl = templates(dict);
  translateSplitHeadings(root, dict);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
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

/** Swap the page under `root` to Arabic while lang is "ar", and back. */
export function useArabicPage(ref: { current: HTMLElement | null }, lang: Lang) {
  // imported lazily so English visitors don't download the Arabic copy
  const [dict, setDict] = useState<Dict | null>(null);
  useEffect(() => {
    if (lang === "ar" && !dict) import("../i18n/ar.json").then((m) => setDict(m.default as Dict));
  }, [lang, dict]);
  useEffect(() => {
    const root = ref.current;
    const html = document.documentElement;
    if (!root) return;
    if (lang !== "ar" || !dict) {
      restoreTree(root);
      html.lang = "en";
      html.dir = "ltr";
      return;
    }
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
}

/** The Arabic dictionary, loaded on demand (null until loaded or when not needed). */
export function useArDict(enabled: boolean) {
  const [dict, setDict] = useState<Dict | null>(null);
  useEffect(() => {
    if (enabled && !dict) import("../i18n/ar.json").then((m) => setDict(m.default as Dict));
  }, [enabled, dict]);
  return dict;
}
