import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./layouts/AppShell";
import { AnalysisRouter } from "./pages/analysis/AnalysisRouter";
import { Protocols } from "./pages/Protocols";
import { NewScan } from "./pages/NewScan";
import { Biometrics } from "./pages/Biometrics";
import { Visualization } from "./pages/Visualization";
import { Settings } from "./pages/Settings";
import { ProtocolViewer } from "./pages/ProtocolViewer";
import { Stack } from "./pages/Stack";
import { Plans } from "./pages/Plans";
import { useReady } from "./lib/store";

export function App() {
  const ready = useReady();
  if (!ready) return null;
  return (
    <Routes>
      <Route path="/protocol" element={<ProtocolViewer />} />
      <Route element={<AppShell />}>
        <Route path="/protocols" element={<Protocols />} />
        <Route path="/new" element={<NewScan />} />
        <Route path="/new/:profileId" element={<NewScan />} />
        <Route path="/biometrics" element={<Biometrics />} />
        <Route path="/visualization" element={<Visualization />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/stack" element={<Stack />} />
        <Route path="/plans" element={<Plans />} />
        <Route path="/analysis" element={<Navigate to="/analysis/getting-started" replace />} />
        <Route path="/analysis/:section" element={<AnalysisRouter />} />
        <Route path="*" element={<Navigate to="/protocols" replace />} />
      </Route>
    </Routes>
  );
}
