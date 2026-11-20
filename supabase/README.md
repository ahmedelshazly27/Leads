# Supabase backend

Database, storage, scheduled jobs and edge functions for the app. The contract
the app builds against is [`docs/BACKEND.md`](../docs/BACKEND.md); this folder
implements it.

```
supabase/
  config.toml                         CLI settings (project not linked yet)
  migrations/
    20261119000001_init.sql           tables, checks, indexes, RLS, helper functions, triggers
    20261119000002_storage.sql        private buckets photos + visuals and their policies
    20261119000003_views.sql          fx_rates + dashboard views (admin only)
    20261119000004_cron.sql           daily jobs (pg_cron + pg_net, secrets from Vault)
    20261119000005_hardening.sql      advisor fixes (function grants)
    20261119000006_followups.sql      withdrawal_waiver consent, orders.scan_id, scan delete policies,
                                      photo-consent withdrawal and retention SQL helpers
    20261119000007_cron_retention.sql purge-records-daily job
    20261119000008_membership_included.sql  included month of a report bought on its own (plan 'included'),
                                      email_reminders, reminder query, retention clock without orders.updated_at
    20261119000009_cron_membership.sql included-memberships-daily and membership-reminders-daily jobs
    20261120000010_multi_currency.sql country columns, costs in any currency, EUR-based fx_rates (GCC pegs), views in EUR
  functions/
    _shared/                          CORS, HTTP helpers, service client, auth, Stripe, membership schedule, image APIs, email, storage
    create-checkout/  stripe-webhook/  submit-scan/  generate-visual/  approve-delivery/
    customer-visuals/ delete-my-data/  purge-photos/ sync-meta-ads/    join-waitlist/
    withdraw-photo-consent/  manage-membership/  purge-records/
    set-order-status/  membership-reminders/
```

## 1. Create and link the project

1. Create a project in the Supabase dashboard, region **Central EU (Frankfurt)**.
2. Install the CLI (`brew install supabase/tap/supabase` or `npx supabase ...`) and run:

```bash
supabase login
supabase link --project-ref <project-ref>        # from the project URL
```

## 2. Apply the migrations

```bash
supabase db push
```

This creates everything, including the `pg_cron` and `pg_net` extensions and the
daily jobs (six once 20261119000009 is applied). The jobs call `purge-photos`,
`purge-records`, `membership-reminders` and `sync-meta-ads` with a dedicated **cron secret** (not the
service key, so the scheduler holds only the power to start those jobs). Make one random value and store it in two places:

```bash
openssl rand -hex 32                         # copy the output
supabase secrets set CRON_SECRET=<that value> # the functions compare against this
```

Then in the SQL editor (Vault secrets are encrypted at rest and never appear in
the migrations):

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<the same value as CRON_SECRET>', 'cron_secret');
```

Until both exist the jobs log a warning and do nothing. To rotate the secret,
set a new `CRON_SECRET` and run
`select vault.update_secret((select id from vault.secrets where name = 'cron_secret'), '<new value>');`

(The functions also accept the project's service key, either the legacy
`service_role` JWT or a new `sb_secret_...` key, and `invoke_edge_function` falls
back to a Vault secret named `service_role_key` when `cron_secret` is missing.
The cron secret is the recommended setup.)

Jobs (UTC; Kuwait is UTC+3):

| Job | When | Does |
|---|---|---|
| `purge-photos-daily` | 02:15 | calls `purge-photos`: deletes photos 90 days after delivery, after a refund/cancellation, or (for orders that never finished) after the scan; also removes stray uploads older than 3 days that belong to no scan, and the visuals of refunded/cancelled orders |
| `purge-records-daily` | 02:45 | calls `purge-records`: 24 months after a customer's last order or membership ends, deletes their scans (measurements, health answers), visuals, reviewer notes and generation prompts; deletes waitlist entries older than 24 months |
| `sync-meta-ads-daily` | 03:40 | calls `sync-meta-ads` for the last 7 days |
| `monthly-checkins-daily` | 04:05 | `ensure_monthly_checkins()`: a check-in order each month for paid yearly members (not during a trial or the included month) |
| `included-memberships-daily` | 00:10 | `expire_included_memberships()`: ends included months (report bought on its own) that are over |
| `membership-reminders-daily` | 06:20 | calls `membership-reminders`: "your included month ends in 5 days" (with links to join monthly or yearly) and the yearly reminder about 30 days before the 12 months end (terms section 7). Each email once per membership period (`email_reminders`) |

Check runs with `select * from cron.job_run_details order by start_time desc limit 20;`.
A job that "succeeded" there only means the HTTP request was queued; check the
functions actually accepted it (a `401` means `CRON_SECRET` and the Vault
`cron_secret` differ):

```sql
select id, status_code, content, created
from net._http_response order by created desc limit 10;
```

## 3. Auth settings (dashboard)

- **Authentication > URL Configuration**: Site URL = your production URL; add it
  and `http://localhost:5173` to Redirect URLs.
- **Authentication > URL Configuration > Redirect URLs**: add `https://<your-domain>/**`
  (and `http://localhost:5173/**`). The sign-in link in the email returns the user
  to the page they asked from (`emailRedirectTo`) and signs them in there.
- **Authentication > Emails > Magic Link** template: include `{{ .Token }}` so the
  email carries the 6-digit code the app asks for (`signInWithOtp` + `verifyOtp`);
  keep `{{ .ConfirmationURL }}` for the link. The link works in the same browser
  (PKCE); on another device the code is the way in.
- Set up a custom SMTP sender (Resend works) before launch; the built-in sender is rate-limited.

## 4. Secrets for the functions

Set them in **Edge Functions > Secrets** or with the CLI. Never commit them.

```bash
supabase secrets set \
  SITE_URL=https://<your-domain> \
  STRIPE_SECRET_KEY=sk_live_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  IMAGE_PROVIDER=fal \
  FAL_KEY=... \
  RESEND_API_KEY=re_... \
  EMAIL_FROM="<Brand> <reports@your-domain>" \
  BRAND_NAME="<Brand>" \
  CRON_SECRET=<openssl rand -hex 32> \
  META_ACCESS_TOKEN=... \
  META_AD_ACCOUNT_ID=act_...
```

| Secret | Needed by | Notes |
|---|---|---|
| `SITE_URL` | checkout, emails, CORS | No trailing slash. |
| `ALLOWED_ORIGINS` | CORS | Optional, comma separated (e.g. a preview domain). `localhost` is always allowed. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | create-checkout, stripe-webhook, delete-my-data, manage-membership | |
| `STRIPE_AUTOMATIC_TAX` | create-checkout | Optional. `1` turns on Stripe Tax (and asks for the billing address). Only once the owner is registered for VAT where Stripe should collect it; see section 6. |
| `STRIPE_PRODUCT_REPORT` | create-checkout | Optional `prod_...`: groups every report sale under one Stripe product. |
| `STRIPE_PRICE_MONTHLY_<CUR>` / `STRIPE_PRICE_YEARLY_<CUR>` | create-checkout, stripe-webhook, manage-membership | Optional, e.g. `STRIPE_PRICE_MONTHLY_SAR`. Used only if the price has exactly the amount in `prices.json`; otherwise (and by default) the functions find or create the price by lookup key. The older `STRIPE_PRICE_MONTHLY` / `_YEARLY` count for KWD only; `STRIPE_PRICE_REPORT` is no longer used (the report is an inline price from `prices.json`). |
| `IMAGE_PROVIDER` | generate-visual | `fal` (default) or `openai`. |
| `FAL_KEY` / `OPENAI_API_KEY` | generate-visual | For the chosen provider. Optional: `FAL_IMAGE_MODEL`, `OPENAI_IMAGE_MODEL`, `OPENAI_IMAGE_QUALITY`. |
| `IMAGE_PRICES_JSON` | generate-visual | Optional override of the USD price per call, e.g. `{"fal-ai/nano-banana/edit":0.039}`. Check the provider's pricing page; costs in the dashboard come from this table (OpenAI uses the token usage it reports). |
| `RESEND_API_KEY`, `EMAIL_FROM`, `BRAND_NAME` | approve-delivery, set-order-status, membership-reminders | `EMAIL_FROM` must be on a domain verified in Resend. |
| `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` | sync-meta-ads | System-user token with `ads_read`. Optional `META_API_VERSION` (default `v21.0`). |
| `RATE_LIMIT_SALT` | join-waitlist | Optional random string used to hash IP addresses. |
| `CRON_SECRET` | purge-photos, purge-records, membership-reminders, sync-meta-ads | Random value; the same value goes into Vault as `cron_secret` (section 2). |
| `VISUALS_WITH_PHOTOS` | purge-photos | Optional. `all` also deletes the visuals of delivered reports with their photos (90 days). Default: delivered visuals stay until the 24-month rule or account deletion, as the privacy policy says. |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to functions automatically.

`HIGGSFIELD_API_KEY` is reserved: the schema accepts `higgsfield` as a provider,
but its adapter is not built yet, so `IMAGE_PROVIDER=higgsfield` returns a clear error.

## 5. Deploy the functions

```bash
supabase functions deploy
```

`config.toml` turns off gateway JWT verification for every function, because
each one checks its caller itself (user token, reviewer/admin role, cron secret
or Stripe signature).

## 6. Stripe

1. **Prices.** The price table is `functions/_shared/prices.json` (the app has
   an identical copy, `app/src/lib/prices.json`; `npm run check:prices` in `app/`
   fails when they differ). Customers pay in their country's currency, VAT
   included where VAT applies:

   | Country | Currency | Report | Monthly | 12-month |
   |---|---|---|---|---|
   | Kuwait | KWD | 20 | 5 | 45 |
   | Saudi Arabia | SAR | 249 | 59 | 549 |
   | UAE | AED | 239 | 59 | 539 |
   | Qatar | QAR | 239 | 59 | 529 |
   | Bahrain | BHD | 25 | 6 | 55 |
   | Oman | OMR | 25 | 6 | 56 |
   | other (when enabled) | USD | 65 | 16 | 145 |

   Nothing has to be created in Stripe by hand: the report is an inline price
   and the memberships use prices found or created by lookup key
   (`membership_monthly_sar`, `membership_yearly_kwd`, ...), all with
   `tax_behavior: inclusive`. When the table changes, the next checkout creates
   a new price and moves the lookup key to it; running subscriptions keep their
   price. KWD, BHD and OMR have three decimals and Stripe requires those amounts
   in whole 10 fils/baisa; every price in the table is checked against that
   before a checkout is created.

   To open or close a country, change `selling` (and `countries` for its
   currency) in both copies of `prices.json`, then redeploy the functions and
   the site. A country not in `selling` gets `400 country_not_available`.
   A Stripe customer keeps one currency for subscriptions while one is open;
   a customer who switches country gets `409 currency_mismatch`.

   **Checkout language.** Stripe Checkout has no Arabic, so Arabic customers
   get `locale: auto` (the browser's language where Stripe has it, otherwise
   English).

   **Tax.** Prices are VAT-inclusive whether or not Stripe Tax is on, so the
   customer always pays the listed amount. Set `STRIPE_AUTOMATIC_TAX=1` only
   after the owner has registered where Stripe should calculate VAT and added
   those registrations under Stripe > Tax. With it on, Checkout asks for the
   billing address and Stripe shows the VAT inside the price on the receipt.
   When the billing country differs from the country chosen on the site, the
   webhook writes `checkout.country_mismatch` to `audit_log` (the sale is not
   refused; it shows under "Needs attention" on /admin). Whether and where to register is a question for the tax adviser.
2. **Webhook** (Developers > Webhooks > Add endpoint):
   - URL: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
   - Events:
     `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
     `checkout.session.async_payment_failed`, `checkout.session.expired`,
     `customer.subscription.created`, `customer.subscription.updated`,
     `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`,
     `charge.refunded`
   - Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
3. Test end to end in test mode first (`stripe trigger checkout.session.completed`
   only exercises signature checks; a real test-card checkout from the app covers
   the order flow).

How the plans map to Stripe:

| Plan (`create-checkout`) | Stripe | Order created |
|---|---|---|
| `report` | `mode=payment`, one line | report order, paid on `checkout.session.completed` |
| `report_membership_monthly` / `_yearly` | `mode=subscription`: report as a one-time line + recurring price with `trial_period_days=30` | report order, paid on checkout; first invoice = the report |
| `membership_monthly` / `_yearly` | `mode=subscription`, no trial | none at checkout; each paid invoice creates a `checkin` order |

Monthly members get a check-in order from every paid invoice; yearly members get
one a month from the `monthly-checkins-daily` job.

**Yearly after the first year.** When a yearly subscription is created, the
webhook attaches a subscription schedule: the current phase (the 30-day trial or
the paid year), one yearly phase after a trial, then the monthly price, and the
schedule is released so it simply continues at the monthly price of the same
currency (KWD 45 then KWD 5 a month, SAR 549 then SAR 59, ...). The prices are
the lookup-key prices above (`membership_monthly_<cur>`, `membership_yearly_<cur>`). Check it under Billing > Subscriptions > the subscription
> Schedule. A failure shows as `stripe.schedule_failed` in `audit_log`.

**Cancel, resume, end early** (`manage-membership`): cancel = at period end;
resume = undo before the end; `end_now` = yearly only, ends today and refunds the
full months left (price / 12 each, in the membership's currency, rounded down to
10 fils/baisa for KWD, BHD and OMR and to whole halalas/fils/cents otherwise). Requests under the
14-day right of withdrawal and refunds after a photo-consent withdrawal are
issued by hand in the Stripe dashboard (the webhook records them); for the
latter, `audit_log` rows with action `orders.cancelled_consent_withdrawn` say
whether the refund policy suggests a full or partial refund:

```sql
select at, target_id as order_id, meta from public.audit_log
where action = 'orders.cancelled_consent_withdrawn' order by at desc;
``` Payment fees come from the
balance transaction: `payments.fee` is in the payment currency (converted back
with Stripe's rate), and the `costs` row is in the settlement currency (EUR for
the B.V.'s account), the exact amount Stripe kept.

## 7. Make the first admin and the reviewers

Sign in once through the app (that creates the `profiles` row), then in the SQL editor:

Staff are matched on the verified sign-in email in `auth.users`, never on a
column a customer could edit:

```sql
-- Admin (can also review: set reviewer_gender to receive orders of that gender)
update public.profiles
set role = 'admin', reviewer_gender = 'male'
where id = (select id from auth.users where email = 'you@example.com');

-- Reviewers. Orders are auto-assigned to the reviewer with the fewest open
-- orders whose reviewer_gender matches the customer's gender. Orders from
-- women can only ever be assigned to female reviewers (enforced by a trigger).
update public.profiles set role = 'reviewer', reviewer_gender = 'male'
where id = (select id from auth.users where email = 'reviewer.m@example.com');
update public.profiles set role = 'reviewer', reviewer_gender = 'female'
where id = (select id from auth.users where email = 'reviewer.f@example.com');
```

Check the result with
`select p.id, u.email, p.role, p.reviewer_gender from public.profiles p join auth.users u on u.id = p.id where p.role <> 'customer';`.

Only an admin (or the server) can change `role`, `reviewer_gender`,
`stripe_customer_id` and `email`; a customer trying it gets an error.
`profiles.email` is a copy of the sign-in email, kept in sync by triggers.
Reviews are locked once approved, and reviewers cannot change a review after
its order is delivered, refunded or cancelled.

## 8. Exchange rates for the dashboard

The views and the operator dashboard report in **EUR**, the currency the B.V.
books in (`v_order_economics`, `v_daily_kpis`, `v_mrr` have `*_eur` columns;
`v_revenue_by_market` breaks revenue down per country and currency in the raw
currency and in EUR). The admin page can show the same figures in KWD or USD;
it converts with the same table.

`fx_rates` holds the EUR value of one unit of each currency (`eur_per_unit`):

| Currency | Basis | Who sets it |
|---|---|---|
| EUR | base | always 1 |
| USD | manual | the admin, e.g. weekly (ECB reference rate or the accountant's) |
| KWD | manual | the admin, **daily**: the dinar is pegged to an undisclosed basket |
| SAR, AED, QAR, BHD, OMR | peg | nobody: fixed pegs to USD (3.75, 3.6725, 3.64, 0.376, 0.3845 per USD); their EUR value follows the USD rate (a trigger recomputes it) |

Set the manual ones in the admin page (Exchange rates, quoted as "1 EUR = x")
or in SQL:

```sql
update public.fx_rates set eur_per_unit = <EUR per 1 USD>, updated_at = now() where currency = 'USD';
update public.fx_rates set eur_per_unit = <EUR per 1 KWD>, updated_at = now() where currency = 'KWD';
-- an ad account in another currency:
insert into public.fx_rates (currency, eur_per_unit) values ('GBP', <EUR per 1 GBP>)
on conflict (currency) do update set eur_per_unit = excluded.eur_per_unit, updated_at = now();
```

Migration 010 carries over USD and EUR rates already set in KWD terms. The
admin page warns when KWD is more than a day old or USD more than a week. Until
a needed rate exists, the affected values are `null` and `fx_missing` is `true`
(nothing is silently counted as zero). `kwd_per_unit` is still filled in
(derived) for older queries.

## 9. Local development (optional)

```bash
supabase start                  # local stack with the migrations applied
supabase functions serve --env-file supabase/.env.local
```

Put test keys in `supabase/.env.local` (never commit it).

## Function reference

All take and return JSON. Errors are `{ "error": { "code", "message" } }`.

| Function | Caller | Body | Returns |
|---|---|---|---|
| `create-checkout` | signed-in user | `{ plan, locale }` | `{ url, order_id, session_id }`. Return pages follow `locale`: `/orders/:id`, `/start` (report plans, on cancel), `/account?checkout=success\|cancelled` (plain memberships), under `/ar` for Arabic. Joining during the included month starts the paid membership's trial at its end. Errors: `waitlist` (women), `profile_incomplete` (no gender), `age_required` (no `age18` consent), `already_member` (a paid membership is open; the included month does not count). |
| `stripe-webhook` | Stripe | raw event | `{ received: true }` |
| `submit-scan` | signed-in user | `{ order_id, scan_id }` | `{ order: { id, status, product, submitted_at, due_at, assigned } }`. Requires a `photos` consent (403 `photo_consent_required`), a `withdrawal_waiver` consent (409 `withdrawal_waiver_required`) and a `face` photo. |
| `generate-visual` | reviewer / admin | `{ order_id, kind, prompt, remarks?, parent_id? }` | `{ generation, url }` |
| `approve-delivery` | reviewer / admin | `{ order_id, generation_ids, notes? }` | `{ order, emailed }`. The email links to `/orders/:id` (`/ar/orders/:id` for Arabic). |
| `set-order-status` | reviewer / admin | `{ order_id, status: 'in_review' \| 'changes_requested', message? }` | `{ order, emailed }`. `changes_requested` emails the customer (their language) a link to the order page, with `message` (what to retake, max 2000 characters); logged as `orders.changes_requested`. |
| `customer-visuals` | signed-in user | `{ order_id? }` | `{ visuals: [{ order_id, generation_id, kind, url, created_at }], expires_in }` |
| `delete-my-data` | signed-in user | `{ confirm: true }` | `{ deleted: true, ... }` |
| `withdraw-photo-consent` | signed-in user | `{}` | `{ scans, files, visuals, consents, cancelled_orders }` |
| `manage-membership` | signed-in user | `{ action: 'cancel' \| 'resume' \| 'end_now' }` | `{ subscription, refund? }`. Errors: `no_membership`, `ended`, `not_yearly`, `trialing`, `not_stripe`, `included` (only the included month is running). |
| `purge-photos` | cron (cron secret) | `{}` | `{ scans, scans_failed, files, visuals, orphans, more }` |
| `purge-records` | cron (cron secret) | `{}` | `{ users, users_failed, files, waitlist, more }` |
| `membership-reminders` | cron (cron secret) | `{ dry_run? }` | `{ expired_included, due, sent, skipped, failed, held }` (`dry_run: true` lists what is due and sends nothing) |
| `sync-meta-ads` | cron (cron secret) | `{ days? }` | `{ rows, since, until, spend }` |
| `join-waitlist` | anyone | `{ email, phone?, gender?, locale?, source? }` | `{ ok: true }` (also for duplicates) |

Notes for the client:

- Photos go to `photos/{user_id}/{scan_id}/{view}.jpg`; insert `scans` and
  `scan_photos` rows (the `storage_path` must start with `{user_id}/{scan_id}/`),
  then call `submit-scan`. It records the accepted scan as `orders.scan_id`.
- Before submitting, a customer may delete their own scans and scan photos
  (retakes); after submission they are locked.
- The waitlist is joined only through the `join-waitlist` function (rate-limited,
  honeypot, same answer for duplicates). Direct inserts into `waitlist` are not
  allowed for anon or signed-in users.
- Customers cannot change `profiles.email`; it follows the sign-in email.
- Customers can only change `withdrawn_at` on their consents.
- Reviewers move an assigned order between `in_review` and
  `changes_requested` with `set-order-status` (it emails the customer); the
  database still allows that one change directly, without the email. Delivery
  always goes through `approve-delivery`.
- Every customer email is in the profile's language and links to the page in
  that language (`/ar/...` for Arabic).
