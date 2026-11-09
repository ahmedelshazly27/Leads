import { useEffect, useRef, useState, type ReactNode } from "react";
import { FaceLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";
import { FacePhoto, toPhoto } from "../../components/FacePhoto";
import { Toggle } from "../../components/ui";
import { fileToDataUrl } from "../../lib/image";
import { setVisuals } from "../../lib/store";
import type { Pt, Visuals } from "../../lib/types";
import { realismCheck, type RealismRow } from "../../lib/realism";
import { HAIRSTYLES, BEARDS, REVIEWED_AT, SOURCE_KINDS, TREND_SOURCES } from "../../lib/styles";
import "../pages.css";

/* Production tools used by the reviewer console. */
/* ------------------------------------------------------------------ */
/*  Body visuals                                                       */
/* ------------------------------------------------------------------ */

export const BODY_BASELINE_PROMPT =
  "Clinical standardized physique baseline photo of the exact same person from the reference photos (front body, side body, face). Strictly preserve the real body as it is now: identical body shape, proportions, shoulder width, chest, arms, waist and belly fullness, body fat level, body hair, skin tone, face, hair and facial hair. Do not slim, tone, sculpt or idealize anything, and keep the real standing posture. Re-photograph standing naturally (front view: facing the camera, arms hanging slightly away from the sides, feet hip-width; side view: strict side-on, arms relaxed), wearing loose black athletic gym shorts (fitted underwear-style shorts trip image-model safety filters). Framing from the top of the head to mid-thigh (or head to toe if the full body is visible in the references). Plain seamless studio background in flat deep muted burgundy (#74464f), soft even studio lighting, camera at chest height from about 3 m with a 70 mm lens so there is no wide-angle distortion. Photorealistic, true-to-life, no retouching.";


export function BodyVisuals({ scanId, visuals, bodyPhoto, sidePhoto, afterText }: { scanId: string; visuals: Visuals; bodyPhoto: string | null; sidePhoto: string | null; afterText: [string, string] }) {
  const b = visuals.body ?? {};
  const set = (key: "front" | "side" | "afterFront" | "afterSide") => (x: string | undefined) => setVisuals(scanId, { body: { ...b, [key]: x } });
  return (
    <section className="vz-section">
      <h2 className="title-md">Body</h2>
      <p className="lead">The same approach as the face: a standardized physique model of you on the studio background, then the end-of-plan body — only fat loss, natural muscle and posture changes.</p>
      <div className="vz-slots vz-slots-4" style={{ marginTop: 16 }}>
        <Slot label="Front model" tag="Before" value={b.front} onChange={set("front")} fallback={bodyPhoto} />
        <Slot label="Side model" tag="Before" value={b.side} onChange={set("side")} fallback={sidePhoto} />
        <Slot label="After · front" tag="After" value={b.afterFront} onChange={set("afterFront")} />
        <Slot label="After · side" tag="After" value={b.afterSide} onChange={set("afterSide")} />
      </div>
      <PromptBlock title="3 · Body baseline (standardized physique)" text={BODY_BASELINE_PROMPT} />
      <PromptBlock title="② Body after · front (refs: front body baseline + approved face after)" text={afterText[0]} />
      <PromptBlock title="③ Body after · side (refs: side body baseline + approved face after)" text={afterText[1]} />
    </section>
  );
}

export function Upload({ onFile, children, className = "btn btn-ghost" }: { onFile: (dataUrl: string) => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <label className={className} style={{ cursor: "pointer" }}>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) onFile(await fileToDataUrl(f, 1600));
          if (ref.current) ref.current.value = "";
        }}
      />
      {children}
    </label>
  );
}

export function Slot({ label, tag, value, onChange, fallback }: { label: string; tag: string; value?: string; onChange: (v: string | undefined) => void; fallback?: string | null }) {
  const shown = value ?? null;
  return (
    <div className="vz-slot">
      <div className="vz-slot-img">
        {shown ? (
          <img src={shown} alt="" />
        ) : fallback ? (
          <img src={fallback} alt="" style={{ opacity: 0.35, filter: "grayscale(.4)" }} />
        ) : null}
        {!shown && <div className="vz-slot-empty" style={{ position: "absolute" }}>No {label.toLowerCase()} yet — upload one generated from the prompt below.</div>}
        <span className="photo-tag">{tag}</span>
      </div>
      <div className="vz-slot-bar">
        <span className="mono-sm" style={{ marginRight: "auto" }}>
          {label}
        </span>
        <Upload onFile={onChange}>{shown ? "Replace" : "Upload"}</Upload>
        {shown && (
          <button className="btn btn-ghost" onClick={() => onChange(undefined)}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

export function PromptBlock({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="vz-prompt">
      <div className="vz-prompt-head">
        <span className="mono">{title}</span>
        <button
          className="btn btn-ghost"
          style={{ height: 30, fontSize: 12 }}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* clipboard blocked */
            }
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>{text}</pre>
    </div>
  );
}

export function StyleGallery({ scanId, visuals }: { scanId: string; visuals: Visuals }) {
  const styles = visuals.styles ?? [];
  const [name, setName] = useState("");
  const [draft, setDraft] = useState<{ front?: string; left?: string; right?: string }>({});
  const save = () => {
    if (!name.trim() || !draft.front) return;
    setVisuals(scanId, { styles: [...styles, { name: name.trim(), ...draft }] });
    setName("");
    setDraft({});
  };
  return (
    <section className="vz-section">
      <h2 className="title-md">Style previews</h2>
      <p className="lead">Hair and beard options rendered on your after-portrait from three angles. Only styles your hair can reach within 12 months (~1 cm growth per month) are recommended.</p>
      {styles.map((s, i) => {
        const active = !!s.front && visuals.after === s.front;
        return (
          <div key={s.name + i} className={`vz-style ${active ? "active" : ""}`}>
            <div className="vz-style-head">
              <span className="title-md" style={{ fontSize: 16 }}>
                {s.name}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" style={{ height: 32, fontSize: 12 }} disabled={active || !s.front} onClick={() => setVisuals(scanId, { after: s.front })}>
                  {active ? "Active after" : "Use as after"}
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ height: 32, fontSize: 12 }}
                  onClick={() => confirm(`Remove "${s.name}"?`) && setVisuals(scanId, { styles: styles.filter((_, j) => j !== i) })}
                >
                  Remove
                </button>
              </div>
            </div>
            <div className="vz-style-row">
              {(["left", "front", "right"] as const).filter((k) => s[k]).map((k) => (
                <div key={k}>
                  {s[k] && <img src={s[k]} alt="" />}
                  <span className="mono-sm">{k === "front" ? "Front" : `${k} profile`}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <div className="vz-style">
        <div className="mono" style={{ marginBottom: 10 }}>
          Add a style
        </div>
        <div className="vz-add">
          <div className="field">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Textured crop · heavy stubble" />
          </div>
          {(["front", "left", "right"] as const).map((k) => (
            <Upload key={k} onFile={(d) => setDraft((x) => ({ ...x, [k]: d }))}>
              {draft[k] ? `✓ ${k}` : `${k}${k === "front" ? " *" : ""}`}
            </Upload>
          ))}
          <button className="btn" disabled={!name.trim() || !draft.front} onClick={save}>
            Save style
          </button>
        </div>
      </div>
    </section>
  );
}

const TESS = FaceLandmarker.FACE_LANDMARKS_TESSELATION;

export function MeshViewer({ photo, lm, aspect }: { photo: string | null; lm: Pt[]; aspect: number }) {
  const [mode, setMode] = useState<"face" | "mask">("face");
  const xs = lm.map((p) => p[0]);
  const ys = lm.map((p) => p[1]);
  const pad = 0.12;
  const crop: [number, number, number, number] = (() => {
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const h = Math.min(1, (y1 - y0) * (1 + pad * 3));
    const w = Math.min(1, (h * 0.78) / aspect);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return [Math.max(0, Math.min(1 - w, cx - w / 2)), Math.max(0, Math.min(1 - h, cy - h / 2)), w, h];
  })();
  const lines = TESS.map(({ start, end }, i) => {
    const a = toPhoto(lm[start], aspect);
    const b = toPhoto(lm[end], aspect);
    return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />;
  });
  const H = 1000 / aspect;
  return (
    <section className="vz-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 }}>
        <div>
          <h2 className="title-md">Landmark mesh</h2>
          <p className="lead">The 478-point mesh every facial measurement is computed from.</p>
        </div>
        <Toggle
          value={mode}
          onChange={setMode}
          options={[
            { value: "face", label: "Face" },
            { value: "mask", label: "Mask" },
          ]}
        />
      </div>
      <div className="vz-mesh">
        <div className="vz-mesh-photo">
          <FacePhoto src={mode === "face" ? photo : "data:image/gif;base64,R0lGODlhAQABAAAAACw="} aspect={aspect} crop={crop}>
            {mode === "mask" && <rect x={0} y={0} width={1000} height={H} fill="#74464f" />}
            <g stroke={mode === "mask" ? "rgba(255,255,255,.85)" : "rgba(255,255,255,.35)"} strokeWidth={0.6} vectorEffect="non-scaling-stroke">
              {lines}
            </g>
          </FacePhoto>
          <span className="photo-tag" style={{ position: "absolute", top: 14, left: 14 }}>
            You
          </span>
        </div>
        <div className="vz-mesh-side">
          <div className="bt-card" style={{ margin: 0 }}>
            <div className="mono-sm">Landmarks</div>
            <div className="title-lg" style={{ marginTop: 18 }}>
              {lm.length}
            </div>
          </div>
          <div className="bt-card" style={{ margin: 0 }}>
            <div className="mono-sm">Mesh edges</div>
            <div className="title-lg" style={{ marginTop: 18 }}>
              {TESS.length}
            </div>
          </div>
          <p className="lead" style={{ fontSize: 12.5 }}>
            Landmarks are detected on-device with MediaPipe Face Landmarker, then rotated into a frontal pose using their depth values before any ratio is measured.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Realism check (reviewer QA)                                        */
/* ------------------------------------------------------------------ */

export function RealismPanel({ before, after, onResult }: { before: string | null; after: string; onResult?: (r: { rows: RealismRow[]; pass: boolean }) => void }) {
  const [res, setRes] = useState<{ rows: RealismRow[]; pass: boolean } | null | "error">(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!before) return;
    setBusy(true);
    try {
      const r = await realismCheck(before, after);
      setRes(r ?? "error");
      if (r) onResult?.(r);
    } catch {
      setRes("error");
    }
    setBusy(false);
  };
  useEffect(() => {
    setRes(null);
  }, [before, after]);
  return (
    <section className="vz-section rl">
      <div className="rl-head">
        <div>
          <h2 className="title-md">Realism check</h2>
          <p className="lead">
            Habits can't change bone, eye colour or skin tone. We re-measure the after image and compare bone-set proportions (relative to pupil distance), lips, skin tone and eye
            colour with the baseline. Anything outside tolerance is flagged for review.
          </p>
        </div>
        <button className="btn" onClick={run} disabled={busy || !before}>
          {busy ? "Measuring…" : res && res !== "error" ? "Re-run" : "Run check"}
        </button>
      </div>
      {res === "error" && <p className="lead">Couldn't detect a face in one of the images.</p>}
      {res && res !== "error" && (
        <>
          <div className={`rl-verdict ${res.pass ? "ok" : "flag"}`}>{res.pass ? "Passed — bone structure, lips and colour preserved" : "Flagged — regenerate from the baseline with identity locked"}</div>
          <table className="rl-table">
            <thead>
              <tr>
                <th>Proportion</th>
                <th>Before</th>
                <th>After</th>
                <th>Change</th>
                <th>Tolerance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {res.rows.map((r) => (
                <tr key={r.key} className={r.pass ? "" : "bad"}>
                  <td>
                    {r.label}
                    <small>{r.note}</small>
                  </td>
                  <td>{r.unit === "dE" ? `L* ${r.before.toFixed(0)}` : r.before.toFixed(3)}</td>
                  <td>{r.unit === "dE" ? `L* ${r.after.toFixed(0)}` : r.after.toFixed(3)}</td>
                  <td>{r.unit === "dE" ? `ΔE ${r.changePct.toFixed(1)}` : (r.changePct > 0 ? "+" : "") + r.changePct.toFixed(1) + "%"}</td>
                  <td>{r.unit === "dE" ? `≤ ${r.tolerancePct}` : r.key === "lips" ? `−12 / +${r.tolerancePct}%` : r.key === "jaw" || r.key === "zyg" ? `−${r.tolerancePct} / +1%` : `±${r.tolerancePct}%`}</td>
                  <td>{r.pass ? "✓" : "⚠"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="rl-note">
            Not measurable here, so check by eye: age (no added lines or greying), hair colour, ears and head size, and sex cues. ΔE is the CIE colour difference; about 2–3 is
            just noticeable side by side.
          </p>
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Style library (reviewed by the founder)                            */
/* ------------------------------------------------------------------ */

export function StyleLibrary() {
  return (
    <section className="vz-section">
      <h2 className="title-md">Style library · editorial review {REVIEWED_AT}</h2>
      <p className="lead">Every haircut and beard comes from this list — never improvised by the image model. Face fit decides the pick; "current" is editorial judgment and only breaks ties. No barber or brand blogs are used as sources.</p>
      <div className="tl-grid">
        {HAIRSTYLES.map((h) => (
          <div key={h.id} className={`tl-card tl-${h.status}`}>
            <div className="tl-top">
              <b>{h.name}</b>
              <span className={`tl-status tl-s-${h.status}`}>{h.status === "trending" ? "current" : h.status}</span>
            </div>
            <span className="tl-meta">
              {h.hairTypes.join(" · ")} · top {h.topCm[0]}–{h.topCm[1]} cm{h.heatFriendly ? " · heat-friendly" : ""}
            </span>
            {h.status !== "fading" && <span className="tl-barber">{h.barber}</span>}
          </div>
        ))}
        {BEARDS.map((b) => (
          <div key={b.id} className="tl-card">
            <div className="tl-top">
              <b>{b.name}</b>
              <span className={`tl-status tl-s-${b.status}`}>{b.status === "trending" ? "current" : b.status}</span>
            </div>
            <span className="tl-meta">Beard · needs {b.needsDensity} density</span>
          </div>
        ))}
      </div>
      <div className="tl-src">
        {SOURCE_KINDS.map((k) => (
          <div key={k.kind} className="tl-src-group">
            <b>{k.label}</b> <span>— {k.note}</span>
            <ul>
              {TREND_SOURCES.filter((x) => x.kind === k.kind).map((x) => (
                <li key={x.name}>
                  {x.url ? (
                    <a href={x.url} target="_blank" rel="noreferrer">
                      {x.name}
                    </a>
                  ) : (
                    x.name
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Pose landmark viewer (body / side QA)                              */
/* ------------------------------------------------------------------ */

const POSE = PoseLandmarker.POSE_CONNECTIONS;

export function PoseViewer({ photo, lm, aspect, label }: { photo: string | null; lm: Pt[]; aspect: number; label: string }) {
  const P = (i: number) => toPhoto(lm[i], aspect);
  return (
    <div className="rv-pose">
      <FacePhoto src={photo} aspect={aspect} placeholderTone="slate">
        <g stroke="#5fe0a0" strokeWidth={4} strokeLinecap="round">
          {POSE.map(({ start, end }, i) => {
            if (!lm[start] || !lm[end]) return null;
            const a = P(start), b = P(end);
            return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />;
          })}
        </g>
        <g fill="#fff" stroke="#0b1d24" strokeWidth={2}>
          {lm.map((_, i) => {
            const a = P(i);
            return <circle key={i} cx={a[0]} cy={a[1]} r={7} />;
          })}
        </g>
      </FacePhoto>
      <span className="photo-tag" style={{ position: "absolute", top: 10, left: 10 }}>{label}</span>
    </div>
  );
}
