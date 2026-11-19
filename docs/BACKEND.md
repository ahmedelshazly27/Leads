# Backend contract

Single source of truth for the database, storage, server functions and the
client data layer. Everything else (app pages, reviewer console, admin
dashboard) builds against this. Supabase (Postgres + Auth + Storage + Edge
Functions), EU region (Frankfurt). Operator: a Dutch B.V. (GDPR controller).

## Business rules

- Market: Kuwait customers, charged in **KWD** (3 decimals; Stripe amounts in fils: 20 KWD = 20000).
- Products:
  - `report`: 20.000 KWD one-off. Includes the first 30 days of membership.
  - `membership_monthly`: 5.000 KWD/month. `membership_yearly`: 45.000 KWD for the first 12 months, then it continues month to month at 5.000 KWD (a Stripe subscription schedule, see "Membership and refunds"). Started from checkout as a subscription with a 30-day trial when bought together with the report ("report + membership"), or later from the app.
- Membership gives: a monthly re-scan (check-in) with updated scores and plan, a reviewer note each month, and a new 12-month visual every 3 months.
- **Men only at launch.** Women join a waitlist (`waitlist`). The schema still supports gender-matched review (women's orders can only be assigned to female reviewers) for later.
- 18+ only. Age is confirmed at sign-up and stored as a consent.
- Photos are deleted 90 days after the order is delivered, or on request (photo consent withdrawn, account deleted).
- Measurements, health answers, plan inputs, reviewer notes and visuals: at most 24 months after the last order or membership ends. Waitlist entries: at most 24 months. Payment and accounting records: 7 years (anonymised when the account is deleted).
- Payment provider: **Stripe** (on the B.V.) now; `provider` columns allow `checkout_com` (KNET) later.
- After images: generated server-side through an image API. The reviewer can add remarks and regenerate (each attempt is a row in `generations`, linked by `parent_id`), then approves the final set. Nothing reaches the customer before approval.

## Tables (schema `public`)

All tables have RLS on. `auth.uid()` = the signed-in user. Helper SQL functions: `is_admin()`, `is_reviewer()` (security definer, read `profiles.role`).

| Table | Columns (main) | Who can read / write |
|---|---|---|
| `profiles` | `id uuid pk = auth.users.id`, `full_name`, `email` (copy of the verified sign-in email, kept in sync by triggers on `auth.users`), `phone`, `locale ('en'|'ar')`, `gender ('male'|'female')`, `birth_year int`, `role ('customer'|'reviewer'|'admin') default 'customer'`, `reviewer_gender ('male'|'female') null`, `stripe_customer_id unique null`, `created_at`, `updated_at` | own row (read, update except `role`/`reviewer_gender`/`stripe_customer_id`/`email`: a trigger refuses those); admin all |
| `consents` | `id`, `user_id`, `kind ('age18'|'terms'|'privacy'|'photos'|'marketing'|'withdrawal_waiver')`, `version text`, `granted_at`, `withdrawn_at null` | own rows insert/read, own update of `withdrawn_at` only; admin read. `withdrawal_waiver` = the request to start the report within the 14-day withdrawal period (terms section 8), recorded before photos are submitted. |
| `orders` | `id uuid`, `user_id` (null after account deletion), `product ('report'|'checkin')`, `plan` (the checkout plan; null for check-ins), `status ('pending_payment'|'paid'|'awaiting_photos'|'in_review'|'changes_requested'|'delivered'|'refunded'|'cancelled')`, `amount numeric(10,3)`, `currency default 'KWD'`, `provider ('stripe'|'checkout_com'|'manual')`, `provider_ref` (checkout session, or the invoice for a check-in), `subscription_id null` (membership of a bundle or check-in), `scan_id null` (the scan submit-scan accepted), `assigned_reviewer uuid null`, `due_at`, `paid_at`, `submitted_at`, `delivered_at`, `created_at`, `updated_at` | customer reads own; reviewer reads/updates assigned (status `in_review` <-> `changes_requested` only); admin all. Everything else via functions. |
| `subscriptions` | `id`, `user_id`, `provider`, `provider_sub_id`, `provider_customer_id`, `plan ('monthly'|'yearly')` (from the current price interval, so a yearly plan reads `monthly` once it continues monthly), `status ('trialing'|'active'|'past_due'|'canceled')`, `amount`, `currency`, `current_period_end`, `trial_end`, `cancel_at` (set while cancelling), `canceled_at`, `created_at` | own read; admin all; written by the webhook and manage-membership |
| `payments` | `id`, `order_id null`, `subscription_id null`, `user_id`, `provider`, `provider_ref` (payment intent / invoice / refund id, unique per provider), `provider_charge`, `amount numeric(10,3)` (refunds are their own rows with a negative amount), `currency`, `fee`, `net` (in the payment currency, converted with Stripe's rate), `settlement_currency`, `settlement_fee`, `settlement_net` (as settled, usually EUR), `status ('succeeded'|'refunded'|'failed')`, `created_at` | own read; admin all; webhook writes |
| `scans` | `id uuid`, `user_id`, `order_id`, `kind ('baseline'|'checkin')`, `intake jsonb`, `results jsonb` (the client's `Scan` object minus photos), `app_version`, `created_at`, `photos_deleted_at null` | own read/insert; own delete while `order_accepts_photos(order_id)` (retakes); assigned reviewer read; admin all |
| `scan_photos` | `scan_id`, `view ('face'|'body'|'side'|'faceLeft'|'faceRight'|'face45'|'smile'|'frown'|'browRaise')`, `storage_path`, pk (`scan_id`,`view`) | same as scans (own delete while the order accepts photos) |
| `reviews` | `id`, `order_id` unique, `reviewer_id`, `status ('in_progress'|'approved'|'returned')`, `checklist jsonb`, `notes text`, `item_notes jsonb`, `marker_grades jsonb`, `approved_at` | reviewer (assigned) read/write; customer reads only approved reviews of delivered orders; admin all. Locked once approved; reviewers cannot approve directly (approve-delivery does) or edit after the order is delivered, refunded or cancelled. |
| `generations` | `id`, `order_id`, `scan_id`, `requested_by`, `kind ('face_after'|'face_after_alt'|'body_after_front'|'body_after_side')`, `prompt text`, `remarks text null`, `parent_id null`, `provider ('fal'|'openai'|'higgsfield')`, `model`, `status ('queued'|'running'|'succeeded'|'failed')`, `output_path`, `cost_usd numeric(10,4)`, `approved bool default false`, `created_at` | reviewer (assigned) + admin; customer reads approved rows of delivered orders |
| `costs` | `id`, `order_id null`, `user_id null`, `category ('image_generation'|'payment_fee'|'messaging'|'reviewer'|'other')`, `amount numeric(10,4)`, `currency ('USD'|'KWD'|'EUR')`, `note`, `source_ref` (provider reference, unique per category: makes webhook retries idempotent), `created_at` | admin only |
| `ad_spend` | `id`, `date`, `platform ('meta'|'snap'|'tiktok'|'google')`, `campaign_id`, `campaign_name`, `spend numeric(12,4)`, `currency`, `impressions int`, `clicks int`, `purchases int`, unique(`date`,`platform`,`campaign_id`) | admin only |
| `waitlist` | `id`, `email` (stored trimmed, lower case), `phone null`, `gender`, `locale`, `source`, `created_at`, unique(`email`) | inserted only through the `join-waitlist` function (no direct insert for anon or signed-in users); admin read/delete |
| `audit_log` | `id`, `actor`, `action`, `target_type`, `target_id`, `meta jsonb`, `at` | admin read; written by functions/triggers |
| `fx_rates` | `currency pk`, `kwd_per_unit`, `updated_at` (KWD = 1; the owner sets USD, EUR) | admin all. Used by the views; a missing rate gives `null` + `fx_missing`, never a silent zero. |
| `stripe_events` | `id` (event id), `type`, `received_at`, `processed_at` | service only (webhook idempotency) |
| `rate_limits` | `key`, `window_start`, `hits` | service only (`hit_rate_limit()`, join-waitlist) |

Views for the dashboard (admin only, `security_invoker`): `v_order_economics` (per order: revenue, payment fee, image cost, gross margin), `v_daily_kpis` (date, orders, revenue, new customers, ad spend, CAC, ROAS), `v_mrr` (active subscriptions × monthly equivalent).

## Storage

- Bucket `photos` (private): `{user_id}/{scan_id}/{view}.jpg`. Customer can upload/read own folder; assigned reviewer and admin read.
- Bucket `visuals` (private): `{order_id}/{generation_id}.jpg`. Written by functions; reviewer/admin read; customer reads approved ones after delivery (via signed URL from a function).

## Edge functions (Deno, `supabase/functions/<name>/index.ts`)

| Function | Auth | Does |
|---|---|---|
| `create-checkout` | user JWT | Body `{ plan: 'report'|'report_membership_monthly'|'report_membership_yearly'|'membership_monthly'|'membership_yearly', locale }`. Creates the `orders` row (`pending_payment`) and a Stripe Checkout Session (KWD; `mode=payment` for report, `mode=subscription` with the report as a one-time line item + 30-day trial on the recurring price for bundles). Returns `{ url }`. |
| `stripe-webhook` | Stripe signature (no JWT) | `checkout.session.completed` → order `paid`→`awaiting_photos`, payment row with fee from the balance transaction, cost row (`payment_fee`); `customer.subscription.*` → `subscriptions`; `invoice.paid` → payment row and, for membership renewals, a `checkin` order; `charge.refunded` → order `refunded`. Idempotent on event id. |
| `submit-scan` | user JWT | After photos are uploaded and the scan row inserted: checks ownership + status `awaiting_photos`/`changes_requested`, an active `photos` consent and a `face` photo, sets `in_review`, `scan_id` (the accepted scan), `submitted_at`, `due_at = now()+72h`, auto-assigns a reviewer (least open orders, gender-matched), audit log (with whether a `withdrawal_waiver` is on record). |
| `generate-visual` | reviewer/admin JWT | Body `{ order_id, kind, prompt, remarks?, parent_id? }`. Builds the request from the scan's photos (signed URL) or the parent output, calls the image provider (`IMAGE_PROVIDER`, `FAL_KEY` / `OPENAI_API_KEY` / `HIGGSFIELD_API_KEY`), stores the output in `visuals`, writes `generations` with `cost_usd` from a price table, and a `costs` row. |
| `approve-delivery` | reviewer/admin JWT | Marks chosen generations `approved`, review `approved`, order `delivered`, `delivered_at`; emails the customer via Resend (`RESEND_API_KEY`). |
| `customer-visuals` | user JWT | Signed URLs for approved visuals of the customer's delivered orders. |
| `delete-my-data` | user JWT | Cancels memberships, deletes the user's photos, visuals, scans, reviews, generations, consents and waitlist entry; anonymises orders/payments/subscriptions/costs (kept for accounting); deletes the auth user. |
| `withdraw-photo-consent` | user JWT | Body `{}`. Deletes every photo file of the user, sets `photos_deleted_at` and clears `scans.intake`/`results` (measurements and health answers), marks `photos` consents withdrawn, cancels orders whose photos were submitted but not delivered (`in_review`/`changes_requested` -> `cancelled`, their visuals deleted) with an `orders.cancelled_consent_withdrawn` audit row saying what the refund policy suggests (`full`/`partial`). Refunds are manual. Orders still `awaiting_photos` stay open. Visuals of delivered reports are kept (privacy policy). Returns `{ scans, files, visuals, consents, cancelled_orders }`. |
| `manage-membership` | user JWT | Body `{ action: 'cancel'|'resume'|'end_now' }`. `cancel`: at period end (releases the yearly schedule first); `resume`: undo while the period runs (re-creates the yearly schedule); `end_now`: yearly only, once paid: ends today and refunds the full months left (price / 12 each) through Stripe. Returns `{ subscription, refund? }`. |
| `purge-photos` | cron (cron secret) | Daily: deletes photos 90 days after delivery, after a refund/cancellation, or (orders that never finished) after the scan; sets `scans.photos_deleted_at`; removes orphan uploads older than 3 days. With the photos of a refunded/cancelled order its visuals go too. Delivered visuals stay unless `VISUALS_WITH_PHOTOS=all` (then the privacy policy must say so). |
| `purge-records` | cron (cron secret) | Daily: for customers with no current membership whose last order activity and membership end are > 24 months ago, deletes visual (and any photo) files and their scans, clears reviewer notes and generation prompts; deletes waitlist entries > 24 months old. Orders, payments, costs stay. |
| `sync-meta-ads` | cron (cron secret) | Daily: Meta Marketing API insights (`META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, optional `META_API_VERSION`) for the last 7 days → upsert `ad_spend`. |
| `join-waitlist` | public | Validates email (honeypot), inserts into `waitlist` with the service key (dedup, same answer for duplicates), rate-limited by hashed IP (`RATE_LIMIT_SALT`). |

All functions run with `verify_jwt = false` (config.toml) and check the caller themselves.

Secrets (set by the owner in the Supabase dashboard, never in code): `SITE_URL`, `ALLOWED_ORIGINS` (optional extra CORS origins), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_REPORT`/`_MONTHLY`/`_YEARLY` (optional; inline prices / lookup-key prices otherwise), `IMAGE_PROVIDER`, `FAL_KEY`/`OPENAI_API_KEY`/`HIGGSFIELD_API_KEY`, `IMAGE_PRICES_JSON` (optional USD price table), `RESEND_API_KEY`, `EMAIL_FROM`, `BRAND_NAME`, `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `META_API_VERSION` (optional), `RATE_LIMIT_SALT` (optional), `CRON_SECRET` (same value as the Vault secret `cron_secret`), `VISUALS_WITH_PHOTOS` (optional, `all`). Scheduled jobs (pg_cron, `invoke_edge_function`): `purge-photos-daily` 02:15 UTC, `purge-records-daily` 02:45, `sync-meta-ads-daily` 03:40, `monthly-checkins-daily` 04:05 (`ensure_monthly_checkins()`).

## Membership and refunds

- **Yearly then monthly.** On `customer.subscription.created` for a yearly price the webhook puts the subscription on a schedule (`_shared/membership.ts`): the current phase (the 30-day trial, or the paid year), one yearly phase after a trial, then the monthly price, `end_behavior: release`, so it continues at 5.000 KWD a month. Prices come from `STRIPE_PRICE_MONTHLY`/`_YEARLY` or a price found/created by lookup key `membership_<interval>_kwd`. A failure is logged as `stripe.schedule_failed` in `audit_log` (the subscription row is still saved); `manage-membership resume` or the Stripe dashboard can fix it. Cancelling releases the schedule (Stripe does not allow changing cancellation on a scheduled subscription).
- **Cancel.** Ends at the end of the paid period (or the included 30 days). No refund for a monthly period or the included 30 days (refund policy section 5).
- **Yearly ended early.** `end_now` refunds the full calendar months left × price / 12, rounded down to 10 fils (Stripe's KWD rule), capped at what the last invoice paid. The refund rows come in through `charge.refunded`.
- **14-day withdrawal** (terms section 8, refund policy sections 1-3). Requests come by email or the model form and are refunded by hand in Stripe (the webhook records them): full before photos are submitted; after submission, the price less the work already done; nothing once delivered (the `withdrawal_waiver` consent records the request to start early). For a membership the 14 days run from its start. Withdrawing photo consent before delivery cancels the order and logs the suggested refund (`full` if the review had not started, else `partial`) for the team to issue.

## Client data layer (`app/src/lib/backend/`)

- `client.ts`: Supabase client from `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`; `backendEnabled` false when unset (the app keeps working fully local, as today, for demos and development).
- `auth.ts`: email sign-in (`signInWithOtp` + `verifyOtp`), sign-out, `useSession()`, `useProfile()`. `sendCode(email, { locale, gender, emailRedirectTo })`: the email carries the 6-digit code and a sign-in link that lands on `emailRedirectTo` (default: the current page) and signs in there (`detectSessionInUrl`, PKCE: same browser). Allow the site under Auth > Redirect URLs (`https://<domain>/**`). Consents given before sign-in are kept in localStorage (2 hours, so the link's new tab finds them; `sendCode` tags them with the email, and they are saved only for that account) and saved right after sign-in (`consentsFlushed()`; `startCheckout` waits for it).
- `orders.ts`: `startCheckout(plan)`, `useMyOrders()`, `useOrder(id)`.
- `scans.ts`: `submitScan(orderId, scan, photos)` (uploads to `photos`, inserts `scans` + `scan_photos`, calls `submit-scan`); `getScanForOrder` returns the accepted scan (`orders.scan_id`), else the latest.
- `review.ts`: reviewer queue, load a scan with signed photo URLs, save review, `generateVisual`, `approveDelivery`.
- `admin.ts`: dashboard queries (KPIs, economics, ad spend, waitlist, orders table).
- `consents.ts`, `waitlist.ts`, `account.ts` (export / delete my data, `withdrawPhotoConsent()` -> `{ scans, files, cancelledOrders }`).
- `membership.ts`: `cancelMembership()`, `resumeMembership()`, `endYearlyMembershipNow()` (manage-membership), `yearlyEndNowRefund(sub, 45)` (preview of the refund), `isCancelling(sub)`.
- `mock.ts` (`VITE_BACKEND_MOCK=1`): the whole app is demoable without Supabase: seeded customers, orders in every status over 30+ days, payments with fees, failed renewals, refunds, subscriptions (trialing, active, past due, cancelling, ended), generations with costs, 30 days of ad spend, waitlist; reviewer flow on the synthetic sample profile (photos and after images from `public/sample/`). Sign in as `admin...` / `review...` / anything else; any 6 digits.

## Order flow

`/start` (choose report or report + membership, 18+ and gender check; women → waitlist) → sign in (email code) → Stripe Checkout → `/orders/:id` (`awaiting_photos`) → photo consent → guided scan (on-device analysis) → `submitScan` → `in_review` (customer sees status and due time) → reviewer console (`/review` server mode): check, generate visuals with remarks, approve → `delivered` (email) → report, visuals and PDF in the app → photos purged after 90 days.
