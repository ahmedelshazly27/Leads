import { backendMode, check, invalidate, sb, useBackendQuery } from "./client";
import { mock } from "./mock";
import { getSession, requireUserId, useSession } from "./auth";
import type { ConsentKind, ConsentRow, QueryState } from "./types";

/**
 * Version stamp stored with each consent. Bump it whenever the wording of the
 * terms, privacy policy or photo-consent screen changes, so we can tell which
 * text a person agreed to.
 */
export const CONSENT_VERSION = "2026-11-19";

const PENDING_KEY = "facet-pending-consents";

interface Pending {
  kind: ConsentKind;
  version: string;
  at: string;
}

function readPending(): Pending[] {
  try {
    return JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? "[]") as Pending[];
  } catch {
    return [];
  }
}
function writePending(list: Pending[]) {
  try {
    if (list.length) sessionStorage.setItem(PENDING_KEY, JSON.stringify(list));
    else sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* storage blocked */
  }
}

/**
 * Record consents for the signed-in user. When nobody is signed in yet (e.g.
 * the 18+ and terms checks on /start happen before the email code), they are
 * kept for this browser tab and saved right after sign-in.
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

/** Consents given before sign-in that have not been saved yet. */
export function pendingConsents(): ConsentKind[] {
  return readPending().map((p) => p.kind);
}

/** Save consents stashed before sign-in. Called automatically when a session starts. */
export async function flushPendingConsents(): Promise<void> {
  const list = readPending();
  if (!list.length || !getSession()) return;
  const byVersion = new Map<string, ConsentKind[]>();
  for (const p of list) byVersion.set(p.version, [...(byVersion.get(p.version) ?? []), p.kind]);
  for (const [version, kinds] of byVersion) await recordConsents(kinds, version);
  writePending([]);
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
