// JSON responses, request parsing and a typed HTTP error used by every function.
import { corsHeaders } from "./cors.ts";

export { corsHeaders };

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

export function errorResponse(req: Request, err: unknown): Response {
  if (err instanceof HttpError) {
    return json(req, { error: { code: err.code, message: err.message } }, err.status);
  }
  console.error(err);
  return json(
    req,
    { error: { code: "internal", message: "Something went wrong on our side. Please try again." } },
    500,
  );
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  if (req.method !== "POST") throw new HttpError(405, "method_not_allowed", "Use POST.");
  try {
    const text = await req.text();
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    throw new HttpError(400, "bad_json", "The request body is not valid JSON.");
  }
}

/** Wraps a handler with CORS preflight and error handling. */
export function serve(handler: (req: Request) => Promise<Response>): void {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
    try {
      return await handler(req);
    } catch (err) {
      return errorResponse(req, err);
    }
  });
}

export function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new HttpError(500, "not_configured", `Server setting ${name} is missing.`);
  return v;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requireUuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw new HttpError(400, "bad_request", `${field} must be a UUID.`);
  }
  return value;
}
