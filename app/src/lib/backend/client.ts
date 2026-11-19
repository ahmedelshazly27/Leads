import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { QueryState } from "./types";

/**
 * Backend mode:
 * - "supabase": VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY are set.
 * - "mock":     VITE_BACKEND_MOCK=1 (in-memory demo backend, see mock.ts). Wins over Supabase.
 * - "off":      neither. The app keeps working fully local (IndexedDB), as before.
 */
export type BackendMode = "supabase" | "mock" | "off";

const env = import.meta.env;
const url = (env.VITE_SUPABASE_URL as string | undefined)?.trim() || "";
const key = (env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() || "";
const mockFlag = String(env.VITE_BACKEND_MOCK ?? "").trim();

export const backendMode: BackendMode = mockFlag === "1" || mockFlag === "true" ? "mock" : url && key ? "supabase" : "off";

/** True when the app talks to a backend (Supabase, or the opt-in mock). False when VITE_SUPABASE_URL is unset and the mock is off. */
export const backendEnabled = backendMode !== "off";
export const isMock = backendMode === "mock";

export const supabase: SupabaseClient | null =
  backendMode === "supabase"
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
      })
    : null;

export class BackendError extends Error {
  code: string;
  constructor(message: string, code = "backend_error") {
    super(message);
    this.name = "BackendError";
    this.code = code;
  }
}

/** The Supabase client, or a clear error when the app runs without one. */
export function sb(): SupabaseClient {
  if (!supabase) throw new BackendError("The online backend is not configured (VITE_SUPABASE_URL is unset).", "backend_disabled");
  return supabase;
}

/** Throw a readable error from a PostgREST / storage error object. */
export function check<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) throw new BackendError(res.error.message, res.error.code ?? "db_error");
  return res.data;
}

/** Call an edge function and surface its JSON `{ error }` message on failure. */
export async function callFunction<T>(name: string, body?: unknown): Promise<T> {
  const { data, error } = await sb().functions.invoke(name, { body: body as Record<string, unknown> | undefined });
  if (error) {
    let message = error.message;
    let code = "function_error";
    const ctx = (error as { context?: unknown }).context;
    if (ctx instanceof Response) {
      try {
        const j = (await ctx.clone().json()) as { error?: string | { message?: string; code?: string }; message?: string };
        if (typeof j.error === "string") message = j.error;
        else if (j.error?.message) {
          message = j.error.message;
          code = j.error.code ?? code;
        } else if (j.message) message = j.message;
      } catch {
        /* body was not JSON */
      }
    }
    throw new BackendError(message, code);
  }
  return data as T;
}

/** numeric columns may arrive as strings; normalise. */
export const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });

/* ------------------------------------------------------------------ */
/*  Tiny query cache: hooks re-run when any mutation calls invalidate() */
/* ------------------------------------------------------------------ */

let version = 0;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** Mark all backend data stale; mounted hooks refetch. Call after every write. */
export function invalidate() {
  version++;
  listeners.forEach((l) => l());
}

export function useBackendVersion() {
  return useSyncExternalStore(subscribe, () => version);
}

/**
 * Run `fn` on mount, whenever `key` changes, and after invalidate().
 * Pass `key = null` to skip (e.g. while signed out).
 */
export function useBackendQuery<T>(key: string | null, fn: () => Promise<T>): QueryState<T> {
  const v = useBackendVersion();
  const [local, setLocal] = useState(0);
  const [state, setState] = useState<{ data: T | undefined; error: Error | null; loading: boolean; key: string | null }>({
    data: undefined,
    error: null,
    loading: key !== null,
    key,
  });
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (key === null) {
      setState({ data: undefined, error: null, loading: false, key });
      return;
    }
    let live = true;
    setState((s) => ({ data: s.key === key ? s.data : undefined, error: null, loading: true, key }));
    fnRef
      .current()
      .then((data) => live && setState({ data, error: null, loading: false, key }))
      .catch((e: unknown) => live && setState((s) => ({ data: s.data, error: e instanceof Error ? e : new Error(String(e)), loading: false, key })));
    return () => {
      live = false;
    };
  }, [key, v, local]);

  const refresh = useCallback(() => setLocal((n) => n + 1), []);
  return { data: state.key === key ? state.data : undefined, error: state.error, loading: state.loading, refresh };
}
