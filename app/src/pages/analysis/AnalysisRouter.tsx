import { useParams } from "react-router-dom";
import { CaptureWarning } from "../../components/CaptureWarning";
import { useActive } from "../../lib/useActive";
import { BodyProportions } from "./BodyProportions";
import { Eyebrows } from "./Eyebrows";

export function AnalysisRouter() {
  const { section } = useParams();
  const { scan, facePhoto, bodyPhoto, profile } = useActive();
  if (section === "eyebrows" && scan?.face)
    return <><Eyebrows face={scan.face} photo={facePhoto} /></>;
  if (section === "body-proportions" && scan?.body && profile)
    return <BodyProportions body={scan.body} photo={bodyPhoto} gender={profile.intake.gender} />;
  return (
    <div className="page">
      {scan?.face && <CaptureWarning capture={scan.face.capture} />}
      <div className="page-card">Section “{section}” — in progress</div>
    </div>
  );
}
