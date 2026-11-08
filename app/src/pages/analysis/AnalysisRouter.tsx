import { useParams } from "react-router-dom";
import { useActive } from "../../lib/useActive";
import { Eyebrows } from "./Eyebrows";

export function AnalysisRouter() {
  const { section } = useParams();
  const { scan, facePhoto } = useActive();
  if (section === "eyebrows" && scan?.face) return <Eyebrows face={scan.face} photo={facePhoto} />;
  return <div className="page"><div className="page-card">Section “{section}” — in progress</div></div>;
}
