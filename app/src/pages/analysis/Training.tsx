import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Citations, GradeBadge, PageHeader } from "../../components/ui";
import { buildTraining, VOLUME, type MuscleId, type MusclePlan, type Priority, type TrainingDay } from "../../lib/training";
import type { SectionProps } from "./types";
import "./Training.css";

const PRIORITY_LABEL: Record<Priority, string> = { focus: "Focus", build: "Build", maintain: "Maintain" };

export function Training(p: SectionProps) {
  const { scan, profile, plan } = p;
  const t = useMemo(() => buildTraining(scan, profile.intake, plan), [scan, profile, plan]);
  const byId = useMemo(() => Object.fromEntries(t.muscles.map((m) => [m.id, m])) as Record<MuscleId, MusclePlan>, [t]);
  const firstFocus = t.muscles.find((m) => m.priority === "focus") ?? t.muscles[0];
  const [sel, setSel] = useState<MuscleId>(firstFocus.id);
  const female = profile.intake.gender === "female";
  const active = byId[sel];
  const priorityMuscles = t.muscles.filter((m) => m.priority !== "maintain");
  const proj = t.projection;

  return (
    <div className="page tr">
      <PageHeader
        kicker="Training"
        muted="Your"
        strong="training plan"
        lead={
          <>
            Which muscles to prioritise comes from your <b>measurements</b>: body ratios, side posture and composition. Weekly volume follows the dose-response
            evidence.
          </>
        }
      />

      {/* -------- muscle map -------- */}
      <section className="tr-map-card">
        <div className="tr-maps">
          <figure>
            <MuscleMap view="front" byId={byId} sel={sel} onSel={setSel} female={female} />
            <figcaption className="mono-sm">Front</figcaption>
          </figure>
          <figure>
            <MuscleMap view="back" byId={byId} sel={sel} onSel={setSel} female={female} />
            <figcaption className="mono-sm">Back</figcaption>
          </figure>
        </div>
        <div className="tr-side">
          <div className="tr-legend">
            {(["focus", "build", "maintain"] as Priority[]).map((pr) => (
              <span key={pr}>
                <i className={`tr-sw tr-${pr}`} /> {PRIORITY_LABEL[pr]}
                <em>
                  {VOLUME[pr][0]}–{VOLUME[pr][1]} sets/wk
                </em>
              </span>
            ))}
          </div>
          <MuscleCard m={active} compact />
          <p className="tr-hint mono-sm">Tap a muscle on the map</p>
        </div>
      </section>

      {/* -------- why these muscles -------- */}
      <h2 className="title-md tr-h2">
        <span className="hl">Why</span> these muscles
      </h2>
      <div className="tr-cards">
        {priorityMuscles.map((m) => (
          <MuscleCard key={m.id} m={m} onClick={() => setSel(m.id)} selected={m.id === sel} />
        ))}
      </div>

      {/* -------- daily correctives -------- */}
      {t.daily.length > 0 && (
        <section className="tr-daily">
          <div>
            <span className="mono-sm">Daily · 5 minutes</span>
            <h3>Posture correctives</h3>
            <p>Done every day, at home. These target the forward-head position measured in your side photo.</p>
          </div>
          <ul>
            {t.daily.map((e) => (
              <li key={e.name}>
                <b>{e.name}</b>
                <span>
                  {e.sets} × {e.reps}
                </span>
                {e.note && <em>{e.note}</em>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* -------- weekly split -------- */}
      <h2 className="title-md tr-h2">
        <span className="hl">Your</span> weekly split
      </h2>
      {t.notes[0] && t.rampUp && <p className="tr-note">{t.notes[0]}</p>}
      {t.rampUp && (
        <>
          <div className="mono-sm tr-sub">Weeks 1–4 · 3-day full body</div>
          <Split days={t.rampUp} byId={byId} />
          <div className="mono-sm tr-sub">Week 5 onwards · 4-day upper / lower</div>
        </>
      )}
      <Split days={t.split} byId={byId} />
      <ul className="tr-rules">
        {t.rules.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>

      {/* -------- projection -------- */}
      <section className="tr-proj">
        <div className="tr-proj-head">
          <span className="mono-sm">12-month projection</span>
          <h3>
            <span className="hl">What</span> this should change
          </h3>
        </div>
        <div className="tr-proj-grid">
          <Stat label="Shoulder : waist" value={proj.swrNow ? proj.swrNow.toFixed(2) : "—"} next={proj.swrRange ? `${proj.swrRange[0].toFixed(2)}–${proj.swrRange[1].toFixed(2)}` : "—"} />
          <Stat label="Body fat target" value={scan.body?.metrics.bodyFatEstimate != null ? `${scan.body.metrics.bodyFatEstimate.toFixed(0)}%` : "—"} next={proj.targetBodyFat != null ? `≈${proj.targetBodyFat}%` : "—"} />
          <Stat label="Waist" value="now" next={proj.waistDropCm ? `−${proj.waistDropCm[0]} to −${proj.waistDropCm[1]} cm` : "—"} />
          <Stat label="Lean mass, year one" value="now" next={proj.leanGainKg ? `+${proj.leanGainKg[0]} to +${proj.leanGainKg[1]} kg` : "—"} grade="C" />
        </div>
        <p className="tr-proj-note">{proj.note}</p>
      </section>

      <div className="tr-notes">
        {t.notes.slice(t.rampUp ? 1 : 0).map((n) => (
          <p key={n}>{n}</p>
        ))}
      </div>

      <div className="tr-cta">
        <div>
          <h3>
            <span className="hl">Want a coach</span> to run it with you?
          </h3>
          <p>Coaches receive only your split and priorities — never photos.</p>
        </div>
        <Link to="/analysis/partners?cat=trainer" className="btn">
          Book a coach
        </Link>
      </div>

      <section className="tr-evidence">
        <span className="mono-sm">Evidence</span>
        <p>
          Volume targets follow the dose-response meta-analysis (≥10 weekly sets per muscle, each trained 2×/week). Muscle priorities come from your
          measurements; posture work follows the forward-head exercise meta-analysis.
        </p>
        <Citations ids={t.refs} />
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function MuscleCard({ m, compact, onClick, selected }: { m: MusclePlan; compact?: boolean; onClick?: () => void; selected?: boolean }) {
  return (
    <article className={`tr-card ${compact ? "tr-card-compact" : ""} ${selected ? "on" : ""}`} onClick={onClick}>
      <header>
        <span className={`tr-pill tr-${m.priority}`}>{PRIORITY_LABEL[m.priority]}</span>
        <GradeBadge grade={m.grade} />
      </header>
      <h3>{m.name}</h3>
      <div className="tr-sets">{m.corrective ? "Daily · 5 min" : `${m.weeklySets[0]}–${m.weeklySets[1]} sets / week`}</div>
      <ul className="tr-reasons">
        {m.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      {!compact && (
        <ol className="tr-ex">
          {m.exercises.map((e) => (
            <li key={e.name}>
              <span>{e.name}</span>
              <em>{e.reps}</em>
            </li>
          ))}
        </ol>
      )}
      {!compact && m.refs.length > 0 && <Citations ids={m.refs} />}
    </article>
  );
}

function Split({ days, byId }: { days: TrainingDay[]; byId: Record<MuscleId, MusclePlan> }) {
  return (
    <div className="tr-split">
      {days.map((d) => (
        <div key={d.name} className="tr-day">
          <div className="tr-day-head">
            <b>{d.name}</b>
            <span className="mono-sm">{d.exercises.reduce((s, e) => s + e.sets, 0)} sets</span>
          </div>
          <ul>
            {d.exercises.map((e, i) => (
              <li key={i} className={e.priority === "focus" ? "hot" : ""}>
                <span>
                  {e.name}
                  <em>{byId[e.muscle].name}</em>
                </span>
                <b>
                  {e.sets} × {e.reps}
                </b>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, next, grade }: { label: string; value: string; next: string; grade?: "C" }): ReactNode {
  return (
    <div className="tr-stat">
      <span className="mono-sm">
        {label}
        {grade && <i className="tr-grade">Grade {grade}</i>}
      </span>
      <div>
        {value !== "now" && <span className="tr-stat-now">{value}</span>}
        {value !== "now" && <span className="tr-arrow">→</span>}
        <b>{next}</b>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Muscle map: simplified anatomical schematic                        */
/* ------------------------------------------------------------------ */

type Shape = { d?: string; e?: [number, number, number, number] };
const mirror = (s: Shape): Shape =>
  s.e ? { e: [200 - s.e[0], s.e[1], s.e[2], s.e[3]] } : { d: s.d!.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${200 - Number(x)},${y}`) };
const pair = (s: Shape): Shape[] => [s, mirror(s)];

const FRONT: Partial<Record<MuscleId, Shape[]>> = {
  neck: [{ d: "M91,52 L109,52 L111,68 L89,68 Z" }],
  traps: pair({ d: "M90,62 L70,72 L84,76 L94,68 Z" }),
  frontDelts: pair({ e: [67, 86, 10, 12] }),
  sideDelts: pair({ e: [53, 90, 7, 13] }),
  chest: pair({ d: "M98,80 L74,82 L68,102 L82,116 L98,114 Z" }),
  biceps: pair({ e: [46, 130, 8, 21] }),
  forearms: pair({ e: [39, 184, 7, 26] }),
  abs: [{ d: "M87,120 L113,120 L114,196 Q100,204 86,196 Z" }],
  obliques: pair({ d: "M84,122 L70,120 L68,186 L84,198 Z" }),
  quads: pair({ e: [82, 296, 15, 46] }),
  calves: pair({ e: [80, 384, 8, 30] }),
};

const BACK: Partial<Record<MuscleId, Shape[]>> = {
  neck: [{ d: "M91,52 L109,52 L111,66 L89,66 Z" }],
  traps: [{ d: "M100,58 L72,74 L86,86 L100,134 L114,86 L128,74 Z" }],
  rearDelts: pair({ e: [65, 88, 10, 11] }),
  sideDelts: pair({ e: [53, 90, 7, 13] }),
  lats: pair({ d: "M86,92 L72,98 L72,148 L92,186 L98,150 Z" }),
  triceps: pair({ e: [46, 130, 8, 21] }),
  forearms: pair({ e: [39, 184, 7, 26] }),
  glutes: pair({ e: [86, 234, 15, 17] }),
  hamstrings: pair({ e: [82, 298, 14, 40] }),
  calves: pair({ e: [80, 378, 10, 30] }),
};

function Silhouette({ female }: { female: boolean }) {
  const torso = female
    ? "M56,72 Q100,64 144,72 L148,96 Q134,150 132,196 Q144,226 142,250 L58,250 Q56,226 68,196 Q66,150 52,96 Z"
    : "M50,72 Q100,62 150,72 L154,96 Q140,150 136,206 Q140,232 138,250 L62,250 Q60,232 64,206 Q60,150 46,96 Z";
  const arm = "M48,76 Q34,82 33,112 L29,200 Q29,214 33,228 L46,228 Q50,214 50,200 L58,112 Z";
  const leg = "M64,246 L99,250 L98,330 Q96,380 94,430 L71,430 Q69,380 67,330 Z";
  return (
    <g className="tr-sil">
      <circle cx={100} cy={32} r={20} />
      <rect x={89} y={48} width={22} height={22} rx={6} />
      <path d={torso} />
      <path d={arm} />
      <path d={mirror({ d: arm }).d} />
      <path d={leg} />
      <path d={mirror({ d: leg }).d} />
    </g>
  );
}

function MuscleMap({
  view,
  byId,
  sel,
  onSel,
  female,
}: {
  view: "front" | "back";
  byId: Record<MuscleId, MusclePlan>;
  sel: MuscleId;
  onSel: (id: MuscleId) => void;
  female: boolean;
}) {
  const shapes = view === "front" ? FRONT : BACK;
  return (
    <svg viewBox="0 0 200 440" className="tr-map" role="img" aria-label={`${view} muscle map`}>
      <Silhouette female={female} />
      {(Object.entries(shapes) as [MuscleId, Shape[]][]).map(([id, list]) => {
        const m = byId[id];
        if (!m) return null;
        return (
          <g
            key={id}
            className={`tr-mus tr-${m.priority} ${sel === id ? "sel" : ""}`}
            onClick={() => onSel(id)}
            onMouseEnter={() => onSel(id)}
          >
            <title>{`${m.name} · ${PRIORITY_LABEL[m.priority]}`}</title>
            {list.map((s, i) => (s.e ? <ellipse key={i} cx={s.e[0]} cy={s.e[1]} rx={s.e[2]} ry={s.e[3]} /> : <path key={i} d={s.d} />))}
          </g>
        );
      })}
    </svg>
  );
}
