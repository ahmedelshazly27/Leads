// Caller identity. Functions are deployed with verify_jwt = false (see
// config.toml) and check the token here, so they work with both legacy and
// asymmetric JWT signing keys.
import type { User } from "jsr:@supabase/supabase-js@2";
import { HttpError } from "./http.ts";
import { admin, serviceKey } from "./supabase.ts";

export type Role = "customer" | "reviewer" | "admin";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  locale: "en" | "ar";
  gender: "male" | "female" | null;
  birth_year: number | null;
  role: Role;
  reviewer_gender: "male" | "female" | null;
  stripe_customer_id: string | null;
}

export interface Caller {
  user: User;
  profile: Profile;
}

function bearer(req: Request): string {
  const h = req.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) throw new HttpError(401, "unauthorized", "Please sign in.");
  return m[1].trim();
}

/** Signed-in user with their profile. */
export async function requireUser(req: Request): Promise<Caller> {
  const token = bearer(req);
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "unauthorized", "Your session has expired. Please sign in again.");
  const { data: profile, error: pErr } = await admin()
    .from("profiles")
    .select("id, email, full_name, phone, locale, gender, birth_year, role, reviewer_gender, stripe_customer_id")
    .eq("id", data.user.id)
    .maybeSingle();
  if (pErr) throw new Error(`profile lookup: ${pErr.message}`);
  if (!profile) throw new HttpError(403, "no_profile", "Your account is not set up yet. Please sign in again.");
  return { user: data.user, profile: profile as Profile };
}

/** Signed-in user whose profile role is one of `roles`. */
export async function requireRole(req: Request, roles: Role[]): Promise<Caller> {
  const caller = await requireUser(req);
  if (!roles.includes(caller.profile.role)) {
    throw new HttpError(403, "forbidden", "You do not have access to this.");
  }
  return caller;
}

function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

/** Scheduled jobs: the caller must present the service key. */
export function requireService(req: Request): void {
  const token = bearer(req);
  if (!timingSafeEqual(token, serviceKey())) {
    throw new HttpError(401, "unauthorized", "Service key required.");
  }
}
