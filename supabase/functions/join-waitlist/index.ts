// Public. POST { email, phone?, gender?, locale?, source?, website? } -> { ok: true }
// Adds an email to the waitlist (women's service and launch list). Duplicates
// are ignored and get the same answer, so the endpoint does not reveal who is
// already on the list. Rate-limited per IP (hashed, never stored in clear).
import { HttpError, json, readJson, serve } from "../_shared/http.ts";
import { admin, must } from "../_shared/supabase.ts";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PER_HOUR = 10;

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
      req.headers.get("x-real-ip") ??
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown"
  );
}

serve(async (req) => {
  const body = await readJson<{
    email?: string;
    phone?: string;
    gender?: string;
    locale?: string;
    source?: string;
    website?: string; // honeypot: real people leave it empty
  }>(req);

  if (body.website) return json(req, { ok: true });

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 254) {
    throw new HttpError(400, "bad_email", "Please enter a valid email address.");
  }
  const phone = typeof body.phone === "string" && body.phone.trim() ? body.phone.trim().slice(0, 32) : null;
  if (phone && !/^\+?[0-9 ()-]{6,32}$/.test(phone)) {
    throw new HttpError(400, "bad_phone", "Please check the phone number.");
  }
  const gender = body.gender === "male" || body.gender === "female" ? body.gender : null;
  const locale = body.locale === "ar" ? "ar" : "en";
  const source = typeof body.source === "string" ? body.source.trim().slice(0, 64) || null : null;

  const db = admin();
  const salt = Deno.env.get("RATE_LIMIT_SALT") ?? Deno.env.get("SUPABASE_URL") ?? "";
  const key = `waitlist:${await sha256(`${salt}:${clientIp(req)}`)}`;
  const { data: allowed, error: rlErr } = await db.rpc("hit_rate_limit", {
    p_key: key,
    p_window_seconds: 3600,
    p_max: PER_HOUR,
  });
  if (rlErr) console.error("rate limit check failed", rlErr.message);
  else if (allowed === false) throw new HttpError(429, "rate_limited", "Too many attempts. Please try again later.");

  must(
    await db.from("waitlist").upsert({ email, phone, gender, locale, source }, {
      onConflict: "email",
      ignoreDuplicates: true,
    }),
    "waitlist insert",
  );
  return json(req, { ok: true });
});
