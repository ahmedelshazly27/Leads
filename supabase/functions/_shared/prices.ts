// Prices per currency and the countries we sell in.
//
// prices.json is the canonical table. The app keeps an identical copy
// (app/src/lib/prices.json; `npm run check:prices` fails when they differ),
// but only this one decides what Stripe charges: the client sends a plan and
// a country, never an amount.
//
// Amounts are what the customer pays, VAT included where VAT applies (Stripe
// prices are created with tax_behavior "inclusive").
import TABLE from "./prices.json" with { type: "json" };

export type PricePlan = "report" | "monthly" | "yearly";

interface CurrencyPrices {
  report: number;
  monthly: number;
  yearly: number;
  /** digits after the decimal point (KWD, BHD, OMR: 3) */
  decimals: number;
}

const CURRENCIES = TABLE.currencies as Record<string, CurrencyPrices>;
const COUNTRIES = TABLE.countries as Record<string, string>;
const SELLING = new Set<string>(TABLE.selling);

export const PRICE_TABLE_VERSION: number = TABLE.version;
export const FALLBACK_CURRENCY: string = TABLE.fallbackCurrency;

/** Every currency in the table (upper case). */
export const CURRENCY_CODES: readonly string[] = Object.keys(CURRENCIES);

/** Upper-case ISO 3166-1 alpha-2 code, or null when the value is not one. */
export function normCountry(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const c = v.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : null;
}

/** True when checkout is open for the country. */
export const isSelling = (country: string): boolean => SELLING.has(country);

/** The currency a country is charged in (its own, else the fallback). */
export const currencyForCountry = (country: string): string => COUNTRIES[country] ?? FALLBACK_CURRENCY;

export const hasCurrency = (currency: string): boolean => currency.toUpperCase() in CURRENCIES;

/** Price of a plan in a currency, in major units (SAR 249, KWD 20). Throws for a currency not in the table. */
export function priceOf(plan: PricePlan, currency: string): number {
  const row = CURRENCIES[currency.toUpperCase()];
  if (!row) throw new Error(`no prices for ${currency}`);
  return row[plan];
}

/** Digits after the decimal point for a currency in the table (null when it is not in the table). */
export function decimalsOf(currency: string): number | null {
  return CURRENCIES[currency.toUpperCase()]?.decimals ?? null;
}
