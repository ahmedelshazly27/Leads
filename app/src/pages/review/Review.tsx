import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/ui";
import { photoUrl, useAppState } from "../../lib/store";
import type { ReviewStatus, Scan } from "../../lib/types";
import { checklistFor } from "./checklist";
import { StaffOnly } from "./StaffOnly";
import "./review.css";

const LABEL: Record<ReviewStatus, string> = { awaiting: "Awaiting review", "in-review": "In review", approved: "Approved" };

export const statusOf = (s: Scan): ReviewStatus => s.review?.status ?? "awaiting";

/** Reviewer queue: every scan on this device, oldest waiting first. */
export function Review() {
  const state = useAppState();
  if (!state.settings.staff) return <StaffOnly />;
  const [filter, setFilter] = useState<ReviewStatus | "all">("all");
  const rows = state.scans
    .map((s) => ({ s, p: state.profiles.find((p) => p.id === s.profileId) }))
    .filter((r) => r.p && (filter === "all" || statusOf(r.s) === filter))
    .sort((a, b) => {
      const order = { awaiting: 0, "in-review": 1, approved: 2 };
      return order[statusOf(a.s)] - order[statusOf(b.s)] || a.s.createdAt.localeCompare(b.s.createdAt);
    });
  const count = (k: ReviewStatus) => state.scans.filter((s) => statusOf(s) === k).length;

  return (
    <div className="page">
      <PageHeader
        kicker="Reviewer console"
        muted="Review"
        strong="queue"
        lead="Every report is checked by a person before release: landmarks, measurements, plan, style and generated visuals. Clients can explore their results while a review is pending; visuals unlock on approval."
      />
      <div className="rv-filters" role="tablist">
        {(["all", "awaiting", "in-review", "approved"] as const).map((k) => (
          <button key={k} role="tab" aria-selected={filter === k} className={`rv-filter ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>
            {k === "all" ? `All · ${state.scans.length}` : `${LABEL[k]} · ${count(k)}`}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="lead" style={{ marginTop: 24 }}>
          Nothing here.
        </p>
      ) : (
        <div className="rv-queue">
          {rows.map(({ s, p }) => {
            const list = checklistFor(s);
            const done = list.filter((c) => s.review?.checks[c.id]).length;
            const v = state.visuals[s.id] ?? {};
            const st = statusOf(s);
            const face = photoUrl(s.id, "face");
            return (
              <Link key={s.id} to={`/review/${s.id}`} className="rv-row">
                <div className="rv-thumb">{face ? <img src={face} alt="" /> : null}</div>
                <div className="rv-who">
                  <b>{p!.intake.name}</b>
                  <span>
                    {p!.intake.age} · {p!.intake.gender} · {p!.intake.location || "—"}
                  </span>
                </div>
                <div className="rv-meta">
                  <span className="mono-sm">Submitted</span>
                  <span>{new Date(s.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                </div>
                <div className="rv-meta">
                  <span className="mono-sm">Photos</span>
                  <span>{[s.hasFacePhoto && "face", s.hasBodyPhoto && "body", s.hasSidePhoto && "side"].filter(Boolean).join(" · ") || "—"}</span>
                </div>
                <div className="rv-meta">
                  <span className="mono-sm">Visuals</span>
                  <span>{v.after ? (v.body?.afterFront ? "face + body" : "face") : "not yet"}</span>
                </div>
                <div className="rv-progress" aria-label={`${done} of ${list.length} checks`}>
                  <i style={{ width: `${(done / list.length) * 100}%` }} />
                  <span>
                    {done}/{list.length}
                  </span>
                </div>
                <span className={`rv-status rv-${st}`}>{LABEL[st]}</span>
              </Link>
            );
          })}
        </div>
      )}
      <p className="rv-foot">
        This console works on the data stored in this browser. Once accounts and cloud storage are connected, client submissions from any device will arrive in this queue.
      </p>
    </div>
  );
}
