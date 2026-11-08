import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./layouts/AppShell";
import { AnalysisRouter } from "./pages/analysis/AnalysisRouter";
import { Protocols } from "./pages/Protocols";
import { NewScan } from "./pages/NewScan";
import { Biometrics } from "./pages/Biometrics";
import { Settings } from "./pages/Settings";
import { ProtocolViewer } from "./pages/ProtocolViewer";
import { Landing } from "./pages/Landing";
import { Review } from "./pages/review/Review";
import { ReviewScan } from "./pages/review/ReviewScan";
import { useReady } from "./lib/store";

export function App() {
  const ready = useReady();
  if (!ready) return null;
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/protocol" element={<ProtocolViewer />} />
      <Route path="/plans" element={<Navigate to="/#reports" replace />} />
      <Route element={<AppShell />}>
        <Route path="/home" element={<Protocols />} />
        <Route path="/protocols" element={<Navigate to="/home" replace />} />
        <Route path="/new" element={<NewScan />} />
        <Route path="/new/:profileId" element={<NewScan />} />
        <Route path="/measurements" element={<Biometrics />} />
        <Route path="/biometrics" element={<Navigate to="/measurements" replace />} />
        <Route path="/visualization" element={<Navigate to="/analysis/projection" replace />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/stack" element={<Navigate to="/home" replace />} />
        <Route path="/requests" element={<Navigate to="/review" replace />} />
        <Route path="/review" element={<Review />} />
        <Route path="/review/:scanId" element={<ReviewScan />} />
        <Route path="/analysis" element={<Navigate to="/analysis/getting-started" replace />} />
        <Route path="/analysis/:section" element={<AnalysisRouter />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Route>
    </Routes>
  );
}
