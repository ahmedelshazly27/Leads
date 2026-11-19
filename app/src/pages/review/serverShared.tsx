import type { ReactNode } from "react";
import { BackendError, hoursLeft, useRole, type OrderRow, type OrderStatus } from "../../lib/backend";
import { StaffOnly } from "./StaffOnly";

/** Renders children only for a signed-in reviewer or admin (server mode). */
export function StaffGate({ children }: { children: ReactNode }) {
  const { role, loading } = useRole();
  if (loading)
    return (
      <div className="page" aria-busy="true">
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
