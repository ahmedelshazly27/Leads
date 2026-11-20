/*
 * Country and local prices.
 *
 * The price table (./prices.json) is a copy of the server's table
 * (supabase/functions/_shared/prices.json); `npm run check:prices` fails when
 * they differ. Prices are what the customer pays, VAT included where VAT
 * applies. The server decides the amount actually charged: the site only
 * shows it.
 *
 * The visitor's country is, in order: ?country=xx in the URL, the country
 * they picked before (localStorage), then a guess from the device's time zone
 * and language region. Countries outside `selling` see prices in their
 * currency (or USD) and a waitlist instead of checkout.
 */
import { useSyncExternalStore } from "react";
import TABLE from "./prices.json";
import type { Lang } from "./i18n";

export type PricePlan = "report" | "monthly" | "yearly";
export type CurrencyCode = keyof typeof TABLE.currencies;
/** ISO 3166-1 alpha-2, upper case ("KW", "SA", ...). */
export type CountryCode = string;

export interface Price {
  amount: number;
  currency: CurrencyCode;
}

export interface CountryInfo {
  code: CountryCode;
  en: string;
  ar: string;
}

/** The six launch countries first, then other countries in the region (waitlist until they open). */
export const COUNTRIES: CountryInfo[] = [
  { code: "KW", en: "Kuwait", ar: "الكويت" },
  { code: "SA", en: "Saudi Arabia", ar: "السعودية" },
  { code: "AE", en: "United Arab Emirates", ar: "الإمارات" },
  { code: "QA", en: "Qatar", ar: "قطر" },
  { code: "BH", en: "Bahrain", ar: "البحرين" },
  { code: "OM", en: "Oman", ar: "عُمان" },
  { code: "EG", en: "Egypt", ar: "مصر" },
  { code: "JO", en: "Jordan", ar: "الأردن" },
  { code: "IQ", en: "Iraq", ar: "العراق" },
  { code: "LB", en: "Lebanon", ar: "لبنان" },
  { code: "MA", en: "Morocco", ar: "المغرب" },
  { code: "TN", en: "Tunisia", ar: "تونس" },
];

/** Shown for a country not in COUNTRIES (prices in USD, waitlist). */
export const OTHER_COUNTRY: CountryInfo = { code: "ZZ", en: "Another country", ar: "دولة ثانية" };

/** The countries we sell in (Stripe checkout open). */
export const SELLING: readonly CountryCode[] = TABLE.selling;
/** Every currency the site can show, in the order of SELLING, then the fallback. */
export const FALLBACK_CURRENCY = TABLE.fallbackCurrency as CurrencyCode;
/** The default when nothing is known about the visitor (also what pre-rendered pages show). */
export const DEFAULT_COUNTRY: CountryCode = "KW";

const COUNTRY_CURRENCY = TABLE.countries as Record<string, CurrencyCode>;

export const isSelling = (country: CountryCode): boolean => SELLING.includes(country);
export const currencyFor = (country: CountryCode): CurrencyCode => COUNTRY_CURRENCY[country] ?? FALLBACK_CURRENCY;
export const countryInfo = (country: CountryCode): CountryInfo => COUNTRIES.find((c) => c.code === country) ?? { ...OTHER_COUNTRY, code: country };
export const countryName = (country: CountryCode, lang: Lang): string => {
  const c = COUNTRIES.find((x) => x.code === country);
  if (c) return lang === "ar" ? c.ar : c.en;
  // a country outside the list: the browser's own name for it, when it has one
  try {
    const n = new Intl.DisplayNames([lang === "ar" ? "ar" : "en"], { type: "region" }).of(country);
    if (n && n !== country) return n;
  } catch {
    /* old browser or not a region code */
  }
  return lang === "ar" ? OTHER_COUNTRY.ar : OTHER_COUNTRY.en;
};

/** The price of a plan in the visitor's country (its currency, else USD). */
export function priceFor(plan: PricePlan, country: CountryCode): Price {
  const currency = currencyFor(country);
  return { amount: TABLE.currencies[currency][plan], currency };
}

/** The price of a plan in a given currency (e.g. the currency a membership was bought in); unknown codes fall back to USD. */
export function priceIn(plan: PricePlan, currency: string | null | undefined): Price {
  const cur = (currency ?? "").toUpperCase();
  const c = (cur in TABLE.currencies ? cur : FALLBACK_CURRENCY) as CurrencyCode;
  return { amount: TABLE.currencies[c][plan], currency: c };
}

/** What 12 monthly payments cost more than the 12-month plan, in the same currency. */
export function yearlySaving(country: CountryCode): Price {
  const currency = currencyFor(country);
  const c = TABLE.currencies[currency];
  return { amount: Math.max(0, c.monthly * 12 - c.yearly), currency };
}

const AR_SYMBOL: Record<CurrencyCode, string> = {
  KWD: "د.ك",
  SAR: "ر.س",
  AED: "د.إ",
  QAR: "ر.ق",
  BHD: "د.ب",
  OMR: "ر.ع",
  USD: "$",
};

/** The currency on its own: "SAR" in English, "ر.س" in Arabic ("دولار" for USD). */
export function currencyLabel(currency: string, lang: Lang): string {
  const cur = currency.toUpperCase();
  if (lang !== "ar") return cur;
  return cur === "USD" ? "دولار" : AR_SYMBOL[cur as CurrencyCode] ?? cur;
}

/** Whole amounts without decimals ("20"); otherwise the currency's decimals ("12.500", "59.50"). Latin digits. */
export function formatAmount(amount: number, currency: string): string {
  const decimals = (TABLE.currencies as Record<string, { decimals: number }>)[currency]?.decimals ?? 2;
  const f = 10 ** decimals;
  const n = Math.round(amount * f) / f;
  return Number.isInteger(n) ? String(n) : n.toFixed(decimals);
}

/**
 * "SAR 249", "KWD 20", "USD 65" in English; "249 ر.س", "20 د.ك", "$65" in Arabic.
 * Unknown currency codes are shown as code + amount in both languages.
 */
export function formatPrice(amount: number, currency: string, lang: Lang): string {
  const n = formatAmount(amount, currency);
  const cur = currency.toUpperCase();
  if (lang === "ar") {
    if (cur === "USD") return `$${n}`;
    const sym = AR_SYMBOL[cur as CurrencyCode];
    return sym ? `${n} ${sym}` : `${n} ${cur}`;
  }
  return `${cur} ${n}`;
}

/**
 * formatPrice for on-screen text: a word joiner after the space keeps the
 * amount and the currency on one line ("549 / ر.س" never wraps). Not a no-break
 * space: the Arabic text swap folds every whitespace character into a plain
 * space, which would undo it; the joiner survives and is invisible.
 */
export const displayPrice = (amount: number, currency: string, lang: Lang): string => formatPrice(amount, currency, lang).replace(" ", " \u2060");

/** displayPrice for a Price. */
export const fmt = (p: Price, lang: Lang) => displayPrice(p.amount, p.currency, lang);

/* ------------------------------ The visitor's country ------------------------------ */

const KEY = "country";
const TZ_COUNTRY: Record<string, CountryCode> = {
  "Asia/Kuwait": "KW",
  "Asia/Riyadh": "SA",
  "Asia/Dubai": "AE",
  "Asia/Qatar": "QA",
  "Asia/Bahrain": "BH",
  "Asia/Muscat": "OM",
  "Africa/Cairo": "EG",
  "Asia/Amman": "JO",
  "Asia/Baghdad": "IQ",
  "Asia/Beirut": "LB",
  "Africa/Casablanca": "MA",
  "Africa/Tunis": "TN",
};

const valid = (v: unknown): v is CountryCode => typeof v === "string" && /^[A-Z]{2}$/.test(v);

/** A guess from the device: the time zone first (where the phone is), then the language region ("ar-SA"). */
export function detectCountry(): CountryCode | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TZ_COUNTRY[tz]) return TZ_COUNTRY[tz];
  } catch {
    /* no Intl time zone */
  }
  try {
    const langs = typeof navigator !== "undefined" ? (navigator.languages?.length ? navigator.languages : [navigator.language]) : [];
    for (const l of langs) {
      const region = l?.split(/[-_]/)[1]?.toUpperCase();
      if (valid(region)) return region;
    }
  } catch {
    /* no navigator */
  }
  return null;
}

function fromUrl(): CountryCode | null {
  try {
    const v = new URLSearchParams(window.location.search).get("country")?.toUpperCase();
    return valid(v) ? v : null;
  } catch {
    return null;
  }
}
function stored(): CountryCode | null {
  try {
    const v = localStorage.getItem(KEY);
    return valid(v) ? v : null;
  } catch {
    return null;
  }
}
function remember(c: CountryCode) {
  try {
    localStorage.setItem(KEY, c);
  } catch {
    /* private mode: kept for this visit only */
  }
}

function initial(): CountryCode {
  const u = fromUrl();
  if (u) {
    remember(u);
    return u;
  }
  return stored() ?? detectCountry() ?? DEFAULT_COUNTRY;
}

let country: CountryCode = initial();
const subs = new Set<() => void>();

/** Choose the country (remembered on this device). */
export function setCountry(c: CountryCode) {
  const v = c.toUpperCase();
  if (!valid(v)) return;
  remember(v);
  if (v === country) return;
  country = v;
  subs.forEach((f) => f());
}
/** The current country outside React. */
export const getCountry = (): CountryCode => country;

/** Re-read ?country= (call after client-side navigation to a URL that carries it). */
export function syncCountryFromUrl() {
  const u = fromUrl();
  if (u && u !== country) setCountry(u);
}

/** The visitor's country; re-renders when it changes. */
export function useCountry(): CountryCode {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => country,
    () => DEFAULT_COUNTRY,
  );
}

/** Country, currency and whether checkout is open, for components. */
export function useMarket() {
  const c = useCountry();
  return { country: c, currency: currencyFor(c), selling: isSelling(c) };
}
