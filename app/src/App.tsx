import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useSeo } from "./lib/seo";
import { BRAND_NAME } from "./lib/brand";
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
import { Library } from "./pages/Library";
import { useReady } from "./lib/store";

const TITLES: [RegExp, string][] = [
  [/^\/home/, "Your reports"],
  [/^\/new/, "New scan"],
  [/^\/measurements/, "Measurements"],
  [/^\/settings/, "Settings"],
  [/^\/review/, "Review console"],
  [/^\/analysis\/all-markers/, "All markers"],
  [/^\/analysis/, "Analysis"],
  [/^\/protocol/, "Report"],
];

/** Titles for app pages, all kept out of search results; the landing pages and library set their own. */
function RouteSeo() {
  const { pathname } = useLocation();
  const isLibrary = pathname === "/library";
  const name = TITLES.find(([re]) => re.test(pathname))?.[1] ?? BRAND_NAME;
  useSeo(
    isLibrary
      ? {
          title: `Feature library · eye shapes, nose types, hair and curl patterns, face shapes · ${BRAND_NAME}`,
          description: "100 feature types across 25 categories, from eye shape and brow position to hair curl patterns and posture, each with how it is measured and the research behind it.",
          path: "/library",
        }
      : { title: `${name} · ${BRAND_NAME}`, path: pathname, noindex: true },
  );
  return null;
}

/** The landing pages manage their own metadata (language-specific). */
function AppRouteSeo() {
  const { pathname } = useLocation();
  return pathname === "/" || pathname === "/ar" ? null : <RouteSeo />;
}

export function App() {
  const ready = useReady();
  if (!ready) return null;
  return (
    <>
    <AppRouteSeo />
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/ar" element={<Landing />} />
      <Route path="/protocol" element={<ProtocolViewer />} />
      <Route path="/plans" element={<Navigate to="/#reports" replace />} />
      <Route element={<AppShell />}>
        <Route path="/home" element={<Protocols />} />
        <Route path="/protocols" element={<Navigate to="/home" replace />} />
        <Route path="/new" element={<NewScan />} />
        <Route path="/new/:profileId" element={<NewScan />} />
        <Route path="/measurements" element={<Biometrics />} />
        <Route path="/library" element={<Library />} />
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
    </>
  );
}
