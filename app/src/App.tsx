import { lazy, Suspense, type ComponentType, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useSeo } from "./lib/seo";
import { BRAND_NAME } from "./lib/brand";
import { useReady } from "./lib/store";

/**
 * Every page is its own chunk, so the landing never downloads the app, the report,
 * the review console or the vision code. A page that has already loaded renders
 * straight away (no Suspense round trip), which lets main.tsx load the first page
 * before the first render and keep the pre-rendered HTML on screen until then.
 */
type Loader = () => Promise<ComponentType>;
function page(load: Loader) {
  let Loaded: ComponentType | null = null;
  let pending: Promise<ComponentType> | null = null;
  const preload = () =>
    (pending ??= load().then(
      (C) => (Loaded = C),
      (e) => {
        pending = null; // allow a retry after a failed chunk download
        throw e;
      },
    ));
  const Lazy = lazy(() => preload().then((C) => ({ default: C })));
  const Page = () => (Loaded ? <Loaded /> : <Lazy />);
  return Object.assign(Page, { preload });
}

const Landing = page(() => import("./pages/Landing").then((m) => m.Landing));
const ProtocolViewer = page(() => import("./pages/ProtocolViewer").then((m) => m.ProtocolViewer));
const AppShell = page(() => import("./layouts/AppShell").then((m) => m.AppShell));
const Protocols = page(() => import("./pages/Protocols").then((m) => m.Protocols));
const NewScan = page(() => import("./pages/NewScan").then((m) => m.NewScan));
const Biometrics = page(() => import("./pages/Biometrics").then((m) => m.Biometrics));
const Library = page(() => import("./pages/Library").then((m) => m.Library));
const Settings = page(() => import("./pages/Settings").then((m) => m.Settings));
const Review = page(() => import("./pages/review/Review").then((m) => m.Review));
const ReviewScan = page(() => import("./pages/review/ReviewScan").then((m) => m.ReviewScan));
const AnalysisRouter = page(() => import("./pages/analysis/AnalysisRouter").then((m) => m.AnalysisRouter));
const Start = page(() => import("./pages/flow/Start").then((m) => m.Start));
const Order = page(() => import("./pages/flow/Order").then((m) => m.Order));
const Account = page(() => import("./pages/flow/Account").then((m) => m.Account));
const Admin = page(() => import("./pages/admin/Admin").then((m) => m.Admin));
const ReviewOrder = page(() => import("./pages/review/ReviewOrder").then((m) => m.ReviewOrder));
const Privacy = page(() => import("./pages/legal/Privacy").then((m) => m.Privacy));
const Terms = page(() => import("./pages/legal/Terms").then((m) => m.Terms));
const Refunds = page(() => import("./pages/legal/Refunds").then((m) => m.Refunds));

/**
 * A redirect that first loads the page it points to. Navigations run as transitions,
 * so while this waits the previous screen stays up, and the target then renders at
 * once instead of showing an empty main area while its chunks download.
 */
function redirect(to: string, ...targets: { preload: () => Promise<unknown> }[]) {
  const Go = () => <Navigate to={to} replace />;
  return page(() => Promise.all(targets.map((t) => t.preload())).then(() => Go));
}
const ToHome = redirect("/home", AppShell, Protocols);
const ToMeasurements = redirect("/measurements", AppShell, Biometrics);
const ToAnalysis = redirect("/analysis/getting-started", AppShell, AnalysisRouter);
const ToProjection = redirect("/analysis/projection", AppShell, AnalysisRouter);
const ToReview = redirect("/review", AppShell, Review);
const ToReports = redirect("/#reports", Landing);

/** Which chunks a URL needs on first load (app pages also need the shell). */
const PRELOAD: [RegExp, { preload: () => Promise<unknown> }[]][] = [
  [/^\/(ar\/?)?$/, [Landing]],
  [/^\/protocol\/?$/, [ProtocolViewer]],
  [/^\/(ar\/)?start\/?$/, [Start]],
  [/^\/(ar\/)?orders\/[^/]+/, [Order]],
  [/^\/(ar\/)?account\/?$/, [Account]],
  [/^\/admin\/?$/, [Admin]],
  [/^\/(ar\/)?privacy\/?$/, [Privacy]],
  [/^\/(ar\/)?terms\/?$/, [Terms]],
  [/^\/(ar\/)?refunds\/?$/, [Refunds]],
  [/^\/review\/orders\/[^/]+/, [AppShell, ReviewOrder]],
  [/^\/home\/?$/, [AppShell, Protocols]],
  [/^\/new(\/|$)/, [AppShell, NewScan]],
  [/^\/measurements\/?$/, [AppShell, Biometrics]],
  [/^\/library\/?$/, [AppShell, Library]],
  [/^\/settings\/?$/, [AppShell, Settings]],
  [/^\/review\/?$/, [AppShell, Review]],
  [/^\/review\/[^/]+/, [AppShell, ReviewScan]],
  [/^\/analysis\/[^/]+/, [AppShell, AnalysisRouter]],
  [/^\/analysis\/?$/, [AppShell, ToAnalysis]],
  [/^\/visualization\/?$/, [AppShell, ToProjection]],
  [/^\/biometrics\/?$/, [AppShell, ToMeasurements]],
  [/^\/requests\/?$/, [AppShell, ToReview]],
  [/^\/plans\/?$/, [ToReports]],
];
/** Any other path is caught by the app's catch-all, which goes to /home. */
const PRELOAD_OTHER = [AppShell, ToHome];

/** Load the chunks for the first URL. Never rejects: a failed download falls back to Suspense. */
export function preloadRoute(pathname: string): Promise<void> {
  const hit = PRELOAD.find(([re]) => re.test(pathname));
  return Promise.all((hit?.[1] ?? PRELOAD_OTHER).map((p) => p.preload())).then(
    () => undefined,
    () => undefined,
  );
}

/**
 * One boundary around all routes. Every navigation is a transition, so a page whose
 * chunk is still downloading (including the shell and its page loading one after the
 * other, from the landing into the app) keeps the previous screen up until it is
 * ready, rather than mounting a fresh boundary that shows an empty area. The fallback
 * only appears if nothing is on screen yet, and holds the page height meanwhile.
 */
const s = (el: ReactNode) => <Suspense fallback={<div aria-busy="true" style={{ minHeight: "100vh" }} />}>{el}</Suspense>;

const TITLES: [RegExp, string][] = [
  [/^\/home/, "Your reports"],
  [/^\/new/, "New scan"],
  [/^\/measurements/, "Measurements"],
  [/^\/settings/, "Settings"],
  [/^\/review/, "Review console"],
  [/^\/analysis\/all-markers/, "All markers"],
  [/^\/analysis/, "Analysis"],
  [/^\/protocol/, "Report"],
  [/^\/(ar\/)?start/, "Start"],
  [/^\/(ar\/)?orders/, "Your order"],
  [/^\/(ar\/)?account/, "Your account"],
  [/^\/admin/, "Operator dashboard"],
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
  return /^\/(ar\/?)?$|^\/(ar\/)?(privacy|terms|refunds)\/?$/.test(pathname) ? null : <RouteSeo />;
}

export function App() {
  const ready = useReady();
  if (!ready) return null;
  return (
    <>
    <AppRouteSeo />
    {s(
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/ar" element={<Landing />} />
      <Route path="/protocol" element={<ProtocolViewer />} />
      <Route path="/plans" element={<ToReports />} />
      <Route path="/start" element={<Start />} />
      <Route path="/ar/start" element={<Start />} />
      <Route path="/orders/:orderId" element={<Order />} />
      <Route path="/ar/orders/:orderId" element={<Order />} />
      <Route path="/account" element={<Account />} />
      <Route path="/ar/account" element={<Account />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/refunds" element={<Refunds />} />
      <Route path="/ar/privacy" element={<Privacy />} />
      <Route path="/ar/terms" element={<Terms />} />
      <Route path="/ar/refunds" element={<Refunds />} />
      <Route element={<AppShell />}>
        <Route path="/home" element={<Protocols />} />
        <Route path="/protocols" element={<ToHome />} />
        <Route path="/new" element={<NewScan />} />
        <Route path="/new/:profileId" element={<NewScan />} />
        <Route path="/measurements" element={<Biometrics />} />
        <Route path="/library" element={<Library />} />
        <Route path="/biometrics" element={<ToMeasurements />} />
        <Route path="/visualization" element={<ToProjection />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/stack" element={<ToHome />} />
        <Route path="/requests" element={<ToReview />} />
        <Route path="/review" element={<Review />} />
        <Route path="/review/:scanId" element={<ReviewScan />} />
        <Route path="/review/orders/:orderId" element={<ReviewOrder />} />
        <Route path="/analysis" element={<ToAnalysis />} />
        <Route path="/analysis/:section" element={<AnalysisRouter />} />
        <Route path="*" element={<ToHome />} />
      </Route>
    </Routes>,
    )}
    </>
  );
}
