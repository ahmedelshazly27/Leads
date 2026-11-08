import { PageHeader } from "../components/ui";
import { CATEGORY_LABEL, PARTNERS } from "../lib/partners";
import { updateBookingStatus, useAppState } from "../lib/store";
import type { Booking } from "../lib/types";
import "./analysis/Partners.css";

/**
 * Founder review of booking requests (stand-in). In production this list lives
 * server-side and confirmations are sent to partners / users by WhatsApp or email.
 */
export function Requests() {
  const s = useAppState();
  const list = (s.bookings ?? []).slice().reverse();
  return (
    <div className="page">
      <PageHeader
        kicker="Admin"
        muted="Booking"
        strong="requests"
        lead="Confirm availability with the partner, then update the status. Local stand-in: the production version runs server-side with notifications."
      />
      {!list.length && <p className="lead">No requests yet.</p>}
      <div className="rq-list">
        {list.map((b) => (
          <Req key={b.id} b={b} name={s.profiles.find((p) => p.id === b.profileId)?.intake.name ?? "Unknown"} />
        ))}
      </div>
      <style>{`
        .rq-list { display: grid; gap: 10px; }
        .rq { border: 1px solid var(--line); border-radius: 16px; padding: 16px; display: grid; gap: 10px; background: var(--surface); }
        .rq-top { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .rq-top b { font-weight: 500; }
        .rq-meta { font-size: 12.5px; color: var(--ink-3); }
        .rq pre { margin: 0; font-family: var(--mono); font-size: 11.5px; background: var(--card); border-radius: 10px; padding: 10px; white-space: pre-wrap; word-break: break-word; }
        .rq-actions { display: flex; gap: 8px; flex-wrap: wrap; }
      `}</style>
    </div>
  );
}

function Req({ b, name }: { b: Booking; name: string }) {
  const partner = PARTNERS.find((x) => x.id === b.partnerId);
  const svc = partner?.services.find((x) => x.id === b.serviceId);
  const shared = Object.entries(b.shared)
    .filter(([k, v]) => k !== "photos" && (Array.isArray(v) ? v.length : v))
    .map(([k]) => k);
  return (
    <div className="rq">
      <div className="rq-top">
        <div>
          <b>
            {name} → {partner?.name}
          </b>
          <div className="rq-meta">
            {partner ? CATEGORY_LABEL[partner.category] : ""} · {partner?.city} · {svc?.name} · from {svc?.currency} {svc?.priceFrom}
          </div>
          <div className="rq-meta">
            Preferred {b.preferredDate} ({b.preferredTime}) · requested {new Date(b.createdAt).toLocaleString()}
          </div>
        </div>
        <span className={`pt-status s-${b.status}`}>{b.status}</span>
      </div>
      <div className="rq-meta">Consented to share: {shared.join(", ") || "nothing beyond the request"} · photos: never</div>
      {b.notes && <div className="rq-meta">Notes: {b.notes}</div>}
      {Object.keys(b.payload).length > 0 && <pre>{JSON.stringify(b.payload, null, 2)}</pre>}
      <div className="rq-actions">
        <button className="btn" onClick={() => updateBookingStatus(b.id, "confirmed")} disabled={b.status === "confirmed"}>
          Confirm
        </button>
        <button className="btn btn-ghost" onClick={() => updateBookingStatus(b.id, "declined")} disabled={b.status === "declined"}>
          Decline
        </button>
        <button className="btn btn-ghost" onClick={() => updateBookingStatus(b.id, "completed")} disabled={b.status === "completed"}>
          Mark completed
        </button>
      </div>
    </div>
  );
}
