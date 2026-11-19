/**
 * Client data layer for the online service (see docs/BACKEND.md).
 *
 * `backendMode` is "off" unless VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY
 * are set ("supabase") or VITE_BACKEND_MOCK=1 ("mock"). With it off, the app
 * keeps working fully on-device, as before.
 */
export { backendEnabled, backendMode, isMock, supabase, BackendError, invalidate, useBackendQuery, type BackendMode } from "./client";
export * from "./types";
export { getSession, useSession, whenSessionReady, consentsFlushed, sendCode, type SendCodeOptions, verifyCode, signOut, getMyProfile, updateMyProfile, useProfile, useRole } from "./auth";
export {
  startCheckout,
  redirectToCheckout,
  listMyOrders,
  getOrder,
  getMySubscription,
  isActiveMember,
  getMyReview,
  getMyVisuals,
  useMyOrders,
  useOrder,
  useMySubscription,
  useMyReview,
  useMyVisuals,
} from "./orders";
export { submitScan, localScanPhotos, stripPhotoData, getScanForOrder, scanResults, useOrderScan, type PhotoInput, type SubmitScanOptions } from "./scans";
export {
  listReviewQueue,
  loadReviewBundle,
  saveReview,
  generateVisual,
  approveDelivery,
  setOrderStatus,
  hoursLeft,
  useReviewQueue,
  useReviewBundle,
  type ReviewPatch,
  type GenerateVisualInput,
} from "./review";
export {
  FX_TO_KWD,
  toKwd,
  rangeStart,
  fetchAdminRows,
  computeDashboard,
  computeKpis,
  computeOrderEconomics,
  computeCustomerEconomics,
  loadAdminDashboard,
  useAdminDashboard,
  ordersToCsv,
  toCsv,
  ADMIN_RANGES,
  ORDER_STATUS_ORDER,
  FX_EDITABLE,
  adminRangeStart,
  kuwaitDay,
  listFxRates,
  saveFxRate,
  fetchMrr,
  listWaitlistEntries,
  waitlistToCsv,
  computeOperatorDashboard,
  loadOperatorDashboard,
  useOperatorDashboard,
  type OrderCsvRow,
  type AdminRange,
  type FxRate,
  type FxCurrency,
  type MrrSummary,
  type AdminWaitlistEntry,
  type OperatorOrder,
  type OperatorKpis,
  type UnitEconomics,
  type MarketingDay,
  type MarketingCampaign,
  type MarketingSummary,
  type OperatorDailyPoint,
  type OperatorDashboard,
  type OperatorInput,
} from "./admin";
export { CONSENT_VERSION, recordConsents, pendingConsents, flushPendingConsents, listMyConsents, withdrawConsent, activeConsents, useMyConsents } from "./consents";
export { joinWaitlist, type WaitlistEntry, type WaitlistResult } from "./waitlist";
export { exportMyData, downloadMyData, deleteMyData, withdrawPhotoConsent } from "./account";
export {
  manageMembership,
  cancelMembership,
  resumeMembership,
  endYearlyMembershipNow,
  yearlyEndNowRefund,
  fullMonthsBetween,
  isCancelling,
  type MembershipAction,
  type MembershipRefund,
  type MembershipResult,
} from "./membership";
export { mock as mockBackend } from "./mock";
