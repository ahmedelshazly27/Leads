/**
 * Pre-render the public pages to static HTML after `vite build`, so search
 * engines and link previews (WhatsApp, X, LinkedIn) see the full page and its
 * metadata without running JavaScript. The plain app shell is kept as
 * dist/app.html for every other route (see vercel.json).
 *
 *   VITE_SITE_URL=https://example.com VITE_INDEXABLE=1 npm run build:site
 *
 * Also writes robots.txt and sitemap.xml. Without VITE_INDEXABLE=1 (previews)
 * robots.txt blocks everything.
 */
import { spawn } from "node:child_process";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const SITE = (process.env.VITE_SITE_URL || "https://glowup-preview-beta.vercel.app").replace(/\/$/, "");
const INDEXABLE = process.env.VITE_INDEXABLE === "1";
const PORT = 4190;
const PAGES = [
  ["/", "dist/index.html"],
  ["/ar", "dist/ar/index.html"],
  ["/library", "dist/library/index.html"],
];

copyFileSync("dist/index.html", "dist/app.html");
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
const base = `http://localhost:${PORT}`;
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(base)).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}

const browser = await chromium.launch();
try {
  for (const [path, out] of PAGES) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(base + path, { waitUntil: "networkidle" });
    if (path === "/ar") await page.waitForFunction(() => document.documentElement.dir === "rtl" && /[؀-ۿ]/.test(document.querySelector("h1")?.textContent ?? ""));
    await page.waitForTimeout(800);
    const html = "<!doctype html>\n" + (await page.evaluate(() => document.documentElement.outerHTML));
    mkdirSync(out.replace(/\/[^/]+$/, ""), { recursive: true });
    writeFileSync(out, html);
    console.log("prerendered", path, "→", out, Math.round(html.length / 1024) + " KB");
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}

writeFileSync(
  "dist/robots.txt",
  INDEXABLE ? `User-agent: *\nAllow: /\nDisallow: /home\nDisallow: /new\nDisallow: /review\nDisallow: /analysis\nDisallow: /protocol\nDisallow: /settings\nDisallow: /measurements\n\nSitemap: ${SITE}/sitemap.xml\n` : "User-agent: *\nDisallow: /\n",
);
const today = new Date().toISOString().slice(0, 10);
const url = (loc, alts) =>
  `  <url>\n    <loc>${SITE}${loc}</loc>\n    <lastmod>${today}</lastmod>\n${(alts || []).map(([l, p]) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${SITE}${p}"/>`).join("\n")}\n  </url>`;
const langs = [["en", "/"], ["ar", "/ar"], ["x-default", "/"]];
writeFileSync(
  "dist/sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${[url("/", langs), url("/ar", langs), url("/library")].join("\n")}\n</urlset>\n`,
);
console.log("robots.txt", INDEXABLE ? "(indexable)" : "(preview: blocked)", "· sitemap.xml for", SITE);
