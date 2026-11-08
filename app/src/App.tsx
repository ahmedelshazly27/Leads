import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./layouts/AppShell";
import { AnalysisRouter } from "./pages/analysis/AnalysisRouter";
import { useReady } from "./lib/store";

export function App() {
  const ready = useReady();
  if (!ready) return null;
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/analysis" element={<Navigate to="/analysis/getting-started" replace />} />
        <Route path="/analysis/:section" element={<AnalysisRouter />} />
        <Route path="*" element={<Navigate to="/analysis/eyebrows" replace />} />
      </Route>
    </Routes>
  );
}
