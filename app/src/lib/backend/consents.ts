import { backendMode, check, invalidate, sb, useBackendQuery } from "./client";
import { mock } from "./mock";
import { getSession, requireUserId, useSession } from "./auth";
import type { ConsentKind, ConsentRow, QueryState } from "./types";

/**
 * Version stamp stored with each consent. Bump it whenever the wording of the
 * terms, privacy policy or photo-consent screen changes, so we can tell which
 * text a person agreed to.
 */
export const CONSENT_VERSION = "2026-11-20.1";

const PENDING_KEY = "facet-pending-consents";
/** Pending consents older than this are dropped (a sign-in code or link expires long before). */
const PENDING_MAX_AGE_MS = 2 * 3600_000;

interface Pending {
  kind: ConsentKind;
  version: string;
  at: string;
  /** the email the sign-in code was sent to (set by sendCode); only that account receives these consents */
  email?: string;
}

/*
 * Consents given before sign-in are kept in localStorage, not sessionStorage:
 * the sign-in link in the email opens a new tab, which has its own
 * sessionStorage, and the consents would be lost there. They hold only the
 * consent kind, version and time, and expire after two hours.
 */
function readStore(store: Storage | undefined): Pending[] {
  try {
    const list = JSON.parse(store?.getItem(PENDING_KEY) ?? "[]") as Pending[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function readPending(): Pending[] {
  // Older builds kept them in sessionStorage.
  const all = [...readStore(typeof sessionStorage !== "undefined" ? sessionStorage : undefined), ...readStore(typeof localStorage !== "undefined" ? localStorage : undefined)];
  const cutoff = Date.now() - PENDING_MAX_AGE_MS;
  const latest = new Map<ConsentKind, Pending>();
  for (const p of all) {
    if (!p?.kind || !p.version || !(Date.parse(p.at) >= cutoff)) continue;
    const prev = latest.get(p.kind);
    if (!prev || prev.at < p.at) latest.set(p.kind, p);
  }
  return [...latest.values()];
}

function writePending(list: Pending[]) {
  try {
    if (list.length) localStorage.setItem(PENDING_KEY, JSON.stringify(list));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    /* storage blocked */
  }
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* storage blocked */
  }
}

/**
 * Record consents for the signed-in user. When nobody is signed in yet (e.g.
 * the 18+ and terms checks on /start happen before the email code), they are
 * kept in this browser (up to two hours) and saved right after sign-in, also
 * when the sign-in link opens in a new tab.
 */
export async function recordConsents(kinds: ConsentKind[], version = CONSENT_VERSION): Promise<void> {
  if (!kinds.length) return;
  if (backendMode === "off") return;
  if (!getSession()) {
    const now = new Date().toISOString();
    const rest = readPending().filter((p) => !kinds.includes(p.kind));
    writePending([...rest, ...kinds.map((kind) => ({ kind, version, at: now }))]);
    return;
  }
  if (backendMode === "mock") {
    await mock.addConsents(kinds, version);
    return;
  }
  const uid = requireUserId();
  check(await sb().from("consents").insert(kinds.map((kind) => ({ user_id: uid, kind, version }))));
  invalidate();
}

/**
 * Ties the pending consents to the email a sign-in code is being sent to, so
 * that on a shared browser they are saved only for the person who gave them
 * (localStorage outlives the tab). Called by sendCode.
 */
export function tagPendingConsents(email: string): void {
  const list = readPending();
  if (list.length) writePending(list.map((p) => ({ ...p, email: email.trim().toLowerCase() })));
}

/** Consents given before sign-in that have not been saved yet. */
export function pendingConsents(): ConsentKind[] {
  return readPending().map((p) => p.kind);
}

let flushInFlight: Promise<void> | null = null;

/**
 * Save consents stashed before sign-in. Called automatically when a session
 * starts (and again by consentsFlushed before checkout). Only the entries that
 * were saved are removed from the pending list, so a consent given while a
 * save is running is kept for the next one. Concurrent calls share one save.
 */
export function flushPendingConsents(): Promise<void> {
  if (flushInFlight) return flushInFlight;
  flushInFlight = (async () => {
    const session = getSession();
    if (!session || backendMode === "off") return;
    const mine = session.email?.trim().toLowerCase() ?? null;
    // Consents tagged with another email were given by someone else on this browser: drop them.
    const all = readPending();
    const list = all.filter((p) => !p.email || !mine || p.email === mine);
    if (list.length !== all.length) writePending(list);
    if (!list.length) return;
    const byVersion = new Map<string, ConsentKind[]>();
    for (const p of list) byVersion.set(p.version, [...(byVersion.get(p.version) ?? []), p.kind]);
    for (const [version, kinds] of byVersion) {
      await recordConsents(kinds, version);
      const saved = new Set(kinds);
      writePending(readPending().filter((p) => !(saved.has(p.kind) && p.version === version)));
    }
  })().finally(() => {
    flushInFlight = null;
  });
  return flushInFlight;
}

export async function listMyConsents(): Promise<ConsentRow[]> {
  if (backendMode === "mock") return mock.listConsents();
  const uid = requireUserId();
  const rows = check(await sb().from("consents").select("*").eq("user_id", uid).order("granted_at", { ascending: false }));
  return (rows ?? []) as ConsentRow[];
}

/** Withdraw a consent (e.g. marketing). Photos consent withdrawal should be paired with a data deletion request. */
export async function withdrawConsent(kind: ConsentKind): Promise<void> {
  if (backendMode === "mock") return mock.withdrawConsent(kind);
  const uid = requireUserId();
  check(
    await sb()
      .from("consents")
      .update({ withdrawn_at: new Date().toISOString() })
      .eq("user_id", uid)
      .eq("kind", kind)
      .is("withdrawn_at", null),
  );
  invalidate();
}

/** Latest active consent per kind (null when never given or withdrawn). */
export function activeConsents(rows: ConsentRow[]): Partial<Record<ConsentKind, ConsentRow>> {
  const out: Partial<Record<ConsentKind, ConsentRow>> = {};
  for (const r of [...rows].sort((a, b) => a.granted_at.localeCompare(b.granted_at))) {
    if (r.withdrawn_at) delete out[r.kind];
    else out[r.kind] = r;
  }
  return out;
}

export function useMyConsents(): QueryState<ConsentRow[]> {
  const { session } = useSession();
  return useBackendQuery(session ? `consents:${session.userId}` : null, listMyConsents);
}
