// Image provider adapters for image-to-image edits. Each call returns the image
// bytes plus the cost in USD, so generate-visual can log it per order.
//
// Prices are the providers' published list prices at the time of writing.
// They change: check the provider's pricing page and override without a
// redeploy with the IMAGE_PRICES_JSON secret, e.g.
//   {"fal-ai/nano-banana/edit": 0.039, "gpt-image-1:high": 0.25}
import { HttpError, requireEnv } from "./http.ts";

export type ProviderName = "fal" | "openai" | "higgsfield";

export interface ReferenceImage {
  /** Short-lived URL the provider (or this function) can fetch. */
  url: string;
  label: string;
}

export interface EditRequest {
  prompt: string;
  /** In order of importance. The first image is the one being edited. */
  images: ReferenceImage[];
  /** Portrait output for body and face shots. */
  size?: "1024x1536" | "1024x1024";
}

export interface EditResult {
  bytes: Uint8Array;
  mime: string;
  provider: ProviderName;
  model: string;
  costUsd: number;
  /** Provider reply without the image payload, for debugging. */
  meta: Record<string, unknown>;
}

// USD per call, by "model" or "model:quality".
const DEFAULT_PRICES_USD: Record<string, number> = {
  "fal-ai/nano-banana/edit": 0.039,
  "gpt-image-1:low": 0.016,
  "gpt-image-1:medium": 0.063,
  "gpt-image-1:high": 0.25,
};

// USD per 1M tokens, used when the provider reports token usage.
const OPENAI_TOKEN_PRICES_USD: Record<string, { textIn: number; imageIn: number; imageOut: number }> = {
  "gpt-image-1": { textIn: 5, imageIn: 10, imageOut: 40 },
};

function priceTable(): Record<string, number> {
  const raw = Deno.env.get("IMAGE_PRICES_JSON");
  if (!raw) return DEFAULT_PRICES_USD;
  try {
    return { ...DEFAULT_PRICES_USD, ...(JSON.parse(raw) as Record<string, number>) };
  } catch {
    console.error("IMAGE_PRICES_JSON is not valid JSON; using defaults");
    return DEFAULT_PRICES_USD;
  }
}

export function priceFor(key: string): number {
  const p = priceTable()[key];
  if (typeof p !== "number") {
    console.warn(`No price configured for ${key}; logging cost 0. Add it to IMAGE_PRICES_JSON.`);
    return 0;
  }
  return p;
}

async function fetchBytes(url: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch image (${res.status})`);
  const mime = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
  return { bytes: new Uint8Array(await res.arrayBuffer()), mime };
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------------------------------------------------------------------------
// fal.ai (synchronous endpoint)
// ---------------------------------------------------------------------------
async function falEdit(req: EditRequest): Promise<EditResult> {
  const key = requireEnv("FAL_KEY");
  const model = Deno.env.get("FAL_IMAGE_MODEL") ?? "fal-ai/nano-banana/edit";
  const res = await fetch(`https://fal.run/${model}`, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: req.prompt,
      image_urls: req.images.map((i) => i.url),
      num_images: 1,
      output_format: "jpeg",
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new HttpError(502, "provider_error", `Image provider error (${res.status}): ${JSON.stringify(body).slice(0, 300)}`);
  }
  const url: string | undefined = body?.images?.[0]?.url;
  if (!url) throw new HttpError(502, "provider_error", "Image provider returned no image.");
  const img = url.startsWith("data:")
    ? { bytes: base64ToBytes(url.split(",")[1] ?? ""), mime: url.slice(5, url.indexOf(";")) || "image/jpeg" }
    : await fetchBytes(url);
  return {
    bytes: img.bytes,
    mime: img.mime,
    provider: "fal",
    model,
    costUsd: priceFor(model),
    meta: { description: body?.description ?? null, request_id: res.headers.get("x-fal-request-id") },
  };
}

// ---------------------------------------------------------------------------
// OpenAI image edits (multipart, several reference images)
// ---------------------------------------------------------------------------
async function openaiEdit(req: EditRequest): Promise<EditResult> {
  const key = requireEnv("OPENAI_API_KEY");
  const model = Deno.env.get("OPENAI_IMAGE_MODEL") ?? "gpt-image-1";
  const quality = Deno.env.get("OPENAI_IMAGE_QUALITY") ?? "high";

  const form = new FormData();
  form.append("model", model);
  form.append("prompt", req.prompt);
  form.append("n", "1");
  form.append("size", req.size ?? "1024x1536");
  form.append("quality", quality);
  form.append("output_format", "jpeg");
  if (model.startsWith("gpt-image-1")) form.append("input_fidelity", "high");
  for (const [i, ref] of req.images.entries()) {
    const { bytes, mime } = await fetchBytes(ref.url);
    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
    form.append("image[]", new Blob([bytes], { type: mime }), `ref-${i}.${ext}`);
  }

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message ?? JSON.stringify(body).slice(0, 300);
    throw new HttpError(502, "provider_error", `Image provider error (${res.status}): ${msg}`);
  }
  const b64: string | undefined = body?.data?.[0]?.b64_json;
  if (!b64) throw new HttpError(502, "provider_error", "Image provider returned no image.");

  // Prefer exact token usage; fall back to the per-call table.
  let costUsd = priceFor(`${model}:${quality}`);
  const usage = body?.usage;
  const tokenPrices = OPENAI_TOKEN_PRICES_USD[model];
  if (usage && tokenPrices) {
    const textIn = usage.input_tokens_details?.text_tokens ?? 0;
    const imageIn = usage.input_tokens_details?.image_tokens ?? 0;
    const out = usage.output_tokens ?? 0;
    costUsd = (textIn * tokenPrices.textIn + imageIn * tokenPrices.imageIn + out * tokenPrices.imageOut) / 1_000_000;
  }

  return {
    bytes: base64ToBytes(b64),
    mime: "image/jpeg",
    provider: "openai",
    model,
    costUsd: Math.round(costUsd * 10000) / 10000,
    meta: { usage: usage ?? null, quality },
  };
}

export function currentProvider(): ProviderName {
  const p = (Deno.env.get("IMAGE_PROVIDER") ?? "fal").toLowerCase();
  if (p === "fal" || p === "openai" || p === "higgsfield") return p;
  throw new HttpError(500, "not_configured", `Unknown IMAGE_PROVIDER "${p}". Use fal or openai.`);
}

export function modelFor(provider: ProviderName): string {
  if (provider === "fal") return Deno.env.get("FAL_IMAGE_MODEL") ?? "fal-ai/nano-banana/edit";
  if (provider === "openai") return Deno.env.get("OPENAI_IMAGE_MODEL") ?? "gpt-image-1";
  return "higgsfield";
}

export async function editImage(provider: ProviderName, req: EditRequest): Promise<EditResult> {
  if (req.images.length === 0) throw new HttpError(400, "bad_request", "At least one reference image is needed.");
  switch (provider) {
    case "fal":
      return await falEdit(req);
    case "openai":
      return await openaiEdit(req);
    case "higgsfield":
      // Higgsfield is listed in the schema for later. Its adapter is not built
      // yet; generate in Higgsfield by hand, or switch IMAGE_PROVIDER.
      throw new HttpError(501, "not_implemented", "The Higgsfield adapter is not built yet. Set IMAGE_PROVIDER to fal or openai.");
  }
}
