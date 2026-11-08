import { useMemo, type ComponentType } from "react";
import { Navigate, useParams } from "react-router-dom";
import { Empty, Toggle } from "../../components/ui";
import { useDisplayScan } from "../../lib/studio";
import { setPhotoMode } from "../../lib/store";
import { buildPlan } from "../../lib/plan";
import { useActive } from "../../lib/useActive";
import { ALL_ITEMS } from "../../lib/sections";
import * as A from "./Assessments";
import * as B from "./Body";
import * as BD from "./BodyDetail";
import * as F from "./Features";
import * as I from "./Intro";
import * as P from "./Protocol";
import { Skin } from "./Skin";
import { Nutrition } from "./Nutrition";
import { Training } from "./Training";
import { Partners } from "./Partners";
import { Eyebrows } from "./Eyebrows";
import { BodyProportions } from "./BodyProportions";
import type { SectionProps } from "./types";

const SECTIONS: Record<string, ComponentType<SectionProps>> = {
  "getting-started": I.GettingStarted,
  "about-you": I.AboutYou,
  methodology: I.Methodology,
  "first-impression": A.FirstImpression,
  dimorphism: A.Dimorphism,
  averageness: A.Averageness,
  proportions: A.Proportions,
  symmetry: A.Symmetry,
  neoteny: A.Neoteny,
  "face-shape": A.FaceShape,
  adiposity: A.Adiposity,
  contrast: A.Contrast,
  eyebrows: (p) => <Eyebrows face={p.scan.face!} photo={p.facePhoto} />,
  eyes: F.Eyes,
  nose: F.Nose,
  lips: F.Lips,
  cheeks: F.Cheeks,
  jaw: F.Jaw,
  chin: F.Chin,
  skin: Skin,
  "features-summary": F.FeaturesSummary,
  "body-overview": B.BodyOverview,
  "body-proportions": (p) => <BodyProportions body={p.scan.body!} photo={p.bodyPhoto} gender={p.profile.intake.gender} />,
  posture: B.Posture,
  "physique-impression": BD.PhysiqueImpression,
  "chest-arms": BD.ChestArms,
  "waist-core": BD.WaistCore,
  "hips-legs": BD.HipsLegs,
  "side-posture": BD.SidePosture,
  "body-symmetry": BD.BodySymmetry,
  "body-summary": BD.BodySummary,
  composition: B.Composition,
  "your-protocol": P.YourProtocol,
  recommendations: P.Recommendations,
  "action-plan": P.ActionPlan,
  estimations: P.Estimations,
  nutrition: Nutrition,
  training: Training,
  partners: Partners,
  progress: P.Progress,
  summary: P.Summary,
};

/** Sections whose numbers are read from photo pixels: always show the original. */
const ORIGINAL_ONLY = new Set(["skin", "contrast"]);
/** Sections that don't show analysis photos (no switch needed). */
const NO_PHOTO = new Set(["getting-started", "about-you", "methodology", "recommendations", "action-plan", "estimations", "progress", "nutrition", "partners", "training"]);

export function AnalysisRouter() {
  const { section = "getting-started" } = useParams();
  const { profile, scan, scans, facePhoto, bodyPhoto, sidePhoto, state } = useActive();
  const plan = useMemo(() => (scan && profile ? buildPlan(scan, profile.intake) : null), [scan, profile]);
  const visuals = scan ? state.visuals[scan.id] ?? {} : {};
  const mode = ORIGINAL_ONLY.has(section) ? "original" : state.settings.photoMode ?? "studio";
  const display = useDisplayScan(scan, visuals, profile?.intake ?? null, { face: facePhoto, body: bodyPhoto, side: sidePhoto }, mode);
  if (!profile || !scan || !plan || !display) return <Navigate to="/protocols" replace />;
  const item = ALL_ITEMS.find((i) => i.id === section);
  const Comp = SECTIONS[section];
  if (!item || !Comp) return <Navigate to="/analysis/getting-started" replace />;
  if (item.needs === "face" && !scan.face)
    return <div className="page"><Empty title="No face scan yet">Add a front portrait in a new scan to unlock this section.</Empty></div>;
  if (item.needs === "body" && !scan.body)
    return <div className="page"><Empty title="No body scan yet">Add a full-body photo in a new scan to unlock this section.</Empty></div>;
  if (item.needs === "side" && !scan.bodySide)
    return <div className="page"><Empty title="No side photo yet">Add a side-on full-body photo in a new scan to unlock side posture and core depth.</Empty></div>;
  const showSwitch = display.available && !NO_PHOTO.has(section);
  return (
    <>
      {showSwitch && (
        <div className="page photo-switch">
          <span className="mono-sm">
            {ORIGINAL_ONLY.has(section)
              ? "Original photo — this section reads real skin pixels"
              : display.loading
                ? "Preparing studio photo…"
                : "Measurements always come from your original photos"}
          </span>
          {!ORIGINAL_ONLY.has(section) && (
            <Toggle
              value={state.settings.photoMode ?? "studio"}
              options={[
                { value: "studio", label: "Studio" },
                { value: "original", label: "Original" },
              ]}
              onChange={(v) => setPhotoMode(v)}
            />
          )}
        </div>
      )}
      <Comp
        key={`${section}-${mode}-${display.loading}`}
        profile={profile}
        scan={display.scan}
        scans={scans}
        facePhoto={display.facePhoto}
        bodyPhoto={display.bodyPhoto}
        sidePhoto={display.sidePhoto}
        visuals={visuals}
        plan={plan}
      />
    </>
  );
}
