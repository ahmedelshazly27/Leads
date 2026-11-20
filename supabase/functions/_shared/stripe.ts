// Stripe client and money helpers.
import Stripe from "npm:stripe@17.7.0";
import { requireEnv } from "./http.ts";
import { decimalsOf } from "./prices.ts";

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
  const d = decimalsOf(c);
  if (d != null) return 10 ** d;
  if (THREE_DECIMAL.has(c)) return 1000;
  if (ZERO_DECIMAL.has(c)) return 1;
  return 100;
}

/**
 * The smallest step Stripe accepts for an amount, in minor units. For the
 * three-decimal currencies (KWD, BHD, OMR, JOD, TND) Stripe requires the
 * amount to be divisible by 10 (whole 10 fils / baisa), for compatibility
 * with local card processing.
 */
export function minorStep(currency: string): number {
  return minorUnit(currency) === 1000 ? 10 : 1;
}

/** Stripe minor units -> decimal amount (KWD 20000 -> 20.000). */
export function fromMinor(amount: number, currency: string): number {
  return amount / minorUnit(currency);
}

/** Decimal -> Stripe minor units (KWD 20.000 -> 20000). */
export function toMinor(amount: number, currency: string): number {
  return Math.round(amount * minorUnit(currency));
}

/** A price to charge, in Stripe minor units. Throws when Stripe would refuse it (KWD not in whole 10 fils). */
export function chargeAmount(amount: number, currency: string): number {
  const minor = toMinor(amount, currency);
  if (!(minor > 0) || minor % minorStep(currency) !== 0) {
    throw new Error(`${amount} ${currency} is not a valid Stripe amount`);
  }
  return minor;
}

/** A refund rounded down to an amount Stripe accepts (whole 10 fils for KWD/BHD/OMR, whole cents/halalas otherwise). */
export function refundAmount(minor: number, currency: string): number {
  const step = minorStep(currency);
  return Math.max(0, Math.floor(minor / step) * step);
}

/** Round a decimal amount to the currency's minor unit (for display and records). */
export function roundMoney(amount: number, currency: string): number {
  const u = minorUnit(currency);
  return Math.round(amount * u) / u;
}

/**
 * Stripe Tax: off unless STRIPE_AUTOMATIC_TAX=1. Turn it on only once the
 * owner is registered for VAT where Stripe should collect it (and has added
 * the registrations in the Stripe dashboard). Prices are VAT-inclusive either
 * way, so the customer pays the same amount; with it on, Stripe works out the
 * VAT inside that amount and shows it on the receipt.
 */
export const automaticTax = (): boolean => Deno.env.get("STRIPE_AUTOMATIC_TAX") === "1";

/**
 * Checkout page language. Stripe Checkout does not offer Arabic, so Arabic
 * customers get "auto" (the browser's language when Stripe supports it,
 * otherwise English).
 */
export const checkoutLocale = (locale: string): Stripe.Checkout.SessionCreateParams.Locale =>
  locale === "en" ? "en" : "auto";

export const TRIAL_DAYS_WITH_REPORT = 30;
