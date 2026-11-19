// CORS: SITE_URL and ALLOWED_ORIGINS (comma separated) plus localhost for development.

function allowedOrigins(): string[] {
  const list = [Deno.env.get("SITE_URL") ?? "", ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",")]
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return list;
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = allowedOrigins();
  const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const allow = allowed.length === 0 ? "*" : allowed.includes(origin) || isLocal ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}
