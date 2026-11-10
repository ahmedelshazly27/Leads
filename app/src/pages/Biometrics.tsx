import { useNavigate } from "react-router-dom";
import { Empty, PageHeader } from "../components/ui";
import { Download } from "../components/icons";
import { useActive } from "../lib/useActive";
import type { Scan } from "../lib/types";
import "./pages.css";

interface Row {
  key: string;
  label: string;
  unit?: string;
  norm?: string;
  digits?: number;
}

const FACE_ROWS: { group: string; rows: Row[] }[] = [
  {
    group: "Proportions",
    rows: [
      { key: "faceWHR", label: "Face width ÷ height", norm: "≈ 0.86 ± 0.06", digits: 3 },
      { key: "fWHR", label: "Facial width-to-height ratio (fWHR)", norm: "1.7–2.1", digits: 3 },
      { key: "midToLowerThird", label: "Middle ÷ lower third", norm: "≈ 1.0", digits: 3 },
      { key: "lipChinRatio", label: "Upper lip ÷ chin height", norm: "≈ 0.5", digits: 3 },
      { key: "eyeSpacingRatio", label: "Intercanthal ÷ eye width", norm: "canon ≈ 1.0; Saudi ≈ 0.92–0.94", digits: 3 },
      { key: "eyeWidthToFace", label: "Eye width ÷ face width", norm: "≈ 0.20", digits: 3 },
      { key: "noseWidthToIntercanthal", label: "Nose width ÷ intercanthal", norm: "canon ≈ 1.0; Saudi 1.22 men, 1.08 women", digits: 3 },
      { key: "noseLengthToFace", label: "Nose length ÷ face height", norm: "≈ 0.33", digits: 3 },
      { key: "mouthToNoseWidth", label: "Mouth ÷ nose width", norm: "≈ 1.5", digits: 3 },
      { key: "jawToFaceWidth", label: "Jaw ÷ face width", norm: "≈ 0.80", digits: 3 },
      { key: "chinWidthToMouth", label: "Chin ÷ mouth width", digits: 3 },
      { key: "foreheadToFaceWidth", label: "Forehead ÷ face width", norm: "≈ 0.82", digits: 3 },
    ],
  },
  {
    group: "Features",
    rows: [
      { key: "canthalTilt", label: "Canthal tilt", unit: "°", norm: "+2° to +6°", digits: 1 },
      { key: "eyeAspect", label: "Eye height ÷ width", digits: 3 },
      { key: "browArch", label: "Brow arch (rise ÷ length)", digits: 3 },
      { key: "browPeak", label: "Brow peak position (inner → outer)", digits: 2 },
      { key: "browThickness", label: "Brow thickness ÷ length", digits: 3 },
      { key: "browTilt", label: "Brow tilt", unit: "°", digits: 1 },
      { key: "browEyeDistance", label: "Brow-to-canthus ÷ eye width", digits: 3 },
      { key: "lipRatio", label: "Upper ÷ lower lip", norm: "1 : 2 rated most attractive; averages ≈ 0.84–0.93", digits: 3 },
      { key: "lipFullness", label: "Lip height ÷ mouth width", digits: 3 },
      { key: "mouthCornerTilt", label: "Mouth-corner tilt", unit: "°", digits: 1 },
    ],
  },
  {
    group: "Composite indices",
    rows: [
      { key: "symmetry", label: "Symmetry", unit: "/100", norm: "> 85 highly symmetric", digits: 0 },
      { key: "averageness", label: "Averageness", unit: "/100", digits: 0 },
      { key: "dimorphism", label: "Dimorphism (0 fem. → 1 masc.)", digits: 2 },
      { key: "neoteny", label: "Neoteny", unit: "/100", digits: 0 },
      { key: "adiposity", label: "Facial adiposity", unit: "/100", digits: 0 },
      { key: "contrast", label: "Facial contrast", unit: "/100", digits: 0 },
      { key: "skinScore", label: "Skin score", unit: "/100", digits: 0 },
    ],
  },
];

const BODY_ROWS: Row[] = [
  { key: "shoulderToWaist", label: "Shoulder ÷ waist width", norm: "≈ 1.6 men · ≈ 1.35 women", digits: 2 },
  { key: "waistToHip", label: "Waist ÷ hip width (frontal)", digits: 2 },
  { key: "whrTape", label: "Waist ÷ hip circumference (tape)", norm: "WHO risk ≥ 0.90 men / ≥ 0.85 women", digits: 2 },
  { key: "whtr", label: "Waist ÷ height (tape)", norm: "< 0.5", digits: 2 },
  { key: "shoulderWidth", label: "Shoulder width ÷ torso length", digits: 3 },
  { key: "waistWidth", label: "Waist width ÷ torso length", digits: 3 },
  { key: "hipWidth", label: "Hip width ÷ torso length", digits: 3 },
  { key: "legToHeight", label: "Leg ÷ height", norm: "≈ 0.47–0.50", digits: 3 },
  { key: "torsoToLeg", label: "Torso ÷ leg", digits: 3 },
  { key: "shoulderTilt", label: "Shoulder-line tilt", unit: "°", norm: "≈ 0°", digits: 1 },
  { key: "hipTilt", label: "Pelvis-line tilt", unit: "°", norm: "≈ 0°", digits: 1 },
  { key: "headOffset", label: "Head offset from midline", unit: "%", norm: "≈ 0%", digits: 1 },
  { key: "armSymmetry", label: "Arm length symmetry", unit: "/100", digits: 0 },
  { key: "bmi", label: "BMI", unit: "kg/m²", norm: "18.5–24.9", digits: 1 },
  { key: "bodyFatEstimate", label: "Body fat (estimate)", unit: "%", norm: "≈ 10–18% men · 18–26% women", digits: 1 },
  { key: "postureScore", label: "Posture score", unit: "/100", digits: 0 },
  { key: "proportionScore", label: "Proportion score", unit: "/100", digits: 0 },
  { key: "compositionScore", label: "Composition score", unit: "/100", digits: 0 },
];

const fmt = (v: unknown, r: Row) => (typeof v === "number" && isFinite(v) ? v.toFixed(r.digits ?? 2) + (r.unit ? ` ${r.unit}` : "") : "—");
const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });

export function Biometrics() {
  const { profile, scan, scans } = useActive();
  const nav = useNavigate();
  if (!profile || !scan)
    return (
      <div className="page">
        <Empty title="No scans yet">
          <button className="btn" onClick={() => nav("/new")}>
            Start an analysis
          </button>
        </Empty>
      </div>
    );
  const history = scans.length > 1 ? scans : [];
  const face = scan.face?.metrics as unknown as Record<string, number> | undefined;
  const body = scan.body?.metrics as unknown as Record<string, number> | undefined;
  const affected = new Set(scan.face?.capture?.affected ?? []);

  const csv = () => {
    const lines = [["section", "metric", "unit", "reference", ...scans.map((s) => s.createdAt)].join(",")];
    const add = (section: string, r: Row, get: (s: Scan) => unknown) =>
      lines.push([section, `"${r.label}"`, r.unit ?? "", `"${r.norm ?? ""}"`, ...scans.map((s) => String(get(s) ?? ""))].join(","));
    FACE_ROWS.forEach((g) => g.rows.forEach((r) => add(g.group, r, (s) => (s.face?.metrics as unknown as Record<string, number> | undefined)?.[r.key])));
    BODY_ROWS.forEach((r) => add("Body", r, (s) => (s.body?.metrics as unknown as Record<string, unknown> | undefined)?.[r.key]));
    scan.face?.skin.forEach((sk) =>
      (["coverage", "evenness", "redness", "texture"] as const).forEach((k) =>
        add("Skin", { key: k, label: `${sk.key} ${k}` }, (s) => s.face?.skin.find((x) => x.key === sk.key)?.[k]),
      ),
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${profile.intake.name.replace(/\s+/g, "_")}_biometrics.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="page">
      <PageHeader
        kicker="Measurements"
        muted="Every"
        strong="measurement"
        lead="Each number behind your report, its published reference range and the study it comes from. Compare check-ins to track change."
        right={
          <button className="btn btn-ghost" onClick={csv}>
            <Download size={15} /> Download CSV
          </button>
        }
      />

      {scan.face && (
        <div className="bt-card">
          <h2 className="title-md">Capture quality</h2>
          <table className="bt">
            <colgroup>
              <col style={{ width: "38%" }} />
              <col style={{ width: "22%" }} />
              <col />
            </colgroup>
            <tbody>
              <tr>
                <td>Head turn (yaw)</td>
                <td className="num">{scan.face.capture.yaw.toFixed(1)}°</td>
                <td className="norm">&lt; 5° ideal</td>
              </tr>
              <tr>
                <td>Head nod (pitch)</td>
                <td className="num">{scan.face.capture.pitch.toFixed(1)}°</td>
                <td className="norm">&lt; 10°</td>
              </tr>
              <tr>
                <td>Head tilt (roll, corrected)</td>
                <td className="num">{scan.face.capture.roll.toFixed(1)}°</td>
                <td className="norm">corrected automatically</td>
              </tr>
              <tr>
                <td>Face width ÷ image width</td>
                <td className="num">{(scan.face.capture.faceWidthFrac * 100).toFixed(0)}%</td>
                <td className="norm">&gt; 42% suggests a close-range selfie</td>
              </tr>
            </tbody>
          </table>
          {scan.face.capture.warnings.map((w) => (
            <p key={w} className="lead" style={{ fontSize: 12, margin: "8px 0 10px" }}>
              ⚠ {w}
            </p>
          ))}
        </div>
      )}

      {face &&
        FACE_ROWS.map((g) => (
          <MetricTable
            key={g.group}
            title={`Face · ${g.group}`}
            rows={g.rows}
            value={(r) => face[r.key]}
            history={history}
            hist={(s, r) => (s.face?.metrics as unknown as Record<string, number> | undefined)?.[r.key]}
            flag={(r) => affected.has(r.key)}
          />
        ))}

      {scan.face && (
        <div className="bt-card">
          <h2 className="title-md">Skin regions</h2>
          <table className="bt">
            <thead>
              <tr>
                <th>Region</th>
                <th>Flagged coverage</th>
                <th>Evenness</th>
                <th>Redness</th>
                <th>Texture</th>
              </tr>
            </thead>
            <tbody>
              {scan.face.skin.map((r) => (
                <tr key={r.key}>
                  <td>{REGION[r.key] ?? r.key}</td>
                  <td className="num">{(r.coverage * 100).toFixed(1)}%</td>
                  <td className="num">{r.evenness.toFixed(0)} /100</td>
                  <td className="num">{r.redness.toFixed(0)} /100</td>
                  <td className="num">{r.texture.toFixed(0)} /100</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {body && (
        <MetricTable
          title="Body"
          rows={BODY_ROWS}
          value={(r) => body[r.key]}
          history={history}
          hist={(s, r) => (s.body?.metrics as unknown as Record<string, number> | undefined)?.[r.key]}
          extra={
            scan.body!.metrics.bodyFatMethod
              ? `Body fat via ${scan.body!.metrics.bodyFatMethod === "navy" ? "US Navy circumference method" : "Deurenberg BMI equation"}.`
              : "Add height, weight and tape measurements for body-fat estimates."
          }
        />
      )}
    </div>
  );
}

const REGION: Record<string, string> = {
  forehead: "Forehead",
  leftCheek: "Left cheek",
  rightCheek: "Right cheek",
  nose: "Nose",
  underEye: "Under-eye",
  chin: "Chin",
};

function MetricTable({
  title,
  rows,
  value,
  history,
  hist,
  flag,
  extra,
}: {
  title: string;
  rows: Row[];
  value: (r: Row) => unknown;
  history: Scan[];
  hist: (s: Scan, r: Row) => unknown;
  flag?: (r: Row) => boolean;
  extra?: string;
}) {
  return (
    <div className="bt-card">
      <h2 className="title-md">{title}</h2>
      {extra && (
        <p className="lead" style={{ fontSize: 12, margin: "-4px 0 8px" }}>
          {extra}
        </p>
      )}
      <table className="bt">
        <thead>
          <tr>
            <th style={{ width: "38%" }}>Metric</th>
            {history.length ? history.map((s) => <th key={s.id}>{shortDate(s.createdAt)}</th>) : <th>Value</th>}
            {history.length > 1 && <th>Change</th>}
            <th>Reference</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const first = history.length ? hist(history[0], r) : undefined;
            const last = history.length ? hist(history[history.length - 1], r) : undefined;
            const delta = typeof first === "number" && typeof last === "number" ? last - first : null;
            return (
              <tr key={r.key}>
                <td>
                  {r.label}
                  {flag?.(r) && <span className="flag" title="Affected by photo conditions">photo</span>}
                </td>
                {history.length ? (
                  history.map((s) => (
                    <td key={s.id} className="num">
                      {fmt(hist(s, r), r)}
                    </td>
                  ))
                ) : (
                  <td className="num">{fmt(value(r), r)}</td>
                )}
                {history.length > 1 && (
                  <td className={`num ${delta && delta > 0 ? "delta-up" : delta && delta < 0 ? "delta-down" : ""}`}>
                    {delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(r.digits ?? 2)}`}
                  </td>
                )}
                <td className="norm">{r.norm ?? ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

