import { BackendError, backendMode, callFunction, check, invalidate, num, sb, useBackendQuery } from "./client";
import { mock } from "./mock";
import { requireUserId, useSession } from "./auth";
import { normOrder } from "./orders";
import { getScanForOrder } from "./scans";
import {
  OPEN_REVIEW_STATUSES,
  type GenerationKind,
  type GenerationRow,
  type GenerationWithUrl,
  type OrderRow,
  type OrderStatus,
  type QueryState,
  type ReviewBundle,
  type ReviewRow,
} from "./types";

export const VISUALS_BUCKET = "visuals";

/**
 * Open orders for the signed-in reviewer, soonest due first. Row-level
 * security limits a reviewer to orders assigned to them; admins see all.
 */
export async function listReviewQueue(): Promise<OrderRow[]> {
  if (backendMode === "mock") return mock.reviewQueue();
  requireUserId();
  const rows = check(await sb().from("orders").select("*").in("status", OPEN_REVIEW_STATUSES).order("due_at", { ascending: true, nullsFirst: false }));
  return ((rows ?? []) as OrderRow[]).map(normOrder);
}

async function signedVisualUrls(gens: GenerationRow[]): Promise<GenerationWithUrl[]> {
  const withPath = gens.filter((g) => g.status === "succeeded" && g.output_path);
  const urls = new Map<string, string>();
  if (withPath.length) {
    const { data, error } = await sb().storage.from(VISUALS_BUCKET).createSignedUrls(withPath.map((g) => g.output_path!), 60 * 60);
    if (error) throw new BackendError(error.message, "signed_url_failed");
    withPath.forEach((g, i) => {
      const u = data?.[i]?.signedUrl;
      if (u) urls.set(g.id, u);
    });
  }
  return gens.map((g) => ({ ...g, cost_usd: num(g.cost_usd), url: urls.get(g.id) ?? null }));
}

/** Everything the reviewer console needs for one order: order, scan with signed photo URLs, review, generations with signed URLs. */
export async function loadReviewBundle(orderId: string): Promise<ReviewBundle> {
  if (backendMode === "mock") return mock.reviewBundle(orderId);
  const client = sb();
  const order = check(await client.from("orders").select("*").eq("id", orderId).maybeSingle()) as OrderRow | null;
  if (!order) throw new BackendError("Order not found or not assigned to you.", "not_found");
  const [scan, review, gens] = await Promise.all([
    getScanForOrder(orderId),
    client.from("reviews").select("*").eq("order_id", orderId).maybeSingle().then(check),
    client.from("generations").select("*").eq("order_id", orderId).order("created_at", { ascending: true }).then(check),
  ]);
  return {
    order: normOrder(order),
    scan: scan?.scan ?? null,
    photos: scan?.photos ?? {},
    review: (review as ReviewRow | null) ?? null,
    generations: await signedVisualUrls((gens ?? []) as GenerationRow[]),
  };
}

export type ReviewPatch = Partial<Pick<ReviewRow, "status" | "checklist" | "notes" | "item_notes" | "marker_grades">>;

/** Create or update the review row for an order (one per order). */
export async function saveReview(orderId: string, patch: ReviewPatch): Promise<ReviewRow> {
  if (backendMode === "mock") return mock.saveReview(orderId, patch);
  const uid = requireUserId();
  const client = sb();
  const existing = check(await client.from("reviews").select("id").eq("order_id", orderId).maybeSingle()) as { id: string } | null;
  const row = existing
    ? check(await client.from("reviews").update(patch).eq("id", existing.id).select("*").single())
    : check(await client.from("reviews").insert({ order_id: orderId, reviewer_id: uid, status: "in_progress", ...patch }).select("*").single());
  invalidate();
  return row as ReviewRow;
}

export interface GenerateVisualInput {
  order_id: string;
  kind: GenerationKind;
  prompt: string;
  /** reviewer remarks for a regeneration */
  remarks?: string | null;
  /** the attempt this one refines */
  parent_id?: string | null;
}

/** Generate (or regenerate with remarks) one after image. Each attempt is a new `generations` row with its cost. */
export async function generateVisual(input: GenerateVisualInput): Promise<GenerationWithUrl> {
  if (backendMode === "mock") return mock.generateVisual(input);
  const res = await callFunction<{ generation?: GenerationRow } | GenerationRow>("generate-visual", input);
  const gen = (res && "generation" in res ? res.generation : res) as GenerationRow | undefined;
  invalidate();
  if (!gen?.id) throw new BackendError("The image could not be generated. Please try again.", "generation_failed");
  return (await signedVisualUrls([gen]))[0];
}

/** Approve the chosen generations and deliver the order to the customer (emails them). */
export async function approveDelivery(orderId: string, generationIds: string[]): Promise<void> {
  if (backendMode === "mock") {
    await mock.approveDelivery(orderId, generationIds);
    return;
  }
  await callFunction("approve-delivery", { order_id: orderId, generation_ids: generationIds });
  invalidate();
}

/**
 * Reviewer-side status change for an assigned order, e.g. `changes_requested`
 * when the photos need retaking. Delivery always goes through approveDelivery.
 */
export async function setOrderStatus(orderId: string, status: Extract<OrderStatus, "in_review" | "changes_requested">): Promise<void> {
  if (backendMode === "mock") {
    await mock.setOrderStatus(orderId, status);
    return;
  }
  check(await sb().from("orders").update({ status }).eq("id", orderId));
  invalidate();
}

/** Hours left until the order is due (negative = overdue), or null when not submitted yet. */
export const hoursLeft = (o: Pick<OrderRow, "due_at">, now = Date.now()) => (o.due_at ? (Date.parse(o.due_at) - now) / 3600_000 : null);

/* ------------------------------ Hooks ------------------------------ */

export function useReviewQueue(): QueryState<OrderRow[]> {
  const { session } = useSession();
  return useBackendQuery(session ? `queue:${session.userId}` : null, listReviewQueue);
}

export function useReviewBundle(orderId: string | null | undefined): QueryState<ReviewBundle> {
  const { session } = useSession();
  return useBackendQuery(session && orderId ? `bundle:${orderId}` : null, () => loadReviewBundle(orderId!));
}
