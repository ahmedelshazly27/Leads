# Launch plan: Kuwait, men first

Updated 19 Nov 2026. One market (Kuwait), English and Arabic, operated from the
Netherlands. This is a checklist to take to a Dutch lawyer, a Dutch accountant and,
for the Kuwait points, a Kuwaiti lawyer. **It is not legal or tax advice.**

## The model in one paragraph

A Dutch B.V. sells a non-surgical face and body analysis with a 12-month plan,
checked by a person, to customers in Kuwait. There is **no Kuwaiti entity and no
Kuwaiti licence**. The report costs **20 KWD** (one payment) and includes **30 days
of membership**. After that the customer can keep the membership for **5 KWD a
month, or 45 KWD for the first year and then 5 KWD a month**, cancel any time, or
let it end. Payment is by **Stripe on
the B.V., in KWD** (card, Apple Pay, Google Pay). **KNET is not available yet.** At
launch the service is **for men aged 18 or over**; women can join a waitlist.

## What the customer buys

| Plan (`create-checkout`) | Today | Then |
|---|---|---|
| `report` | 20 KWD | 30 days of membership, which simply end. Nothing renews. |
| `report_membership_monthly` | 20 KWD | 5 KWD a month from day 31, until cancelled |
| `report_membership_yearly` | 20 KWD | 45 KWD for the first year from day 31, then 5 KWD a month, until cancelled (a Stripe subscription schedule) |
| `membership_monthly` / `membership_yearly` | 5 / 45 KWD | for customers who already had a report; the yearly one also continues at 5 KWD a month after its first year |

Membership gives: a re-scan every month with updated scores and an updated plan, a
note from the reviewer each month, and a new 12-month visual every 3 months.
Prices live in `app/src/lib/backend/types.ts` (`PRICES_KWD`, `BUNDLE_TRIAL_DAYS`) and
must match the Stripe prices. Approved wording is in `docs/CLAIMS.md`: never "no
subscription", never "free 30 days", never "KNET" until it is live.

## Where things stand

| Part | State |
|---|---|
| Backend | **Live on Supabase**, project `kmxmizakklawslfeguvw`, region Central EU (Frankfurt). All migrations applied (tables, row-level security, private photo and visual buckets, dashboard views, daily jobs, hardening). **10 edge functions deployed**: `create-checkout`, `stripe-webhook`, `submit-scan`, `generate-visual`, `approve-delivery`, `customer-visuals`, `delete-my-data`, `purge-photos`, `sync-meta-ads`, `join-waitlist`. **Not yet deployed** (in the repo, checked 19 Nov 2026): `manage-membership` (cancel / resume / end a yearly membership early), `withdraw-photo-consent` and `purge-records` (the 24-month clean-up). Deploy them before taking real payments: without them, members can't cancel from the account page and photo consent can't be withdrawn from the app. Re-check that every migration in `supabase/migrations` is applied at the same time. Contract: `docs/BACKEND.md`; set-up: `supabase/README.md`. |
| Customer flow | Built: `/start` (choose a plan, who it is for, consent, sign in with an emailed 6-digit code, pay), the order page, the account page (orders, membership, download or delete data). Women are sent to the waitlist at the "who it is for" step. |
| Analysis engine | Runs in the browser on the customer's phone: face, side profile, smile and body measurements, skin by region, the 12-month plan, nutrition and training. **Accuracy not yet validated on real people** (step 5). |
| Review console | Server-backed queue: orders are auto-assigned to the reviewer with the fewest open orders; the reviewer checks the results, generates the 12-month visuals through the image provider, writes notes and approves delivery. |
| Operator dashboard | `/admin`: orders, revenue, payment fees, image costs, ad spend. |
| Landing and legal pages | EN and AR: pricing with the membership, women's waitlist, privacy policy, terms and refund policy (draft, with placeholders), all pre-rendered for search and link previews. |
| Payments, email, images, ads data | **Code ready, accounts and keys not set up** (next section). Until they are, nobody can pay, sign-in emails use Supabase's rate-limited sender, and visuals can't be generated. |

## What the owner still has to do

In this order; the first two take the longest.

1. **Company details and name.** Choose the brand name (`VITE_BRAND_NAME`, the
   `BRAND_NAME` function secret, the app manifest) and register the domain. Fill in the
   B.V.'s name, KvK number, address and contact email: they are the `[BRACKETED]`
   placeholders in `app/src/pages/legal/content.ts` and the footer of
   `app/src/pages/Landing.tsx` (`OPERATOR`).
2. **Stripe account on the B.V.** Activate it for KWD. Create the three prices
   (Report 20.000 KWD one-time, Membership 5.000 KWD/month, 45.000 KWD/year) and put
   the ids in `STRIPE_PRICE_REPORT`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`.
   Turn on Apple Pay and Google Pay in Checkout (Apple Pay needs the domain verified).
   Set `STRIPE_SECRET_KEY`.
3. **Stripe webhook.** Endpoint
   `https://kmxmizakklawslfeguvw.supabase.co/functions/v1/stripe-webhook` with at
   least `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`
   and `charge.refunded` (the full list the function handles is in
   `supabase/README.md`, section 6). Copy the signing secret into
   `STRIPE_WEBHOOK_SECRET`. Test with a test-mode card from the app before going live.
4. **Email.** Verify the sending domain in Resend; set `RESEND_API_KEY` and
   `EMAIL_FROM`. In Supabase Auth, set Resend as the **custom SMTP** sender and put
   `{{ .Token }}` in the Magic Link template, so the sign-in email carries the
   6-digit code the app asks for. Set the Site URL and redirect URLs.
5. **Image provider.** Create the account, set `IMAGE_PROVIDER` and its key, and
   **sign its DPA**, which must forbid keeping or training on customers' photos (the
   site says so). Until then, don't generate visuals for real customers.
6. **Meta.** A system-user token with `ads_read` and the ad account id
   (`META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`) so ad spend reaches the dashboard.
7. **Cron secret.** `CRON_SECRET` in function secrets and the same value in Vault
   (`supabase/README.md`, section 2), or the daily photo deletion doesn't run.
8. **Deploy the remaining functions.** `manage-membership`, `withdraw-photo-consent`
   and `purge-records` are in the repo but not on the project yet
   (`supabase functions deploy <name>`, see `supabase/README.md`).
9. **First admin and reviewers.** Sign in once through the app, then run the SQL in
   `supabase/README.md`, section 7, to make yourself admin and add reviewers.
10. **Vercel.** Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (and
   `VITE_SITE_URL`, `VITE_BRAND_NAME`; `VITE_INDEXABLE=1` only on production), build
   with `npm run build:site`, attach the domain.

## Legal and tax: questions to settle

### The B.V. selling into Kuwait
- [ ] Confirm with a Kuwaiti lawyer that a foreign company may sell this online
      service to Kuwaiti residents **without a local entity or licence**, and what
      changes if we later hire people, run ads through local agencies or partner with
      clinics in Kuwait.
- [ ] Consumer law: the terms are under Dutch law, but Kuwaiti consumer rules may
      still apply to Kuwaiti customers. Have the terms and refund policy checked.
- [ ] Advertising: health, cosmetic and appearance claims in ads are regulated in
      Kuwait (Ministry of Health for health-related advertising, Ministry of
      Information for paid and influencer ads). Ask what applies to a foreign
      advertiser; keep to `docs/CLAIMS.md`.

### Payments
- [ ] **Now: Stripe on the B.V., in KWD** (cards, Apple Pay, Google Pay). Ask Stripe to
      confirm KWD presentment and how it settles (likely EUR; the webhook already
      converts fees back to KWD).
- [ ] **Later: KNET.** Most Kuwaitis pay with KNET debit, and Stripe doesn't offer
      it. Options: **Checkout.com**, which offers KNET (confirm that it can onboard
      a Dutch B.V. for KNET and what the KNET scheme requires of us), or a Kuwaiti
      gateway (MyFatoorah, Tap, UPayments, Hesabe), which usually needs a Kuwaiti
      commercial licence and bank account. Either way: a second processor, KNET's
      merchant approval, a refund flow (KNET refunds work differently from cards),
      and the `checkout_com` provider path that the schema already allows. Only add
      "KNET" to the site once a real KNET payment and refund have worked.

### Data protection
- [ ] **GDPR as the controller**: the B.V. decides why and how the data is used.
      Records of processing, a data-protection impact assessment (face and body
      photos, health-related answers: special-category data, processed on explicit
      consent), breach procedure (72 hours to the Dutch DPA), and a contact for
      requests.
- [ ] **DPAs** signed with every processor: Supabase (database, auth, storage),
      Vercel (hosting), Stripe (payments; partly an independent controller), Resend
      (email) and the image provider. List them in the privacy policy.
- [ ] Transfers outside the EU: check each processor's location and transfer
      mechanism (EU-US Data Privacy Framework or standard contractual clauses),
      especially the image provider.
- [ ] **Kuwait: CITRA's Data Privacy Protection Regulation.** Ask the lawyer whether
      and how it applies to a foreign provider serving Kuwaiti residents, and what it
      says about storing the data abroad (it is stored in the EU), consent wording and
      breach notification.
- [ ] 18+ only: age is confirmed and stored as a consent at sign-up.

### Tax
- [ ] **VAT on digital services to non-EU consumers.** Ask the Dutch accountant
      whether the B.V. charges Dutch VAT on sales to consumers in Kuwait (generally
      not, since a digital service to a non-EU consumer is taxed where the consumer
      lives), whether the OSS scheme matters at all (it covers EU consumers, so only
      if we ever sell inside the EU), and what evidence of the customer's location to
      keep. Kuwait has no VAT today; ask whether any Kuwaiti tax applies to foreign
      digital-service sellers.
- [ ] Bookkeeping in KWD vs EUR: Stripe settlement currency, exchange-rate records,
      and how membership revenue is recognised.

## How a paid order works

1. The customer opens `/start`, chooses a plan, says who it is for (women go to the
   waitlist), agrees to the photo and health-data consent, confirms they are 18+, and
   signs in with the 6-digit code from the email.
2. They pay on Stripe Checkout. The webhook marks the order paid; the browser is
   never trusted for payment status.
3. They take the guided photos; the analysis runs on their phone. Photos and results
   upload to private storage. `submit-scan` sets the order to "In review", due in
   72 hours, and assigns a reviewer.
4. The reviewer checks the landmarks and the plan, generates the 12-month visuals,
   checks them for realism, writes notes and approves. Only then can the customer
   see anything.
5. The customer gets an email: "Your report is ready".
6. Members get a check-in order every month (from each paid monthly invoice, or the
   daily job for yearly members).
7. Photos are deleted automatically 90 days after delivery, or straight away when
   the customer deletes their data from the account page.

## Men only, women on the waitlist

At launch only men can order. Women who choose "for a woman" at `/start`, or use
the form on the landing page, join the waitlist (`join-waitlist`). The plan for the
women's service, stated on the site as a plan and not as a fact: women's photos and
results reviewed only by female reviewers (the database already refuses to assign a
woman's order to anyone else), with its own plans. Before opening it: hire and train
at least one female reviewer, review the plan content for women, and update
`docs/CLAIMS.md`. **No photos of women anywhere**, on the site or in ads.

## Before launch

### Reviewers
- [ ] At least one male reviewer, plus a back-up, with a contract that covers
      confidentiality, the GDPR (they act for the B.V.) and the review checklist.
- [ ] Decide how reviewers are named on reports (name only, unless they hold a
      licence they agree to show).

### Make sure the results hold up
- [ ] **Calibration study:** 30–50 consenting men (a range of ages, skin tones,
      with and without beards), measured with calipers or by a clinician, compared
      with the app. Fix whatever is off, and only claim the accuracy you measured.
- [ ] Test real phone photos (bad light, mirrors, glasses, beards) and tighten the
      photo guide and error messages.
- [ ] **Paid beta:** 20–30 real customers at the full price (friends and network),
      the whole flow end to end, with turnaround, refunds and feedback tracked.

### Product
- [ ] Arabic in the report PDF (the app and landing are bilingual).
- [ ] Error monitoring, uptime alerts, backups (Supabase point-in-time recovery).
- [ ] Load the face and body models only on the scan page.

### Marketing
- [ ] Final domain, then `VITE_SITE_URL=https://<domain> VITE_INDEXABLE=1 npm run build:site`
      and submit the sitemap to Google Search Console.
- [ ] Analytics with consent, plus the Snapchat, Instagram and TikTok pixels.
- [ ] Influencers: check the Ministry of Information licensing question with the
      lawyer; every paid post says it's an ad.
- [ ] Launch content in Kuwaiti Arabic first, with drawings and the synthetic sample.

### The day before
- [ ] A real 20 KWD card payment, an Apple Pay payment and a refund all work, in live mode.
- [ ] A membership bundle: the trial starts, the first renewal invoice is right, and
      cancelling from the account page stops it. A yearly bundle moves to 5 KWD a
      month after its first year (check the Stripe subscription schedule).
- [ ] A full order goes from payment to delivered report within 72 hours.
- [ ] The sign-in email arrives with the 6-digit code, from our own domain.
- [ ] Deletion works (account delete, and the 90-day job run once by hand).
- [ ] The placeholders in the legal pages and footer are filled in; the privacy
      policy, terms and refund policy are reviewed and linked in the footer.
- [ ] Every claim on the site is true today (`docs/CLAIMS.md`).
