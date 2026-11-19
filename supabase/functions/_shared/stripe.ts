// Stripe client and money helpers.
import Stripe from "npm:stripe@17.7.0";
import { requireEnv } from "./http.ts";

export { Stripe };

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!client) {
    client = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
      httpClient: Stripe.createFetchHttpClient(),
      maxNetworkRetries: 2,
    });
  }
  return client;
}

export const cryptoProvider = Stripe.createSubtleCryptoProvider();

// Stripe amounts are integers in the currency's minor unit.
const THREE_DECIMAL = new Set(["BHD", "JOD", "KWD", "OMR", "TND"]);
const ZERO_DECIMAL = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);

export function minorUnit(currency: string): number {
  const c = currency.toUpperCase();
  if (THREE_DECIMAL.has(c)) return 1000;
  if (ZERO_DECIMAL.has(c)) return 1;
  return 100;
}

/** Stripe minor units -> decimal amount (KWD 20000 -> 20.000). */
export function fromMinor(amount: number, currency: string): number {
  return amount / minorUnit(currency);
}

/** Decimal -> Stripe minor units (KWD 20.000 -> 20000). */
export function toMinor(amount: number, currency: string): number {
  return Math.round(amount * minorUnit(currency));
}

// Prices (KWD). Stripe Price ids from secrets win; these are used for price_data
// when a Price id is not configured.
export const PRICES_KWD = {
  report: 20,
  monthly: 5,
  yearly: 45,
} as const;

export const TRIAL_DAYS_WITH_REPORT = 30;
