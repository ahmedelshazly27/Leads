import { Link } from "react-router-dom";
import { SAMPLE_PROFILE_ID } from "../lib/sample";
import type { Scan } from "../lib/types";
import { dateLocale } from "../lib/i18n";

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(dateLocale() ?? "en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

/** Client-facing review status for a scan. */
export function ReviewBanner({ scan, compact = false }: { scan: Scan; compact?: boolean }) {
  const r = scan.review;
  if (scan.profileId === SAMPLE_PROFILE_ID && !compact) {
    return (
      <div className="rb rb-ok" role="note">
        <span className="rb-dot" />
        <div>
          <b>Sample report</b>
          <p>
            This is example data for a synthetic person who does not exist, so you can see what a report looks like. <Link to="/new">Start your own analysis</Link> to get yours.
          </p>
        </div>
      </div>
    );
  }
  if (r?.status === "approved") {
    if (compact || (!r.note && !r.reviewer)) return null;
    return (
      <div className="rb rb-ok" role="note">
        <span className="rb-dot" />
        <div>
          <b>
            Reviewed {fmt(r.approvedAt)}
            {r.reviewer ? ` by ${r.reviewer}` : ""}
          </b>
          {r.note && <p>{r.note}</p>}
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
