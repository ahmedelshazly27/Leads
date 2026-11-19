# Backend contract

Single source of truth for the database, storage, server functions and the
client data layer. Everything else (app pages, reviewer console, admin
dashboard) builds against this. Supabase (Postgres + Auth + Storage + Edge
Functions), EU region (Frankfurt). Operator: a Dutch B.V. (GDPR controller).

## Business rules

- Market: Kuwait customers, charged in **KWD** (3 decimals; Stripe amounts in fils: 20 KWD = 20000).
- Products:
  - `report`: 20.000 KWD one-off. Includes the first 30 days of membership.
  - `membership_monthly`: 5.000 KWD/month. `membership_yearly`: 45.000 KWD/year. Started from checkout as a subscription with a 30-day trial when bought together with the report ("report + membership"), or later from the app.
- Membership gives: a monthly re-scan (check-in) with updated scores and plan, a reviewer note each month, and a new 12-month visual every 3 months.
- **Men only at launch.** Women join a waitlist (`waitlist`). The schema still supports gender-matched review (women's orders can only be assigned to female reviewers) for later.
- 18+ only. Age is confirmed at sign-up and stored as a consent.
- Photos are deleted 90 days after the order is delivered, or on request.
- Payment provider: **Stripe** (on the B.V.) now; `provider` columns allow `checkout_com` (KNET) later.
- After images: generated server-side through an image API. The reviewer can add remarks and regenerate (each attempt is a row in `generations`, linked by `parent_id`), then approves the final set. Nothing reaches the customer before approval.

## Tables (schema `public`)

All tables have RLS on. `auth.uid()` = the signed-in user. Helper SQL functions: `is_admin()`, `is_reviewer()` (security definer, read `profiles.role`).

| Table | Columns (main) | Who can read / write |
|---|---|---|
| `profiles` | `id uuid pk = auth.users.id`, `full_name`, `email`, `phone`, `locale ('en'|'ar')`, `gender ('male'|'female')`, `birth_year int`, `role ('customer'|'reviewer'|'admin') default 'customer'`, `reviewer_gender ('male'|'female') null`, `created_at` | own row (read, update except `role`/`reviewer_gender`); admin all |
| `consents` | `id`, `user_id`, `kind ('age18'|'terms'|'privacy'|'photos'|'marketing')`, `version text`, `granted_at`, `withdrawn_at null` | own rows insert/read; admin read |
| `orders` | `id uuid`, `user_id`, `product ('report'|'checkin')`, `status ('pending_payment'|'paid'|'awaiting_photos'|'in_review'|'changes_requested'|'delivered'|'refunded'|'cancelled')`, `amount numeric(10,3)`, `currency default 'KWD'`, `provider ('stripe'|'checkout_com'|'manual')`, `provider_ref` (checkout session / payment intent), `assigned_reviewer uuid null`, `due_at`, `paid_at`, `submitted_at`, `delivered_at`, `created_at` | customer reads own; reviewer reads/updates assigned; admin all. Status changes from the customer side only via functions. |
| `subscriptions` | `id`, `user_id`, `provider`, `provider_sub_id`, `plan ('monthly'|'yearly')`, `status ('trialing'|'active'|'past_due'|'canceled')`, `current_period_end`, `cancel_at`, `created_at` | own read; admin all; written by webhook |
| `payments` | `id`, `order_id null`, `subscription_id null`, `user_id`, `provider`, `provider_ref`, `amount numeric(10,3)`, `currency`, `fee numeric(10,3)`, `net numeric(10,3)`, `status ('succeeded'|'refunded'|'failed')`, `created_at` | own read; admin all; webhook writes |
| `scans` | `id uuid`, `user_id`, `order_id`, `kind ('baseline'|'checkin')`, `intake jsonb`, `results jsonb` (the client's `Scan` object minus photos), `app_version`, `created_at`, `photos_deleted_at null` | own read/insert; assigned reviewer read; admin all |
| `scan_photos` | `scan_id`, `view ('face'|'body'|'side'|'faceLeft'|'faceRight'|'face45'|'smile'|'frown'|'browRaise')`, `storage_path`, pk (`scan_id`,`view`) | same as scans |
| `reviews` | `id`, `order_id` unique, `reviewer_id`, `status ('in_progress'|'approved'|'returned')`, `checklist jsonb`, `notes text`, `item_notes jsonb`, `marker_grades jsonb`, `approved_at` | reviewer (assigned) read/write; customer reads only when order delivered; admin all |
| `generations` | `id`, `order_id`, `scan_id`, `requested_by`, `kind ('face_after'|'face_after_alt'|'body_after_front'|'body_after_side')`, `prompt text`, `remarks text null`, `parent_id null`, `provider ('fal'|'openai'|'higgsfield')`, `model`, `status ('queued'|'running'|'succeeded'|'failed')`, `output_path`, `cost_usd numeric(10,4)`, `approved bool default false`, `created_at` | reviewer (assigned) + admin; customer reads approved rows of delivered orders |
| `costs` | `id`, `order_id null`, `user_id null`, `category ('image_generation'|'payment_fee'|'messaging'|'reviewer'|'other')`, `amount numeric(10,4)`, `currency ('USD'|'KWD'|'EUR')`, `note`, `created_at` | admin only |
| `ad_spend` | `id`, `date`, `platform ('meta'|'snap'|'tiktok'|'google')`, `campaign_id`, `campaign_name`, `spend numeric(12,4)`, `currency`, `impressions int`, `clicks int`, `purchases int`, unique(`date`,`platform`,`campaign_id`) | admin only |
| `waitlist` | `id`, `email`, `phone null`, `gender`, `locale`, `source`, `created_at`, unique(`email`) | anyone may insert (no read); admin read |
| `audit_log` | `id`, `actor`, `action`, `target_type`, `target_id`, `meta jsonb`, `at` | admin read; written by functions/triggers |

Views for the dashboard (admin only, `security_invoker`): `v_order_economics` (per order: revenue, payment fee, image cost, gross margin), `v_daily_kpis` (date, orders, revenue, new customers, ad spend, CAC, ROAS), `v_mrr` (active subscriptions × monthly equivalent).

## Storage

- Bucket `photos` (private): `{user_id}/{scan_id}/{view}.jpg`. Customer can upload/read own folder; assigned reviewer and admin read.
- Bucket `visuals` (private): `{order_id}/{generation_id}.jpg`. Written by functions; reviewer/admin read; customer reads approved ones after delivery (via signed URL from a function).

## Edge functions (Deno, `supabase/functions/<name>/index.ts`)

| Function | Auth | Does |
|---|---|---|
| `create-checkout` | user JWT | Body `{ plan: 'report'|'report_membership_monthly'|'report_membership_yearly'|'membership_monthly'|'membership_yearly', locale }`. Creates the `orders` row (`pending_payment`) and a Stripe Checkout Session (KWD; `mode=payment` for report, `mode=subscription` with the report as a one-time line item + 30-day trial on the recurring price for bundles). Returns `{ url }`. |
| `stripe-webhook` | Stripe signature (no JWT) | `checkout.session.completed` → order `paid`→`awaiting_photos`, payment row with fee from the balance transaction, cost row (`payment_fee`); `customer.subscription.*` → `subscriptions`; `invoice.paid` → payment row and, for membership renewals, a `checkin` order; `charge.refunded` → order `refunded`. Idempotent on event id. |
| `submit-scan` | user JWT | After photos are uploaded and the scan row inserted: checks ownership + status `awaiting_photos`, sets `in_review`, `submitted_at`, `due_at = now()+72h`, auto-assigns a reviewer (least open orders, gender-matched), audit log. |
| `generate-visual` | reviewer/admin JWT | Body `{ order_id, kind, prompt, remarks?, parent_id? }`. Builds the request from the scan's photos (signed URL) or the parent output, calls the image provider (`IMAGE_PROVIDER`, `FAL_KEY` / `OPENAI_API_KEY` / `HIGGSFIELD_API_KEY`), stores the output in `visuals`, writes `generations` with `cost_usd` from a price table, and a `costs` row. |
| `approve-delivery` | reviewer/admin JWT | Marks chosen generations `approved`, review `approved`, order `delivered`, `delivered_at`; emails the customer via Resend (`RESEND_API_KEY`). |
| `customer-visuals` | user JWT | Signed URLs for approved visuals of the customer's delivered orders. |
| `delete-my-data` | user JWT | Deletes the user's photos, visuals, scans, generations; anonymises orders/payments (kept for accounting); deletes the auth user. |
| `purge-photos` | cron (service key) | Daily: deletes photos of orders delivered > 90 days ago; sets `scans.photos_deleted_at`. |
| `sync-meta-ads` | cron (service key) | Daily: Meta Marketing API insights (`META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`) for the last 7 days → upsert `ad_spend`. |
| `join-waitlist` | public | Validates email, inserts into `waitlist` (dedup), rate-limited by IP. |

Secrets (set by the owner in the Supabase dashboard, never in code): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`, `IMAGE_PROVIDER`, `FAL_KEY`/`OPENAI_API_KEY`/`HIGGSFIELD_API_KEY`, `RESEND_API_KEY`, `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `SITE_URL`.

## Client data layer (`app/src/lib/backend/`)

- `client.ts`: Supabase client from `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`; `backendEnabled` false when unset (the app keeps working fully local, as today, for demos and development).
- `auth.ts`: email one-time code sign-in (`signInWithOtp` + `verifyOtp`), sign-out, `useSession()`, `useProfile()`.
- `orders.ts`: `startCheckout(plan)`, `useMyOrders()`, `useOrder(id)`.
- `scans.ts`: `submitScan(orderId, scan, photos)` (uploads to `photos`, inserts `scans` + `scan_photos`, calls `submit-scan`).
- `review.ts`: reviewer queue, load a scan with signed photo URLs, save review, `generateVisual`, `approveDelivery`.
- `admin.ts`: dashboard queries (KPIs, economics, ad spend, waitlist, orders table).
- `consents.ts`, `waitlist.ts`, `account.ts` (export / delete my data).

## Order flow

`/start` (choose report or report + membership, 18+ and gender check; women → waitlist) → sign in (email code) → Stripe Checkout → `/orders/:id` (`awaiting_photos`) → photo consent → guided scan (on-device analysis) → `submitScan` → `in_review` (customer sees status and due time) → reviewer console (`/review` server mode): check, generate visuals with remarks, approve → `delivered` (email) → report, visuals and PDF in the app → photos purged after 90 days.
