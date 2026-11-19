import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/ui";
import { fileToDataUrl, MIN_SHORT_SIDE, PhotoError, UNREADABLE_PHOTO } from "../lib/image";
import { runScan, ScanError, warmModels, type Stage } from "../lib/pipeline";
import { bodyInputError, BODY_LIMITS } from "../lib/nutrition";
import { addScan, createProfile, isSampleProfile, setActiveProfile, updateIntake, useAppState } from "../lib/store";
import { FACE_VIEWS, type FaceView, type Intake, type PhotoKind, type Scan } from "../lib/types";
import { BackendError, submitScan, updateMyProfile, type PhotoInput } from "../lib/backend";
import SUMMARY from "../lib/markers/summary.json";
import "./pages.css";

export const DEFAULT_INTAKE: Intake = {
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
const ORDER_STEPS = ["About you", "Photos", "Analysis", "Send for review"];

/**
 * Order mode (used by /orders/:orderId): the same guided capture and on-device
 * analysis, then the scan is also sent for review with submitScan instead of
 * only being saved on this device.
 */
export interface OrderScanMode {
  orderId: string;
  /** the scan was accepted: the order is now in review */
  onSubmitted: (res: { scanId: string; dueAt: string | null; localScanId: string }) => void;
  /** submit-scan says the photo consent or the withdrawal waiver is missing (or was withdrawn) */
  onConsentRequired: () => void;
  /** the order is no longer waiting for photos (already sent, refunded, ...) */
  onWrongStatus: () => void;
  /** change it to send again (e.g. after the photo consent was given) */
  retryKey?: number;
}

export const MIN_AGE = 18;
const MAX_AGE = 100;

type ModelState = "idle" | "loading" | "ready" | "failed";

export function NewScan({ order }: { order?: OrderScanMode } = {}) {
  const params = useParams();
  const profileId = order ? undefined : params.profileId;
  const s = useAppState();
  const nav = useNavigate();
  // the sample profile never takes a customer's scan: a "check-in" on it starts a new profile
  const existing = profileId && !isSampleProfile(profileId) ? s.profiles.find((p) => p.id === profileId && !p.sample) : undefined;
  const [step, setStep] = useState(0);
  // at launch the service is for men only, so an order's intake is always male
  const [intake, setIntake] = useState<Intake>(() => {
    const base: Intake = { ...DEFAULT_INTAKE, ...(existing?.intake ?? {}), ...(order ? { gender: "male" as const, pregnancy: undefined } : {}) };
    // the service is non-surgical: surgery is no longer offered as a preference (older profiles may still carry it)
    return base.preferences === "open-to-surgical" ? { ...base, preferences: "open-to-clinical" } : base;
  });
  const [saved, setSaved] = useState<{ scan: Scan; photos: Partial<Record<PhotoKind, PhotoInput>> } | null>(null);
  const steps = order ? ORDER_STEPS : STEPS;
  const [face, setFace] = useState<string | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const [side, setSide] = useState<string | null>(null);
  const [views, setViews] = useState<Partial<Record<FaceView, string>>>({});
  const [models, setModels] = useState<ModelState>("idle");

  // load the vision models only once the first photo is added (not when the page opens)
  const anyPhoto = !!(face || body || side || FACE_VIEWS.some((k) => views[k]));
  const needsBody = !!(body || side);
  useEffect(() => {
    if (!anyPhoto) return;
    let live = true;
    setModels((m) => (m === "ready" && !needsBody ? m : "loading"));
    warmModels(needsBody).then((ok) => {
      if (live) setModels(ok ? "ready" : "failed");
    });
    return () => {
      live = false;
    };
  }, [anyPhoto, needsBody]);

  return (
    <div className="page" style={{ maxWidth: 980 }}>
      <PageHeader
        kicker={order ? "Your order" : existing ? "Check-in" : "New analysis"}
        muted={order ? "Take your" : existing ? "New check-in for" : "Start your"}
        strong={order ? "photos" : existing ? existing.intake.name : "analysis"}
        lead={
          order
            ? "Your photos are analysed on this device first. When you send them, they are uploaded encrypted for your reviewer."
            : "Your photos are analysed on this device. Nothing is uploaded."
        }
      />
      <div className="wz-steps">
        {steps.map((label, i) => (
          <div key={label} className={`wz-step ${i < step ? "done" : i === step ? "on" : ""}`}>
            <div className="bar" />
            <span className="mono-sm">
              {String(i + 1).padStart(2, "0")} · {label}
            </span>
          </div>
        ))}
      </div>
      {step === 0 && <IntakeStep intake={intake} setIntake={setIntake} onNext={() => setStep(1)} fixedGender={!!order} />}
      {step === 1 && (
        <PhotoStep
          face={face}
          body={body}
          side={side}
          setFace={setFace}
          setBody={setBody}
          setSide={setSide}
          views={views}
          models={models}
          setView={(k, v) => setViews((cur) => ({ ...cur, [k]: v ?? undefined }))}
          faceRequired={!!order}
          onBack={() => setStep(0)}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <ProcessStep
          intake={intake}
          face={face}
          body={body}
          side={side}
          views={views}
          onBack={() => setStep(1)}
          onDone={async (scan) => {
            // the profile is only created once the scan succeeded, so failed attempts leave nothing behind
            let pid = existing?.id;
            if (pid) updateIntake(pid, intake);
            else pid = createProfile(intake).id;
            const got = FACE_VIEWS.filter((k) => views[k]);
            const local = { ...scan, profileId: pid, views: got };
            await addScan(local, face, body, side, views);
            setActiveProfile(pid);
            if (!order) {
              nav("/analysis/getting-started");
              return;
            }
            // order mode: keep a copy on this device (for the report viewer), then send it for review
            const photos: Partial<Record<PhotoKind, PhotoInput>> = {};
            if (face) photos.face = face;
            if (body) photos.body = body;
            if (side) photos.side = side;
            for (const k of got) photos[k] = views[k]!;
            setSaved({ scan: local, photos });
            setStep(3);
          }}
        />
      )}
      {step === 3 && order && saved && (
        <SubmitStep order={order} scan={saved.scan} photos={saved.photos} intake={intake} onChangePhotos={() => setStep(1)} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 1: intake                                                     */
/* ------------------------------------------------------------------ */

function IntakeStep({ intake, setIntake, onNext, fixedGender = false }: { intake: Intake; setIntake: (i: Intake) => void; onNext: () => void; fixedGender?: boolean }) {
  const set = <K extends keyof Intake>(k: K, v: Intake[K]) => setIntake({ ...intake, [k]: v });
  const num = (v: string) => (v === "" ? null : Number(v));
  const nameOk = intake.name.trim().length > 0;
  const ageOk = Number.isFinite(intake.age) && intake.age >= MIN_AGE && intake.age <= MAX_AGE;
  const bodyErr = bodyInputError(intake.heightCm, intake.weightKg);
  const valid = nameOk && ageOk && !bodyErr;
  const problem = !nameOk
    ? "Please add your name."
    : !ageOk
      ? intake.age < MIN_AGE
        ? `You need to be ${MIN_AGE} or older to use this service.`
        : `Please enter an age between ${MIN_AGE} and ${MAX_AGE}.`
      : bodyErr;
  const [hMin, hMax] = BODY_LIMITS.heightCm;
  const [wMin, wMax] = BODY_LIMITS.weightKg;
  return (
    <div className="wz-card">
      <Section title="Basics">
        <F label="Name">
          <input value={intake.name} onChange={(e) => set("name", e.target.value)} placeholder="Your name" autoComplete="given-name" />
        </F>
        <F label="Age" hint={`${MIN_AGE}+ only`} error={!ageOk ? (intake.age < MIN_AGE ? `You need to be ${MIN_AGE} or older.` : `Enter an age between ${MIN_AGE} and ${MAX_AGE}.`) : undefined}>
          <input type="number" min={MIN_AGE} max={MAX_AGE} value={Number.isFinite(intake.age) ? intake.age : ""} onChange={(e) => set("age", e.target.value === "" ? NaN : Number(e.target.value))} />
        </F>
        {!fixedGender && (
        <F label="Gender">
          <select
            value={intake.gender}
            onChange={(e) => {
              const gender = e.target.value as Intake["gender"];
              setIntake({ ...intake, gender, pregnancy: gender === "female" ? intake.pregnancy : undefined });
            }}
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other / prefer not to say</option>
          </select>
        </F>
        )}
        {intake.gender === "female" && (
          <F label="Pregnancy or breastfeeding" hint="Some skin and hair treatments aren't used during pregnancy or breastfeeding; we adjust your plan">
            <select value={intake.pregnancy ?? "no"} onChange={(e) => set("pregnancy", e.target.value as Intake["pregnancy"])}>
              <option value="no">Neither</option>
              <option value="trying">Trying to conceive</option>
              <option value="pregnant">Pregnant</option>
              <option value="breastfeeding">Breastfeeding</option>
            </select>
          </F>
        )}
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
        <F label="Height (cm)" hint={`${hMin}–${hMax} cm`} error={bodyErr && /Height/.test(bodyErr) ? bodyErr : undefined}>
          <input type="number" inputMode="decimal" min={hMin} max={hMax} value={intake.heightCm ?? ""} onChange={(e) => set("heightCm", num(e.target.value))} />
        </F>
        <F label="Weight (kg)" hint={`${wMin}–${wMax} kg`} error={bodyErr && !/Height/.test(bodyErr) ? bodyErr : undefined}>
          <input type="number" inputMode="decimal" min={wMin} max={wMax} value={intake.weightKg ?? ""} onChange={(e) => set("weightKg", num(e.target.value))} />
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
            <option value="straight">Straight — no bend (1)</option>
            <option value="wavy">Wavy — loose S-bends (2A–2C)</option>
            <option value="curly">Curly — springy loops or spirals (3A–3C)</option>
            <option value="coily">Coily — tight coils or zig-zags (4A–4C)</option>
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
        <span className="lead" style={{ fontSize: 12 }} role="status" aria-live="polite">
          {problem ?? ""}
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

const CONTROLS = new Set(["input", "select", "textarea"]);

/** Form field: links the label (and hint / error) to a single input, select or textarea child. */
function F({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const control = isValidElement(children) && typeof children.type === "string" && CONTROLS.has(children.type);
  const described = [hint && hintId, error && errId].filter(Boolean).join(" ") || undefined;
  const child = control
    ? cloneElement(children as ReactElement<Record<string, unknown>>, { id, "aria-describedby": described, "aria-invalid": error ? true : undefined })
    : children;
  return (
    <div className="field">
      {control ? <label htmlFor={id}>{label}</label> : <label id={id}>{label}</label>}
      {child}
      {hint && (
        <span className="hint" id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className="hint" id={errId} role="alert" style={{ color: "#7a3b2e" }}>
          {error}
        </span>
      )}
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
  views: Partial<Record<FaceView, string>>;
  models: ModelState;
  setView: (k: FaceView, v: string | null) => void;
  /** order mode: the reviewer needs the front portrait */
  faceRequired?: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const canRun = props.faceRequired ? !!props.face : !!(props.face || props.body);
  return (
    <div className="wz-card">
      <div className="wz-photos">
        <Drop
          testId="face-input"
          label="Front portrait"
          optionalNote={props.faceRequired ? "Required" : "Needed for face analysis · add this or a full body photo"}
          value={props.face}
          onChange={props.setFace}
          guide={<FaceGuide />}
          tips={["Camera ~1.5 m away at eye level (use zoom, not a close selfie)", "Neutral expression, mouth closed", "Even, soft front light; hair off the face (only so we can measure — style advice assumes how you normally wear it)", "Face the camera straight on"]}
        />
        <Drop
          testId="body-input"
          label="Full body"
          value={props.body}
          onChange={props.setBody}
          guide={<BodyGuide />}
          optionalNote="Optional · unlocks body analysis"
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
      <div className="wz-views-head">
        <div>
          <div className="title-md">Face views &amp; expressions</div>
          <p className="lead" style={{ margin: "4px 0 0" }}>
            {`Optional, but each one unlocks more of the ${SUMMARY.total} markers. Same light and spot as your front portrait, camera at eye level, about 1.5 m away.`}
          </p>
        </div>
        <span className="mono-sm">
          {FACE_VIEWS.filter((k) => props.views[k]).length} / {FACE_VIEWS.length} added
        </span>
      </div>
      <div className="wz-photos wz-views">
        {VIEW_SPECS.map((v) => (
          <Drop
            key={v.kind}
            testId={`${v.kind}-input`}
            label={v.label}
            value={props.views[v.kind] ?? null}
            onChange={(x) => props.setView(v.kind, x)}
            guide={<ViewGuide kind={v.kind} />}
            optionalNote={`Optional · unlocks ${v.unlocks}`}
            tips={v.tips}
          />
        ))}
      </div>
      <div className="wz-foot" style={{ marginTop: 18 }}>
        <button className="btn btn-ghost" onClick={props.onBack}>
          Back
        </button>
        <span className="lead" style={{ fontSize: 12 }} role="status" aria-live="polite">
          {!canRun
            ? props.faceRequired
              ? "Add a front portrait to continue."
              : "Add a front portrait or a full body photo to continue."
            : props.models === "loading"
              ? "Preparing on-device analysis…"
              : props.models === "ready"
                ? "On-device analysis ready."
                : props.models === "failed"
                  ? "The analysis models couldn't load. Check your internet connection, then reload the page to try again."
                  : ""}
        </span>
        <button className="btn" disabled={!canRun} onClick={props.onNext}>
          Run analysis
        </button>
      </div>
    </div>
  );
}

const HEIC = /\.(heic|heif)$/i;

function Drop({
  label,
  optionalNote,
  value,
  onChange,
  guide,
  tips,
  testId,
}: {
  optionalNote?: string;
  label: string;
  value: string | null;
  onChange: (s: string | null) => void;
  guide: ReactNode;
  tips: string[];
  testId: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const take = async (f: File | undefined) => {
    if (!f) return;
    // some browsers give HEIC files an empty type; let the decoder try and explain if it can't
    if (!f.type.startsWith("image/") && !HEIC.test(f.name)) {
      setError("That file isn't a photo. Use a JPG or PNG image.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onChange(await fileToDataUrl(f, 1400, MIN_SHORT_SIDE));
    } catch (e) {
      setError(e instanceof PhotoError ? e.message : UNREADABLE_PHOTO);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  const browse = () => input.current?.click();
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
      <input ref={input} data-testid={testId} type="file" accept="image/*,.heic,.heif" aria-label={`${label} photo`} onChange={(e) => take(e.target.files?.[0])} />
      {value ? (
        <div className="drop-preview">
          <img src={value} alt={`${label} photo you added`} />
        </div>
      ) : (
        <div
          className="drop-empty"
          role="button"
          tabIndex={0}
          aria-label={`Add ${label} photo`}
          onClick={browse}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              browse();
            }
          }}
          style={{ cursor: "pointer" }}
        >
          {guide}
          <div className="drop-tips">
            <div className="title-md">{label}</div>
            <span className="mono-sm">{optionalNote ?? "Optional"}</span>
            <ul>
              {tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {error && (
        <div className="proc-err" role="alert" style={{ margin: "8px 12px 0" }}>
          {error}
        </div>
      )}
      <div className="drop-bar">
        <span className="mono-sm">{busy ? "Preparing…" : value ? label : "Drop an image or browse"}</span>
        <div style={{ display: "flex", gap: 8 }}>
          {value && (
            <button
              className="btn btn-ghost"
              style={{ height: 30, fontSize: 12 }}
              aria-label={`Remove ${label} photo`}
              onClick={() => {
                setError(null);
                onChange(null);
              }}
            >
              Remove
            </button>
          )}
          <button className="btn btn-ghost" style={{ height: 30, fontSize: 12 }} aria-label={`${value ? "Replace" : "Browse for"} ${label} photo`} onClick={browse}>
            {value ? "Replace" : "Browse"}
          </button>
        </div>
      </div>
    </div>
  );
}

const VIEW_SPECS: { kind: FaceView; label: string; unlocks: string; tips: string[] }[] = [
  {
    kind: "faceLeft",
    label: "Left profile",
    unlocks: `${SUMMARY.profile} profile markers`,
    tips: ["Turn your whole head 90° so the camera sees one side only", "Head level: eyes looking at the horizon, not up or down", "Hair behind the ear; jaw and neck visible", "Plain wall behind you"],
  },
  {
    kind: "faceRight",
    label: "Right profile",
    unlocks: "a left–right comparison",
    tips: ["Same as the left profile, the other way", "Keep the same distance and height", "Neutral face, lips closed"],
  },
  {
    kind: "face45",
    label: "Three-quarter (45°)",
    unlocks: `${SUMMARY.face45} cheek and jawline markers`,
    tips: ["Turn your head halfway, about 45°", "Both eyes still visible", "Neutral expression, lips closed"],
  },
  {
    kind: "smile",
    label: "Natural smile",
    unlocks: `${SUMMARY.smile} smile markers`,
    tips: ["Facing the camera, a full natural smile showing your teeth", "Same distance as the front portrait", "Head level"],
  },
  {
    kind: "frown",
    label: "Frown",
    unlocks: "frown-line grading",
    tips: ["Facing the camera", "Pull your brows together as if concentrating hard", "Hold for the photo"],
  },
  {
    kind: "browRaise",
    label: "Raised brows",
    unlocks: "forehead-line grading",
    tips: ["Facing the camera", "Raise your eyebrows as high as you can", "Hair off the forehead"],
  },
];

function ViewGuide({ kind }: { kind: FaceView }) {
  const head =
    kind === "faceLeft" || kind === "faceRight" ? (
      <path
        d="M70 34c-14-6-34 2-36 22-1 8 1 14 0 20l-6 10 7 2c-1 6 2 9 7 9l-1 6c2 3 6 4 10 3 6 0 10 6 10 14"
        transform={kind === "faceRight" ? "translate(120 0) scale(-1 1)" : undefined}
      />
    ) : kind === "face45" ? (
      <ellipse cx="62" cy="66" rx="26" ry="36" transform="rotate(-8 62 66)" />
    ) : (
      <ellipse cx="60" cy="66" rx="28" ry="37" />
    );
  const face =
    kind === "smile" ? (
      <path d="M48 82q12 10 24 0" />
    ) : kind === "frown" ? (
      <path d="M48 52l10 4M72 52l-10 4M50 86q10-5 20 0" />
    ) : kind === "browRaise" ? (
      <path d="M46 44q8-6 14-2M74 44q-8-6-14-2M52 34h16M50 38h20" />
    ) : null;
  return (
    <svg className="guide" width="120" height="150" viewBox="0 0 120 150" aria-hidden="true">
      <rect width="120" height="150" rx="12" fill="#74464f" />
      <g fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeDasharray={face ? undefined : "4 4"}>
        {head}
        {face}
      </g>
      <line x1="10" y1="62" x2="110" y2="62" stroke="#fff" strokeWidth="1" opacity=".35" />
    </svg>
  );
}

function FaceGuide() {
  return (
    <svg className="guide" width="120" height="150" viewBox="0 0 120 150">
      <rect width="120" height="150" rx="12" fill="#74464f" />
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
      <rect width="120" height="150" rx="12" fill="#74464f" />
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
      <rect width="120" height="150" rx="12" fill="#74464f" />
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
      <rect width="120" height="150" rx="12" fill="#9f626f" />
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

const STAGES: { key: Stage; label: string; needs?: "face" | "body" | "profile" }[] = [
  { key: "loading-models", label: "Loading on-device models" },
  { key: "face", label: "Mapping 478 facial landmarks", needs: "face" },
  { key: "skin", label: "Analysing skin regions", needs: "face" },
  { key: "profile", label: "Tracing your side profile", needs: "profile" },
  { key: "body", label: "Measuring body silhouette (front & side)", needs: "body" },
  { key: "plan", label: "Building your evidence-based plan" },
];

function ProcessStep({
  intake,
  face,
  body,
  side,
  views,
  onBack,
  onDone,
}: {
  intake: Intake;
  face: string | null;
  body: string | null;
  side: string | null;
  views: Partial<Record<FaceView, string>>;
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
    runScan("pending", intake, face, body, setStage, side, views)
      .then(onDone)
      .catch((e) => {
      console.error(e);
      setError(e instanceof ScanError ? e.message : `Something went wrong while analysing: ${e?.message ?? e}`);
    });
  }, [attempt, intake, face, body, side, onDone]);

  const order = STAGES.map((s) => s.key);
  const idx = stage === "done" ? order.length : order.indexOf(stage);
  const visible = STAGES.filter((s) => !s.needs || (s.needs === "face" ? face : s.needs === "profile" ? views.faceLeft || views.faceRight : body));
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

/* ------------------------------------------------------------------ */
/*  Step 4 (order mode): send for review                               */
/* ------------------------------------------------------------------ */

type SubmitState =
  | { kind: "sending"; done: number; total: number }
  | { kind: "retrying"; inSeconds: number }
  | { kind: "error"; code: string; message: string }
  | { kind: "done" };

/** Automatic retries for failures without a definite answer (network, 5xx); 4xx answers are final. */
const RETRY_DELAYS_S = [2, 5];

function SubmitStep({
  order,
  scan,
  photos,
  intake,
  onChangePhotos,
}: {
  order: OrderScanMode;
  scan: Scan;
  photos: Partial<Record<PhotoKind, PhotoInput>>;
  intake: Intake;
  onChangePhotos: () => void;
}) {
  const total = Object.keys(photos).length;
  const [state, setState] = useState<SubmitState>({ kind: "sending", done: 0, total });
  const [attempt, setAttempt] = useState(0);
  const orderRef = useRef(order);
  orderRef.current = order;

  // A repeated run (e.g. a development double effect) joins the upload in flight: submitScan de-duplicates per order.
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async (tryNo: number, fixedProfile: boolean): Promise<void> => {
      setState({ kind: "sending", done: 0, total });
      try {
        const res = await submitScan(order.orderId, scan, photos, {
          intake,
          onProgress: (done, t) => live && setState({ kind: "sending", done, total: t }),
        });
        if (!live) return;
        setState({ kind: "done" });
        orderRef.current.onSubmitted({ ...res, localScanId: scan.id });
      } catch (e) {
        if (!live) return;
        const code = e instanceof BackendError ? e.code : "";
        const status = e instanceof BackendError ? e.status : undefined;
        if (code === "profile_incomplete" && !fixedProfile) {
          // only men can order at launch, and the intake says so: complete the profile and try again
          try {
            await updateMyProfile({ gender: "male" });
            return run(tryNo, true);
          } catch {
            /* fall through to the message */
          }
        }
        const definite = (status !== undefined && status >= 400 && status < 500) || KNOWN_FINAL.has(code);
        if (!definite && tryNo < RETRY_DELAYS_S.length) {
          const wait = RETRY_DELAYS_S[tryNo];
          setState({ kind: "retrying", inSeconds: wait });
          timer = setTimeout(() => live && run(tryNo + 1, fixedProfile), wait * 1000);
          return;
        }
        console.warn("submitScan failed", e);
        setState({ kind: "error", code, message: submitMessage(code) });
      }
    };
    run(0, false);
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, order.retryKey]);

  const face = typeof photos.face === "string" ? photos.face : null;
  return (
    <div className="wz-card">
      <div className="proc">
        <div className="proc-photo">
          {face && <img src={face} alt="" />}
          {state.kind === "sending" && <div className="proc-scan" />}
        </div>
        <div className="proc-list" role="status" aria-live="polite">
          <div className="title-md" style={{ marginBottom: 6 }}>
            {state.kind === "error" ? "Not sent yet" : state.kind === "done" ? "Sent for review" : "Sending your photos…"}
          </div>
          {state.kind === "sending" && (
            <p className="lead">{state.done > 0 ? `Uploaded ${state.done} of ${state.total} photos` : "Uploading encrypted to our servers in the EU."}</p>
          )}
          {state.kind === "retrying" && <p className="lead">{`The connection dropped. Trying again in ${state.inSeconds} seconds…`}</p>}
          {state.kind === "done" && <p className="lead">Your reviewer has your photos and results.</p>}
          {state.kind === "error" && (
            <>
              <div className="proc-err" role="alert">
                {state.message}
              </div>
              <p className="lead" style={{ fontSize: 12 }}>
                Your analysis is saved on this device, so you don't need to take the photos again.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {state.code === "photo_consent_required" || state.code === "withdrawal_waiver_required" ? (
                  <button className="btn" onClick={order.onConsentRequired}>
                    {state.code === "withdrawal_waiver_required" ? "Confirm the start of your review" : "Review the photo consent"}
                  </button>
                ) : state.code === "wrong_status" ? (
                  <button className="btn" onClick={order.onWrongStatus}>
                    Back to my order
                  </button>
                ) : state.code === "photo_missing" || state.code === "photos_missing" || state.code === "bad_photo_path" || state.code === "photo_unreadable" ? (
                  <button className="btn" onClick={onChangePhotos}>
                    Change photos
                  </button>
                ) : (
                  <button className="btn" onClick={() => setAttempt((a) => a + 1)}>
                    Try again
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const KNOWN_FINAL = new Set(["photo_consent_required", "withdrawal_waiver_required", "profile_incomplete", "wrong_status", "photo_missing", "photos_missing", "bad_photo_path", "photo_unreadable", "not_found", "not_signed_in"]);

function submitMessage(code: string): string {
  switch (code) {
    case "photo_consent_required":
      return "We need your photo consent before we can receive your photos.";
    case "withdrawal_waiver_required":
      return "Before we start your review, please confirm that you want us to start now.";
    case "profile_incomplete":
      return "Your profile is missing some details. Please try again, or contact us if this keeps happening.";
    case "wrong_status":
      return "This order is no longer waiting for photos.";
    case "photo_missing":
    case "photos_missing":
      return "The front portrait is required.";
    case "bad_photo_path":
      return "A photo could not be stored. Please take the photos again.";
    case "photo_unreadable":
      return "A photo could not be read. Please retake it.";
    case "not_found":
      return "We could not find this order in your account.";
    case "not_signed_in":
      return "Please sign in again, then try again.";
    case "upload_failed":
      return "The upload did not finish. Check your connection and try again.";
    default:
      return "Sending did not work. Check your connection and try again.";
  }
}
