import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/ui";
import { fileToDataUrl } from "../lib/image";
import { runScan, ScanError, type Stage } from "../lib/pipeline";
import { addScan, createProfile, setActiveProfile, updateIntake, useAppState } from "../lib/store";
import type { Intake, Scan } from "../lib/types";
import { preloadVision } from "../lib/vision";
import "./pages.css";

const DEFAULT_INTAKE: Intake = {
  name: "",
  age: 25,
  gender: "male",
  ethnicity: "",
  heightCm: null,
  weightKg: null,
  waistCm: null,
  hipCm: null,
  neckCm: null,
  location: "",
  preferences: "non-invasive",
  budget: "medium",
  smoking: "no",
  drinking: "occasional",
  sleepHours: 7,
  trainingDays: 0,
  skinTone: 3,
  limitations: "",
  allergies: "",
  profession: "",
  goals: [],
  hairType: "straight",
  hairLengthCm: 5,
  hairLoss: "none",
  facialHair: "none",
  activeAcne: false,
};

const STEPS = ["About you", "Photos", "Analysis"];

export function NewScan() {
  const { profileId } = useParams();
  const s = useAppState();
  const nav = useNavigate();
  const existing = profileId ? s.profiles.find((p) => p.id === profileId) : undefined;
  const [step, setStep] = useState(0);
  const [intake, setIntake] = useState<Intake>(() => ({ ...DEFAULT_INTAKE, ...(existing?.intake ?? {}) }));
  const [face, setFace] = useState<string | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const [side, setSide] = useState<string | null>(null);

  useEffect(() => {
    preloadVision();
  }, []);

  return (
    <div className="page" style={{ maxWidth: 980 }}>
      <PageHeader
        kicker={existing ? "Check-in" : "New analysis"}
        muted={existing ? "New check-in for" : "Start your"}
        strong={existing ? existing.intake.name : "analysis"}
        lead="Your photos are analysed on this device. Nothing is uploaded."
      />
      <div className="wz-steps">
        {STEPS.map((label, i) => (
          <div key={label} className={`wz-step ${i < step ? "done" : i === step ? "on" : ""}`}>
            <div className="bar" />
            <span className="mono-sm">
              {String(i + 1).padStart(2, "0")} · {label}
            </span>
          </div>
        ))}
      </div>
      {step === 0 && <IntakeStep intake={intake} setIntake={setIntake} onNext={() => setStep(1)} />}
      {step === 1 && (
        <PhotoStep face={face} body={body} side={side} setFace={setFace} setBody={setBody} setSide={setSide} onBack={() => setStep(0)} onNext={() => setStep(2)} />
      )}
      {step === 2 && (
        <ProcessStep
          intake={intake}
          face={face}
          body={body}
          side={side}
          onBack={() => setStep(1)}
          onDone={async (scan) => {
            // the profile is only created once the scan succeeded, so failed attempts leave nothing behind
            let pid = existing?.id;
            if (pid) updateIntake(pid, intake);
            else pid = createProfile(intake).id;
            await addScan({ ...scan, profileId: pid }, face, body, side);
            setActiveProfile(pid);
            nav("/analysis/getting-started");
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 1: intake                                                     */
/* ------------------------------------------------------------------ */

function IntakeStep({ intake, setIntake, onNext }: { intake: Intake; setIntake: (i: Intake) => void; onNext: () => void }) {
  const set = <K extends keyof Intake>(k: K, v: Intake[K]) => setIntake({ ...intake, [k]: v });
  const num = (v: string) => (v === "" ? null : Number(v));
  const valid = intake.name.trim().length > 0 && intake.age >= 13 && intake.age <= 100;
  return (
    <div className="wz-card">
      <Section title="Basics">
        <F label="Name">
          <input value={intake.name} onChange={(e) => set("name", e.target.value)} placeholder="Your name" />
        </F>
        <F label="Age">
          <input type="number" min={13} max={100} value={intake.age} onChange={(e) => set("age", Number(e.target.value))} />
        </F>
        <F label="Gender">
          <select value={intake.gender} onChange={(e) => set("gender", e.target.value as Intake["gender"])}>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other / prefer not to say</option>
          </select>
        </F>
        <F label="Ethnicity" hint="Used to pick reference norms">
          <input value={intake.ethnicity} onChange={(e) => set("ethnicity", e.target.value)} placeholder="e.g. Middle Eastern" />
        </F>
        <F label="Location">
          <input value={intake.location} onChange={(e) => set("location", e.target.value)} placeholder="Country" />
        </F>
        <F label="Profession">
          <input value={intake.profession} onChange={(e) => set("profession", e.target.value)} />
        </F>
      </Section>

      <Section title="Body measurements" note="Height and weight let us estimate BMI and body fat. Nothing else to measure.">
        <F label="Height (cm)">
          <input type="number" value={intake.heightCm ?? ""} onChange={(e) => set("heightCm", num(e.target.value))} />
        </F>
        <F label="Weight (kg)">
          <input type="number" value={intake.weightKg ?? ""} onChange={(e) => set("weightKg", num(e.target.value))} />
        </F>
      </Section>

      <Section title="Lifestyle">
        <F label="Sleep (hours/night)">
          <input type="number" step={0.5} value={intake.sleepHours} onChange={(e) => set("sleepHours", Number(e.target.value))} />
        </F>
        <F label="Training days / week">
          <input type="number" min={0} max={7} value={intake.trainingDays} onChange={(e) => set("trainingDays", Number(e.target.value))} />
        </F>
        <F label="Smoking">
          <select value={intake.smoking} onChange={(e) => set("smoking", e.target.value as Intake["smoking"])}>
            <option value="no">No</option>
            <option value="occasionally">Occasionally</option>
            <option value="daily">Daily</option>
          </select>
        </F>
        <F label="Drinking">
          <select value={intake.drinking} onChange={(e) => set("drinking", e.target.value as Intake["drinking"])}>
            <option value="never">Never</option>
            <option value="occasional">Occasional social drinker</option>
            <option value="weekly">Weekly</option>
            <option value="daily">Daily</option>
          </select>
        </F>
        <F label="Preferences">
          <select value={intake.preferences} onChange={(e) => set("preferences", e.target.value as Intake["preferences"])}>
            <option value="non-invasive">Non-invasive only</option>
            <option value="open-to-clinical">Open to clinical treatments</option>
            <option value="open-to-surgical">Open to surgical options</option>
          </select>
        </F>
        <F label="Budget">
          <select value={intake.budget} onChange={(e) => set("budget", e.target.value as Intake["budget"])}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </F>
      </Section>

      <Section title="Skin & hair">
        <F label="Skin tone (Fitzpatrick)">
          <select value={intake.skinTone} onChange={(e) => set("skinTone", Number(e.target.value) as Intake["skinTone"])}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                Type {["I", "II", "III", "IV", "V", "VI"][n - 1]}
              </option>
            ))}
          </select>
        </F>
        <F label="Front photo" hint="Arm's-length selfies widen the nose ~30%; we correct our reading if you tell us">
          <select value={intake.frontCapture ?? ""} onChange={(e) => set("frontCapture", (e.target.value || undefined) as Intake["frontCapture"])}>
            <option value="">Not sure</option>
            <option value="distance">Taken by someone else / timer (1.5 m+)</option>
            <option value="selfie">Selfie at arm's length</option>
          </select>
        </F>
        <F label="Active acne">
          <label className="wz-check">
            <input type="checkbox" checked={intake.activeAcne} onChange={(e) => set("activeAcne", e.target.checked)} /> I currently have breakouts
          </label>
        </F>
        <F label="Hair type">
          <select value={intake.hairType} onChange={(e) => set("hairType", e.target.value as Intake["hairType"])}>
            <option value="straight">Straight</option>
            <option value="wavy">Wavy</option>
            <option value="curly">Curly</option>
            <option value="coily">Coily</option>
          </select>
        </F>
        <F label="Hair length on top (cm)">
          <input type="number" value={intake.hairLengthCm} onChange={(e) => set("hairLengthCm", Number(e.target.value))} />
        </F>
        <F label="Hair loss" hint="Receding hairline or thinning crown">
          <select value={intake.hairLoss} onChange={(e) => set("hairLoss", e.target.value as Intake["hairLoss"])}>
            <option value="none">None</option>
            <option value="early">Early</option>
            <option value="moderate">Moderate</option>
            <option value="advanced">Advanced</option>
          </select>
        </F>
        {intake.gender !== "female" && (
          <F label="Facial hair growth">
            <select value={intake.facialHair} onChange={(e) => set("facialHair", e.target.value as Intake["facialHair"])}>
              <option value="none">Little or none</option>
              <option value="patchy">Patchy</option>
              <option value="full">Full</option>
            </select>
          </F>
        )}
      </Section>

      <Section title="Health notes">
        <F label="Limitations">
          <textarea value={intake.limitations} onChange={(e) => set("limitations", e.target.value)} placeholder="Injuries, conditions…" />
        </F>
        <F label="Allergies">
          <textarea value={intake.allergies} onChange={(e) => set("allergies", e.target.value)} />
        </F>
        <F label="Goals" hint="Comma-separated">
          <textarea
            value={intake.goals.join(", ")}
            onChange={(e) =>
              set(
                "goals",
                e.target.value.split(",").map((g) => g.trimStart()).filter((g, i, a) => g || i === a.length - 1),
              )
            }
            placeholder="Clear skin, leaner face…"
          />
        </F>
      </Section>

      <div className="wz-foot">
        <span className="lead" style={{ fontSize: 12 }}>
          {valid ? "" : "Name and a valid age are required."}
        </span>
        <button className="btn" disabled={!valid} onClick={onNext}>
          Continue to photos
        </button>
      </div>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div className="wz-section">
      <h3>{title}</h3>
      {note && (
        <p className="lead" style={{ fontSize: 12, marginTop: -6, marginBottom: 12 }}>
          {note}
        </p>
      )}
      <div className="wz-grid">{children}</div>
    </div>
  );
}

function F({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 2: photos                                                     */
/* ------------------------------------------------------------------ */

function PhotoStep(props: {
  face: string | null;
  body: string | null;
  side: string | null;
  setFace: (s: string | null) => void;
  setBody: (s: string | null) => void;
  setSide: (s: string | null) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="wz-card">
      <div className="wz-photos">
        <Drop
          testId="face-input"
          label="Front portrait"
          required
          value={props.face}
          onChange={props.setFace}
          guide={<FaceGuide />}
          tips={["Camera ~1.5 m away at eye level (use zoom, not a close selfie)", "Neutral expression, mouth closed", "Even, soft front light; hair off the face", "Face the camera straight on"]}
        />
        <Drop
          testId="body-input"
          label="Full body"
          value={props.body}
          onChange={props.setBody}
          guide={<BodyGuide />}
          tips={["Head to toe in frame, facing the camera", "Arms slightly away from the body (A-pose)", "Fitted clothing or swimwear", "Camera at hip height, ~3 m away"]}
        />
        <Drop
          testId="side-input"
          label="Side (full body)"
          value={props.side}
          onChange={props.setSide}
          guide={<SideGuide />}
          optionalNote="Optional · unlocks side posture & core depth"
          tips={["Stand side-on to the camera, whole body in frame", "Arms relaxed at your sides, head level, eyes forward", "Camera at chest height, 2–3 m away", "Same clothing and spot as the front photo"]}
        />
        <div className="drop drop-soon">
          <div className="drop-empty">
            <BackGuide />
            <div className="drop-tips">
              <div className="title-md">Back (optional)</div>
              <span className="mono-sm">Coming soon</span>
              <ul>
                <li>Back view will add upper-back width, shoulder-blade position and spinal alignment.</li>
                <li>For now, front + side cover proportions, posture and core depth.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      <div className="wz-foot" style={{ marginTop: 18 }}>
        <button className="btn btn-ghost" onClick={props.onBack}>
          Back
        </button>
        <button className="btn" disabled={!props.face && !props.body} onClick={props.onNext}>
          Run analysis
        </button>
      </div>
    </div>
  );
}

function Drop({
  label,
  required,
  optionalNote,
  value,
  onChange,
  guide,
  tips,
  testId,
}: {
  optionalNote?: string;
  label: string;
  required?: boolean;
  value: string | null;
  onChange: (s: string | null) => void;
  guide: ReactNode;
  tips: string[];
  testId: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const take = async (f: File | undefined) => {
    if (!f || !f.type.startsWith("image/")) return;
    setBusy(true);
    try {
      onChange(await fileToDataUrl(f));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className={`drop ${value ? "has" : ""} ${over ? "over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files[0]);
      }}
    >
      <input ref={input} data-testid={testId} type="file" accept="image/*" onChange={(e) => take(e.target.files?.[0])} />
      {value ? (
        <div className="drop-preview">
          <img src={value} alt="" />
        </div>
      ) : (
        <div className="drop-empty" onClick={() => input.current?.click()} style={{ cursor: "pointer" }}>
          {guide}
          <div className="drop-tips">
            <div className="title-md">{label}</div>
            <span className="mono-sm">{required ? "Required" : optionalNote ?? "Optional · unlocks body analysis"}</span>
            <ul>
              {tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <div className="drop-bar">
        <span className="mono-sm">{busy ? "Preparing…" : value ? label : "Drop an image or browse"}</span>
        <div style={{ display: "flex", gap: 8 }}>
          {value && (
            <button className="btn btn-ghost" style={{ height: 30, fontSize: 12 }} onClick={() => onChange(null)}>
              Remove
            </button>
          )}
          <button className="btn btn-ghost" style={{ height: 30, fontSize: 12 }} onClick={() => input.current?.click()}>
            {value ? "Replace" : "Browse"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FaceGuide() {
  return (
    <svg className="guide" width="120" height="150" viewBox="0 0 120 150">
      <rect width="120" height="150" rx="12" fill="#a9bdc4" />
      <ellipse cx="60" cy="66" rx="30" ry="38" fill="none" stroke="#fff" strokeWidth="1.5" strokeDasharray="4 4" />
      <line x1="30" y1="62" x2="90" y2="62" stroke="#fff" strokeWidth="1" opacity=".7" />
      <line x1="60" y1="24" x2="60" y2="108" stroke="#fff" strokeWidth="1" opacity=".7" />
      <path d="M20 150c4-22 20-32 40-32s36 10 40 32" fill="rgba(255,255,255,.35)" />
    </svg>
  );
}
function BodyGuide() {
  return (
    <svg className="guide" width="120" height="150" viewBox="0 0 120 150">
      <rect width="120" height="150" rx="12" fill="#a9bdc4" />
      <g fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="4 4">
        <circle cx="60" cy="22" r="9" />
        <path d="M60 31v50M60 46l-24 22M60 46l24 22M60 81l-14 50M60 81l14 50" />
      </g>
      <line x1="30" y1="46" x2="90" y2="46" stroke="#fff" opacity=".6" />
      <line x1="40" y1="81" x2="80" y2="81" stroke="#fff" opacity=".6" />
    </svg>
  );
}

function SideGuide() {
  return (
    <svg className="guide" width="120" height="150" viewBox="0 0 120 150">
      <rect width="120" height="150" rx="12" fill="#a9bdc4" />
      <line x1="62" y1="8" x2="62" y2="142" stroke="#fff" opacity=".6" strokeDasharray="2 4" />
      <g fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="4 4">
        <circle cx="62" cy="22" r="9" />
        <path d="M62 31v50M62 46l2 34M62 81l-2 50" />
      </g>
      <circle cx="62" cy="22" r="2.4" fill="#fff" />
      <circle cx="62" cy="46" r="2.4" fill="#fff" />
      <circle cx="62" cy="81" r="2.4" fill="#fff" />
    </svg>
  );
}
function BackGuide() {
  return (
    <svg className="guide" width="120" height="150" viewBox="0 0 120 150" opacity=".55">
      <rect width="120" height="150" rx="12" fill="#c9d4d8" />
      <g fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="4 4">
        <circle cx="60" cy="22" r="9" />
        <path d="M60 31v50M60 46l-24 22M60 46l24 22M60 81l-14 50M60 81l14 50" />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 3: processing                                                 */
/* ------------------------------------------------------------------ */

const STAGES: { key: Stage; label: string; needs?: "face" | "body" }[] = [
  { key: "loading-models", label: "Loading on-device models" },
  { key: "face", label: "Mapping 478 facial landmarks", needs: "face" },
  { key: "skin", label: "Analysing skin regions", needs: "face" },
  { key: "body", label: "Measuring body silhouette (front & side)", needs: "body" },
  { key: "plan", label: "Building your evidence-based plan" },
];

function ProcessStep({
  intake,
  face,
  body,
  side,
  onBack,
  onDone,
}: {
  intake: Intake;
  face: string | null;
  body: string | null;
  side: string | null;
  onBack: () => void;
  onDone: (scan: Scan) => Promise<void>;
}) {
  const [stage, setStage] = useState<Stage>("loading-models");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const started = useRef(-1);

  useEffect(() => {
    if (started.current === attempt) return;
    started.current = attempt;
    setError(null);
    setStage("loading-models");
    runScan("pending", intake, face, body, setStage, side)
      .then(onDone)
      .catch((e) => {
      console.error(e);
      setError(e instanceof ScanError ? e.message : `Something went wrong while analysing: ${e?.message ?? e}`);
    });
  }, [attempt, intake, face, body, side, onDone]);

  const order = STAGES.map((s) => s.key);
  const idx = stage === "done" ? order.length : order.indexOf(stage);
  const visible = STAGES.filter((s) => !s.needs || (s.needs === "face" ? face : body));
  return (
    <div className="wz-card">
      <div className="proc">
        <div className="proc-photo">
          {(face ?? body) && <img src={(face ?? body)!} alt="" />}
          {!error && <div className="proc-scan" />}
        </div>
        <div className="proc-list">
          <div className="title-md" style={{ marginBottom: 6 }}>
            {error ? "Analysis stopped" : stage === "done" ? "Done" : "Analysing…"}
          </div>
          {visible.map((s) => {
            const i = order.indexOf(s.key);
            const state = error && i === idx ? "" : i < idx ? "done" : i === idx ? "active" : "";
            return (
              <div key={s.key} className={`proc-item ${state}`}>
                <span className="proc-dot">{state === "done" ? "✓" : ""}</span>
                {s.label}
              </div>
            );
          })}
          {error && (
            <>
              <div className="proc-err" role="alert">
                {error}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost" onClick={onBack}>
                  Change photos
                </button>
                <button className="btn" onClick={() => setAttempt((a) => a + 1)}>
                  Retry
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
