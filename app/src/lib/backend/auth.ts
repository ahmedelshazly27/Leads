import { useSyncExternalStore } from "react";
import { BackendError, backendMode, check, invalidate, sb, supabase, useBackendQuery } from "./client";
import { mock } from "./mock";
import { flushPendingConsents } from "./consents";
import type { ProfilePatch, ProfileRow, QueryState, SessionInfo } from "./types";

/* ------------------------- Session store --------------------------- */

let session: SessionInfo | null = null;
/** false until the stored session has been read once */
let sessionReady = backendMode === "off";
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function setSession(next: SessionInfo | null) {
  const changed = next?.userId !== session?.userId || next?.email !== session?.email;
  session = next;
  sessionReady = true;
  if (changed) {
    emit();
    invalidate();
    if (next) flushPendingConsents().catch((e) => console.warn("could not save consents", e));
  } else emit();
}

if (backendMode === "mock") {
  session = mock.getSession();
  sessionReady = true;
  mock.onSession(setSession);
} else if (supabase) {
  supabase.auth
    .getSession()
    .then(({ data }) => setSession(data.session ? { userId: data.session.user.id, email: data.session.user.email ?? null } : null))
    .catch(() => setSession(null));
  supabase.auth.onAuthStateChange((_event, s) => setSession(s ? { userId: s.user.id, email: s.user.email ?? null } : null));
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function getSession(): SessionInfo | null {
  return session;
}

/** The signed-in user, or null. `ready` is false while the stored session is still being read. */
export function useSession(): { session: SessionInfo | null; ready: boolean } {
  const s = useSyncExternalStore(subscribe, () => session);
  const ready = useSyncExternalStore(subscribe, () => sessionReady);
  return { session: s, ready };
}

/** Resolve once the stored session has been read (e.g. before a route guard decides). */
export function whenSessionReady(): Promise<SessionInfo | null> {
  if (sessionReady) return Promise.resolve(session);
  return new Promise((resolve) => {
    const off = subscribe(() => {
      if (sessionReady) {
        off();
        resolve(session);
      }
    });
  });
}

export function requireUserId(): string {
  if (!session) throw new BackendError("Please sign in first.", "not_signed_in");
  return session.userId;
}

/* ---------------------- Email one-time code ------------------------ */

const normEmail = (e: string) => e.trim().toLowerCase();

/** Send a 6-digit sign-in code to the email. Creates the account on first use. */
export async function sendCode(email: string, opts: { locale?: "en" | "ar" } = {}): Promise<void> {
  if (backendMode === "mock") return mock.sendCode(normEmail(email));
  const { error } = await sb().auth.signInWithOtp({
    email: normEmail(email),
    options: { shouldCreateUser: true, data: opts.locale ? { locale: opts.locale } : undefined },
  });
  if (error) throw new BackendError(error.message, error.code ?? "otp_failed");
}

/** Check the code from the email and sign in. */
export async function verifyCode(email: string, code: string): Promise<SessionInfo> {
  if (backendMode === "mock") return mock.verifyCode(normEmail(email), code);
  const { data, error } = await sb().auth.verifyOtp({ email: normEmail(email), token: code.trim(), type: "email" });
  if (error) throw new BackendError(error.message, error.code ?? "otp_invalid");
  if (!data.user) throw new BackendError("Sign-in did not complete. Please request a new code.", "otp_invalid");
  const s = { userId: data.user.id, email: data.user.email ?? null };
  setSession(s);
  return s;
}

export async function signOut(): Promise<void> {
  if (backendMode === "mock") return mock.signOut();
  if (!supabase) return;
  await supabase.auth.signOut();
  setSession(null);
}

/* ----------------------------- Profile ----------------------------- */

export async function getMyProfile(): Promise<ProfileRow | null> {
  if (backendMode === "mock") return mock.getProfile();
  if (!session) return null;
  const row = check(await sb().from("profiles").select("*").eq("id", session.userId).maybeSingle());
  return (row as ProfileRow | null) ?? null;
}

/** Update the signed-in user's own profile. `role` and `reviewer_gender` can only be changed by an admin. */
export async function updateMyProfile(patch: ProfilePatch): Promise<ProfileRow> {
  if (backendMode === "mock") return mock.updateProfile(patch);
  const uid = requireUserId();
  const { full_name, phone, locale, gender, birth_year } = patch;
  const clean = Object.fromEntries(Object.entries({ full_name, phone, locale, gender, birth_year }).filter(([, v]) => v !== undefined));
  const row = check(await sb().from("profiles").update(clean).eq("id", uid).select("*").single());
  invalidate();
  return row as ProfileRow;
}

export function useProfile(): QueryState<ProfileRow | null> {
  const { session: s } = useSession();
  return useBackendQuery(s ? `profile:${s.userId}` : null, getMyProfile);
}

/** Convenience role checks for route guards. */
export function useRole(): { role: ProfileRow["role"] | null; loading: boolean } {
  const { session: s, ready } = useSession();
  const p = useProfile();
  return { role: p.data?.role ?? null, loading: !ready || (s !== null && p.loading && p.data === undefined) };
}
