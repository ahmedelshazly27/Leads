import { useEffect } from "react";
import { BRAND_NAME, INDEXABLE, SITE_URL } from "./brand";

export interface Seo {
  title: string;
  description?: string;
  /** path of this page, e.g. "/ar" */
  path: string;
  lang?: "en" | "ar";
  /** private app pages: keep out of search results */
  noindex?: boolean;
  /** hreflang alternates: lang → path */
  alternates?: Record<string, string>;
  jsonLd?: object[];
  image?: string;
}

function meta(attr: "name" | "property", key: string, content: string | null) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (content == null) return el?.remove();
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function link(rel: string, href: string | null, hreflang?: string) {
  const sel = hreflang ? `link[rel="${rel}"][hreflang="${hreflang}"]` : `link[rel="${rel}"]:not([hreflang])`;
  let el = document.head.querySelector<HTMLLinkElement>(sel);
  if (href == null) return el?.remove();
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    if (hreflang) el.hreflang = hreflang;
    document.head.appendChild(el);
  }
  el.href = href;
}

/** Sets title, description, canonical, social cards, robots, hreflang and JSON-LD for the current page. */
export function useSeo(s: Seo) {
  const key = JSON.stringify(s);
  useEffect(() => {
    const url = SITE_URL + s.path;
    const image = SITE_URL + (s.image ?? "/og.jpg");
    document.title = s.title;
    meta("name", "description", s.description ?? null);
    meta("name", "robots", s.noindex || !INDEXABLE ? "noindex, nofollow" : "index, follow, max-image-preview:large");
    link("canonical", s.noindex ? null : url);
    document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((l) => l.remove());
    if (s.alternates && !s.noindex) {
      for (const [hl, p] of Object.entries(s.alternates)) link("alternate", SITE_URL + p, hl);
      link("alternate", SITE_URL + (s.alternates.en ?? "/"), "x-default");
    }
    meta("property", "og:type", "website");
    meta("property", "og:site_name", BRAND_NAME);
    meta("property", "og:title", s.title);
    meta("property", "og:description", s.description ?? null);
    meta("property", "og:url", url);
    meta("property", "og:image", image);
    meta("property", "og:image:width", "1200");
    meta("property", "og:image:height", "630");
    meta("property", "og:locale", s.lang === "ar" ? "ar_AE" : "en_AE");
    meta("name", "twitter:card", "summary_large_image");
    meta("name", "twitter:title", s.title);
    meta("name", "twitter:description", s.description ?? null);
    meta("name", "twitter:image", image);
    document.getElementById("ld-json")?.remove();
    if (s.jsonLd?.length) {
      const el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = "ld-json";
      el.textContent = JSON.stringify(s.jsonLd.length === 1 ? s.jsonLd[0] : s.jsonLd);
      document.head.appendChild(el);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
