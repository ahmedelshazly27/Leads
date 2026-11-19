import type { ReactNode } from "react";
import { BackendError, hoursLeft, useRole, type GenerationKind, type OrderRow, type OrderStatus } from "../../lib/backend";
import { StaffOnly } from "./StaffOnly";

/**
 * Spread on the root of every staff page (review console, /admin). Staff pages
 * stay English: translate="no" tells browsers and the app's text swap to leave
 * the subtree alone, and lang/dir keep it left to right inside an Arabic shell.
 * The swap honours it once lib/i18n.ts skips [translate="no"] subtrees.
 */
export const ENGLISH_ONLY = { translate: "no", lang: "en", dir: "ltr", "data-i18n": "off" } as const;

/** Renders children only for a signed-in reviewer or admin (server mode). */
export function StaffGate({ children }: { children: ReactNode }) {
  const { role, loading } = useRole();
  if (loading)
    return (
      <div className="page" aria-busy="true" {...ENGLISH_ONLY}>
        <p className="lead">Checking your account…</p>
      </div>
    );
  if (role !== "reviewer" && role !== "admin") return <StaffOnly />;
  return <>{children}</>;
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Pending payment",
  paid: "Paid",
  awaiting_photos: "Awaiting photos",
  in_review: "In review",
  changes_requested: "Changes requested",
  delivered: "Delivered",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

/** CSS modifier for an order status pill (review.css). */
export const statusClass = (s: OrderStatus) =>
  s === "delivered" ? "rv-approved" : s === "changes_requested" ? "rv-awaiting" : s === "in_review" ? "rv-in-review" : "rv-muted";

export const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

/** "31 h left" / "overdue by 5 h" / "—" */
export function dueText(o: Pick<OrderRow, "due_at">, now = Date.now()): { text: string; overdue: boolean; soon: boolean } {
  const h = hoursLeft(o, now);
  if (h === null) return { text: "—", overdue: false, soon: false };
  const abs = Math.abs(h);
  const amount = abs < 1 ? `${Math.max(1, Math.round(abs * 60))} min` : `${Math.round(abs)} h`;
  return h < 0 ? { text: `overdue by ${amount}`, overdue: true, soon: false } : { text: `${amount} left`, overdue: false, soon: h < 12 };
}

/** A readable message for any error the backend layer throws. */
export function errorText(e: unknown): string {
  if (e instanceof BackendError) return e.code && !["backend_error", "function_error"].includes(e.code) ? `${e.message} (${e.code})` : e.message;
  if (e instanceof Error) return e.message;
  return String(e);
}

export const shortId = (id: string) => id.slice(0, 8);

/* ------------------------- Visual captions ------------------------- */

/**
 * What the customer sees under each after image, by kind. The customer's
 * order page (pages/flow/Order.tsx) and the reviewer's "Approve and send"
 * summary both use visualCaptions(), so the reviewer sees the exact captions
 * the customer will get. English: on Arabic pages the text swap translates
 * them (keys in ar.json, plus the "{0} ({1} of {2})" template).
 */
export const VISUAL_CAPTION: Record<GenerationKind, string> = {
  face_after: "Face",
  face_after_alt: "Face, another version",
  body_after_front: "Body, front",
  body_after_side: "Body, side",
};

export interface CaptionInput {
  /** generations row id (reviewer side) */
  id?: string;
  /** CustomerVisual.generation_id (customer side) */
  generation_id?: string;
  kind: GenerationKind;
  order_id?: string;
  created_at?: string | null;
}

/**
 * Captions for a set of delivered (or to-be-delivered) visuals, keyed by
 * generation id. One visual of a kind gets the plain caption ("Face"); when
 * several of the same kind go to the customer they are numbered in the order
 * the customer sees them (oldest first, as customer-visuals returns them):
 * "Face (1 of 2)", "Face (2 of 2)". Numbering is per order and kind.
 */
export function visualCaptions(items: readonly CaptionInput[]): Map<string, string> {
  const idOf = (v: CaptionInput) => v.id ?? v.generation_id ?? "";
  const sorted = items
    .map((v, i) => ({ v, i }))
    .sort((a, b) => (a.v.created_at && b.v.created_at ? a.v.created_at.localeCompare(b.v.created_at) : 0) || a.i - b.i);
  const groups = new Map<string, CaptionInput[]>();
  for (const { v } of sorted) {
    const k = `${v.order_id ?? ""}|${v.kind}`;
    const g = groups.get(k);
    if (g) g.push(v);
    else groups.set(k, [v]);
  }
  const out = new Map<string, string>();
  for (const g of groups.values()) {
    g.forEach((v, i) => {
      const base = VISUAL_CAPTION[v.kind] ?? v.kind;
      out.set(idOf(v), g.length > 1 ? `${base} (${i + 1} of ${g.length})` : base);
    });
  }
  return out;
}
