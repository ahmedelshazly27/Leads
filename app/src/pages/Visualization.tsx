import { useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { FaceLandmarker } from "@mediapipe/tasks-vision";
import { FacePhoto, toPhoto } from "../components/FacePhoto";
import { Empty, PageHeader, Toggle } from "../components/ui";
import { fileToDataUrl } from "../lib/image";
import { afterPrompt, BASELINE_PROMPT, buildPlan } from "../lib/plan";
import { setVisuals } from "../lib/store";
import { useActive } from "../lib/useActive";
import type { Pt, Visuals } from "../lib/types";
import "./pages.css";

export function Visualization() {
  const { profile, scan, facePhoto, bodyPhoto, sidePhoto, state } = useActive();
  const nav = useNavigate();
  const plan = useMemo(() => (scan && profile ? buildPlan(scan, profile.intake) : null), [scan, profile]);
  if (!profile || !scan || !plan)
    return (
      <div className="page">
        <Empty title="No scans yet">
          <button className="btn" onClick={() => nav("/new")}>
            Start an analysis
          </button>
        </Empty>
      </div>
    );
  const v: Visuals = state.visuals[scan.id] ?? {};
  const after = afterPrompt(plan, profile.intake);

  return (
    <div className="page">
      <PageHeader
        kicker="Visualization"
        muted="See your"
        strong="potential"
        lead="A standardized studio portrait of you, and the same portrait after the plan's 12-month, evidence-based changes. Only changes the plan can realistically produce are shown — never bone structure."
      />

      <div className="vz-slots">
        <Slot label="Standardized model" tag="Before" value={v.baseline} onChange={(x) => setVisuals(scan.id, { baseline: x })} fallback={facePhoto} />
        <Slot label="12-month after" tag="After" value={v.after} onChange={(x) => setVisuals(scan.id, { after: x })} />
      </div>

      <section className="vz-section">
        <h2 className="title-md">Generation prompts</h2>
        <p className="lead">
          These prompts are generated from your measurements and plan. Run them with an image model: <b>FLUX 3</b> for the baseline (most identity-faithful), then <b>Nano Banana Pro</b> for the after (follows
          edits best). Upload the results into the slots above.
        </p>
        <PromptBlock title="1 · Baseline (standardized model)" text={BASELINE_PROMPT} />
        <PromptBlock title="2 · After (end of plan)" text={after} />
        <div className="vz-gen">
          <button className="btn" disabled title="Needs an image-model backend">
            Generate in app
          </button>
          <span>
            In-app generation needs a small backend that calls an image model with your API key. Until it's connected, copy the prompts above. Uploading photos to an external generator sends them
            to that provider.
          </span>
        </div>
      </section>

      {(scan.body || scan.bodySide) && (
        <BodyVisuals scanId={scan.id} visuals={v} bodyPhoto={bodyPhoto} sidePhoto={sidePhoto} afterText={bodyAfterPrompt(plan.items.map((i) => i.visual ?? ""))} />
      )}

      <StyleGallery scanId={scan.id} visuals={v} />

      {scan.face?.landmarks && <MeshViewer photo={facePhoto} lm={scan.face.landmarks} aspect={scan.face.imageAspect} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Body visuals                                                       */
/* ------------------------------------------------------------------ */

const BODY_BASELINE_PROMPT =
  "Clinical standardized physique baseline photo of the exact same person from the reference photos (front body, side body, face). Strictly preserve the real body as it is now: identical body shape, proportions, shoulder width, chest, arms, waist and belly fullness, body fat level, body hair, skin tone, face, hair and facial hair. Do not slim, tone, sculpt or idealize anything, and keep the real standing posture. Re-photograph standing naturally (front view: facing the camera, arms hanging slightly away from the sides, feet hip-width; side view: strict side-on, arms relaxed), wearing plain fitted black athletic shorts. Framing from the top of the head to mid-thigh (or head to toe if the full body is visible in the references). Plain seamless studio background in flat muted slate blue-grey (#A9BDC4), soft even studio lighting, camera at chest height from about 3 m with a 70 mm lens so there is no wide-angle distortion. Photorealistic, true-to-life, no retouching.";

function bodyAfterPrompt(visuals: string[]) {
  const body = visuals.filter((x) => /body|stomach|waist|shoulder|muscle|training|standing|posture|glute|arms/i.test(x));
  const list = body.length ? body.map((x, i) => `${i + 1}) ${x}`).join("; ") : "1) realistic improvements from 12 months of training and fat loss";
  return [
    "Edit the first image (the standardized physique baseline). Keep the exact same person, face, hair, skin tone, body hair, camera angle, framing, black athletic shorts, slate blue-grey studio background (#A9BDC4) and lighting so it lines up 1:1 as a before/after pair.",
    `Show the result of a realistic 12-month, evidence-based training and nutrition plan, changing ONLY: ${list}.`,
    "Keep the same skeleton, height, shoulder bone width, limb lengths and proportions; natural, drug-free muscle gain only (no bodybuilder or fitness-model physique), realistic skin and body hair. Photorealistic, no retouching or beauty filter.",
  ].join(" ");
}

function BodyVisuals({ scanId, visuals, bodyPhoto, sidePhoto, afterText }: { scanId: string; visuals: Visuals; bodyPhoto: string | null; sidePhoto: string | null; afterText: string }) {
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
      <PromptBlock title="4 · Body after (end of plan)" text={afterText} />
    </section>
  );
}

function Upload({ onFile, children, className = "btn btn-ghost" }: { onFile: (dataUrl: string) => void; children: ReactNode; className?: string }) {
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

function Slot({ label, tag, value, onChange, fallback }: { label: string; tag: string; value?: string; onChange: (v: string | undefined) => void; fallback?: string | null }) {
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

function PromptBlock({ title, text }: { title: string; text: string }) {
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

function StyleGallery({ scanId, visuals }: { scanId: string; visuals: Visuals }) {
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
              {(["left", "front", "right"] as const).map((k) => (
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

function MeshViewer({ photo, lm, aspect }: { photo: string | null; lm: Pt[]; aspect: number }) {
  const [mode, setMode] = useState<"face" | "mask">("mask");
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
            {mode === "mask" && <rect x={0} y={0} width={1000} height={H} fill="#a9bdc4" />}
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
