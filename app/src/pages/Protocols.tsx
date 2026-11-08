import { useNavigate } from "react-router-dom";
import { FacePhoto } from "../components/FacePhoto";
import { PageHeader, ScoreCard } from "../components/ui";
import { band, currentScores, overall } from "../lib/report";
import { deleteProfile, latestScan, photoUrl, scansFor, setActiveProfile, useAppState } from "../lib/store";
import type { Profile } from "../lib/types";
import "./pages.css";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export function Protocols() {
  const s = useAppState();
  const nav = useNavigate();
  return (
    <div className="page">
      <PageHeader
        kicker="Protocols"
        muted="Your"
        strong="protocols"
        lead="Each protocol is one person: their intake, every scan and check-in, and the evidence-based plan built from those measurements."
        right={
          <button className="btn" onClick={() => nav("/new")}>
            + New analysis
          </button>
        }
      />
      <div className="pr-grid">
        {s.profiles.map((p) => (
          <ProfileCard key={p.id} profile={p} active={s.activeProfileId === p.id} />
        ))}
        <button className="pr-new" onClick={() => nav("/new")}>
          <span className="plus">+</span>
          <span>Start a new analysis</span>
          <span className="mono-sm">Front photo · optional body photo</span>
        </button>
      </div>
    </div>
  );
}

function ProfileCard({ profile, active }: { profile: Profile; active: boolean }) {
  const s = useAppState();
  const nav = useNavigate();
  const scans = scansFor(s, profile.id);
  const last = latestScan(s, profile.id);
  const visual = last && last.review?.status === "approved" ? s.visuals[last.id] : undefined;
  const photo = (last && (visual?.baseline ?? photoUrl(last.id, "face"))) ?? null;
  const score = last ? overall(currentScores(last, profile.intake)) : null;
  const open = () => {
    setActiveProfile(profile.id);
    nav("/analysis/getting-started");
  };
  return (
    <article className="pr-card" style={active ? { boxShadow: "0 0 0 2px var(--slate)" } : undefined}>
      <div className="pr-photo" onClick={open} style={{ cursor: "pointer" }}>
        {photo ? <img src={photo} alt="" /> : <FacePhoto src={null} aspect={0.8} placeholderTone="slate" />}
        {profile.sample && <span className="photo-tag">Sample data</span>}
        {score != null && <ScoreCard className="pr-score" label={band(score)} value={score} />}
        {last && <span className={`pr-review pr-review-${last.review?.status ?? "awaiting"}`}>{last.review?.status === "approved" ? "Reviewed" : last.review?.status === "in-review" ? "In review" : "Awaiting review"}</span>}
      </div>
      <div className="pr-body">
        <div>
          <div className="pr-name">{profile.intake.name}</div>
          <div className="mono-sm" style={{ marginTop: 4 }}>
            {profile.intake.age} · {profile.intake.gender} · {profile.intake.location || "—"}
          </div>
        </div>
        <div className="pr-meta">
          <div>
            <div className="mono-sm">Last scan</div>
            <div className="v">{last ? fmtDate(last.createdAt) : "—"}</div>
          </div>
          <div>
            <div className="mono-sm">Check-ins</div>
            <div className="v">{scans.length}</div>
          </div>
        </div>
        <div className="pr-actions">
          <button className="btn" onClick={open}>
            Open analysis
          </button>
          <button className="btn btn-ghost" onClick={() => nav(`/new/${profile.id}`)}>
            New check-in
          </button>
          <button
            className="pr-del"
            onClick={() => {
              if (confirm(`Delete ${profile.intake.name} and all ${scans.length} scan(s)? This cannot be undone.`)) deleteProfile(profile.id);
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}
