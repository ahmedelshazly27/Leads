# Launch readiness

Status as of 12 Nov 2026. P0 = must be done before taking a single paid customer.
P1 = before marketing spend. P2 = soon after launch.

## 1. What works today

Everything below runs **in the browser, on the user's device**. Nothing is sent
to a server, because there is no server yet.

| Part | State |
|---|---|
| Face analysis | Works. MediaPipe face mesh (478 points + iris) → ~57 frontal markers, skin by region (evenness, redness, texture), symmetry, proportions, dimorphism, face shape. |
| Side profile, smile | Works on good photos (beard detection hides chin/lip markers it can't see). |
| Body | Works. Pose (front + side) → proportions, posture, waist/hip ratios. Body fat is an **estimate from BMI** (Deurenberg), not measured. |
| Marker registry | 236 markers from the literature; on the sample 80 are measured, 38 hidden by facial hair, 39 reviewer-graded, 79 not built yet. |
| Plan engine | Works. Rule-based 12-month plan, every step graded A–C with citations; nutrition targets. |
| Review console | Works **only in the founder's own browser** (local data). Not multi-user. |
| After images (12-month visual) | **Manual.** The console writes the prompt; the reviewer pastes it into an image tool by hand. Realism checks exist (`realism.ts`) but no API integration. |
| Landing page | Done in English and Arabic (`/`, `/ar`), privacy and women's-service section, SEO metadata, pre-rendered HTML. |

**Not yet validated:** measurement accuracy against ground truth. Before claiming
precision we need a small calibration study: ~30–50 consenting people, measured
by a clinician or with calipers, compared with the app. Also test on real phone
photos (bad light, hijab, glasses, beards, darker skin types). The sample person is synthetic.

## 2. Backend and accounts (P0)

- [ ] **Accounts**: phone number + OTP (WhatsApp/SMS) is the Gulf default; add Apple/Google sign-in. 18+ age gate.
- [ ] **Database**: users, profiles, scans, plans, reviews, orders, consents, audit log. (Supabase is already connected to this workspace: Postgres + Auth + Storage.)
- [ ] **Data residency decision**: UAE PDPL and Saudi PDPL treat face photos as sensitive/biometric data. Either host in-region (AWS me-central-1 UAE / me-south-1 Bahrain, or Supabase self-hosted there) or document a lawful cross-border transfer. Supabase cloud has no Gulf region. *Decide before writing the privacy policy*: the site promises "stored in line with UAE and Saudi law".
- [ ] **Photo storage**: private encrypted bucket, short-lived signed URLs, **automatic deletion 90 days after delivery** (scheduled job) and on request.
- [ ] **Access control**: only the assigned reviewer can open a scan's photos; every access logged.
- [ ] **Women-only review**: reviewer roster with gender; women's scans can only be assigned to female reviewers, enforced in the database, not just in the UI. **Hire and train at least one female reviewer before opening sign-ups to women.**
- [ ] **Review workflow on the server**: queue, assignment, SLA timer, "approved by [name]" stamp, then release to the client.
- [ ] **After-image generation via API**, with a vendor whose contract forbids retaining or training on photos (the site promises this). Run the realism checks automatically; reviewer approves.
- [ ] **Notifications**: email (Resend is connected) and WhatsApp for "report ready", check-in reminders.
- [ ] **Account deletion and data export** (legal requirement).

## 3. Payments (P0)

- [ ] **Gateway** with AED + SAR, cards, Apple Pay and **mada** (Saudi debit): Tap Payments, Checkout.com, HyperPay or Moyasar (Saudi). Stripe works for a UAE entity but has no mada/KSA merchant support.
- [ ] Products: one-off report (199), premium (399), monthly (49) and yearly (399) subscriptions; renewals, cancellations, refunds.
- [ ] **VAT**: UAE 5%, KSA 15%. The site says "prices include VAT", so prices must be set per country and invoices must be VAT invoices (KSA: ZATCA e-invoicing). Register once over the threshold (AED/SAR 375k), or voluntarily earlier.
- [ ] Optional: Tabby / Tamara instalments (very common in the Gulf).
- [ ] Refund and cancellation policy page.

## 4. Legal and compliance (P0)

- [ ] Company and licence: UAE free-zone or mainland licence that covers online wellness services; decide how to sell into KSA (cross-border vs local entity).
- [ ] Privacy policy, terms of use, **explicit consent screen for biometric photos**, cookie/analytics consent.
- [ ] DPAs with every processor (hosting, image generation, email, analytics).
- [ ] Every public claim checked against `docs/CLAIMS.md`. Rows marked "launch blocker" must be true first (single-reviewer access, women-only review, in-region storage, image-vendor contract).
- [ ] Positioning stays non-medical (no diagnosis, no treatment). Partner clinicians (DHA/MOH) only once contracts exist.
- [ ] Advertising: UAE National Media Council rules for paid/influencer ads; Saudi GCAM for KSA ads. No real before/after without consent, and AI after-images always labelled.
- [ ] Trademark search and filing for the chosen name (UAE Ministry of Economy, Saudi SAIP); register domains and social handles.

## 5. Product gaps (P0 → P1)

- [ ] **P0** Choose the name. Set `VITE_BRAND_NAME` and update `public/manifest.webmanifest` (that's all).
- [ ] **P0** Detailed PDF report: in progress (full analysis, every marker, plan, references).
- [ ] **P1** Arabic for the app itself, the PDF and emails (only the landing page is Arabic today). Move from the text-swap layer to real translation keys; it also removes the brief English flash on `/ar`.
- [ ] **P1** Remaining markers: skin and eye-appearance pixel metrics, ears, 45° view, expression wrinkles (reviewer), right-profile comparison.
- [ ] **P1** Performance: split the app bundle from the landing page (850 KB JS today); face/body models (~54 MB) should load only on the scan page.
- [ ] **P1** Error monitoring (Sentry), uptime alerts, backups.
- [ ] **P1** Accessibility and QA pass (mobile protocol view, alt text, focus states).
- [ ] **P2** Partner network (dermatologists, barbers, coaches, InBody): contracts, booking, consent-based sharing.

## 6. SEO and marketing

Done:
- Titles, descriptions, canonical URLs, Open Graph/Twitter cards, social preview image (`/og.jpg`).
- English `/` and Arabic `/ar` as separate, cross-linked (hreflang) pages.
- Pre-rendered HTML for `/`, `/ar`, `/library` (crawlers and WhatsApp/X/LinkedIn previews see the full page).
- Structured data: Organization, WebSite, Service with AED/SAR prices, FAQPage (rich results).
- App pages are `noindex`; `robots.txt` and `sitemap.xml` generated on build.
- Preview builds are blocked from search.

At launch:
- [ ] Build with `VITE_SITE_URL=https://<domain> VITE_INDEXABLE=1 npm run build:site`.
- [ ] Google Search Console and Bing Webmaster: verify, submit the sitemap.
- [ ] Analytics with consent (Plausible, or GA4 with consent mode). Pixels for **Snapchat** (big in KSA), TikTok, Meta and Google Ads, sent server-side through the conversion APIs.
- [ ] **Waitlist** form before launch (needs the backend: a table + Resend confirmation email).
- [ ] Content for search: one indexable page per feature type (e.g. "hooded eyes", "2C hair", "retruded chin") in English and Arabic. The library already has the copy and research. This is the biggest organic opportunity.
- [ ] Google Business Profile once there's a registered address.
- [ ] Social: an Instagram/TikTok format that breaks down features with drawings and synthetic models (no women's photos, per policy).
