/**
 * The price table exists twice: the server's copy (the source of truth for what
 * Stripe charges) and the app's copy (what the site shows). They must be the
 * same table. `npm run check:prices` fails when they differ.
 */
import { readFileSync } from "node:fs";

const SERVER = new URL("../../supabase/functions/_shared/prices.json", import.meta.url);
const APP = new URL("../src/lib/prices.json", import.meta.url);

function read(url) {
  try {
    return JSON.parse(readFileSync(url, "utf8"));
  } catch (e) {
    console.error(`check:prices: cannot read ${url.pathname}: ${e.message}`);
    process.exit(1);
  }
}
/** Same data, whatever the key order or whitespace. */
const canon = (v) =>
  Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v;

const a = JSON.stringify(canon(read(SERVER)));
const b = JSON.stringify(canon(read(APP)));
if (a !== b) {
  console.error("check:prices: supabase/functions/_shared/prices.json and app/src/lib/prices.json differ. Copy the server file over the app file.");
  process.exit(1);
}
console.log("check:prices: price tables match");
