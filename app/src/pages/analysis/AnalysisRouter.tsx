import { useMemo, type ComponentType } from "react";
import { Navigate, useParams } from "react-router-dom";
import { Empty } from "../../components/ui";
import { buildPlan } from "../../lib/plan";
import { useActive } from "../../lib/useActive";
import { ALL_ITEMS } from "../../lib/sections";
import * as A from "./Assessments";
import * as B from "./Body";
import * as F from "./Features";
import * as I from "./Intro";
import * as P from "./Protocol";
import { Skin } from "./Skin";
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
  composition: B.Composition,
  "your-protocol": P.YourProtocol,
  recommendations: P.Recommendations,
  "action-plan": P.ActionPlan,
  estimations: P.Estimations,
  progress: P.Progress,
  summary: P.Summary,
};

export function AnalysisRouter() {
  const { section = "getting-started" } = useParams();
  const { profile, scan, scans, facePhoto, bodyPhoto, state } = useActive();
  const plan = useMemo(() => (scan && profile ? buildPlan(scan, profile.intake) : null), [scan, profile]);
  if (!profile || !scan || !plan) return <Navigate to="/protocols" replace />;
  const item = ALL_ITEMS.find((i) => i.id === section);
  const Comp = SECTIONS[section];
  if (!item || !Comp) return <Navigate to="/analysis/getting-started" replace />;
  if (item.needs === "face" && !scan.face)
    return <div className="page"><Empty title="No face scan yet">Add a front portrait in a new scan to unlock this section.</Empty></div>;
  if (item.needs === "body" && !scan.body)
    return <div className="page"><Empty title="No body scan yet">Add a full-body photo in a new scan to unlock this section.</Empty></div>;
  return (
    <Comp
      key={section}
      profile={profile}
      scan={scan}
      scans={scans}
      facePhoto={facePhoto}
      bodyPhoto={bodyPhoto}
      visuals={state.visuals[scan.id] ?? {}}
      plan={plan}
    />
  );
}
