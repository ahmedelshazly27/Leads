/**
 * In-memory demo backend, used when VITE_BACKEND_MOCK=1.
 *
 * It mirrors the Supabase contract closely enough to demo and test the full
 * flow without a Supabase project: email-code sign-in (any 6 digits), a fake
 * checkout that marks the order paid at once, scan submission, the reviewer
 * console (generations return the sample after images in /sample/) and the
 * admin dashboard (KPIs computed from the seeded demo rows below).
 *
 * Everything here is demo data: emails are @example.com, money and costs are
 * made-up round figures, and nothing leaves the browser. State is kept in
 * sessionStorage so it survives the redirect after the fake checkout; photos
 * stay in memory only.
 *
 * Roles: sign in with an email starting with "admin" for the admin role, with
 * "review" for the reviewer role; any other email is a customer. A new
 * reviewer takes over the open orders of "Demo reviewer 1", so the queue is
 * never empty. Seeded scans use the built-in synthetic sample profile
 * (lib/sample.ts) for their measurements and the photos in public/sample/.
 */
import { BackendError, invalidate, newId } from "./client";
import { currentSubscription } from "./subscription";
import { sampleProfile, sampleScan } from "../sample";
import {
  ADMIN_AUDIT_ACTIONS,
  INCLUDED_MEMBERSHIP_DAYS,
  PLANS,
  SLA_HOURS,
  type AdminAuditEvent,
  type AdSpendRow,
  type AdminRows,
  type CheckoutPlan,
  type ConsentKind,
  type ConsentRow,
  type CostRow,
  type CustomerVisual,
  type GenerationKind,
  type GenerationRow,
  type GenerationWithUrl,
  type Locale,
  type OrderRow,
  type OrderStatus,
  type PaymentRow,
  type PhotoUrls,
  type ProfilePatch,
  type ProfileRow,
  type ReviewBundle,
  type ReviewRow,
  type ScanKind,
  type ScanPhotoRow,
  type ScanPhotoView,
  type ScanRow,
  type SessionInfo,
  type SubscriptionRow,
  type WaitlistRow,
  type AuditLogRow,
  type GenderCode,
} from "./types";

interface MockDb {
  seededAt: string;
  session: SessionInfo | null;
  profiles: ProfileRow[];
  consents: ConsentRow[];
  orders: OrderRow[];
  subscriptions: SubscriptionRow[];
  payments: PaymentRow[];
  scans: ScanRow[];
  scan_photos: ScanPhotoRow[];
  reviews: ReviewRow[];
  generations: GenerationRow[];
  costs: CostRow[];
  ad_spend: AdSpendRow[];
  waitlist: WaitlistRow[];
  audit_log: AuditLogRow[];
}

const STORAGE_KEY = "facet-mock-backend-v3";
/** Seeded scans point at the sample profile instead of copying it (keeps sessionStorage small). */
const SAMPLE_REF = "mock:sample";
const HOUR = 3600_000;
const DAY = 24 * HOUR;
/** Mock-only figures (not real provider prices). */
const MOCK_FEE_RATE = 0.029;
const MOCK_FEE_FIXED_KWD = 0.09;
const MOCK_IMAGE_COST_USD = 0.05;

const sampleBase = () => `${import.meta.env.BASE_URL ?? "/"}sample/`;
const SAMPLE_OUTPUT: Record<GenerationKind, string> = {
  face_after: "face_after.jpg",
  face_after_alt: "face_after_alt.jpg",
  body_after_front: "body_after_front.jpg",
  body_after_side: "body_after_side.jpg",
};
const SAMPLE_PHOTO: Partial<Record<ScanPhotoView, string>> = {
  face: "face.jpg",
  body: "body_front.jpg",
  side: "body_side.jpg",
  faceLeft: "face_left.jpg",
  faceRight: "face_right.jpg",
  face45: "face_45.jpg",
  smile: "face_smile.jpg",
  frown: "face_frown.jpg",
  browRaise: "face_brow_raise.jpg",
};

const iso = (t: number) => new Date(t).toISOString();
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const fee = (amount: number) => r3(amount * MOCK_FEE_RATE + MOCK_FEE_FIXED_KWD);

/* ------------------------------ Seed ------------------------------- */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seed(now = Date.now()): MockDb {
  const rand = rng(20261119);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const db: MockDb = {
    seededAt: iso(now),
    session: null,
    profiles: [],
    consents: [],
    orders: [],
    subscriptions: [],
    payments: [],
    scans: [],
    scan_photos: [],
    reviews: [],
    generations: [],
    costs: [],
    ad_spend: [],
    waitlist: [],
    audit_log: [],
  };

  const reviewers = [1, 2].map<ProfileRow>((n) => ({
    id: newId(),
    full_name: `Demo reviewer ${n}`,
    email: `reviewer${n}@example.com`,
    phone: null,
    locale: "en",
    gender: "male",
    birth_year: null,
    role: "reviewer",
    reviewer_gender: "male",
    created_at: iso(now - 60 * DAY),
  }));
  db.profiles.push(...reviewers, {
    id: newId(),
    full_name: "Demo admin",
    email: "admin@example.com",
    phone: null,
    locale: "en",
    gender: "male",
    birth_year: null,
    role: "admin",
    reviewer_gender: null,
    created_at: iso(now - 90 * DAY),
  });

  const addCustomer = (createdAt: number, n: number): ProfileRow => {
    const p: ProfileRow = {
      id: newId(),
      full_name: `Demo customer ${n}`,
      email: `customer${n}@example.com`,
      phone: null,
      locale: rand() < 0.55 ? "ar" : "en",
      gender: "male",
      birth_year: 1985 + Math.floor(rand() * 20),
      role: "customer",
      reviewer_gender: null,
      created_at: iso(createdAt),
    };
    db.profiles.push(p);
    for (const kind of ["age18", "terms", "privacy", "photos", "withdrawal_waiver"] as ConsentKind[])
      db.consents.push({ id: newId(), user_id: p.id, kind, version: "demo", granted_at: iso(createdAt), withdrawn_at: null });
    return p;
  };

  const addPayment = (userId: string, orderId: string | null, subId: string | null, amount: number, at: number): PaymentRow => {
    const f = fee(amount);
    const pay: PaymentRow = {
      id: newId(),
      order_id: orderId,
      subscription_id: subId,
      user_id: userId,
      provider: "stripe",
      provider_ref: `mock_${newId().slice(0, 8)}`,
      amount,
      currency: "KWD",
      fee: f,
      net: r3(amount - f),
      status: "succeeded",
      created_at: iso(at),
    };
    db.payments.push(pay);
    db.costs.push({ id: newId(), order_id: orderId, user_id: userId, category: "payment_fee", amount: f, currency: "KWD", note: "mock fee", created_at: iso(at) });
    return pay;
  };

  const addGenerations = (order: OrderRow, scanId: string, at: number, approve: boolean) => {
    const reviewer = order.assigned_reviewer;
    for (const kind of ["face_after", "body_after_front", "body_after_side"] as GenerationKind[]) {
      const attempts = 1 + Math.floor(rand() * 3);
      let parent: string | null = null;
      for (let a = 0; a < attempts; a++) {
        const g: GenerationRow = {
          id: newId(),
          order_id: order.id,
          scan_id: scanId,
          requested_by: reviewer,
          kind,
          prompt: `demo prompt for ${kind}`,
          remarks: a > 0 ? "demo remark: keep the face shape, softer light" : null,
          parent_id: parent,
          provider: "higgsfield",
          model: "demo",
          status: "succeeded",
          output_path: `mock:${kind}`,
          cost_usd: MOCK_IMAGE_COST_USD,
          approved: approve && a === attempts - 1,
          error: null,
          created_at: iso(at + a * 10 * 60_000),
        };
        db.generations.push(g);
        db.costs.push({ id: newId(), order_id: order.id, user_id: order.user_id, category: "image_generation", amount: MOCK_IMAGE_COST_USD, currency: "USD", note: `mock ${kind}`, created_at: g.created_at });
        parent = g.id;
      }
    }
  };

  const addOrder = (userId: string, product: "report" | "checkin", createdAt: number, status: OrderStatus, amount: number, subscriptionId: string | null = null): OrderRow => {
    const o: OrderRow = {
      id: newId(),
      user_id: userId,
      product,
      status,
      amount,
      currency: "KWD",
      provider: "stripe",
      provider_ref: `mock_cs_${newId().slice(0, 8)}`,
      plan: product === "report" ? "report" : null,
      subscription_id: subscriptionId,
      scan_id: null,
      assigned_reviewer: null,
      due_at: null,
      paid_at: null,
      submitted_at: null,
      delivered_at: null,
      created_at: iso(createdAt),
    };
    db.orders.push(o);
    if (status === "pending_payment") return o;
    o.paid_at = iso(createdAt + 2 * 60_000);
    if (amount > 0) addPayment(userId, o.id, null, amount, createdAt + 2 * 60_000);
    if (status === "paid" || status === "awaiting_photos") {
      o.status = "awaiting_photos";
      return o;
    }
    const submitted = createdAt + (0.2 + rand() * 6) * HOUR;
    o.submitted_at = iso(submitted);
    o.due_at = iso(submitted + SLA_HOURS * HOUR);
    o.assigned_reviewer = pick(reviewers).id;
    const scanId = newId();
    o.scan_id = scanId;
    // Photos of orders delivered more than 90 days ago are gone, as purge-photos does.
    const purged = status === "delivered" && submitted < now - 92 * DAY ? iso(submitted + 92 * DAY) : null;
    db.scans.push({ id: scanId, user_id: userId, order_id: o.id, kind: product === "report" ? "baseline" : "checkin", intake: SAMPLE_REF, results: SAMPLE_REF, app_version: "demo", created_at: iso(submitted), photos_deleted_at: purged });
    if (!purged) for (const view of Object.keys(SAMPLE_PHOTO) as ScanPhotoView[]) db.scan_photos.push({ scan_id: scanId, view, storage_path: `mock:${view}` });
    if (status === "delivered") {
      const delivered = submitted + (18 + rand() * 70) * HOUR; // some land past the 72h SLA
      o.delivered_at = iso(Math.min(delivered, now - HOUR));
      addGenerations(o, scanId, submitted + 6 * HOUR, true);
      db.reviews.push({ id: newId(), order_id: o.id, reviewer_id: o.assigned_reviewer, status: "approved", checklist: {}, notes: "Demo reviewer note.", item_notes: {}, marker_grades: {}, approved_at: o.delivered_at });
    } else if (status === "in_review" && rand() < 0.5) {
      addGenerations(o, scanId, submitted + 2 * HOUR, false);
      db.reviews.push({ id: newId(), order_id: o.id, reviewer_id: o.assigned_reviewer, status: "in_progress", checklist: {}, notes: "", item_notes: {}, marker_grades: {}, approved_at: null });
    }
    if (status === "cancelled") {
      // Cancelled after submission (e.g. photo consent withdrawn): refund by hand.
      o.status = "cancelled";
    }
    if (status === "refunded") {
      // As the payment webhook does: the original payment stays "succeeded" and
      // the refund is its own row with a negative amount.
      const pay = db.payments.find((p) => p.order_id === o.id && p.status === "succeeded");
      if (pay) {
        db.payments.push({ ...pay, id: newId(), provider_ref: `mock_re_${newId().slice(0, 8)}`, amount: -pay.amount, fee: 0, net: -pay.amount, status: "refunded", created_at: iso(Math.min(Date.parse(pay.created_at) + 2 * DAY, now - HOUR)) });
      }
    }
    return o;
  };

  let n = 1;
  // Older members (outside the 30-day window) so MRR is not empty.
  for (let i = 0; i < 9; i++) {
    const created = now - (35 + rand() * 80) * DAY;
    const c = addCustomer(created, n++);
    const report = addOrder(c.id, "report", created, "delivered", PLANS.report.dueNowKwd);
    const plan = rand() < 0.7 ? "monthly" : "yearly";
    const sub: SubscriptionRow = {
      id: newId(),
      user_id: c.id,
      provider: "stripe",
      provider_sub_id: `mock_sub_${newId().slice(0, 8)}`,
      plan,
      status: rand() < 0.88 ? "active" : "past_due",
      current_period_end: iso(now + (5 + rand() * 25) * DAY),
      cancel_at: null,
      amount: plan === "monthly" ? PLANS.membership_monthly.recurringKwd : PLANS.membership_yearly.recurringKwd,
      currency: "KWD",
      trial_end: iso(Date.parse(report.created_at) + 30 * DAY),
      created_at: report.created_at,
    };
    if (plan === "yearly") sub.current_period_end = iso(Date.parse(report.created_at) + (30 + 365) * DAY);
    // A few members have cancelled: they keep their benefits until the period ends.
    if (sub.status === "active" && rand() < 0.15) sub.cancel_at = sub.current_period_end;
    db.subscriptions.push(sub);
    report.plan = plan === "monthly" ? "report_membership_monthly" : "report_membership_yearly";
    report.subscription_id = sub.id;
    if (sub.status === "past_due") {
      const failedAt = now - rand() * 5 * DAY;
      db.payments.push({ id: newId(), order_id: null, subscription_id: sub.id, user_id: c.id, provider: "stripe", provider_ref: `mock_in_${newId().slice(0, 8)}`, amount: PLANS.membership_monthly.recurringKwd ?? 0, currency: "KWD", fee: 0, net: 0, status: "failed", created_at: iso(failedAt) });
    }
    // Renewal inside the window + its check-in order.
    if (sub.status === "active" && plan === "monthly") {
      const renewed = now - rand() * 25 * DAY;
      addPayment(c.id, null, sub.id, PLANS.membership_monthly.recurringKwd ?? 0, renewed);
      addOrder(c.id, "checkin", renewed + HOUR, renewed < now - 4 * DAY ? "delivered" : "awaiting_photos", 0, sub.id);
    }
  }

  // Two former members whose membership has ended.
  for (let i = 0; i < 2; i++) {
    const created = now - (70 + rand() * 40) * DAY;
    const c = addCustomer(created, n++);
    const report = addOrder(c.id, "report", created, "delivered", PLANS.report.dueNowKwd);
    const ended = created + 60 * DAY;
    const sub: SubscriptionRow = { id: newId(), user_id: c.id, provider: "stripe", provider_sub_id: `mock_sub_${newId().slice(0, 8)}`, plan: "monthly", status: "canceled", current_period_end: iso(ended), cancel_at: iso(ended), canceled_at: iso(ended), trial_end: iso(created + 30 * DAY), amount: PLANS.membership_monthly.recurringKwd, currency: "KWD", created_at: report.created_at };
    db.subscriptions.push(sub);
    report.plan = "report_membership_monthly";
    report.subscription_id = sub.id;
    addPayment(c.id, null, sub.id, sub.amount ?? 0, created + 30 * DAY);
  }

  // Customers in the last 30 days, slightly more recent ones.
  for (let i = 0; i < 38; i++) {
    const ageDays = Math.pow(rand(), 1.2) * 30;
    const created = now - ageDays * DAY;
    const c = addCustomer(created, n++);
    const roll = rand();
    let status: OrderStatus;
    if (roll < 0.06) status = "pending_payment";
    else if (ageDays < 0.5) status = rand() < 0.5 ? "awaiting_photos" : "in_review";
    else if (ageDays < 3.2) status = rand() < 0.15 ? "awaiting_photos" : "in_review";
    else if (roll < 0.1) status = "refunded";
    else if (roll < 0.115) status = "cancelled";
    else if (roll < 0.13) status = "changes_requested";
    else if (roll < 0.17 && ageDays < 6) status = "in_review"; // overdue
    else status = "delivered";
    const o = addOrder(c.id, "report", created, status, PLANS.report.dueNowKwd);
    if (status !== "pending_payment" && status !== "refunded" && status !== "cancelled" && rand() < 0.42) {
      const plan = rand() < 0.75 ? "monthly" : "yearly";
      const trialEnd = Date.parse(o.created_at) + 30 * DAY;
      const sub: SubscriptionRow = {
        id: newId(),
        user_id: c.id,
        provider: "stripe",
        provider_sub_id: `mock_sub_${newId().slice(0, 8)}`,
        plan,
        status: trialEnd > now ? "trialing" : "active",
        current_period_end: iso(trialEnd > now ? trialEnd : trialEnd + (plan === "monthly" ? 30 : 365) * DAY),
        cancel_at: null,
        trial_end: iso(trialEnd),
        amount: plan === "monthly" ? PLANS.membership_monthly.recurringKwd : PLANS.membership_yearly.recurringKwd,
        currency: "KWD",
        created_at: o.created_at,
      };
      if (rand() < 0.12) sub.cancel_at = sub.current_period_end;
      db.subscriptions.push(sub);
      o.plan = plan === "monthly" ? "report_membership_monthly" : "report_membership_yearly";
      o.subscription_id = sub.id;
      // The first membership payment, when the 30 days included with the report ended.
      if (trialEnd <= now) addPayment(c.id, null, sub.id, sub.amount ?? 0, trialEnd);
    }
  }

  // Always one order whose photos need retaking and one cancelled after a photo consent withdrawal.
  if (!db.orders.some((o) => o.status === "changes_requested")) {
    const created = now - 2 * DAY;
    addOrder(addCustomer(created, n++).id, "report", created, "changes_requested", PLANS.report.dueNowKwd);
  }
  if (!db.orders.some((o) => o.status === "cancelled" && o.submitted_at)) {
    const created = now - 9 * DAY;
    addOrder(addCustomer(created, n++).id, "report", created, "cancelled", PLANS.report.dueNowKwd);
  }

  // Report bought on its own: the included month (ends 30 days after payment;
  // one or two end within 5 days, so the reminder case is visible).
  for (const o of db.orders) {
    if (o.product !== "report" || o.plan !== "report" || !o.paid_at || !o.user_id || o.status === "refunded" || o.status === "pending_payment") continue;
    if (db.subscriptions.some((x) => x.user_id === o.user_id)) continue;
    const end = Date.parse(o.paid_at) + INCLUDED_MEMBERSHIP_DAYS * DAY;
    const sub: SubscriptionRow = {
      id: newId(),
      user_id: o.user_id,
      provider: "manual",
      provider_sub_id: `included:${o.id}`,
      plan: "included",
      status: end > now ? "active" : "canceled",
      current_period_end: iso(end),
      cancel_at: null,
      canceled_at: end > now ? null : iso(end),
      trial_end: null,
      amount: 0,
      currency: "KWD",
      created_at: o.paid_at,
    };
    db.subscriptions.push(sub);
    o.subscription_id = sub.id;
  }

  // Two customers who deleted their account: orders and payments stay, without user_id.
  for (let i = 0; i < 2; i++) {
    const created = now - (8 + rand() * 18) * DAY;
    const c = addCustomer(created, n++);
    const o = addOrder(c.id, "report", created, "delivered", PLANS.report.dueNowKwd);
    db.profiles = db.profiles.filter((x) => x.id !== c.id);
    db.consents = db.consents.filter((x) => x.user_id !== c.id);
    const gone = new Set(db.scans.filter((x) => x.user_id === c.id).map((x) => x.id));
    db.scan_photos = db.scan_photos.filter((x) => !gone.has(x.scan_id));
    db.scans = db.scans.filter((x) => x.user_id !== c.id);
    o.scan_id = null;
    for (const x of db.orders) if (x.user_id === c.id) x.user_id = null;
    for (const x of db.payments) if (x.user_id === c.id) x.user_id = null;
    for (const x of db.costs) if (x.user_id === c.id) x.user_id = null;
    db.generations = db.generations.filter((g) => g.order_id !== o.id);
  }

  // Audit rows the operator dashboard lists.
  const seedAudit = (action: string, target_type: string, target_id: string, meta: Record<string, unknown>, at: number) =>
    db.audit_log.push({ id: newId(), actor: null, action, target_type, target_id, meta, at: iso(Math.min(at, now - 10 * 60_000)) });
  for (const o of db.orders) {
    const at = Date.parse(o.submitted_at ?? o.created_at);
    if (o.status === "cancelled" && o.submitted_at) {
      const started = db.generations.some((g) => g.order_id === o.id);
      seedAudit("orders.cancelled_consent_withdrawn", "orders", o.id, { from: "in_review", product: o.product, amount: o.amount, currency: o.currency, review_started: started, withdrawal_waiver: true, refund: "manual", refund_policy: started ? "partial" : "full" }, at + 20 * HOUR);
    }
    if (o.status === "changes_requested") seedAudit("orders.changes_requested", "orders", o.id, { from: "in_review", emailed: true, with_message: true }, at + 5 * HOUR);
  }
  const yearly = db.subscriptions.find((x) => x.plan === "yearly");
  if (yearly) seedAudit("stripe.schedule_failed", "subscriptions", yearly.id, { subscription: yearly.provider_sub_id, error: "demo: the schedule could not be created" }, Date.parse(yearly.created_at) + 60_000);

  // Ad spend (USD), last 30 days.
  const campaigns: { platform: AdSpendRow["platform"]; id: string; name: string; base: number; cvr: number }[] = [
    { platform: "meta", id: "demo_meta_1", name: "KW | Men 18-34 | Scan video (demo)", base: 18, cvr: 0.009 },
    { platform: "meta", id: "demo_meta_2", name: "KW | Retargeting | Report preview (demo)", base: 7, cvr: 0.014 },
    { platform: "snap", id: "demo_snap_1", name: "KW | Snap story | Glow-up (demo)", base: 9, cvr: 0.004 },
  ];
  for (let d = 0; d < 30; d++) {
    const date = iso(now - d * DAY).slice(0, 10);
    for (const c of campaigns) {
      const spend = r3(c.base * (0.7 + rand() * 0.6));
      const impressions = Math.round(spend * (220 + rand() * 160));
      const clicks = Math.round(impressions * (0.008 + rand() * 0.01));
      const purchases = Math.floor(clicks * c.cvr + rand() * 0.6);
      db.ad_spend.push({ id: newId(), date, platform: c.platform, campaign_id: c.id, campaign_name: c.name, spend, currency: "USD", impressions, clicks, purchases });
    }
  }

  // Waitlist (women at launch, plus a few others).
  for (let i = 1; i <= 27; i++) {
    const gender: GenderCode = i % 9 === 0 ? "male" : "female";
    db.waitlist.push({ id: newId(), email: `waitlist${i}@example.com`, phone: null, gender, locale: rand() < 0.6 ? "ar" : "en", source: pick(["landing", "instagram", "snapchat", "referral"]), created_at: iso(now - rand() * 40 * DAY) });
  }

  return db;
}

/* ---------------------------- Persistence --------------------------- */

let db: MockDb | null = null;
const photoBlobs = new Map<string, string>(); // storage path -> object URL
const sessionListeners = new Set<(s: SessionInfo | null) => void>();

function load(): MockDb {
  if (db) return db;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) db = JSON.parse(raw) as MockDb;
  } catch {
    /* storage blocked */
  }
  db ??= seed();
  expireIncluded(db);
  return db;
}

function save() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    /* storage blocked or full: keep in memory */
  }
}

function commit() {
  save();
  invalidate();
}

const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms));

/** Metadata passed with sendCode, applied when verifyCode creates the profile. */
const signupMeta = new Map<string, { locale?: Locale; gender?: GenderCode }>();

/** True when the user has an active (not withdrawn) consent of this kind. */
function hasConsent(d: { consents: ConsentRow[] }, userId: string, kind: ConsentKind): boolean {
  return d.consents.some((c) => c.user_id === userId && c.kind === kind && !c.withdrawn_at);
}

function me(): ProfileRow {
  const d = load();
  if (!d.session) throw new BackendError("Please sign in first.", "not_signed_in");
  const p = d.profiles.find((x) => x.id === d.session!.userId);
  if (!p) throw new BackendError("Profile not found.", "not_found");
  return p;
}

function requireStaff(): ProfileRow {
  const p = me();
  if (p.role !== "reviewer" && p.role !== "admin") throw new BackendError("Reviewer access only.", "forbidden");
  return p;
}

function audit(action: string, target_type: string, target_id: string, meta: unknown = null) {
  load().audit_log.push({ id: newId(), actor: load().session?.userId ?? null, action, target_type, target_id, meta, at: iso(Date.now()) });
}

function photoUrl(path: string): string | null {
  if (photoBlobs.has(path)) return photoBlobs.get(path)!;
  const view = path.startsWith("mock:") ? (path.slice(5) as ScanPhotoView) : (path.split("/").pop()?.replace(".jpg", "") as ScanPhotoView);
  const f = SAMPLE_PHOTO[view];
  return f ? sampleBase() + f : null;
}

function generationUrl(g: GenerationRow): string | null {
  if (g.status !== "succeeded" || !g.output_path) return null;
  return sampleBase() + SAMPLE_OUTPUT[g.kind];
}

/** A seeded scan carries the sample profile's intake and measurements (under the customer's demo name). */
function hydrateScan(scan: ScanRow): ScanRow {
  if (scan.results !== SAMPLE_REF && scan.intake !== SAMPLE_REF) return scan;
  const owner = load().profiles.find((p) => p.id === scan.user_id);
  return {
    ...scan,
    intake: scan.intake === SAMPLE_REF ? { ...sampleProfile.intake, name: owner?.full_name ?? "Demo customer" } : scan.intake,
    results: scan.results === SAMPLE_REF ? { ...sampleScan, id: scan.id, createdAt: scan.created_at } : scan.results,
  };
}

/** As expire_included_memberships: included months that are over end. */
function expireIncluded(d: MockDb, now = Date.now()) {
  for (const x of d.subscriptions)
    if (x.plan === "included" && x.status === "active" && (!x.current_period_end || Date.parse(x.current_period_end) <= now)) {
      x.status = "canceled";
      x.canceled_at = x.current_period_end;
    }
}

/** As grant_included_membership: a report bought on its own gives 30 days of membership (no renewal). */
function grantIncluded(d: MockDb, o: OrderRow, now = Date.now()) {
  if (!o.user_id || o.plan !== "report") return;
  if (d.subscriptions.some((x) => x.user_id === o.user_id && x.plan !== "included" && (x.status === "active" || x.status === "trialing" || x.status === "past_due"))) return;
  const end = iso(Date.parse(o.paid_at ?? iso(now)) + INCLUDED_MEMBERSHIP_DAYS * DAY);
  const running = d.subscriptions.find((x) => x.user_id === o.user_id && x.plan === "included" && x.status === "active");
  if (running) {
    if ((running.current_period_end ?? "") < end) running.current_period_end = end;
    o.subscription_id ??= running.id;
    return;
  }
  const id = newId();
  d.subscriptions.push({ id, user_id: o.user_id, provider: "manual", provider_sub_id: `included:${o.id}`, plan: "included", status: "active", current_period_end: end, cancel_at: null, canceled_at: null, trial_end: null, amount: 0, currency: "KWD", created_at: iso(now) });
  o.subscription_id = id;
}

const ADMIN_ACTIONS = new Set<string>(ADMIN_AUDIT_ACTIONS);

/** audit_log row -> AdminAuditEvent (same mapping as admin.ts toAuditEvent). */
function auditEvent(r: AuditLogRow): AdminAuditEvent {
  const meta = r.meta && typeof r.meta === "object" && !Array.isArray(r.meta) ? (r.meta as Record<string, unknown>) : {};
  const isOrder = r.target_type === "orders" || r.target_type === "order";
  return {
    id: r.id,
    action: r.action as AdminAuditEvent["action"],
    created_at: r.at,
    order_id: isOrder ? r.target_id : null,
    details: isOrder || !r.target_id ? meta : { ...meta, [`${r.target_type ?? "target"}_id`]: r.target_id },
  };
}

/** Whole calendar months from `from` until `to`. */
function monthsLeft(from: Date, to: Date): number {
  let m = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  const probe = new Date(from);
  probe.setUTCMonth(probe.getUTCMonth() + m);
  if (probe > to) m--;
  return Math.max(0, m);
}

/* ------------------------------ API -------------------------------- */

export const mock = {
  reset() {
    db = seed();
    photoBlobs.forEach((u) => URL.revokeObjectURL(u));
    photoBlobs.clear();
    commit();
    sessionListeners.forEach((l) => l(null));
  },

  /* auth */
  getSession(): SessionInfo | null {
    return load().session;
  },
  onSession(cb: (s: SessionInfo | null) => void) {
    sessionListeners.add(cb);
    return () => {
      sessionListeners.delete(cb);
    };
  },
  async sendCode(email: string, meta: { locale?: Locale; gender?: GenderCode } = {}) {
    await delay();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BackendError("Please enter a valid email address.", "invalid_email");
    signupMeta.set(email.trim().toLowerCase(), meta);
  },
  async verifyCode(email: string, code: string): Promise<SessionInfo> {
    await delay();
    if (!/^\d{6}$/.test(code.trim())) throw new BackendError("The code is 6 digits. (Demo mode: any 6 digits work.)", "invalid_code");
    const d = load();
    const e = email.trim().toLowerCase();
    let p = d.profiles.find((x) => x.email === e);
    if (!p) {
      const role = e.startsWith("admin") ? "admin" : e.startsWith("review") ? "reviewer" : "customer";
      // Like handle_new_user: locale and gender come from the sign-up metadata.
      const meta = signupMeta.get(e) ?? {};
      p = { id: newId(), full_name: null, email: e, phone: null, locale: meta.locale ?? null, gender: meta.gender ?? null, birth_year: null, role, reviewer_gender: role === "reviewer" ? "male" : null, created_at: iso(Date.now()) };
      d.profiles.push(p);
      if (role === "reviewer") {
        // A demo reviewer gets work at once: the open orders of "Demo reviewer 1", plus any order
        // sent in this demo session (so a customer's own test order can be reviewed end to end).
        const first = d.profiles.find((x) => x.email === "reviewer1@example.com");
        const seeded = (userId: string | null) => /^customer\d+@example\.com$/.test(d.profiles.find((x) => x.id === userId)?.email ?? "");
        for (const o of d.orders)
          if ((o.status === "in_review" || o.status === "changes_requested") && ((first && o.assigned_reviewer === first.id) || !seeded(o.user_id))) o.assigned_reviewer = p.id;
        for (const r of d.reviews) if (first && r.reviewer_id === first.id && r.status === "in_progress") r.reviewer_id = p.id;
      }
    }
    d.session = { userId: p.id, email: e };
    commit();
    sessionListeners.forEach((l) => l(d.session));
    return d.session;
  },
  async signOut() {
    load().session = null;
    commit();
    sessionListeners.forEach((l) => l(null));
  },

  /* profile */
  async getProfile(): Promise<ProfileRow | null> {
    const d = load();
    if (!d.session) return null;
    return d.profiles.find((p) => p.id === d.session!.userId) ?? null;
  },
  async updateProfile(patch: ProfilePatch): Promise<ProfileRow> {
    const p = me();
    Object.assign(p, patch);
    commit();
    return p;
  },

  /* orders */
  async startCheckout(plan: CheckoutPlan, locale: Locale): Promise<{ url: string; orderId: string | null }> {
    await delay(300);
    const p = me();
    const d = load();
    // Same business rules as create-checkout.
    if (p.gender === "female") throw new BackendError("We are opening for women soon. Please join the waitlist.", "waitlist");
    if (p.gender !== "male") throw new BackendError("Please complete your profile before paying.", "profile_incomplete");
    if (!hasConsent(d, p.id, "age18")) throw new BackendError("Please confirm you are 18 or older.", "age_required");
    if (p.birth_year && new Date().getUTCFullYear() - p.birth_year < 18) throw new BackendError("This service is for people aged 18 and over.", "under_18");
    const info = PLANS[plan];
    const now = Date.now();
    let subId: string | null = null;
    // As create-checkout: the return pages are in the customer's language.
    const base = `${import.meta.env.BASE_URL ?? "/"}${locale === "ar" ? "ar/" : ""}`;
    if (info.interval) {
      expireIncluded(d, now);
      const open = d.subscriptions.filter((x) => x.user_id === p.id && (x.status === "active" || x.status === "trialing" || x.status === "past_due"));
      if (open.some((x) => x.plan !== "included")) {
        throw new BackendError("You already have a membership.", "already_member");
      }
      // Joining during the included month: the trial runs until it ends (at least 49 hours, as Stripe needs 48).
      const includedEnd = Math.max(0, ...open.map((x) => Date.parse(x.current_period_end ?? "") || 0));
      const trialUntil = info.trialDays ? now + info.trialDays * DAY : includedEnd > now ? Math.max(includedEnd, now + 49 * HOUR) : null;
      subId = newId();
      d.subscriptions.push({
        id: subId,
        user_id: p.id,
        provider: "manual",
        provider_sub_id: `mock_sub_${subId.slice(0, 8)}`,
        plan: info.interval,
        status: trialUntil ? "trialing" : "active",
        current_period_end: iso(trialUntil ?? now + (info.interval === "monthly" ? 30 : 365) * DAY),
        cancel_at: null,
        trial_end: trialUntil ? iso(trialUntil) : null,
        amount: info.recurringKwd,
        currency: "KWD",
        created_at: iso(now),
      });
      // As on_paid_membership_started: the paid membership replaces the included month.
      for (const x of open) {
        x.status = "canceled";
        x.canceled_at = iso(now);
      }
      if (!info.includesReport) {
        // A plain membership: the first check-in comes with the first paid period (not during a trial).
        if (!trialUntil) {
          const c: OrderRow = { id: newId(), user_id: p.id, product: "checkin", status: "awaiting_photos", amount: info.dueNowKwd, currency: "KWD", provider: "manual", provider_ref: `mock_in_${newId().slice(0, 8)}`, plan: null, subscription_id: subId, scan_id: null, assigned_reviewer: null, due_at: null, paid_at: iso(now), submitted_at: null, delivered_at: null, created_at: iso(now) };
          d.orders.push(c);
          const f = fee(info.dueNowKwd);
          d.payments.push({ id: newId(), order_id: c.id, subscription_id: subId, user_id: p.id, provider: "manual", provider_ref: c.provider_ref, amount: info.dueNowKwd, currency: "KWD", fee: f, net: r3(info.dueNowKwd - f), status: "succeeded", created_at: iso(now) });
          d.costs.push({ id: newId(), order_id: c.id, user_id: p.id, category: "payment_fee", amount: f, currency: "KWD", note: "mock fee", created_at: iso(now) });
        }
        audit("membership.joined", "subscriptions", subId, { plan, trial_until: trialUntil ? iso(trialUntil) : null, mock: true });
        commit();
        return { url: `${base}account?checkout=success`, orderId: null };
      }
    }
    const o: OrderRow = {
      id: newId(),
      user_id: p.id,
      product: "report",
      status: "awaiting_photos",
      amount: info.dueNowKwd,
      currency: "KWD",
      provider: "manual",
      provider_ref: `mock_cs_${newId().slice(0, 8)}`,
      plan,
      subscription_id: subId,
      scan_id: null,
      assigned_reviewer: null,
      due_at: null,
      paid_at: iso(now),
      submitted_at: null,
      delivered_at: null,
      created_at: iso(now),
    };
    d.orders.push(o);
    const f = fee(info.dueNowKwd);
    d.payments.push({ id: newId(), order_id: o.id, subscription_id: null, user_id: p.id, provider: "manual", provider_ref: o.provider_ref, amount: info.dueNowKwd, currency: "KWD", fee: f, net: r3(info.dueNowKwd - f), status: "succeeded", created_at: iso(now) });
    d.costs.push({ id: newId(), order_id: o.id, user_id: p.id, category: "payment_fee", amount: f, currency: "KWD", note: "mock fee", created_at: iso(now) });
    grantIncluded(d, o, now);
    audit("order.paid", "order", o.id, { plan, mock: true });
    commit();
    return { url: `${base}orders/${o.id}?checkout=success`, orderId: o.id };
  },
  async listMyOrders(): Promise<OrderRow[]> {
    const p = me();
    return load()
      .orders.filter((o) => o.user_id === p.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  async getOrder(id: string): Promise<OrderRow | null> {
    const p = me();
    const o = load().orders.find((x) => x.id === id) ?? null;
    if (o && o.user_id !== p.id && p.role === "customer") return null;
    return o;
  },
  async getMySubscription(): Promise<SubscriptionRow | null> {
    const p = me();
    return currentSubscription(load().subscriptions.filter((s) => s.user_id === p.id));
  },
  async getMyReview(orderId: string): Promise<ReviewRow | null> {
    const p = me();
    const d = load();
    const o = d.orders.find((x) => x.id === orderId && x.user_id === p.id);
    if (!o || o.status !== "delivered") return null;
    return d.reviews.find((r) => r.order_id === orderId) ?? null;
  },
  async customerVisuals(orderId?: string): Promise<CustomerVisual[]> {
    const p = me();
    const d = load();
    const delivered = new Set(d.orders.filter((o) => o.user_id === p.id && o.status === "delivered" && (!orderId || o.id === orderId)).map((o) => o.id));
    return d.generations
      .filter((g) => g.approved && delivered.has(g.order_id))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((g) => ({ generation_id: g.id, order_id: g.order_id, kind: g.kind, url: generationUrl(g) ?? "", created_at: g.created_at }));
  },

  /* scans */
  async submitScan(args: { orderId: string; kind: ScanKind; intake: unknown; results: unknown; appVersion: string; photos: { view: ScanPhotoView; blob: Blob }[]; scanId?: string }): Promise<{ scanId: string; dueAt: string }> {
    await delay(400);
    const p = me();
    const d = load();
    const o = d.orders.find((x) => x.id === args.orderId && x.user_id === p.id);
    if (!o) throw new BackendError("Order not found.", "not_found");
    if (o.status !== "awaiting_photos" && o.status !== "changes_requested") throw new BackendError("This order is not waiting for photos.", "wrong_status");
    // Same checks as submit-scan.
    if (!hasConsent(d, p.id, "photos")) throw new BackendError("Please agree to the photo consent first.", "photo_consent_required");
    if (!hasConsent(d, p.id, "withdrawal_waiver")) throw new BackendError("Please confirm that we may start your review now, within the 14-day withdrawal period.", "withdrawal_waiver_required", 409);
    if (!p.gender) throw new BackendError("Please complete your profile first.", "profile_incomplete");
    if (args.scanId && d.scans.some((s) => s.id === args.scanId)) throw new BackendError("This scan was already submitted.", "wrong_status");
    const scanId = args.scanId ?? newId();
    d.scans.push({ id: scanId, user_id: p.id, order_id: o.id, kind: args.kind, intake: args.intake, results: args.results, app_version: args.appVersion, created_at: iso(Date.now()), photos_deleted_at: null });
    for (const ph of args.photos) {
      const path = `${p.id}/${scanId}/${ph.view}.jpg`;
      photoBlobs.set(path, URL.createObjectURL(ph.blob));
      d.scan_photos.push({ scan_id: scanId, view: ph.view, storage_path: path });
    }
    const now = Date.now();
    o.status = "in_review";
    o.scan_id = scanId;
    o.submitted_at = iso(now);
    o.due_at = iso(now + SLA_HOURS * HOUR);
    const reviewers = d.profiles.filter((x) => x.role === "reviewer");
    const load_ = (id: string) => d.orders.filter((x) => x.assigned_reviewer === id && (x.status === "in_review" || x.status === "changes_requested")).length;
    o.assigned_reviewer = reviewers.sort((a, b) => load_(a.id) - load_(b.id))[0]?.id ?? null;
    audit("scan.submitted", "order", o.id, { scan_id: scanId });
    commit();
    return { scanId, dueAt: o.due_at };
  },
  async getScanForOrder(orderId: string): Promise<{ scan: ScanRow; photos: PhotoUrls } | null> {
    const p = me();
    const d = load();
    const visible = d.scans.filter((s) => s.order_id === orderId && (s.user_id === p.id || p.role !== "customer"));
    // The scan submit-scan accepted, or else the latest one (as the real client does).
    const acceptedId = d.orders.find((o) => o.id === orderId)?.scan_id;
    const raw = visible.find((s) => s.id === acceptedId) ?? visible.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (!raw) return null;
    const scan = hydrateScan(raw);
    const photos: PhotoUrls = {};
    if (!scan.photos_deleted_at)
      for (const ph of d.scan_photos.filter((x) => x.scan_id === scan.id)) {
        const u = photoUrl(ph.storage_path);
        if (u) photos[ph.view] = u;
      }
    return { scan, photos };
  },

  /* review */
  async reviewQueue(): Promise<OrderRow[]> {
    const p = requireStaff();
    return load()
      .orders.filter((o) => (o.status === "in_review" || o.status === "changes_requested") && (p.role === "admin" || o.assigned_reviewer === p.id))
      .sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""));
  },
  async reviewBundle(orderId: string): Promise<ReviewBundle> {
    const p = requireStaff();
    const d = load();
    const order = d.orders.find((o) => o.id === orderId);
    if (!order || (p.role !== "admin" && order.assigned_reviewer !== p.id)) throw new BackendError("Order not found or not assigned to you.", "not_found");
    const s = await mock.getScanForOrder(orderId);
    const generations: GenerationWithUrl[] = d.generations
      .filter((g) => g.order_id === orderId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((g) => ({ ...g, url: generationUrl(g) }));
    return { order, scan: s?.scan ?? null, photos: s?.photos ?? {}, review: d.reviews.find((r) => r.order_id === orderId) ?? null, generations };
  },
  async saveReview(orderId: string, patch: Partial<Pick<ReviewRow, "status" | "checklist" | "notes" | "item_notes" | "marker_grades">>): Promise<ReviewRow> {
    const p = requireStaff();
    const d = load();
    let r = d.reviews.find((x) => x.order_id === orderId);
    if (!r) {
      r = { id: newId(), order_id: orderId, reviewer_id: p.id, status: "in_progress", checklist: {}, notes: "", item_notes: {}, marker_grades: {}, approved_at: null };
      d.reviews.push(r);
    }
    Object.assign(r, patch);
    commit();
    return r;
  },
  async generateVisual(input: { order_id: string; kind: GenerationKind; prompt: string; remarks?: string | null; parent_id?: string | null }): Promise<GenerationWithUrl> {
    const p = requireStaff();
    await delay(1200);
    const d = load();
    const o = d.orders.find((x) => x.id === input.order_id);
    if (!o) throw new BackendError("Order not found.", "not_found");
    const scan = d.scans.find((s) => s.order_id === o.id);
    const g: GenerationRow = {
      id: newId(),
      order_id: o.id,
      scan_id: scan?.id ?? null,
      requested_by: p.id,
      kind: input.kind,
      prompt: input.prompt,
      remarks: input.remarks ?? null,
      parent_id: input.parent_id ?? null,
      provider: "higgsfield",
      model: "demo",
      status: "succeeded",
      output_path: `mock:${input.kind}`,
      cost_usd: MOCK_IMAGE_COST_USD,
      approved: false,
      error: null,
      created_at: iso(Date.now()),
    };
    d.generations.push(g);
    d.costs.push({ id: newId(), order_id: o.id, user_id: o.user_id, category: "image_generation", amount: g.cost_usd, currency: "USD", note: `mock ${g.kind}`, created_at: g.created_at });
    audit("visual.generated", "generation", g.id, { kind: g.kind });
    commit();
    return { ...g, url: generationUrl(g) };
  },
  async approveDelivery(input: { order_id: string; generation_ids: string[]; notes?: string }): Promise<{ order: OrderRow; emailed: boolean }> {
    const p = requireStaff();
    await delay(300);
    const d = load();
    const orderId = input.order_id;
    const generationIds = input.generation_ids;
    const o = d.orders.find((x) => x.id === orderId);
    if (!o) throw new BackendError("Order not found.", "not_found");
    if (p.role !== "admin" && o.assigned_reviewer !== p.id) throw new BackendError("This order is not assigned to you.", "forbidden", 403);
    if (o.status !== "in_review") throw new BackendError("Only orders in review can be delivered.", "wrong_status", 409);
    const ids = new Set(generationIds);
    for (const g of d.generations) if (g.order_id === orderId) g.approved = ids.has(g.id);
    const now = iso(Date.now());
    let r = d.reviews.find((x) => x.order_id === orderId);
    if (!r) {
      r = { id: newId(), order_id: orderId, reviewer_id: p.id, status: "approved", checklist: {}, notes: "", item_notes: {}, marker_grades: {}, approved_at: now };
      d.reviews.push(r);
    }
    r.status = "approved";
    r.approved_at = now;
    if (typeof input.notes === "string") r.notes = input.notes.slice(0, 20000);
    o.status = "delivered";
    o.delivered_at = now;
    // The demo sends no email; the customer is "emailed" when the account still exists.
    const emailed = !!o.user_id && d.profiles.some((x) => x.id === o.user_id);
    audit("orders.delivered", "orders", o.id, { generation_ids: generationIds, emailed });
    commit();
    return { order: o, emailed };
  },
  /** As set-order-status: in_review <-> changes_requested; changes_requested "emails" the customer. */
  async setOrderStatus(orderId: string, status: OrderStatus, message: string | null = null): Promise<{ order: OrderRow; emailed: boolean }> {
    const p = requireStaff();
    const d = load();
    const o = d.orders.find((x) => x.id === orderId);
    if (!o) throw new BackendError("Order not found.", "not_found");
    if (p.role !== "admin" && o.assigned_reviewer !== p.id) throw new BackendError("This order is not assigned to you.", "forbidden", 403);
    const allowed: OrderStatus[] = ["in_review", "changes_requested"];
    if (!allowed.includes(status)) throw new BackendError("status must be in_review or changes_requested.", "bad_status", 400);
    if (!allowed.includes(o.status)) throw new BackendError("Only orders in review can be changed here.", "wrong_status", 409);
    if (o.status === status) return { order: o, emailed: false };
    const from = o.status;
    o.status = status;
    const emailed = status === "changes_requested" && !!o.user_id && d.profiles.some((x) => x.id === o.user_id);
    if (status === "changes_requested") audit("orders.changes_requested", "orders", o.id, { from, emailed, with_message: !!message?.trim() });
    commit();
    return { order: o, emailed };
  },

  /* admin (no role check in demo mode, so the dashboard can be shown without signing in) */
  async adminRows(sinceIso: string): Promise<AdminRows> {
    await delay();
    const d = load();
    const open = (o: OrderRow) => o.status === "in_review" || o.status === "changes_requested";
    return {
      orders: d.orders.filter((o) => o.created_at >= sinceIso || open(o) || (o.delivered_at ?? "") >= sinceIso),
      payments: d.payments.filter((x) => x.created_at >= sinceIso),
      subscriptions: d.subscriptions,
      generations: d.generations.filter((g) => g.created_at >= sinceIso).map(({ id, order_id, cost_usd, status, created_at, parent_id, kind }) => ({ id, order_id, cost_usd, status, created_at, parent_id, kind })),
      costs: d.costs.filter((c) => c.created_at >= sinceIso),
      adSpend: d.ad_spend.filter((a) => a.date >= sinceIso.slice(0, 10)),
      profiles: d.profiles.map(({ id, email, role, created_at }) => ({ id, email, role, created_at })),
      waitlist: d.waitlist.map(({ id, email, gender, locale, source, created_at }) => ({ id, email, gender, locale, source, created_at })),
      auditEvents: d.audit_log
        .filter((r) => ADMIN_ACTIONS.has(r.action))
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 200)
        .map(auditEvent),
    };
  },

  /* consents */
  async addConsents(kinds: ConsentKind[], version: string): Promise<ConsentRow[]> {
    const p = me();
    const d = load();
    const now = iso(Date.now());
    const rows = kinds.map<ConsentRow>((kind) => ({ id: newId(), user_id: p.id, kind, version, granted_at: now, withdrawn_at: null }));
    d.consents.push(...rows);
    commit();
    return rows;
  },
  async listConsents(): Promise<ConsentRow[]> {
    const p = me();
    return load().consents.filter((c) => c.user_id === p.id);
  },
  async withdrawConsent(kind: ConsentKind) {
    const p = me();
    const now = iso(Date.now());
    for (const c of load().consents) if (c.user_id === p.id && c.kind === kind && !c.withdrawn_at) c.withdrawn_at = now;
    commit();
  },

  /* waitlist */
  async joinWaitlist(entry: { email: string; phone?: string | null; gender: GenderCode | null; locale: Locale; source?: string | null }): Promise<"joined" | "already"> {
    await delay();
    const d = load();
    const email = entry.email.trim().toLowerCase();
    if (d.waitlist.some((w) => w.email === email)) return "already";
    d.waitlist.push({ id: newId(), email, phone: entry.phone ?? null, gender: entry.gender, locale: entry.locale, source: entry.source ?? null, created_at: iso(Date.now()) });
    commit();
    return "joined";
  },

  /* account */
  async exportData() {
    const p = me();
    const d = load();
    const orderIds = new Set(d.orders.filter((o) => o.user_id === p.id).map((o) => o.id));
    const scans = d.scans.filter((s) => s.user_id === p.id);
    const scanIds = new Set(scans.map((s) => s.id));
    return {
      profile: p,
      consents: d.consents.filter((c) => c.user_id === p.id),
      orders: d.orders.filter((o) => o.user_id === p.id),
      subscriptions: d.subscriptions.filter((s) => s.user_id === p.id),
      payments: d.payments.filter((x) => x.user_id === p.id),
      scans: scans.map(hydrateScan),
      scan_photos: d.scan_photos.filter((x) => scanIds.has(x.scan_id)),
      reviews: d.reviews.filter((r) => orderIds.has(r.order_id) && d.orders.find((o) => o.id === r.order_id)?.status === "delivered"),
    };
  },
  /** As withdraw-photo-consent: photos and measurements gone, submitted-but-undelivered orders cancelled. */
  async withdrawPhotoConsent(): Promise<{ scans: number; files: number; cancelledOrders: string[] }> {
    await delay(300);
    const p = me();
    const d = load();
    const now = iso(Date.now());
    const scans = d.scans.filter((s) => s.user_id === p.id);
    const scanIds = new Set(scans.map((s) => s.id));
    let files = 0;
    for (const ph of d.scan_photos.filter((x) => scanIds.has(x.scan_id))) {
      const u = photoBlobs.get(ph.storage_path);
      if (u) URL.revokeObjectURL(u);
      photoBlobs.delete(ph.storage_path);
      files++;
    }
    d.scan_photos = d.scan_photos.filter((x) => !scanIds.has(x.scan_id));
    let cleared = 0;
    for (const s of scans) {
      if (s.photos_deleted_at && JSON.stringify(s.intake ?? {}) === "{}" && JSON.stringify(s.results ?? {}) === "{}") continue;
      s.photos_deleted_at ??= now;
      s.intake = {};
      s.results = {};
      cleared++;
    }
    for (const c of d.consents) if (c.user_id === p.id && c.kind === "photos" && !c.withdrawn_at) c.withdrawn_at = now;
    const cancelled: string[] = [];
    for (const o of d.orders) {
      if (o.user_id !== p.id || (o.status !== "in_review" && o.status !== "changes_requested")) continue;
      const started = d.reviews.some((r) => r.order_id === o.id) || d.generations.some((g) => g.order_id === o.id);
      audit("orders.cancelled_consent_withdrawn", "orders", o.id, { from: o.status, refund: "manual", refund_policy: o.amount <= 0 ? "none (included check-in)" : started ? "partial" : "full" });
      o.status = "cancelled";
      for (const g of d.generations) if (g.order_id === o.id) {
        g.output_path = null;
        g.approved = false;
      }
      cancelled.push(o.id);
    }
    audit("consents.photos_withdrawn", "user", p.id, { scans: cleared, files, orders_cancelled: cancelled.length });
    commit();
    return { scans: cleared, files, cancelledOrders: cancelled };
  },

  /** As manage-membership (no money moves in the demo). */
  async manageMembership(action: "cancel" | "resume" | "end_now"): Promise<{ subscription: SubscriptionRow; refund?: { amount: number; currency: string; months: number; pending: boolean } }> {
    await delay(300);
    const p = me();
    const d = load();
    expireIncluded(d);
    const open = d.subscriptions
      .filter((x) => x.user_id === p.id && (x.status === "active" || x.status === "trialing" || x.status === "past_due"))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const sub = open.find((x) => x.plan !== "included");
    if (!sub && open.length) throw new BackendError("The month included with your report ends by itself and nothing renews, so there is nothing to cancel.", "included", 409);
    if (!sub) throw new BackendError("You do not have an active membership.", "no_membership");
    let refund: { amount: number; currency: string; months: number; pending: boolean } | undefined;
    if (action === "cancel") sub.cancel_at ??= sub.current_period_end;
    else if (action === "resume") sub.cancel_at = null;
    else {
      if (sub.plan !== "yearly") throw new BackendError("A monthly membership ends at the end of the month you have paid for, so it can only be cancelled.", "not_yearly");
      if (sub.status === "trialing") throw new BackendError("Nothing has been charged for the membership yet, so it can only be cancelled.", "trialing");
      const months = sub.current_period_end ? monthsLeft(new Date(), new Date(sub.current_period_end)) : 0;
      const price = sub.amount ?? PLANS.membership_yearly.recurringKwd ?? 0;
      const amount = Math.floor((Math.round(price * 1000) * months) / 12 / 10) * 10 / 1000;
      const now = iso(Date.now());
      sub.status = "canceled";
      sub.canceled_at = now;
      sub.cancel_at = now;
      if (amount > 0) {
        d.payments.push({ id: newId(), order_id: null, subscription_id: sub.id, user_id: p.id, provider: sub.provider, provider_ref: `mock_re_${newId().slice(0, 8)}`, amount: -amount, currency: "KWD", fee: 0, net: -amount, status: "refunded", created_at: now });
        refund = { amount, currency: "KWD", months, pending: false };
      }
    }
    audit(`membership.${action}`, "subscriptions", sub.id, refund ? { refund } : null);
    commit();
    return { subscription: sub, ...(refund ? { refund } : {}) };
  },

  async deleteData(opts: { confirm: true }) {
    if (opts?.confirm !== true) throw new BackendError("Send { confirm: true } to delete your data.", "confirm_required");
    const p = me();
    const d = load();
    const scanIds = new Set(d.scans.filter((s) => s.user_id === p.id).map((s) => s.id));
    const orderIds = new Set(d.orders.filter((o) => o.user_id === p.id).map((o) => o.id));
    for (const ph of d.scan_photos.filter((x) => scanIds.has(x.scan_id))) {
      const u = photoBlobs.get(ph.storage_path);
      if (u) URL.revokeObjectURL(u);
      photoBlobs.delete(ph.storage_path);
    }
    d.scan_photos = d.scan_photos.filter((x) => !scanIds.has(x.scan_id));
    d.scans = d.scans.filter((s) => s.user_id !== p.id);
    d.generations = d.generations.filter((g) => !orderIds.has(g.order_id));
    d.consents = d.consents.filter((c) => c.user_id !== p.id);
    d.profiles = d.profiles.filter((x) => x.id !== p.id);
    // Orders and payments are kept (anonymised) for accounting, as in the real function.
    for (const o of d.orders) if (o.user_id === p.id) o.user_id = null;
    for (const x of d.payments) if (x.user_id === p.id) x.user_id = null;
    for (const x of d.subscriptions)
      if (x.user_id === p.id) {
        // As delete-my-data: the included month simply ends.
        if (x.plan === "included" && x.status === "active") {
          x.status = "canceled";
          x.canceled_at = iso(Date.now());
        }
        x.user_id = null;
      }
    d.session = null;
    commit();
    sessionListeners.forEach((l) => l(null));
  },
};
