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
  functions/
    _shared/                          CORS, HTTP helpers, service client, auth, Stripe, image APIs, email, storage
    create-checkout/  stripe-webhook/  submit-scan/  generate-visual/  approve-delivery/
    customer-visuals/ delete-my-data/  purge-photos/ sync-meta-ads/    join-waitlist/
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
three daily jobs. The jobs call `purge-photos` and `sync-meta-ads` with a
dedicated **cron secret** (not the service key, so the scheduler holds only the
power to start those two jobs). Make one random value and store it in two places:

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
| `purge-photos-daily` | 02:15 | calls `purge-photos`: deletes photos 90 days after delivery, after a refund/cancellation, or (for orders that never finished) after the scan; also removes stray uploads older than 3 days that belong to no scan |
| `sync-meta-ads-daily` | 03:40 | calls `sync-meta-ads` for the last 7 days |
| `monthly-checkins-daily` | 04:05 | `ensure_monthly_checkins()`: a check-in order each month for yearly members |

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
- **Authentication > Emails > Magic Link** template: include `{{ .Token }}` so the
  email carries the 6-digit code the app asks for (`signInWithOtp` + `verifyOtp`).
- Set up a custom SMTP sender (Resend works) before launch; the built-in sender is rate-limited.

## 4. Secrets for the functions

Set them in **Edge Functions > Secrets** or with the CLI. Never commit them.

```bash
supabase secrets set \
  SITE_URL=https://<your-domain> \
  STRIPE_SECRET_KEY=sk_live_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  STRIPE_PRICE_REPORT=price_... \
  STRIPE_PRICE_MONTHLY=price_... \
  STRIPE_PRICE_YEARLY=price_... \
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
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | create-checkout, stripe-webhook, delete-my-data | |
| `STRIPE_PRICE_REPORT` / `_MONTHLY` / `_YEARLY` | create-checkout | Optional. Without them, checkout uses inline prices: 20.000 / 5.000 / 45.000 KWD. |
| `IMAGE_PROVIDER` | generate-visual | `fal` (default) or `openai`. |
| `FAL_KEY` / `OPENAI_API_KEY` | generate-visual | For the chosen provider. Optional: `FAL_IMAGE_MODEL`, `OPENAI_IMAGE_MODEL`, `OPENAI_IMAGE_QUALITY`. |
| `IMAGE_PRICES_JSON` | generate-visual | Optional override of the USD price per call, e.g. `{"fal-ai/nano-banana/edit":0.039}`. Check the provider's pricing page; costs in the dashboard come from this table (OpenAI uses the token usage it reports). |
| `RESEND_API_KEY`, `EMAIL_FROM`, `BRAND_NAME` | approve-delivery | `EMAIL_FROM` must be on a domain verified in Resend. |
| `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` | sync-meta-ads | System-user token with `ads_read`. Optional `META_API_VERSION` (default `v21.0`). |
| `RATE_LIMIT_SALT` | join-waitlist | Optional random string used to hash IP addresses. |
| `CRON_SECRET` | purge-photos, sync-meta-ads | Random value; the same value goes into Vault as `cron_secret` (section 2). |

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

1. **Products and prices** (Dashboard > Product catalog), currency **KWD**:
   - Report: one-time **20.000 KWD**
   - Membership monthly: recurring **5.000 KWD / month**
   - Membership yearly: recurring **45.000 KWD / year**

   Put the `price_...` ids in the `STRIPE_PRICE_*` secrets. KWD has three
   decimals; Stripe takes amounts in fils (20 KWD = 20000) and requires the last
   digit to be 0.
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
one a month from the `monthly-checkins-daily` job. Payment fees come from the
balance transaction (converted back to KWD with Stripe's rate when the account
settles in EUR) and are written to `payments.fee` and a `costs` row.

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

The dashboard reports in KWD. Image costs are in USD and Meta spend is in the ad
account's currency, so set the rates you want to use (KWD per 1 unit) and update
them now and then:

```sql
insert into public.fx_rates (currency, kwd_per_unit) values
  ('USD', <rate>), ('EUR', <rate>)
on conflict (currency) do update set kwd_per_unit = excluded.kwd_per_unit, updated_at = now();
```

Until a needed rate exists, the affected margin / spend values are `null` and
`fx_missing` is `true` in the views (nothing is silently counted as zero).

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
| `create-checkout` | signed-in user | `{ plan, locale }` | `{ url, order_id, session_id }`. Errors: `waitlist` (women), `profile_incomplete` (no gender), `age_required` (no `age18` consent), `already_member`. |
| `stripe-webhook` | Stripe | raw event | `{ received: true }` |
| `submit-scan` | signed-in user | `{ order_id, scan_id }` | `{ order: { id, status, product, submitted_at, due_at, assigned } }`. Requires a `photos` consent and a `face` photo. |
| `generate-visual` | reviewer / admin | `{ order_id, kind, prompt, remarks?, parent_id? }` | `{ generation, url }` |
| `approve-delivery` | reviewer / admin | `{ order_id, generation_ids, notes? }` | `{ order, emailed }` |
| `customer-visuals` | signed-in user | `{ order_id? }` | `{ visuals: [{ order_id, generation_id, kind, url, created_at }], expires_in }` |
| `delete-my-data` | signed-in user | `{ confirm: true }` | `{ deleted: true, ... }` |
| `purge-photos` | cron (cron secret) | `{}` | `{ scans, scans_failed, files, orphans, more }` |
| `sync-meta-ads` | cron (cron secret) | `{ days? }` | `{ rows, since, until, spend }` |
| `join-waitlist` | anyone | `{ email, phone?, gender?, locale?, source? }` | `{ ok: true }` (also for duplicates) |

Notes for the client:

- Photos go to `photos/{user_id}/{scan_id}/{view}.jpg`; insert `scans` and
  `scan_photos` rows (the `storage_path` must start with `{user_id}/{scan_id}/`),
  then call `submit-scan`.
- The waitlist is joined only through the `join-waitlist` function (rate-limited,
  honeypot, same answer for duplicates). Direct inserts into `waitlist` are not
  allowed for anon or signed-in users.
- Customers cannot change `profiles.email`; it follows the sign-in email.
- Customers can only change `withdrawn_at` on their consents.
- Reviewers may move an assigned order between `in_review` and
  `changes_requested`; delivery always goes through `approve-delivery`.
