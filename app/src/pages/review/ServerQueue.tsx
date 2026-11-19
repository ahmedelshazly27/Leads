import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/ui";
import { isMock, useReviewQueue, useRole, type OrderRow } from "../../lib/backend";
import { dueText, errorText, fmtDateTime, ORDER_STATUS_LABEL, shortId, StaffGate, statusClass } from "./serverShared";
import "./review.css";

/** Server queue: open orders assigned to the signed-in reviewer (all for admins), overdue first. */
export function ServerQueue() {
  return (
    <StaffGate>
      <QueueList />
    </StaffGate>
  );
}

function sortQueue(rows: OrderRow[], now: number): OrderRow[] {
  const due = (o: OrderRow) => (o.due_at ? Date.parse(o.due_at) : Infinity);
  return [...rows].sort((a, b) => {
    const ao = due(a) < now ? 0 : 1;
    const bo = due(b) < now ? 0 : 1;
    return ao - bo || due(a) - due(b) || a.created_at.localeCompare(b.created_at);
  });
}

function QueueList() {
  const q = useReviewQueue();
  const { role } = useRole();
  // re-render every minute so "hours left" stays current
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const rows = sortQueue(q.data ?? [], now);
  const overdue = rows.filter((o) => dueText(o, now).overdue).length;

  return (
    <div className="page">
      <PageHeader
        kicker={`Reviewer console${isMock ? " · demo data" : ""}`}
        muted="Review"
        strong="queue"
        lead={
          role === "admin"
            ? "All open orders, overdue first. Nothing reaches a customer until a reviewer approves and sends it."
            : "Orders assigned to you, overdue first. Nothing reaches a customer until you approve and send it."
        }
        right={
          <button className="btn btn-ghost" onClick={q.refresh} disabled={q.loading}>
            {q.loading ? "Loading…" : "Refresh"}
          </button>
        }
      />
      {q.error && (
        <div className="rv-error" role="alert">
          Could not load the queue: {errorText(q.error)}
        </div>
      )}
      {!q.error && q.data && (
        <div className="rv-filters">
          <span className="rv-filter on">Open · {rows.length}</span>
          {overdue > 0 && <span className="rv-filter rv-filter-warn">Overdue · {overdue}</span>}
        </div>
      )}
      {q.loading && !q.data ? (
        <p className="lead" style={{ marginTop: 24 }} aria-busy="true">
          Loading orders…
        </p>
      ) : q.data && rows.length === 0 ? (
        <p className="lead" style={{ marginTop: 24 }}>
          No open orders. New submissions appear here once the customer has sent their photos.
        </p>
      ) : (
        <div className="rv-queue">
          {rows.map((o) => {
            const d = dueText(o, now);
            return (
              <Link key={o.id} to={`/review/orders/${o.id}`} className={`rv-row rv-row-server ${d.overdue ? "rv-row-overdue" : ""}`}>
                <div className="rv-who">
                  <b>Order {shortId(o.id)}</b>
                  <span>{o.product === "checkin" ? "Monthly check-in" : "Report"}</span>
                </div>
                <div className="rv-meta">
                  <span className="mono-sm">Submitted</span>
                  <span>{fmtDateTime(o.submitted_at)}</span>
                </div>
                <div className="rv-meta">
                  <span className="mono-sm">Due</span>
                  <span>{fmtDateTime(o.due_at)}</span>
                </div>
                <div className="rv-meta">
                  <span className="mono-sm">Time left</span>
                  <span className={d.overdue ? "rv-due-over" : d.soon ? "rv-due-soon" : ""}>{d.text}</span>
                </div>
                <span className={`rv-status ${statusClass(o.status)}`}>{ORDER_STATUS_LABEL[o.status]}</span>
              </Link>
            );
          })}
        </div>
      )}
      <p className="rv-foot">Photos are signed links that expire after an hour; reload an order if images stop showing. Photos are deleted 90 days after delivery.</p>
    </div>
  );
}
