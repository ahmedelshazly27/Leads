"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { scenarios, type Kind, type Pt, type Track } from "./ops-scenarios";

type Key = keyof typeof scenarios;
const W = 1000;
const H = 560;
const LAYERS = ["Terrain", "Sensors", "Zones", "Tracks", "Labels"] as const;
type Layer = (typeof LAYERS)[number];

const KIND_COLOR: Record<Kind, string> = {
  friendly: "#5fd4ff",
  unknown: "#f4cc7a",
  hostile: "#ff6b6b",
  neutral: "#9aa3ab",
};

function pathLength(p: Pt[]) {
  let d = 0;
  for (let i = 1; i < p.length; i++) d += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  return d;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function along(p: Pt[], f: number): Pt {
  const [x, y] = alongRaw(p, f);
  return [r1(x), r1(y)];
}

function alongRaw(p: Pt[], f: number): Pt {
  const total = pathLength(p);
  let target = Math.max(0, Math.min(1, f)) * total;
  for (let i = 1; i < p.length; i++) {
    const seg = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    if (target <= seg || i === p.length - 1) {
      const k = seg ? Math.min(1, target / seg) : 0;
      return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * k, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * k];
    }
    target -= seg;
  }
  return p[p.length - 1];
}

function progress(tr: Track, t: number) {
  if (tr.loop) return (t * 1.0 + tr.t0) % 1;
  return (t - tr.t0) / (tr.t1 - tr.t0);
}

function stateAt(tr: Track, t: number) {
  let s = tr.states[0];
  for (const st of tr.states) if (t >= st[0]) s = st;
  return s;
}

function visible(tr: Track, t: number) {
  if (tr.loop) return true;
  if (t < tr.t0) return false;
  if (tr.fadeAfter !== undefined && t > tr.fadeAfter) return false;
  return true;
}

// Deterministic contour rings that read as terrain relief.
function contours(seed: number) {
  const out: string[] = [];
  const centers: Pt[] = [
    [180, 140],
    [820, 420],
    [640, 120],
    [260, 470],
  ];
  centers.forEach(([cx, cy], ci) => {
    for (let lvl = 0; lvl < 6; lvl++) {
      const R = 40 + lvl * 26;
      const pts: string[] = [];
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        const r = R * (1 + 0.16 * Math.sin(3 * a + seed + ci) + 0.08 * Math.sin(5 * a + lvl + ci * 2));
        pts.push(`${(cx + Math.cos(a) * r * 1.3).toFixed(1)},${(cy + Math.sin(a) * r * 0.8).toFixed(1)}`);
      }
      out.push(`M${pts.join("L")}Z`);
    }
  });
  return out;
}

const poly = (p: Pt[]) => p.map((q) => q.join(",")).join(" ");
const fmtTime = (t: number) => {
  const s = Math.floor(t * 210);
  return `T+${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export function OpsConsole({
  scenario,
  cycleMs,
  running,
  onInteract,
}: {
  scenario: Key;
  cycleMs: number;
  running: boolean;
  onInteract?: (active: boolean) => void;
}) {
  const sc = scenarios[scenario];
  const [t, setT] = useState(0);
  const [paused, setPaused] = useState(false);
  const [layers, setLayers] = useState<Record<Layer, boolean>>({
    Terrain: true,
    Sensors: true,
    Zones: true,
    Tracks: true,
    Labels: true,
  });
  const [selected, setSelected] = useState<string>(sc.tracks[sc.tracks.length - 1].id);
  const last = useRef<number | null>(null);
  const tRef = useRef(0);
  const rings = useMemo(() => contours(scenario.length), [scenario]);

  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      if (last.current !== null && running && !paused) {
        tRef.current = (tRef.current + (now - last.current) / cycleMs) % 1;
        setT(tRef.current);
      }
      last.current = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, paused, cycleMs]);

  const live = sc.tracks.filter((tr) => visible(tr, t));
  const sel = sc.tracks.find((tr) => tr.id === selected) ?? sc.tracks[0];
  const selPos = along(sel.path, progress(sel, t));
  const selPrev = along(sel.path, progress(sel, t) - 0.01);
  const heading = (Math.atan2(selPos[0] - selPrev[0], -(selPos[1] - selPrev[1])) * 180) / Math.PI;
  const [, selStatus, selKind] = stateAt(sel, t);
  const log = sc.events.filter((e) => e.t <= t).slice(-5).reverse();
  const alerts = sc.events.filter((e) => e.t <= t && e.level === "alert").length;

  const toggle = (l: Layer) => setLayers((s) => ({ ...s, [l]: !s[l] }));
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    tRef.current = Math.max(0, Math.min(0.999, (e.clientX - r.left) / r.width));
    setT(tRef.current);
  };

  return (
    <div
      className="ic-ops"
      onPointerEnter={() => onInteract?.(true)}
      onPointerLeave={() => onInteract?.(false)}
    >
      <div className="ic-ops__bar">
        <span className="ic-ops__brand">
          <i /> SUHAIL OPS
        </span>
        <span className="ic-ops__crumb">
          {sc.area} <b>/</b> {sc.title}
        </span>
        <span className="ic-ops__pill">SIMULATION</span>
        <span className="ic-ops__pill ic-ops__pill--ok">{sc.sensors.length} SENSORS ONLINE</span>
        {alerts > 0 && <span className="ic-ops__pill ic-ops__pill--alert">{alerts} ALERT</span>}
        <span className="ic-ops__clock">{fmtTime(t)}</span>
      </div>

      <div className="ic-ops__body">
        <div className="ic-ops__rail" aria-label="Map layers">
          <span className="ic-ops__h">LAYERS</span>
          {LAYERS.map((l) => (
            <button key={l} type="button" data-on={layers[l]} onClick={() => toggle(l)}>
              <i /> {l}
            </button>
          ))}
          <span className="ic-ops__h ic-ops__h--gap">LEGEND</span>
          {(["friendly", "unknown", "hostile", "neutral"] as Kind[]).map((k) => (
            <span key={k} className="ic-ops__legend">
              <i style={{ background: KIND_COLOR[k] }} /> {k}
            </span>
          ))}
        </div>

        <svg className="ic-ops__map" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={`${sc.title} simulation`}>
          <defs>
            <pattern id={`grid-${scenario}`} width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M50 0H0V50" fill="none" stroke="rgba(150,190,210,.07)" />
            </pattern>
            <radialGradient id={`vig-${scenario}`} cx="50%" cy="50%" r="70%">
              <stop offset="60%" stopColor="rgba(10,12,14,0)" />
              <stop offset="100%" stopColor="rgba(10,12,14,.75)" />
            </radialGradient>
          </defs>
          <rect width={W} height={H} fill="#11161a" />
          {sc.sea && <polygon points={poly(sc.sea)} fill="#0b2431" />}
          {layers.Terrain && (
            <g fill="none" stroke="rgba(140,180,200,.12)">
              {rings.map((d, i) => (
                <path key={i} d={d} />
              ))}
            </g>
          )}
          {sc.coast && <polyline points={poly(sc.coast)} fill="none" stroke="rgba(150,200,220,.45)" strokeWidth="1.5" />}
          <rect width={W} height={H} fill={`url(#grid-${scenario})`} />
          {Array.from({ length: 20 }, (_, i) => (
            <text key={`gx${i}`} x={i * 50 + 4} y={12} className="ic-ops__grid-label">
              {String.fromCharCode(65 + i)}
            </text>
          ))}
          {Array.from({ length: 11 }, (_, i) => (
            <text key={`gy${i}`} x={4} y={i * 50 + 46} className="ic-ops__grid-label">
              {i + 1}
            </text>
          ))}

          {layers.Zones &&
            sc.zones.map((z) => (
              <g key={z.id}>
                <polygon points={poly(z.poly)} fill="rgba(95,212,255,.06)" stroke="rgba(95,212,255,.55)" strokeDasharray="5 5" />
                {layers.Labels && (
                  <text x={z.poly[0][0] + 6} y={Math.min(...z.poly.map((p) => p[1])) - 6} className="ic-ops__zone-label">
                    {z.label}
                  </text>
                )}
              </g>
            ))}
          {sc.structures.map((s, i) => (
            <g key={i}>
              <polygon points={poly(s.poly)} fill="rgba(200,215,225,.14)" stroke="rgba(200,215,225,.35)" />
              {s.label && layers.Labels && (
                <text x={s.poly[0][0] + 3} y={s.poly[0][1] - 4} className="ic-ops__grid-label">
                  {s.label}
                </text>
              )}
            </g>
          ))}

          {layers.Sensors &&
            sc.sensors.map((s, i) => (
              <g key={s.id}>
                <circle cx={s.at[0]} cy={s.at[1]} r={s.r} fill="rgba(95,212,255,.025)" stroke="rgba(95,212,255,.22)" />
                <circle cx={s.at[0]} cy={s.at[1]} r={s.r * ((t * 3 + i * 0.3) % 1)} fill="none" stroke="rgba(95,212,255,.3)" opacity={1 - ((t * 3 + i * 0.3) % 1)} />
                {i === 0 && (
                  <line
                    x1={s.at[0]}
                    y1={s.at[1]}
                    x2={r1(s.at[0] + Math.cos(t * Math.PI * 2 * 3) * s.r)}
                    y2={r1(s.at[1] + Math.sin(t * Math.PI * 2 * 3) * s.r)}
                    stroke="rgba(95,212,255,.5)"
                  />
                )}
                <rect x={s.at[0] - 4} y={s.at[1] - 4} width="8" height="8" fill="#5fd4ff" />
                {layers.Labels && (
                  <text x={s.at[0] + 9} y={s.at[1] + 14} className="ic-ops__label ic-ops__label--sensor">
                    {s.label}
                  </text>
                )}
              </g>
            ))}

          {layers.Tracks &&
            live.map((tr) => {
              const p = progress(tr, t);
              const pos = along(tr.path, p);
              const [, status, kind] = stateAt(tr, t);
              const c = KIND_COLOR[kind];
              const trail = Array.from({ length: 10 }, (_, k) => along(tr.path, tr.loop ? (p - (k + 1) * 0.012 + 1) % 1 : p - (k + 1) * 0.018));
              const isSel = tr.id === selected;
              const done = !tr.loop && p >= 1 && kind === "neutral" && tr.fadeAfter !== undefined;
              return (
                <g key={tr.id} className="ic-ops__track" onClick={() => setSelected(tr.id)} opacity={done ? 0.55 : 1}>
                  {trail.map((q, k) => (
                    <circle key={k} cx={q[0]} cy={q[1]} r={1.6} fill={c} opacity={0.5 - k * 0.045} />
                  ))}
                  {isSel && <circle cx={pos[0]} cy={pos[1]} r={16} fill="none" stroke={c} strokeDasharray="3 3" />}
                  {kind === "friendly" ? (
                    <circle cx={pos[0]} cy={pos[1]} r={6} fill="none" stroke={c} strokeWidth="2" />
                  ) : kind === "neutral" ? (
                    <rect x={pos[0] - 5} y={pos[1] - 5} width="10" height="10" fill="none" stroke={c} strokeWidth="2" />
                  ) : (
                    <rect x={pos[0] - 5} y={pos[1] - 5} width="10" height="10" fill="none" stroke={c} strokeWidth="2" transform={`rotate(45 ${pos[0]} ${pos[1]})`} />
                  )}
                  {kind === "hostile" && (
                    <line x1={sc.sensors[0].at[0]} y1={sc.sensors[0].at[1]} x2={pos[0]} y2={pos[1]} stroke={c} strokeDasharray="2 4" opacity=".7" />
                  )}
                  {layers.Labels && (
                    <text x={pos[0] + 12} y={kind === "friendly" ? pos[1] + 18 : pos[1] - 8} className="ic-ops__label" fill={c}>
                      {tr.id} · {status}
                    </text>
                  )}
                  <circle cx={pos[0]} cy={pos[1]} r={18} fill="transparent" />
                </g>
              );
            })}
          <rect width={W} height={H} fill={`url(#vig-${scenario})`} pointerEvents="none" />
        </svg>

        <div className="ic-ops__side">
          <span className="ic-ops__h">TRACKS · {live.length}</span>
          <div className="ic-ops__table" role="list">
            {live.map((tr) => {
              const [, status, kind] = stateAt(tr, t);
              return (
                <button key={tr.id} type="button" role="listitem" data-sel={tr.id === selected} onClick={() => setSelected(tr.id)}>
                  <i style={{ background: KIND_COLOR[kind] }} />
                  <b>{tr.id}</b>
                  <span>{status}</span>
                </button>
              );
            })}
          </div>
          <div className="ic-ops__card">
            <span className="ic-ops__h">SELECTED</span>
            <div className="ic-ops__card-id" style={{ color: KIND_COLOR[selKind] }}>
              {sel.id}
            </div>
            <dl>
              <dt>Type</dt>
              <dd>{sel.type}</dd>
              <dt>Status</dt>
              <dd>{visible(sel, t) ? selStatus : "NOT YET DETECTED"}</dd>
              <dt>Heading</dt>
              <dd>{Math.round((heading + 360) % 360)}°</dd>
              <dt>Altitude</dt>
              <dd>{sel.alt}</dd>
              <dt>Source</dt>
              <dd>{sel.source}</dd>
            </dl>
          </div>
          {sc.metric && (
            <div className="ic-ops__card">
              <span className="ic-ops__h">{sc.metric.label.toUpperCase()}</span>
              <div className="ic-ops__metric">
                {(sc.metric.base + Math.sin(t * Math.PI * 6) * sc.metric.swing).toFixed(1)}
                <small> {sc.metric.unit}</small>
              </div>
              <svg viewBox="0 0 100 24" className="ic-ops__spark" aria-hidden="true">
                <polyline
                  fill="none"
                  stroke="#5fd4ff"
                  points={Array.from({ length: 40 }, (_, i) => {
                    const tt = t - (39 - i) * 0.01;
                    return `${i * 2.55},${12 - Math.sin(tt * Math.PI * 6) * 8}`;
                  }).join(" ")}
                />
              </svg>
            </div>
          )}
        </div>
      </div>

      <div className="ic-ops__foot">
        <button type="button" className="ic-ops__play" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Play simulation" : "Pause simulation"}>
          {paused ? "▶" : "❚❚"}
        </button>
        <div className="ic-ops__timeline" onClick={seek} role="slider" aria-label="Simulation time" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(t * 100)} tabIndex={0}>
          {sc.events.map((e) => (
            <i key={e.t} className={`ic-ops__mark ic-ops__mark--${e.level}`} style={{ left: `${e.t * 100}%` }} />
          ))}
          <span className="ic-ops__head" style={{ left: `${t * 100}%` }} />
        </div>
        <ol className="ic-ops__log">
          {log.map((e) => (
            <li key={e.t} className={`ic-ops__log--${e.level}`}>
              <time>{fmtTime(e.t)}</time> {e.text}
            </li>
          ))}
          {log.length === 0 && <li className="ic-ops__log--info">Monitoring · no events</li>}
        </ol>
      </div>
    </div>
  );
}
