/**
 * Row types for the Supabase schema described in docs/BACKEND.md, plus the
 * shapes the client data layer returns. Money columns are `numeric` in
 * Postgres; they are normalised to JS numbers when read.
 */

/* ------------------------------ Enums ------------------------------ */

export type Locale = "en" | "ar";
export type GenderCode = "male" | "female";
export type Role = "customer" | "reviewer" | "admin";
/**
 * `withdrawal_waiver`: the customer asked us to start the report within the
 * 14-day withdrawal period and understands the right to withdraw ends once it
 * is delivered (terms section 8). Recorded before the photos are submitted.
 */
export type ConsentKind = "age18" | "terms" | "privacy" | "photos" | "marketing" | "withdrawal_waiver";
export type OrderProduct = "report" | "checkin";
export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "awaiting_photos"
  | "in_review"
  | "changes_requested"
  | "delivered"
  | "refunded"
  | "cancelled";
export type PaymentProvider = "stripe" | "checkout_com" | "manual";
/**
 * `included`: the 30 days of membership that come with a report bought on its
 * own (provider "manual", amount 0, never renews; ends at current_period_end).
 * Use isIncluded() / includedUntil() from membership.ts.
 */
export type SubscriptionPlan = "monthly" | "yearly" | "included";
/** A paid (Stripe) membership plan. */
export type PaidPlan = Exclude<SubscriptionPlan, "included">;
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";
export type PaymentStatus = "succeeded" | "refunded" | "failed";
export type ScanKind = "baseline" | "checkin";
export type ScanPhotoView = "face" | "body" | "side" | "faceLeft" | "faceRight" | "face45" | "smile" | "frown" | "browRaise";
export type ReviewRowStatus = "in_progress" | "approved" | "returned";
export type GenerationKind = "face_after" | "face_after_alt" | "body_after_front" | "body_after_side";
export type ImageProvider = "fal" | "openai" | "higgsfield";
export type GenerationStatus = "queued" | "running" | "succeeded" | "failed";
export type CostCategory = "image_generation" | "payment_fee" | "messaging" | "reviewer" | "other";
export type MoneyCurrency = "USD" | "KWD" | "EUR";
export type AdPlatform = "meta" | "snap" | "tiktok" | "google";

export const SCAN_PHOTO_VIEWS: ScanPhotoView[] = ["face", "body", "side", "faceLeft", "faceRight", "face45", "smile", "frown", "browRaise"];
export const GENERATION_KINDS: GenerationKind[] = ["face_after", "face_after_alt", "body_after_front", "body_after_side"];
/** Orders a reviewer still has to act on. */
export const OPEN_REVIEW_STATUSES: OrderStatus[] = ["in_review", "changes_requested"];

/* ------------------------------ Rows ------------------------------- */

export interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  locale: Locale | null;
  gender: GenderCode | null;
  birth_year: number | null;
  role: Role;
  reviewer_gender: GenderCode | null;
  created_at: string;
}

/** Fields a user may change on their own profile (never `role` / `reviewer_gender`). */
export type ProfilePatch = Partial<Pick<ProfileRow, "full_name" | "phone" | "locale" | "gender" | "birth_year">>;

export interface ConsentRow {
  id: string;
  user_id: string;
  kind: ConsentKind;
  version: string;
  granted_at: string;
  withdrawn_at: string | null;
}

export interface OrderRow {
  id: string;
  /** null after the customer deleted their account (kept for accounting) */
  user_id: string | null;
  product: OrderProduct;
  status: OrderStatus;
  amount: number;
  currency: string;
  provider: PaymentProvider;
  provider_ref: string | null;
  /** what was bought at checkout (null for check-ins from renewals) */
  plan?: CheckoutPlan | null;
  /** the membership a check-in (or bundle) belongs to */
  subscription_id?: string | null;
  /** the scan submit-scan accepted for this order */
  scan_id?: string | null;
  assigned_reviewer: string | null;
  due_at: string | null;
  paid_at: string | null;
  submitted_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

export interface SubscriptionRow {
  id: string;
  /** null after the customer deleted their account */
  user_id: string | null;
  provider: PaymentProvider;
  provider_sub_id: string | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  current_period_end: string | null;
  /** set while the membership is cancelling (it ends then) */
  cancel_at: string | null;
  trial_end?: string | null;
  canceled_at?: string | null;
  /** recurring price, in `currency` */
  amount?: number | null;
  currency?: string;
  created_at: string;
}

export interface PaymentRow {
  id: string;
  order_id: string | null;
  subscription_id: string | null;
  /** null for refund rows whose original payment could not be matched, and after account deletion */
  user_id: string | null;
  provider: PaymentProvider;
  provider_ref: string | null;
  amount: number;
  currency: string;
  fee: number;
  net: number;
  status: PaymentStatus;
  created_at: string;
}

export interface ScanRow {
  id: string;
  user_id: string;
  order_id: string;
  kind: ScanKind;
  /** the client's `Intake` */
  intake: unknown;
  /** the client's `Scan` object, without any photo data */
  results: unknown;
  app_version: string | null;
  created_at: string;
  photos_deleted_at: string | null;
}

export interface ScanPhotoRow {
  scan_id: string;
  view: ScanPhotoView;
  storage_path: string;
}

export interface ReviewRow {
  id: string;
  order_id: string;
  reviewer_id: string;
  status: ReviewRowStatus;
  checklist: Record<string, boolean> | null;
  notes: string | null;
  item_notes: Record<string, string> | null;
  marker_grades: Record<string, string> | null;
  approved_at: string | null;
}

export interface GenerationRow {
  id: string;
  order_id: string;
  scan_id: string | null;
  requested_by: string | null;
  kind: GenerationKind;
  prompt: string;
  remarks: string | null;
  parent_id: string | null;
  provider: ImageProvider;
  model: string | null;
  status: GenerationStatus;
  output_path: string | null;
  cost_usd: number;
  approved: boolean;
  /** why a generation failed (status "failed"), else null */
  error: string | null;
  created_at: string;
}

export interface CostRow {
  id: string;
  order_id: string | null;
  user_id: string | null;
  category: CostCategory;
  amount: number;
  currency: MoneyCurrency;
  note: string | null;
  created_at: string;
}

export interface AdSpendRow {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  platform: AdPlatform;
  campaign_id: string;
  campaign_name: string | null;
  spend: number;
  currency: string;
  impressions: number;
  clicks: number;
  purchases: number;
}

export interface WaitlistRow {
  id: string;
  email: string;
  phone: string | null;
  gender: GenderCode | null;
  locale: Locale | null;
  source: string | null;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  actor: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  meta: unknown;
  at: string;
}

/* ----------------------------- Pricing ----------------------------- */

/** What `create-checkout` accepts. */
export type CheckoutPlan =
  | "report"
  | "report_membership_monthly"
  | "report_membership_yearly"
  | "membership_monthly"
  | "membership_yearly";

/** Prices in KWD (3 decimals). Must match the Stripe prices the owner sets up. */
export const PRICES_KWD = {
  report: 20,
  membership_monthly: 5,
  membership_yearly: 45,
} as const;

/** Trial days on the membership when bought together with the report. */
export const BUNDLE_TRIAL_DAYS = 30;
/** Days of membership included with a report bought on its own (no renewal). */
export const INCLUDED_MEMBERSHIP_DAYS = 30;

export interface PlanInfo {
  plan: CheckoutPlan;
  /** charged at checkout, KWD */
  dueNowKwd: number;
  /** recurring price after the trial (or immediately for a plain membership), KWD */
  recurringKwd: number | null;
  interval: PaidPlan | null;
  trialDays: number;
  includesReport: boolean;
}

export const PLANS: Record<CheckoutPlan, PlanInfo> = {
  report: { plan: "report", dueNowKwd: PRICES_KWD.report, recurringKwd: null, interval: null, trialDays: 0, includesReport: true },
  report_membership_monthly: { plan: "report_membership_monthly", dueNowKwd: PRICES_KWD.report, recurringKwd: PRICES_KWD.membership_monthly, interval: "monthly", trialDays: BUNDLE_TRIAL_DAYS, includesReport: true },
  report_membership_yearly: { plan: "report_membership_yearly", dueNowKwd: PRICES_KWD.report, recurringKwd: PRICES_KWD.membership_yearly, interval: "yearly", trialDays: BUNDLE_TRIAL_DAYS, includesReport: true },
  membership_monthly: { plan: "membership_monthly", dueNowKwd: PRICES_KWD.membership_monthly, recurringKwd: PRICES_KWD.membership_monthly, interval: "monthly", trialDays: 0, includesReport: false },
  membership_yearly: { plan: "membership_yearly", dueNowKwd: PRICES_KWD.membership_yearly, recurringKwd: PRICES_KWD.membership_yearly, interval: "yearly", trialDays: 0, includesReport: false },
};

/** Monthly-equivalent revenue of one subscription, KWD (0 for the included month). */
export const monthlyEquivalentKwd = (plan: SubscriptionPlan) =>
  plan === "included" ? 0 : plan === "monthly" ? PRICES_KWD.membership_monthly : PRICES_KWD.membership_yearly / 12;

/** Review turnaround promised to the customer (submit-scan sets due_at = now + 72h). */
export const SLA_HOURS = 72;

/* --------------------------- Client shapes -------------------------- */

export interface SessionInfo {
  userId: string;
  email: string | null;
}

/** A query hook's state. `data` stays undefined until the first load. */
export interface QueryState<T> {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  refresh: () => void;
}

/** Signed (time-limited) URLs keyed by photo view. */
export type PhotoUrls = Partial<Record<ScanPhotoView, string>>;

export interface GenerationWithUrl extends GenerationRow {
  /** signed URL of the output image, or null while queued / failed */
  url: string | null;
}

/** Everything the reviewer console needs for one order. */
export interface ReviewBundle {
  order: OrderRow;
  scan: ScanRow | null;
  photos: PhotoUrls;
  review: ReviewRow | null;
  generations: GenerationWithUrl[];
}

export interface CustomerVisual {
  generation_id: string;
  order_id: string;
  kind: GenerationKind;
  url: string;
  /** when the visual was generated; customer-visuals returns them oldest first */
  created_at?: string | null;
}

/* ----------------------------- Dashboard ---------------------------- */

export type KpiRange = "today" | "7d" | "30d";

export interface Kpis {
  range: KpiRange;
  /** ISO start of the range (inclusive) */
  from: string;
  /** net revenue in the range, KWD: succeeded payments minus refunds */
  revenueKwd: number;
  /** succeeded payments in the range before refunds, KWD */
  grossRevenueKwd: number;
  /** refunds issued in the range, KWD, as a positive number */
  refundedKwd: number;
  paymentFeesKwd: number;
  imageCostUsd: number;
  imageCostKwd: number;
  /** orders created in the range (any status except pending/cancelled) */
  orders: number;
  /** report orders paid in the range */
  reportsSold: number;
  /** customer profiles created in the range */
  newCustomers: number;
  /** distinct customers whose report was paid in the range */
  newPayingCustomers: number;
  /** now, not range-bound */
  mrrKwd: number;
  activeMembers: number;
  trialingMembers: number;
  /** submitted → delivered, for orders delivered in the range; null when none */
  avgTurnaroundHours: number | null;
  /** orders due in the range that were delivered late or are still open past due */
  slaBreaches: number;
  /** open review orders already past due right now */
  overdueNow: number;
  openReviewOrders: number;
  adSpendKwd: number;
  /** ad spend / new paying customers */
  cacKwd: number | null;
  /** revenue / ad spend */
  roas: number | null;
  /** gross margin: revenue - payment fees - image cost - other order costs */
  grossMarginKwd: number;
}

export interface OrderEconomics {
  order_id: string;
  user_id: string | null;
  email: string | null;
  product: OrderProduct;
  status: OrderStatus;
  created_at: string;
  paid_at: string | null;
  delivered_at: string | null;
  due_at: string | null;
  revenueKwd: number;
  paymentFeeKwd: number;
  imageCostUsd: number;
  imageCostKwd: number;
  generations: number;
  otherCostKwd: number;
  marginKwd: number;
}

export interface CustomerEconomics {
  user_id: string;
  email: string | null;
  orders: number;
  /** order payments + membership payments */
  revenueKwd: number;
  paymentFeeKwd: number;
  imageCostKwd: number;
  generations: number;
  otherCostKwd: number;
  marginKwd: number;
  member: SubscriptionStatus | null;
}

export interface CampaignSpend {
  platform: AdPlatform;
  campaign_id: string;
  campaign_name: string | null;
  spendKwd: number;
  impressions: number;
  clicks: number;
  /** purchases the ad platform reports (its own attribution) */
  purchases: number;
  ctr: number | null;
  /** spend / platform-reported purchases */
  cpaKwd: number | null;
  /** platform purchases × average report revenue in the range, divided by spend. An estimate. */
  estRoas: number | null;
}

export interface DailyPoint {
  /** YYYY-MM-DD (UTC) */
  date: string;
  revenueKwd: number;
  orders: number;
  adSpendKwd: number;
  imageCostKwd: number;
  paymentFeesKwd: number;
}

export interface WaitlistSummary {
  total: number;
  byGender: Partial<Record<GenderCode | "unknown", number>>;
  last7d: number;
}

export interface AdminDashboard {
  generatedAt: string;
  kpis: Kpis;
  orders: OrderEconomics[];
  customers: CustomerEconomics[];
  campaigns: CampaignSpend[];
  daily: DailyPoint[];
  waitlist: WaitlistSummary;
  /** exchange rates used to convert USD / EUR costs and ad spend to KWD */
  fx: Record<string, number>;
}

/** audit_log actions the operator dashboard lists (AdminRows.auditEvents). */
export const ADMIN_AUDIT_ACTIONS = ["orders.cancelled_consent_withdrawn", "stripe.schedule_failed", "orders.changes_requested"] as const;
export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[number];

/** One audit_log row for the operator (newest first). */
export interface AdminAuditEvent {
  id: string;
  action: AdminAuditAction;
  created_at: string;
  /** the order it is about (null for membership events such as stripe.schedule_failed) */
  order_id: string | null;
  /** audit_log.meta as written by the server (e.g. refund_policy, from, emailed, error) */
  details: Record<string, unknown>;
}

/** Raw rows the dashboard is computed from (fetched from Supabase or the mock). */
export interface AdminRows {
  /** includes orders with user_id null (the customer deleted their account) */
  orders: OrderRow[];
  payments: PaymentRow[];
  subscriptions: SubscriptionRow[];
  /** parent_id set = a regeneration of that attempt */
  generations: Pick<GenerationRow, "id" | "order_id" | "cost_usd" | "status" | "created_at" | "parent_id" | "kind">[];
  costs: CostRow[];
  adSpend: AdSpendRow[];
  profiles: Pick<ProfileRow, "id" | "email" | "role" | "created_at">[];
  /** full rows (admin only); the demo uses @example.com addresses */
  waitlist: Pick<WaitlistRow, "id" | "email" | "gender" | "locale" | "source" | "created_at">[];
  /** recent audit_log rows of ADMIN_AUDIT_ACTIONS, newest first (at most 200) */
  auditEvents: AdminAuditEvent[];
}
