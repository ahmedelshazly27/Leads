import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/ui";
import { makeFrame } from "../../lib/faceAnalysis";
import { frontalMarkers, type MarkerValue } from "../../lib/markers/frontal";
import { place, type Status } from "../../lib/markers/norms";
import type { FaceView, Scan } from "../../lib/types";
import type { SectionProps } from "./types";
import "./allMarkers.css";

/** One row of research_notes/marker_catalogue, as built into catalog.json. */
interface Row {
  id: string;
  region: string;
  name: string;
  definition?: string;
  photo?: string;
  formula?: string;
  normMale?: string;
  normFemale?: string;
  norms?: string;
  ethnicNorms?: string;
  perception?: string;
  sources?: string;
  methodKind: "auto" | "semi" | "review";
  catalogue: "frontal" | "profile" | "skin";
}

const REGION_ORDER = ["proportions", "eyes", "eyebrows", "nose", "lips", "cheeks", "jaw & chin", "ears", "profile", "neck", "smile", "45° view", "skin", "eye appearance", "global constructs"];
const REGION_LABEL: Record<string, string> = {
  proportions: "Proportions",
  eyes: "Eyes",
  eyebrows: "Eyebrows",
  nose: "Nose",
  lips: "Lips & mouth",
  cheeks: "Cheeks & midface",
  "jaw & chin": "Jaw & chin",
  ears: "Ears",
  profile: "Side profile",
  neck: "Neck",
  smile: "Smile",
  "45° view": "Three-quarter view",
  skin: "Skin",
  "eye appearance": "Eye appearance",
  "global constructs": "Overall impressions",
};

type State = "measured" | "photo" | "covered" | "review" | "soon";

/** Which extra photo a catalogue row needs, from its "photo" column. */
function needsView(photo = ""): FaceView | null {
  const p = photo.toLowerCase();
  if (p.includes("45") || p.includes("three-quarter") || p.includes("oblique")) return "face45";
  if (p.includes("profile")) return "faceLeft";
  if (p.includes("smile")) return "smile";
  if (p.includes("frown")) return "frown";
  if (p.includes("raise")) return "browRaise";
  return null;
}
const VIEW_LABEL: Record<FaceView, string> = {
  faceLeft: "profile photo",
  faceRight: "profile photo",
  face45: "45° photo",
  smile: "smile photo",
  frown: "frown photo",
  browRaise: "raised-brow photo",
};

const fmt = (v: MarkerValue) => {
  if (v.text) return v.text;
  const n = v.unit === "ratio" ? v.value.toFixed(2) : v.unit === "index" || v.unit === "%" ? v.value.toFixed(1) : v.value.toFixed(1);
  return v.unit === "ratio" || v.unit === "index" ? n : v.unit === "°" ? `${n}°` : `${n} ${v.unit}`;
};
const STATUS_LABEL: Record<Status, string> = { typical: "Typical", above: "Above typical", below: "Below typical", reference: "Reference", none: "" };

function computed(scan: Scan): Record<string, MarkerValue> {
  const f = scan.face;
  const prof = { ...(scan.profileFace?.markers ?? {}), ...(scan.smileFace?.markers ?? {}) } as Record<string, MarkerValue>;
  if (!f?.landmarks) return { ...prof };
  const P = makeFrame(f.landmarks, f.imageAspect * 1000, 1000).P;
  const out = frontalMarkers(P);
  out["eye-canthal-tilt"] = { value: f.metrics.canthalTilt, unit: "°" };
  out["gen-symmetry"] = { value: f.metrics.symmetry, unit: "index", text: `${Math.round(f.metrics.symmetry)}/100` };
  // the ruler itself: shown as in use rather than as a measurement of the face
  out["gen-iris-mm-scale"] = { value: 11.7, unit: "mm", text: "In use · iris taken as 11.7 mm" };
  return { ...out, ...prof };
}

export function AllMarkers({ scan, profile }: SectionProps) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [region, setRegion] = useState<string>("all");
  const [show, setShow] = useState<State | "all">("all");
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    import("../../lib/markers/catalog.json").then((m) => setRows((m.default as { markers: Row[] }).markers));
  }, []);
  const values = useMemo(() => computed(scan), [scan]);
  const sex = profile.intake.gender;
  const views = new Set<FaceView>(scan.views ?? []);

  if (!rows) return <div className="page"><p className="lead">Loading the marker catalogue…</p></div>;

  const stateOf = (r: Row): State => {
    if (values[r.id]) return "measured";
    const v = needsView(r.photo);
    if (v && !views.has(v)) return "photo";
    // profile outline markers skipped because a beard or moustache hides the skin line
    if (v === "faceLeft" && scan.profileFace?.flags.beard && r.catalogue === "profile" && (r.methodKind === "auto")) return "covered";
    if (r.methodKind === "review") return "review";
    return "soon";
  };
  const withState = rows.map((r) => ({ r, s: stateOf(r) }));
  const count = (s: State) => withState.filter((x) => x.s === s).length;
  const regions = REGION_ORDER.filter((g) => rows.some((r) => r.region === g));
  const visible = withState.filter((x) => (region === "all" || x.r.region === region) && (show === "all" || x.s === show));

  return (
    <div className="page am">
      <PageHeader
        kicker="All markers"
        muted="Every marker,"
        strong="in one place."
        lead={`${rows.length} markers from the research literature, each with its definition, the norm it is compared with and the source. Norms come from Saudi samples where published, otherwise from the best-documented group, and the group is always named.`}
      />
      <div className="am-summary">
        {(
          [
            ["measured", "Measured now", "Computed from your photos"],
            ["photo", "Needs a photo", "Add the profile, 45° or smile photos"],
            ["covered", "Hidden by facial hair", "The beard or moustache covers the skin outline"],
            ["review", "Graded by your reviewer", "Judged by a person against published scales"],
            ["soon", "In development", "Automatable, not yet built"],
          ] as [State, string, string][]
        ).map(([k, t, d]) => (
          <button key={k} className={`am-stat ${show === k ? "on" : ""}`} onClick={() => setShow(show === k ? "all" : k)}>
            <b>{count(k)}</b>
            <span>{t}</span>
            <small>{d}</small>
          </button>
        ))}
      </div>
      <div className="am-regions" role="tablist">
        {["all", ...regions].map((g) => (
          <button key={g} role="tab" aria-selected={region === g} className={region === g ? "on" : ""} onClick={() => setRegion(g)}>
            {g === "all" ? "All regions" : REGION_LABEL[g] ?? g}
          </button>
        ))}
      </div>
      {regions
        .filter((g) => region === "all" || g === region)
        .map((g) => {
          const list = visible.filter((x) => x.r.region === g);
          if (!list.length) return null;
          return (
            <section key={g} className="am-group">
              <h2>
                {REGION_LABEL[g] ?? g} <span>{list.length}</span>
              </h2>
              <div className="am-list">
                {list.map(({ r, s }) => {
                  const v = values[r.id];
                  const p = v ? place(r.id, v.value, sex) : null;
                  const isOpen = open === r.id;
                  const norm = sex === "female" ? r.normFemale ?? r.norms : r.normMale ?? r.norms;
                  return (
                    <div key={r.id} className={`am-row ${isOpen ? "open" : ""}`}>
                      <button className="am-head" onClick={() => setOpen(isOpen ? null : r.id)} aria-expanded={isOpen}>
                        <span className="am-name">{r.name}</span>
                        <span className="am-val">
                          {s === "measured" && v ? (
                            <>
                              <b>{fmt(v)}</b>
                              {p && p.status !== "none" && <em className={`am-st am-${p.status}`}>{STATUS_LABEL[p.status]}</em>}
                            </>
                          ) : s === "photo" ? (
                            <em className="am-st am-need">Needs {VIEW_LABEL[needsView(r.photo)!]}</em>
                          ) : s === "covered" ? (
                            <em className="am-st am-need">Hidden by facial hair</em>
                          ) : s === "review" ? (
                            scan.markerGrades?.[r.id] ? (
                              <>
                                <b>{scan.markerGrades[r.id]}</b>
                                <em className="am-st am-rev">Graded by your reviewer</em>
                              </>
                            ) : (
                              <em className="am-st am-rev">Awaiting reviewer</em>
                            )
                          ) : (
                            <em className="am-st am-soon">In development</em>
                          )}
                        </span>
                      </button>
                      {isOpen && (
                        <div className="am-body">
                          {r.definition && <p>{r.definition}</p>}
                          <dl>
                            {p?.norm && (
                              <div>
                                <dt>Compared with</dt>
                                <dd>
                                  {p.norm.mean}
                                  {p.norm.sd != null ? ` ± ${p.norm.sd}` : ""} · {p.norm.group}
                                  {p.status === "reference" && p.norm.sd != null && " · approximate landmark, calibration pending"}
                                </dd>
                              </div>
                            )}
                            {norm && (
                              <div>
                                <dt>Published norms</dt>
                                <dd>{norm}</dd>
                              </div>
                            )}
                            {r.ethnicNorms && (
                              <div>
                                <dt>By population</dt>
                                <dd>{r.ethnicNorms}</dd>
                              </div>
                            )}
                            {r.formula && (
                              <div>
                                <dt>How it’s measured</dt>
                                <dd>{r.formula}</dd>
                              </div>
                            )}
                            {r.perception && (
                              <div>
                                <dt>What research says</dt>
                                <dd>{r.perception}</dd>
                              </div>
                            )}
                            {r.sources && (
                              <div>
                                <dt>Sources</dt>
                                <dd>{r.sources}</dd>
                              </div>
                            )}
                          </dl>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      <p className="am-foot">
        Millimetre values use the iris as a ruler (about 11.7 mm across in adults). Markers marked “Reference” show a published average without a spread, or use a mesh point that only approximates the
        clinical landmark; they are not called high or low.
      </p>
    </div>
  );
}
