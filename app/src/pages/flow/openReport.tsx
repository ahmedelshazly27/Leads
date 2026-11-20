/*
 * Opening a delivered report on this device, shared by the order page and
 * the account page.
 *
 * The report viewer works on the device's own store, so opening copies the
 * reviewed scan from the account first when this device does not have it.
 *
 * Two ways in, plan first: the 12-month plan (/protocol) is what most people
 * want; the detailed analysis (/analysis-report) is optional and technical.
 */
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Lang } from "../../lib/i18n";
import { addScan, createProfile, getState, setActiveProfile, setReview, useAppState } from "../../lib/store";
import { FACE_VIEWS, type FaceView, type Intake, type Scan } from "../../lib/types";
import { scanResults, useMyReview, useOrderScan, type OrderRow, type PhotoUrls, type ReviewRow, type ScanRow } from "../../lib/backend";
import { Spinner } from "./FlowShell";

/** The plan: what most customers open. */
export const PLAN_PATH = "/protocol";
/** The detailed analysis: every measurement and the research behind it. */
export const ANALYSIS_PATH = "/analysis-report";

/** order id -> id of the local scan made for it on this device */
const LOCAL_KEY = "facet-order-scans";
export function localScanFor(orderId: string): string | null {
  try {
    return (JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "{}") as Record<string, string>)[orderId] ?? null;
  } catch {
    return null;
  }
}
export function rememberLocalScan(orderId: string, scanId: string) {
  try {
    const m = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "{}") as Record<string, string>;
    m[orderId] = scanId;
    localStorage.setItem(LOCAL_KEY, JSON.stringify(m));
  } catch {
    /* storage blocked */
  }
}

const isIntake = (v: unknown): v is Intake => !!v && typeof v === "object" && "name" in (v as Record<string, unknown>) && "gender" in (v as Record<string, unknown>);

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(typeof r.result === "string" ? r.result : null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * The report viewer works on the device's own store. Use the scan made on this
 * device for the order when there is one; otherwise copy the reviewed scan
 * (results, intake and, while they exist, the photos) from the account.
 * The reviewer's notes are applied to the local copy.
 */
export function useLocalScan(orderId: string, server: { scan: ScanRow; photos: PhotoUrls } | null, review: ReviewRow | null = null) {
  const navigate = useNavigate();
  const results = scanResults(server?.scan);
  const findLocal = useCallback((): Scan | null => {
    const st = getState();
    const id = localScanFor(orderId) ?? results?.id ?? null;
    return (id && st.scans.find((x) => x.id === id)) || null;
  }, [orderId, results?.id]);
  const app = useAppState();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const scan = useMemo(findLocal, [findLocal, app.scans]);

  const open = useCallback(
    async (to: string) => {
      let s = findLocal();
      if (!s) {
        if (!results || !server) throw new Error("no results");
        // the default intake lives with the scan flow: load it only on this fallback path
        const intake: Intake = isIntake(server.scan.intake) ? server.scan.intake : { ...(await import("../NewScan")).DEFAULT_INTAKE, name: "Me" };
        const profile = createProfile(intake);
        const [face, body, side, ...views] = await Promise.all(
          (["face", "body", "side", ...FACE_VIEWS] as const).map((k) => (server.photos[k] ? toDataUrl(server.photos[k]!) : Promise.resolve(null))),
        );
        const viewMap: Partial<Record<FaceView, string>> = {};
        FACE_VIEWS.forEach((k, i) => {
          if (views[i]) viewMap[k] = views[i]!;
        });
        s = { ...results, profileId: profile.id, views: FACE_VIEWS.filter((k) => viewMap[k]), hasFacePhoto: !!face, hasBodyPhoto: !!body, hasSidePhoto: !!side };
        await addScan(s, face, body, side, viewMap);
        rememberLocalScan(orderId, s.id);
      }
      if (review && review.status === "approved") {
        setReview(s.id, {
          status: "approved",
          note: review.notes ?? "",
          itemNotes: review.item_notes ?? {},
          ...(review.approved_at ? { approvedAt: review.approved_at } : {}),
        });
      }
      setActiveProfile(s.profileId);
      navigate(to);
    },
    [findLocal, results, server, review, orderId, navigate],
  );

  return { scan, open };
}


/** "Open your plan" (primary) and "Open the detailed analysis", with a line on what each is. */
export function OpenReport({ order, lang: _lang }: { order: OrderRow; lang: Lang }) {
  const review = useMyReview(order.id);
  const server = useOrderScan(order.id);
  const local = useLocalScan(order.id, server.data ?? null, review.data ?? null);
  const [opening, setOpening] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const open = async (to: string) => {
    setOpening(to);
    setOpenError(null);
    try {
      await local.open(to);
    } catch (e) {
      console.warn("open report failed", e);
      setOpenError("We could not open your report on this device. Please try again.");
      setOpening(null);
    }
  };
  const canOpen = !!local.scan || !!scanResults(server.data?.scan);
  return (
    <>
      <div className="fl-row fl-open">
        <button type="button" className="fl-btn" disabled={!canOpen || !!opening} onClick={() => open(PLAN_PATH)}>
          {opening === PLAN_PATH && <Spinner />}
          Open your plan
        </button>
        <button type="button" className="fl-btn is-ghost" disabled={!canOpen || !!opening} onClick={() => open(ANALYSIS_PATH)}>
          {opening === ANALYSIS_PATH && <Spinner />}
          Open the detailed analysis
        </button>
      </div>
      <p className="fl-muted">Your plan is everything you need to start. The detailed analysis is optional: every measurement and the research behind it, for those who want the technical detail.</p>
      {!canOpen && server.loading && <p className="fl-muted">Loading your results…</p>}
      {!canOpen && !server.loading && <p className="fl-note">Your results could not be loaded. Please reload the page, or contact us if this keeps happening.</p>}
      {openError && (
        <p className="fl-note is-bad" role="alert">
          {openError}
        </p>
      )}
    </>
  );
}
