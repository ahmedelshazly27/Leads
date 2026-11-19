// Service-role Supabase client. Bypasses RLS: every function checks the
// caller's identity and ownership itself before using it.
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { requireEnv } from "./http.ts";

let client: SupabaseClient | null = null;

export function serviceKey(): string {
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? requireEnv("SUPABASE_SECRET_KEY");
}

export function admin(): SupabaseClient {
  if (!client) {
    client = createClient(requireEnv("SUPABASE_URL"), serviceKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export async function audit(
  action: string,
  targetType: string,
  targetId: string | null,
  meta: Record<string, unknown> = {},
  actor: string | null = null,
): Promise<void> {
  const { error } = await admin().from("audit_log").insert({
    actor,
    action,
    target_type: targetType,
    target_id: targetId,
    meta,
  });
  if (error) console.error("audit_log insert failed", action, error.message);
}

/** Like must, but also throws when no data came back (single rows, signed URLs). */
export function mustOne<T>(res: { data: T; error: { message: string } | null }, what: string): NonNullable<T> {
  const data = must(res, what);
  if (data == null) throw new Error(`${what}: no data returned`);
  return data as NonNullable<T>;
}

/** Throws on a Supabase error, returns data otherwise. */
export function must<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}
