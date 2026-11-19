// POST { order_id, kind, prompt, remarks?, parent_id? } -> { generation, url }
// Reviewer/admin only. Generates one "after" visual through the image API:
//   - first attempt: the customer's original photo is the reference;
//   - with parent_id (+ remarks): the reviewer is iterating, so the previous
//     result is edited, with the original photo as a second reference to keep
//     the person's identity.
// Stores the output in the visuals bucket, logs generations.cost_usd and a costs row.
import { HttpError, json, readJson, requireUuid, serve } from "../_shared/http.ts";
import { requireRole } from "../_shared/auth.ts";
import { admin, audit, must } from "../_shared/supabase.ts";
import { currentProvider, editImage, modelFor, type ReferenceImage } from "../_shared/images.ts";

type Kind = "face_after" | "face_after_alt" | "body_after_front" | "body_after_side";
const KINDS: Kind[] = ["face_after", "face_after_alt", "body_after_front", "body_after_side"];

// Which original photo(s) to use, in order of preference.
const SOURCE_VIEWS: Record<Kind, string[]> = {
  face_after: ["face"],
  face_after_alt: ["face45", "faceLeft", "faceRight", "face"],
  body_after_front: ["body"],
  body_after_side: ["side", "body"],
};

const SIGNED_SECONDS = 600;

serve(async (req) => {
  const { user, profile } = await requireRole(req, ["reviewer", "admin"]);
  const body = await readJson<{ order_id?: string; kind?: string; prompt?: string; remarks?: string; parent_id?: string }>(req);
  const orderId = requireUuid(body.order_id, "order_id");
  const parentId = body.parent_id ? requireUuid(body.parent_id, "parent_id") : null;
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const remarks = typeof body.remarks === "string" && body.remarks.trim() ? body.remarks.trim() : null;
  if (!prompt || prompt.length > 6000) throw new HttpError(400, "bad_prompt", "A prompt (up to 6000 characters) is required.");
  if (remarks && remarks.length > 2000) throw new HttpError(400, "bad_remarks", "Remarks can be up to 2000 characters.");

  const db = admin();
  const order = must(
    await db.from("orders").select("id, user_id, status, assigned_reviewer").eq("id", orderId).maybeSingle(),
    "order",
  );
  if (!order) throw new HttpError(404, "not_found", "Order not found.");
  if (profile.role !== "admin" && order.assigned_reviewer !== user.id) {
    throw new HttpError(403, "forbidden", "This order is not assigned to you.");
  }
  if (!["in_review", "changes_requested"].includes(order.status as string)) {
    throw new HttpError(409, "wrong_status", "Visuals can only be generated while the order is in review.");
  }

  // Parent (iteration) must be a finished generation of the same order.
  let parent: { id: string; kind: Kind; output_path: string; scan_id: string | null } | null = null;
  if (parentId) {
    const p = must(
      await db.from("generations").select("id, order_id, kind, status, output_path, scan_id").eq("id", parentId).maybeSingle(),
      "parent",
    );
    if (!p || p.order_id !== orderId) throw new HttpError(404, "not_found", "Previous attempt not found for this order.");
    if (p.status !== "succeeded" || !p.output_path) throw new HttpError(409, "parent_not_ready", "The previous attempt has no image.");
    parent = { id: p.id, kind: p.kind as Kind, output_path: p.output_path, scan_id: p.scan_id };
  }

  const kind = (parent?.kind ?? body.kind) as Kind;
  if (!KINDS.includes(kind)) throw new HttpError(400, "bad_kind", "Unknown visual kind.");
  if (parent && body.kind && body.kind !== parent.kind) {
    throw new HttpError(400, "bad_kind", "An iteration keeps the kind of the previous attempt.");
  }

  // Latest scan of the order (or the parent's scan).
  const scanQuery = db.from("scans").select("id, photos_deleted_at").eq("order_id", orderId);
  const scan = must(
    await (parent?.scan_id ? scanQuery.eq("id", parent.scan_id) : scanQuery.order("created_at", { ascending: false }).limit(1))
      .maybeSingle(),
    "scan",
  );
  if (!scan) throw new HttpError(409, "no_scan", "This order has no scan yet.");
  if (scan.photos_deleted_at) throw new HttpError(410, "photos_deleted", "The photos for this scan have been deleted.");

  const photos = must(await db.from("scan_photos").select("view, storage_path").eq("scan_id", scan.id), "photos");
  const byView = new Map((photos ?? []).map((p) => [p.view as string, p.storage_path as string]));
  const sourceView = SOURCE_VIEWS[kind].find((v) => byView.has(v));
  if (!sourceView) throw new HttpError(409, "photo_missing", `No ${SOURCE_VIEWS[kind][0]} photo for this scan.`);

  const signed = must(
    await db.storage.from("photos").createSignedUrl(byView.get(sourceView)!, SIGNED_SECONDS),
    "sign photo",
  );
  const original: ReferenceImage = { url: signed.signedUrl, label: `original ${sourceView} photo` };

  const references: ReferenceImage[] = [];
  let fullPrompt = prompt;
  if (parent) {
    const prev = must(await db.storage.from("visuals").createSignedUrl(parent.output_path, SIGNED_SECONDS), "sign parent");
    references.push({ url: prev.signedUrl, label: "previous attempt" }, original);
    fullPrompt = [
      prompt,
      "",
      "Edit the first image (the previous attempt). The second image is the original photo of the same person:",
      "keep their identity, face shape, skin tone, proportions, pose, framing and background exactly as in it.",
      remarks ? `Apply only these changes from the reviewer: ${remarks}` : "Make it more realistic and closer to the original photo.",
    ].join("\n");
  } else {
    references.push(original);
    if (remarks) fullPrompt = `${prompt}\n\nReviewer notes: ${remarks}`;
  }

  const provider = currentProvider();
  const gen = must(
    await db
      .from("generations")
      .insert({
        order_id: orderId,
        scan_id: scan.id,
        requested_by: user.id,
        kind,
        prompt: fullPrompt,
        remarks,
        parent_id: parent?.id ?? null,
        provider,
        model: modelFor(provider),
        status: "running",
      })
      .select("id")
      .single(),
    "generation insert",
  );
  const genId = gen.id as string;

  try {
    const result = await editImage(provider, {
      prompt: fullPrompt,
      images: references,
      size: "1024x1536",
    });
    const path = `${orderId}/${genId}.jpg`;
    must(
      await db.storage.from("visuals").upload(path, result.bytes, { contentType: result.mime, upsert: true }),
      "upload visual",
    );
    const saved = must(
      await db
        .from("generations")
        .update({ status: "succeeded", output_path: path, cost_usd: result.costUsd, model: result.model })
        .eq("id", genId)
        .select("id, order_id, scan_id, kind, prompt, remarks, parent_id, provider, model, status, output_path, cost_usd, approved, created_at")
        .single(),
      "generation update",
    );
    if (result.costUsd > 0) {
      must(
        await db.from("costs").insert({
          order_id: orderId,
          user_id: order.user_id,
          category: "image_generation",
          amount: result.costUsd,
          currency: "USD",
          note: `generation ${genId} ${result.provider}/${result.model}`,
        }),
        "cost insert",
      );
    }
    const url = must(await db.storage.from("visuals").createSignedUrl(path, 3600), "sign output");
    await audit("generations.created", "generations", genId, { order_id: orderId, kind, parent_id: parent?.id ?? null, cost_usd: result.costUsd }, user.id);
    return json(req, { generation: saved, url: url.signedUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.from("generations").update({ status: "failed", error: message.slice(0, 1000) }).eq("id", genId);
    if (err instanceof HttpError) throw err;
    console.error("generate-visual failed", message);
    throw new HttpError(502, "generation_failed", "The image could not be generated. Please try again.");
  }
});
