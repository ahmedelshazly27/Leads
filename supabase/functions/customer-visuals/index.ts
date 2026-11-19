// POST { order_id? } -> { visuals: [{ order_id, generation_id, kind, url, created_at }] }
// Signed URLs (1 hour) for the approved visuals of the customer's delivered orders.
import { json, readJson, requireUuid, serve } from "../_shared/http.ts";
import { requireUser } from "../_shared/auth.ts";
import { admin, must } from "../_shared/supabase.ts";

const SIGNED_SECONDS = 3600;

serve(async (req) => {
  const { user } = await requireUser(req);
  const body = req.method === "POST" ? await readJson<{ order_id?: string }>(req) : {};
  const onlyOrder = body.order_id ? requireUuid(body.order_id, "order_id") : null;
  const db = admin();

  let q = db.from("orders").select("id").eq("user_id", user.id).eq("status", "delivered");
  if (onlyOrder) q = q.eq("id", onlyOrder);
  const orders = must(await q, "orders");
  const orderIds = (orders ?? []).map((o) => o.id as string);
  if (!orderIds.length) return json(req, { visuals: [] });

  const gens = must(
    await db
      .from("generations")
      .select("id, order_id, kind, output_path, created_at")
      .in("order_id", orderIds)
      .eq("approved", true)
      .eq("status", "succeeded")
      .order("created_at", { ascending: true }),
    "generations",
  );
  const rows = (gens ?? []).filter((g) => g.output_path);
  if (!rows.length) return json(req, { visuals: [] });

  const signed = must(
    await db.storage.from("visuals").createSignedUrls(rows.map((g) => g.output_path as string), SIGNED_SECONDS),
    "sign visuals",
  );
  const urlByPath = new Map(signed.filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]));

  const visuals = rows
    .map((g) => ({
      order_id: g.order_id,
      generation_id: g.id,
      kind: g.kind,
      url: urlByPath.get(g.output_path as string) ?? null,
      created_at: g.created_at,
    }))
    .filter((v) => v.url);

  return json(req, { visuals, expires_in: SIGNED_SECONDS });
});
