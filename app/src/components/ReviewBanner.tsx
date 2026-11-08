import type { Scan } from "../lib/types";

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

/** Client-facing review status for a scan. */
export function ReviewBanner({ scan, compact = false }: { scan: Scan; compact?: boolean }) {
  const r = scan.review;
  if (r?.status === "approved") {
    if (compact || !r.note) return null;
    return (
      <div className="rb rb-ok" role="note">
        <span className="rb-dot" />
        <div>
          <b>Reviewed {fmt(r.approvedAt)}</b>
          <p>{r.note}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="rb rb-wait" role="status">
      <span className="rb-dot" />
      <div>
        <b>{r?.status === "in-review" ? "Your report is being reviewed" : "Awaiting review"}</b>
        <p>
          Your measurements and plan are ready to explore. A specialist checks every landmark, the plan and your visuals before final release — usually within 48 hours. Items may
          still change.
        </p>
      </div>
    </div>
  );
}
