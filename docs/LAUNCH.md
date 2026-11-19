# Launch plan: Kuwait, men first

Updated 19 Nov 2026 (after integration round 2). One market (Kuwait), English and
Arabic, operated from the Netherlands. This is a checklist to take to a Dutch
lawyer, a Dutch accountant and, for the Kuwait points, a Kuwaiti lawyer. **It is
not legal or tax advice.**

## The model in one paragraph

A Dutch B.V. sells a non-surgical face and body analysis with a 12-month plan,
checked by a person, to customers in Kuwait. There is **no Kuwaiti entity and no
Kuwaiti licence**. The report costs **20 KWD** (one payment) and includes **30 days
of membership**. After that the customer can keep the membership for **5 KWD a
month, or 45 KWD for 12 months, then 5 KWD a month**, cancel any time, or let it
end. Payment is by **Stripe on the B.V., in KWD** (card, Apple Pay, Google Pay).
At launch the service is **for men aged 18 or over**; women can join a waitlist.

## What the customer buys

| Plan (`create-checkout`) | Today | Then |
|---|---|---|
| `report` | 20 KWD | 30 days of included membership (`subscriptions.plan = 'included'`, no Stripe subscription). It simply ends; nothing renews. An email goes out about 5 days before it ends. |
| `report_membership_monthly` | 20 KWD | 5 KWD a month from day 31, until cancelled |
| `report_membership_yearly` | 20 KWD | 45 KWD for 12 months from day 31, then 5 KWD a month, until cancelled (a Stripe subscription schedule). A reminder email goes out about 30 days before the 12 months end. |
| `membership_monthly` / `membership_yearly` | 5 / 45 KWD | for customers who already had a report; the yearly one is also 45 KWD for 12 months, then 5 KWD a month |

Membership gives: a re-scan every month with updated scores and an updated plan, a
note from the reviewer each month, and a new 12-month visual every 3 months.
Prices live in `app/src/lib/backend/types.ts` (`PRICES_KWD`, `BUNDLE_TRIAL_DAYS`) and
must match the Stripe prices. Approved wording is in `docs/CLAIMS.md`: never "no
subscription", never "free 30 days", never "45 KWD a year" on its own.

## Where things stand

What is **in the repo** after round 2. What is **live** was last checked on
19 Nov 2026 before round 2, so re-check it (step 7) before taking payments.

| Part | State |
|---|---|
| Database | Project `kmxmizakklawslfeguvw`, Central EU (Frankfurt). Migrations `…0001` to `…0005` are live. **Not applied yet:** `20261119000006_followups.sql` (consent withdrawal, retention), `…0007_cron_retention.sql` (24-month clean-up job), `…0008_membership_included.sql` (the 30 included days, reminder queue, retention clock) and `…0009_cron_membership.sql` (daily membership jobs), plus anything later in `supabase/migrations`. |
| Edge functions | Live before round 2: `create-checkout`, `stripe-webhook`, `submit-scan`, `generate-visual`, `approve-delivery`, `customer-visuals`, `delete-my-data`, `purge-photos`, `sync-meta-ads`, `join-waitlist`. **In the repo but not deployed:** `manage-membership`, `withdraw-photo-consent`, `purge-records`, `membership-reminders`, `set-order-status`. Several live ones changed in round 2 (for example `submit-scan` now refuses photos without the withdrawal waiver), so redeploy **all** of them. |
| Customer flow | `/start` (plan, who it is for, consent, sign in with an emailed 6-digit code, pay), the order page, `/account` (orders, membership, download or delete data, withdraw photo consent), with Arabic routes `/ar/start`, `/ar/account`, `/ar/orders/:id`. Women are sent to the waitlist. Before photos are submitted the customer confirms the withdrawal waiver (canonical text `WAIVER_TEXT` in `app/src/pages/legal/waiver.ts`). |
| Analysis engine | Runs in the browser on the customer's phone. **Accuracy not yet validated on real people** (see "Make sure the results hold up"). |
| Review console | Orders are auto-assigned to the reviewer with the fewest open orders of the matching gender; the reviewer checks results, generates visuals, writes notes and approves delivery (which emails the customer). |
| Operator dashboard | `/admin`: orders, revenue, fees, image costs, ad spend, waitlist, recent problem events from `audit_log`. |
| Landing and legal pages | EN and AR, pre-rendered. Privacy policy, terms and refund policy are **drafts with placeholders** (list below). |
| Payments, email, images, ads data | **Code ready, accounts and keys not set up.** Until they are, nobody can pay, sign-in emails use Supabase's rate-limited sender, and visuals can't be generated. |
| Tracking | **No Meta pixel or any other ad or analytics tracker on the site.** The privacy policy says so. Meta is used only to read campaign totals into the dashboard. |

## Owner checklist

In this order. Steps 1 and 2 take the longest.

### 1. Name and company details
- [ ] Choose the brand name and run a **trademark search** for it before you buy
      ads or print anything: EUIPO (eSearch plus, EU marks), the Benelux register
      (BOIP), WIPO Global Brand Database (international marks designating Kuwait),
      and the Kuwait trademark register (Ministry of Commerce and Industry), in Latin
      and Arabic script. Ask the lawyer whether to file in the Benelux/EU and Kuwait.
- [ ] Register the domain. Set the name in `VITE_BRAND_NAME` (Vercel), the
      `BRAND_NAME` function secret and `app/public/manifest.webmanifest`.
- [ ] Fill in the legal placeholders (next section).

### 2. Stripe account on the B.V.
- [ ] Open the Stripe account **in the name of the Dutch B.V.** (Netherlands),
      complete verification, and confirm with Stripe that it can charge in **KWD**
      and what it settles in (probably EUR).
- [ ] Products and prices, currency KWD: Report **20.000 KWD** one-time; Membership
      monthly **5.000 KWD / month**; Membership yearly **45.000 KWD / year**. Put
      the ids in `STRIPE_PRICE_REPORT`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`
      (optional: without them checkout uses inline prices). After a yearly plan's
      12 months the webhook moves it to the monthly price (`STRIPE_PRICE_MONTHLY`,
      or a price it finds or creates with lookup key `membership_monthly_kwd`).
- [ ] Turn on Apple Pay (verify the domain) and Google Pay for Checkout.
- [ ] Webhook (Developers > Webhooks > Add endpoint):
      - URL: `https://kmxmizakklawslfeguvw.supabase.co/functions/v1/stripe-webhook`
      - Events, all ten that `supabase/functions/stripe-webhook/index.ts` handles:
        `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
        `checkout.session.async_payment_failed`, `checkout.session.expired`,
        `customer.subscription.created`, `customer.subscription.updated`,
        `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`,
        `charge.refunded`
      - Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
- [ ] Do all of this in **test mode** first, then repeat in live mode (live keys,
      live prices, a second live webhook endpoint and its own signing secret).

### 3. Email (Resend) and the sign-in code
- [ ] Add and verify the sending domain in Resend (SPF and DKIM records at your DNS
      provider). Set `RESEND_API_KEY`, and `EMAIL_FROM` on that domain, for example
      `"<Brand> <reports@your-domain>"`.
- [ ] Supabase > Authentication > Emails > **SMTP settings**: turn on custom SMTP with
      Resend (host `smtp.resend.com`, user `resend`, password = a Resend API key;
      check the port and values in Resend's SMTP docs) and the same sender address.
      The built-in sender is rate-limited and not for production.
- [ ] Authentication > Emails > **Magic Link** template: include `{{ .Token }}` so the
      email shows the **6-digit code** the app asks for; keep `{{ .ConfirmationURL }}`
      for the link. Do the Arabic wording in the same template (one template serves
      both languages), then send yourself a sign-in and check the code arrives.

### 4. Auth URLs
- [ ] Authentication > URL Configuration: **Site URL** = `https://<your-domain>`.
- [ ] **Redirect URLs**: `https://<your-domain>/**` and `http://localhost:5173/**`
      (plus a preview domain if you test on one). The sign-in link returns the
      customer to the page they started from, including `/ar/...` pages.

### 5. Image provider
- [ ] Create the account, set `IMAGE_PROVIDER` (`fal` or `openai`) and its key
      (`FAL_KEY` or `OPENAI_API_KEY`). Optionally `IMAGE_PRICES_JSON` so costs in the
      dashboard match the provider's price list.
- [ ] **Sign its DPA**. It must forbid keeping customers' photos or training on them,
      because the privacy policy and the landing say so. Note where it processes data
      (for the privacy policy). Until it is signed, do not generate visuals for real
      customers.

### 6. Meta
- [ ] A system-user token with `ads_read` and the ad account id: `META_ACCESS_TOKEN`,
      `META_AD_ACCOUNT_ID` (optional `META_API_VERSION`). This only reads campaign
      totals into the dashboard.
- [ ] If you later want the **Meta pixel** (or any tracker), it needs a consent
      banner first, and the privacy policy (sections 2 and 6) must be updated before
      it goes live. Today the policy says there is none.

### 7. Supabase: migrations, secrets, functions, cron
- [ ] Apply every migration not yet on the project, in order (006, 007, 008, 009 and
      any later file): `supabase db push`, or paste them in the SQL editor. Never edit
      a migration that is already applied.
- [ ] Function secrets (Edge Functions > Secrets, or `supabase secrets set`; never
      commit them). From `supabase/README.md`, section 4:

      | Secret | Required? |
      |---|---|
      | `SITE_URL` (no trailing slash) | yes |
      | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | yes |
      | `STRIPE_PRICE_REPORT`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY` | recommended |
      | `IMAGE_PROVIDER` + `FAL_KEY` or `OPENAI_API_KEY` | yes |
      | `RESEND_API_KEY`, `EMAIL_FROM`, `BRAND_NAME` | yes |
      | `CRON_SECRET` (`openssl rand -hex 32`) | yes |
      | `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` | for the ad-spend chart |
      | `ALLOWED_ORIGINS`, `RATE_LIMIT_SALT`, `IMAGE_PRICES_JSON`, `META_API_VERSION` | optional |
      | `VISUALS_WITH_PHOTOS` | leave unset (setting `all` contradicts the privacy policy) |

- [ ] Vault, in the SQL editor, so the daily jobs can call the functions:
      `select vault.create_secret('https://kmxmizakklawslfeguvw.supabase.co', 'project_url');`
      and `select vault.create_secret('<same value as CRON_SECRET>', 'cron_secret');`.
      Without them the jobs (`purge-photos-daily`, `purge-records-daily`,
      `monthly-checkins-daily`, `included-memberships-daily`,
      `membership-reminders-daily`, `sync-meta-ads-daily`) log a warning and do
      nothing, so photos are not deleted on time and no reminder emails go out.
- [ ] Deploy all functions: `supabase functions deploy`. Check the list in the
      dashboard includes the five that were missing (`manage-membership`,
      `withdraw-photo-consent`, `purge-records`, `membership-reminders`,
      `set-order-status`).

### 8. First admin and reviewers
- [ ] Sign in once through the app (that creates your `profiles` row), then in the SQL
      editor:

      ```sql
      update public.profiles
      set role = 'admin', reviewer_gender = 'male'
      where id = (select id from auth.users where email = 'you@example.com');
      ```

      Add reviewers the same way with `role = 'reviewer'` (`supabase/README.md`,
      section 7). Check with
      `select p.id, u.email, p.role, p.reviewer_gender from public.profiles p join auth.users u on u.id = p.id where p.role <> 'customer';`.
- [ ] Set the exchange rates for the dashboard (`fx_rates`, README section 8).

### 9. Vercel
- [ ] Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SITE_URL`,
      `VITE_BRAND_NAME`; `VITE_INDEXABLE=1` only on production. Build with
      `npm run build:site` and attach the domain.

## Legal placeholders to fill in

Every `[BRACKETED]` value shows to customers until it is replaced.

| Placeholder | Where |
|---|---|
| `[COMPANY NAME B.V.]`, `[KVK NUMBER]`, `[ADDRESS]`, `[CONTACT EMAIL]` | `app/src/pages/legal/content.ts` (`COMPANY`, used on all three legal pages, the contact line and the withdrawal form) |
| `[COMPANY NAME B.V.]` | `app/src/pages/Landing.tsx` (`OPERATOR`, footer). Replace together with `COMPANY.name`. |
| `[IMAGE PROVIDER]` | `app/src/pages/legal/content.ts`, privacy section 6 table (EN and AR) |
| `[REGION]` for Vercel, Stripe, the image provider and Resend | `app/src/pages/legal/content.ts`, privacy section 6 table (EN and AR); also `app/src/components/ConsentGate.tsx` (the "Where" row of the photo consent) |
| `[REVIEWERS: …]` (where reviewers work, transfer safeguards) | `app/src/pages/legal/content.ts`, privacy section 6 (EN and AR) |
| `[KUWAIT: …]` (CITRA regulation) | `app/src/pages/legal/content.ts`, privacy section 7 (EN and AR) |
| `[report / membership]`, `[date]` in the model withdrawal form | `app/src/pages/legal/content.ts`, refund policy section 7. These stay: the customer fills them in. |

When any legal wording changes, bump `CONSENT_VERSION` in
`app/src/lib/backend/consents.ts` so each consent record shows which text was agreed.

## Legal and tax: questions to settle

### The B.V. selling into Kuwait
- [ ] Confirm with a Kuwaiti lawyer that a foreign company may sell this online
      service to Kuwaiti residents **without a local entity or licence**, and what
      changes if we later hire people, run ads through local agencies or partner with
      clinics in Kuwait.
- [ ] Consumer law: the terms are under Dutch law, but Kuwaiti consumer rules may
      still apply to Kuwaiti customers. Have the terms, refund policy and the
      withdrawal waiver (`WAIVER_TEXT`) checked.
- [ ] Advertising: health, cosmetic and appearance claims in ads are regulated in
      Kuwait (Ministry of Health for health-related advertising, Ministry of
      Information for paid and influencer ads). Ask what applies to a foreign
      advertiser; keep to `docs/CLAIMS.md`.

### Payments
- [ ] **Stripe on the B.V., in KWD** (cards, Apple Pay, Google Pay). Ask Stripe to
      confirm KWD presentment and settlement (the webhook converts fees back to KWD).
- [ ] Local debit-card schemes are not offered at launch. Do not mention any payment
      method on the site that is not live (`docs/CLAIMS.md`).

### Data protection
- [ ] **GDPR as the controller**: records of processing, a data-protection impact
      assessment (face and body photos and health-related answers are special-category
      data, processed on explicit consent), a breach procedure (72 hours to the Dutch
      DPA) and a contact for requests.
- [ ] **DPAs** signed with every processor: Supabase, Vercel, Stripe (partly an
      independent controller), Resend and the image provider. Fill in their regions.
- [ ] Transfers outside the EU: check each processor's location and transfer
      mechanism (EU-US Data Privacy Framework or standard contractual clauses),
      especially the image provider and Resend.
- [ ] **CITRA check with counsel.** Ask a Kuwaiti lawyer whether and how CITRA's Data
      Privacy Protection Regulation applies to a foreign provider serving Kuwaiti
      residents: storing the data in the EU, consent wording (including consent to
      transfer outside Kuwait), breach notification, and any registration. Put the
      answer in privacy section 7, replacing the `[KUWAIT: …]` note.
- [ ] Staff access: the privacy policy says the assigned reviewer and our admins can
      open orders and photos. There is no per-view access log. If you want to promise
      one, build it first.
- [ ] 18+ only: age is confirmed and stored as a consent at sign-up.

### Tax
- [ ] **VAT on digital services to non-EU consumers.** Ask the Dutch accountant
      whether the B.V. charges Dutch VAT on sales to consumers in Kuwait, what
      evidence of the customer's location to keep, and whether any Kuwaiti tax
      applies to foreign digital-service sellers.
- [ ] Bookkeeping in KWD vs EUR: Stripe settlement currency, exchange-rate records,
      and how membership revenue (including the 30 included days) is recognised.

## How a paid order works

1. The customer opens `/start` (or `/ar/start`), chooses a plan, says who it is for
   (women go to the waitlist), agrees to the terms, privacy policy and photo and
   health-data consent, confirms they are 18+, and signs in with the 6-digit code.
2. They pay on Stripe Checkout. The webhook marks the order paid; the browser is
   never trusted for payment status. A report bought on its own starts 30 included
   days of membership.
3. They take the guided photos; the analysis runs on their phone. Before upload they
   confirm the withdrawal waiver. `submit-scan` refuses photos without it, sets the
   order to "In review", due in 72 hours, and assigns a reviewer.
4. The reviewer checks the landmarks and the plan, generates the 12-month visuals,
   checks them for realism, writes notes and approves. Only then can the customer
   see anything, and they get a "Your report is ready" email.
5. Members get a check-in order every month (from each paid monthly invoice, or the
   daily job for yearly and included members).
6. Photos are deleted 90 days after delivery, or straight away when the customer
   withdraws photo consent or deletes their account. Illustrations, measurements and
   notes go when the account is deleted, or 24 months after the last activity.
   Waitlist entries are deleted after 24 months.

## Men only, women on the waitlist

At launch only men can order. Women who choose "for a woman" at `/start`, or use
the form on the landing page, join the waitlist (`join-waitlist`). The plan for the
women's service, stated on the site as a plan and not as a fact: women's photos and
results reviewed only by female reviewers (the database already refuses to assign a
woman's order to anyone else). Before opening it: hire and train at least one female
reviewer, review the plan content for women, and update `docs/CLAIMS.md`. **No
photos of women anywhere**, on the site or in ads.

## Before launch

### Reviewers
- [ ] At least one male reviewer, plus a back-up, with a contract that covers
      confidentiality, the GDPR (they act for the B.V.) and the review checklist.
- [ ] Decide how reviewers are named on reports (name only, unless they hold a
      licence they agree to show).

### Make sure the results hold up
- [ ] **Calibration study:** 30–50 consenting men (a range of ages, skin tones,
      with and without beards), measured with calipers or by a clinician, compared
      with the app. Only claim the accuracy you measured.
- [ ] Test real phone photos (bad light, mirrors, glasses, beards) and tighten the
      photo guide and error messages.
- [ ] **Paid beta:** 20–30 real customers at the full price, the whole flow end to
      end, with turnaround, refunds and feedback tracked.

### Product
- [ ] Arabic marker definitions in the report PDF.
- [ ] Error monitoring, uptime alerts, backups (Supabase point-in-time recovery).

### Marketing
- [ ] Final domain, then `VITE_SITE_URL=https://<domain> VITE_INDEXABLE=1 npm run build:site`
      and submit the sitemap to Google Search Console.
- [ ] Any pixel or analytics only with a consent banner and an updated privacy policy.
- [ ] Influencers: check the Ministry of Information licensing question with the
      lawyer; every paid post says it's an ad.

### The day before
- [ ] A real 20 KWD card payment, an Apple Pay payment and a refund all work, in live mode.
- [ ] Report only: the account shows 30 included days, and nothing is charged after them.
- [ ] A membership bundle: the trial starts, the first renewal invoice is right, and
      cancelling from the account page stops it. A yearly bundle shows its schedule
      (45 KWD for 12 months, then 5 KWD a month) under Billing > Subscriptions.
- [ ] `membership-reminders` with `{ "dry_run": true }` lists what is due without sending.
- [ ] Photo submission without the waiver is refused; with it, it goes through.
- [ ] A full order goes from payment to delivered report within 72 hours.
- [ ] The sign-in email arrives with the 6-digit code, from our own domain.
- [ ] Deletion works: account delete, photo-consent withdrawal, and the 90-day job run
      once by hand.
- [ ] The placeholders are filled in; the privacy policy, terms and refund policy are
      reviewed by the lawyer and linked in the footer.
- [ ] Every claim on the site is true today (`docs/CLAIMS.md`).
