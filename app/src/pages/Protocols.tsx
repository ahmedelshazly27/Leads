import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FacePhoto } from "../components/FacePhoto";
import { ReviewBanner } from "../components/ReviewBanner";
import { PageHeader, ScoreCard } from "../components/ui";
import { buildPlan } from "../lib/plan";
import { refreshBody } from "../lib/bodyAnalysis";
import { band, currentScores, overall } from "../lib/report";
import { deleteProfile, latestScan, photoUrl, scansFor, setActiveProfile, toggleProgress, useAppState } from "../lib/store";
import { useActive } from "../lib/useActive";
import type { Profile } from "../lib/types";
import "./pages.css";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export function Protocols() {
  const s = useAppState();
  const nav = useNavigate();
  const others = s.profiles.length > 1;
  return (
    <div className="page">
      <PageHeader
        kicker="Home"
        muted="Welcome"
        strong="back"
        lead="Your latest result, this phase's habits and your report."
        right={
          <button className="btn" onClick={() => nav("/new")}>
            + New analysis
          </button>
        }
      />
      <Today />
      <h2 className="title-md" style={{ marginTop: 36 }}>{others ? "All reports" : "Your report"}</h2>
      <div className="pr-grid" style={{ marginTop: 14 }}>
        {s.profiles.map((p) => (
          <ProfileCard key={p.id} profile={p} active={s.activeProfileId === p.id} />
        ))}
        <button className="pr-new" onClick={() => nav("/new")}>
          <span className="plus">+</span>
          <span>Start a new analysis</span>
          <span className="mono-sm">Front photo · optional body photos</span>
        </button>
      </div>
    </div>
  );
}

/** Active profile: score, review status and the habits for the current phase. */
function Today() {
  const { profile, scan, progress } = useActive();
  const plan = useMemo(() => (scan && profile ? buildPlan(scan, profile.intake) : null), [scan, profile]);
  if (!profile || !scan || !plan) return null;
  const rows = plan.items.flatMap((it) => it.tasks.map((t) => ({ it, t, key: `${it.id}:${t.id}`, phase: Math.max(it.phase, it.priority) })));
  const phase1 = rows.filter((r) => r.phase === 1);
  const doneAll = rows.filter((r) => progress[r.key]).length;
  return (
    <section className="hm">
      <ReviewBanner scan={scan} />
      <div className="hm-grid">
        <div className="hm-card hm-score">
          <span className="mono-sm">{profile.intake.name}</span>
          <div className="hm-num">
            {Math.round(plan.overallNow)}
            <span>→ {Math.round(plan.overallProjected)}</span>
          </div>
          <span className="hm-sub">Composite score now → projected at 12 months with good adherence</span>
          <div className="hm-links">
            <Link className="btn" to="/analysis/getting-started">Open report</Link>
            <Link className="btn btn-ghost" to="/analysis/projection">Your projection</Link>
            <Link className="btn btn-ghost" to={`/new/${profile.id}`}>New check-in</Link>
          </div>
        </div>
        <div className="hm-card">
          <div className="hm-tasks-head">
            <span className="mono-sm">Phase 1 · foundations</span>
            <Link to="/analysis/action-plan" className="mono-sm">
              {doneAll}/{rows.length} habits in place →
            </Link>
          </div>
          {phase1.slice(0, 6).map(({ it, t, key }) => (
            <label key={key} className={`hm-task ${progress[key] ? "done" : ""}`}>
              <input type="checkbox" checked={!!progress[key]} onChange={() => toggleProgress(profile.id, key)} />
              <span>
                {t.label}
                <small>{it.title} · {t.cadence}</small>
              </span>
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProfileCard({ profile, active }: { profile: Profile; active: boolean }) {
  const s = useAppState();
  const nav = useNavigate();
  const scans = scansFor(s, profile.id);
  const last = latestScan(s, profile.id);
  const visual = last && last.review?.status === "approved" ? s.visuals[last.id] : undefined;
  const photo = (last && (visual?.baseline ?? photoUrl(last.id, "face"))) ?? null;
  const score = last ? Math.round(overall(currentScores(last.body ? { ...last, body: refreshBody(last.body, profile.intake, last.bodySide?.metrics ?? null) } : last, profile.intake))) : null;
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
