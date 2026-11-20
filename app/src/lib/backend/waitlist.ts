import { BackendError, backendMode, callFunction } from "./client";
import { mock } from "./mock";
import type { GenderCode, Locale } from "./types";

export interface WaitlistEntry {
  email: string;
  phone?: string | null;
  gender: GenderCode | null;
  locale: Locale;
  /** where the person came from, e.g. "start", "landing", "instagram" */
  source?: string | null;
  /** the person's country (ISO-2), e.g. a country we do not sell in yet */
  country?: string | null;
}

/**
 * - "joined": added to the waitlist
 * - "already": this email was already on it
 * - "saved_locally": no backend configured (local demo); kept on this device only
 */
export type WaitlistResult = "joined" | "already" | "saved_locally";

const LOCAL_KEY = "facet-waitlist-local";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function joinWaitlist(entry: WaitlistEntry): Promise<WaitlistResult> {
  const email = entry.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new BackendError("Please enter a valid email address.", "invalid_email");
  const country = entry.country?.trim().toUpperCase();
  const clean = { ...entry, email, phone: entry.phone?.trim() || null, source: entry.source ?? null, country: country && /^[A-Z]{2}$/.test(country) ? country : null };

  if (backendMode === "mock") return mock.joinWaitlist(clean);
  if (backendMode === "off") {
    try {
      const list = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]") as WaitlistEntry[];
      if (list.some((x) => x.email === email)) return "already";
      localStorage.setItem(LOCAL_KEY, JSON.stringify([...list, { ...clean, at: new Date().toISOString() }]));
    } catch {
      /* storage blocked */
    }
    return "saved_locally";
  }
  const res = await callFunction<{ status?: string; already?: boolean } | null>("join-waitlist", clean);
  return res?.status === "already" || res?.already ? "already" : "joined";
}
