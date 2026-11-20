# Service-provider contracts and the reviewer agreement

Draft, 2026-11-20, from the verified vendor and data-protection research. Not
legal advice. **[confirm with counsel]** marks open points.

**How reliable this is.** Repo facts (what the code sends where) were checked
in the code. No vendor web page could be re-opened in the verification
session (supabase.com, stripe.com, resend.com, vercel.com, fal.ai, openai.com
were not reachable). Before signing, open each link once and write down the
DPA version date, how it is executed and the transfer mechanism. Check DPF
status at https://www.dataprivacyframework.gov/list.

**Rule for every US provider:** the DPA must contain the EU standard
contractual clauses (Decision (EU) 2021/914) as well as the Data Privacy
Framework, because the *Latombe* appeal (C-703/25 P) is still pending.

**Rule for every tool:** no customer photo goes into any tool without a signed
DPA. That includes manual uploads by staff (for example to Higgsfield or any
other image generator).

## 1. Provider table

| # | Provider (role) | DPA link | How to sign | Transfer mechanism | Settings to change | Status |
|---|---|---|---|---|---|---|
| 1 | **Supabase** (processor: database, auth, photo storage, Edge Functions) | https://supabase.com/legal/dpa · sub-processors: https://supabase.com/legal/subprocessor-list | Request in the dashboard (Org settings → Legal documents), sign via PandaDoc (consistent with past practice; confirm) | SCCs in the DPA; TIA published. Assume no DPF | Pin every function call to eu-central-1 (`functions.invoke(name, { body, region: FunctionRegion.EuCentral1 })`, also the Stripe webhook) and check the `x-sb-edge-region` header; use Resend as Auth SMTP (replace default SMTP); record the backup/PITR window and put it in privacy `[BACKUP WINDOW]`; subscribe to sub-processor notices; file the TIA | to do |
| 2 | **Stripe Payments Europe** (processor for payments; independent controller for fraud, AML and its legal duties) | https://stripe.com/legal/dpa · DTA https://stripe.com/legal/dta · https://stripe.com/legal/service-providers | Part of the Services Agreement automatically; download and file the PDFs with their dates | DPF first, then SCCs (per the DTA) | Keep checkout metadata to IDs only (it is today); confirm settlement of KWD, SAR, AED, QAR, BHD, OMR and USD for the NL account; test charges in all seven currencies; three-decimal currencies must end in 0 (current prices do) | to do |
| 3 | **Resend** (Plus Five Five, Inc., US; transactional email) | https://resend.com/legal/dpa | Pre-signed PDF; countersign and file | DPF-certified (changelog 13 Mar 2025) plus SCCs | Create the sending domain in the EU region if available; turn off open and click tracking; set as Supabase Auth SMTP; note log retention (reported 30 days) | to do |
| 4 | **Vercel Inc.** (static hosting, CDN, request logs) | https://vercel.com/legal/dpa | Incorporated in the terms for paid plans (unconfirmed); move to a **Pro** team (Hobby is non-commercial) and file the DPA | SCCs in the DPA; DPF claimed (unconfirmed) | Keep Web Analytics and Speed Insights off; note log retention for the plan | to do |
| 5 | **Image provider, option A: fal.ai** (Features & Labels, Inc., US) | https://fal.ai/legal/data-processing-addendum | Execution route unconfirmed; ask fal in writing | Unconfirmed; ask for SCCs | Add `X-Fal-Store-IO: 0` and `X-Fal-Object-Lifecycle-Preference` (short expiry) to `falEdit()` in `supabase/functions/_shared/images.ts` and test them in the fal dashboard history. Ask in writing: sub-processors (the `nano-banana` model is Google's, so treat Google as a sub-processor), no-training, retention. **No written answers → use option B or C** | to do |
| 6 | **Image provider, option B: OpenAI** (OpenAI Ireland Ltd for EEA customers) | https://openai.com/policies/data-processing-addendum | Execute online for the organisation | SCCs; DPF unconfirmed | Apply for zero data retention and keep the approval (default is 30-day abuse-monitoring retention); ask whether `/v1/images/edits` is covered by ZDR and EU data residency; keep `OPENAI_IMAGE_MODEL` on a gpt-image model | to do |
| 7 | **Image provider, option C: Google Vertex AI direct** | Google Cloud Data Processing Addendum | Accept in the Cloud console | SCCs in the addendum | Check whether the model is available in an EU region (unconfirmed) | optional |
| 8 | **Meta** (ads) | Not needed: no Pixel or CAPI on the site; only aggregate Marketing API figures are read | — | — | No Pixel or CAPI at launch. Adding one later needs a consent banner (Telecommunicatiewet art. 11.7a), joint-controller terms (*Fashion ID*, C-40/17) and no photo-flow, appearance or health events **[confirm with counsel]** | n/a |
| 9 | **Google Fonts** | None (Google acts as controller; IP goes to the US) | — | — | **Self-host** Inter, IBM Plex Sans Arabic, JetBrains Mono, Mrs Saint Delafield; check each licence file (believed SIL OFL); remove the `preconnect` and stylesheet links in `app/index.html`; then delete the `[FONTS: …]` note in privacy section 13 | to do |
| 10 | **MediaPipe** (on-device) | Not needed | — | — | Remove the jsDelivr / storage.googleapis.com `REMOTE` fallback in `app/src/lib/vision.ts`, or make the build fail if `/wasm` or `/models` are missing | to do |
| 11 | **Supabase default SMTP** | Covered by the Supabase DPA | — | — | Replace with Resend before launch | to do |
| 12 | **Higgsfield** (planned third image provider / manual use) | None | — | — | Do not use with customer photos until a DPA, transfer terms and no-training terms are in place | blocked |
| 13 | **Human reviewers** (contractors) | Own agreement, section 2 | Sign before any access | Outside the EEA: SCCs Module 2 + TIA, plus any GCC clauses counsel requires (e.g. SDAIA model clauses for Saudi Arabia) | Least-privilege access, per-view logging if promised, revoke on exit | to do |

**Record for the B.V.'s own 72-hour breach duty (GDPR art. 33; SDAIA also 72 h):**
note each processor's breach-notice deadline from its DPA in the vendor folder.

**Privacy-policy dependencies:** the processor table in privacy section 7 lists
Supabase (EU), Vercel (US company, global network), the image provider (US)
and Resend (US), with Stripe as a separate controller. If any choice above
changes (for example Resend's EU region, or Google instead of fal), update
that table, the photo-consent "Where" row in `ConsentGate.tsx`, and bump
`CONSENT_VERSION`.

## 2. Reviewer contractor agreement: outline

For counsel to draft. Arabic and English versions for Gulf-based reviewers,
with a clause saying which language prevails.

1. **Parties and status.** The B.V. and an independent contractor. No
   employment: own hours, free to work for others, invoices per review.
   **[confirm with counsel: Wet DBA enforcement since 1 Jan 2025]**
2. **Services.** Review photos and measurements under the Waddah review
   protocol, check quality, select and approve AI illustrations, write notes.
   No medical diagnosis; escalate anything that looks medical.
3. **Fees.** Per-report rate, payment terms, currency; contractor pays own tax
   and social contributions; VAT / reverse-charge note.
4. **Eligibility.** 18+, identity verified, background check where lawful,
   signed code of conduct.
5. **Confidentiality.** All customer and business information; survives
   termination; no time limit for personal data. Never discuss or recognise a
   customer, on any channel.
6. **Data processing (GDPR art. 28(3)).**
   - act only on documented instructions;
   - confidentiality;
   - security (art. 32): review console only; MFA; encrypted, updated device
     with screen lock; not in public places; no shared accounts;
   - **no copies**: no screenshots, downloads, printing, phone photos or local
     copies; no AI tools, translators or any other upload of customer photos to
     third-party tools (including image generators such as Higgsfield);
   - no sub-processors;
   - forward data-subject requests within 24 h;
   - report incidents within 24 h;
   - **deletion**: return or delete everything at the end and certify it in writing;
   - audits and access-log review.
7. **Device rules (annex B).** Company-approved browser only; full-disk
   encryption; OS and browser updates within 14 days; automatic screen lock;
   no browser extensions with page access while reviewing; no screen-sharing
   or recording software running; private network only.
8. **International transfer.** SCCs Module 2 if the contractor is outside the
   EEA, plus a TIA and a duty to report government access requests. If in the
   GCC, add the local clauses counsel identifies. **[confirm with counsel; also
   permanent-establishment risk from a GCC-based reviewer]**
9. **Access control.** Least privilege, every view logged (build before
   promising it), access can be suspended at any time.
10. **Content standards.** Respectful, non-shaming, non-surgical scope, no
    promised results, no comments on religion, ethnicity or sexuality.
11. **IP.** Notes and report text assigned to the B.V.; moral-rights waiver
    where allowed.
12. **No direct contact** with customers.
13. **Liability** for breaches of clauses 5–8; optional insurance.
14. **Termination.** Immediate on a data-protection breach. Clauses 5, 6
    (deletion), 8 and 11 survive.
15. **Law and forum.** Dutch law; Dutch court or NAI arbitration. **[confirm with counsel]**
16. **Annexes.** A protocol; B security and device checklist; C SCCs; D code of
    conduct; E data categories and retention (photos deleted 90 days after
    delivery; no payment data).

**Women's service (later).** When the women's service opens, only female
reviewers may see women's photos. In the Netherlands sex-based selection is
governed mainly by the WGB m/v (and art. 7:646 BW for employees), which allow
it only where sex is a genuine, decisive occupational requirement; customer
privacy for intimate photos is the likely argument. **[confirm with counsel;
also local law where the reviewer lives]** Add the rule to clause 4 and to
access control (women's orders visible only to reviewers flagged female) before
that service opens.

## 3. Pre-launch order

1. Counsel first on classification and the GCC direct-application questions (see LEGAL_MEMO.md).
2. Supabase: sign the DPA, pin functions to eu-central-1, Resend SMTP.
3. Vercel: Pro team, file the DPA.
4. Image provider: fal only with written answers and both headers; otherwise OpenAI with ZDR, or Google direct.
5. Resend: countersign, EU region, tracking off.
6. Stripe: file DPA and DTA; seven-currency test.
7. Self-host fonts, remove the MediaPipe fallback, check the network tab before consent.
8. Reviewer agreements and register.
9. Records: Art. 30 register; vendor folder with DPAs, sub-processor lists, TIAs and breach deadlines.
10. Meta: no Pixel or CAPI at launch.
