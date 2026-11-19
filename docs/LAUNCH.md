# Launch plan: Kuwait, 20 KWD

Updated 19 Nov 2026. One market (Kuwait), one product (the Glow-Up Report, 20 KWD,
one payment), English and Arabic. Legal points below are a checklist to take to a
Kuwaiti lawyer and accountant, not legal advice.

## Where things stand

| Part | State |
|---|---|
| Landing page (EN `/`, AR `/ar`) | Ready: 20 KWD pricing, privacy and women's service, SEO, pre-rendered. |
| Analysis engine | Works **in the browser on the customer's phone**: face, side profile, smile and body measurements (80 of 236 markers on the sample), skin by region, the 12-month plan, nutrition, training. **Accuracy not yet validated on real people.** |
| Report | 90-page PDF generated in the browser. English only. |
| Review console | Works only in the founder's own browser. |
| After images | Made by hand (the console writes the prompt). |
| Accounts, database, payments, emails | **Not built.** Today nothing leaves the customer's phone, so nobody can pay and nobody can review a real customer. |

So the engine works, but the business doesn't exist yet: there's no way to take
money, receive a customer's photos, review them and deliver the report. That's
what the steps below build.

## How a paid order will work

1. The customer taps "Start my scan" and pays **20 KWD** (KNET, card or Apple Pay) on the gateway's hosted page.
2. The gateway confirms payment to our server (a webhook), which creates an **order** and an **account** (phone number + one-time code).
3. The customer agrees to the photo consent, takes the photos with the guided camera, and the analysis runs on their phone.
4. Photos and measurements upload, encrypted, to private storage. The order goes to **"In review"** and is assigned to a reviewer: a **female reviewer for women**, enforced by the database.
5. The reviewer checks the landmarks and plan, generates the 12-month visuals through the image API, checks them for realism, writes their notes, and approves.
6. The customer gets a WhatsApp message and an email: "Your report is ready". They open the report in the app and download the PDF.
7. 90 days after delivery the photos are deleted automatically. The customer can delete everything sooner from Settings.

Target turnaround: **within 72 hours**, stated on the site once the team can hold it.

## Steps, in order

Start steps 1 and 2 today: they depend on government and bank approvals and take the longest.

### 1. Company and bank (week 1–4, start now)
- [ ] Kuwaiti commercial licence through the Ministry of Commerce and Industry (Kuwait Business Center), with an activity that covers online wellness and consultancy services. If the founder isn't Kuwaiti, decide between a Kuwaiti partner structure and 100% foreign ownership through KDIPA. **Get a Kuwaiti lawyer for this.**
- [ ] A Kuwaiti business bank account (needed for KNET settlement).
- [ ] Register the trade name and check the trademark (Ministry of Commerce trademark office) once the name is chosen.
- [ ] Domain (.com plus .com.kw if available), Instagram/TikTok/Snapchat/X handles.

### 2. Payments (week 1–4, in parallel)
- [ ] Choose a Kuwaiti gateway with **KNET** (most Kuwaitis pay with KNET debit) plus Visa/Mastercard and Apple Pay: **MyFatoorah**, **Tap Payments**, **UPayments** or **Hesabe**. Stripe has no KNET.
- [ ] Apply with the commercial licence and bank account. Approval usually takes 1–3 weeks.
- [ ] Price: 20.000 KWD. Kuwait has no VAT today; confirm with the accountant before launch and add it later if it comes in.
- [ ] Refund and cancellation policy (for example: full refund before the photos are submitted; none after the report is delivered unless it fails our quality check).

### 3. Backend (week 2–5)
Supabase is already connected to this workspace (database, sign-in and file storage), with the app on Vercel.
- [ ] Sign-in with phone number and one-time code (SMS through a Kuwait-capable provider such as Twilio or Unifonic; WhatsApp as an option).
- [ ] Tables: customers, orders (paid → photos → in review → delivered), scans, reviews, reviewers (with gender), consents, audit log.
- [ ] Row-level security: a customer sees only their own data; a reviewer sees only orders assigned to them; **women's orders can only be assigned to female reviewers.**
- [ ] Private storage bucket for photos, short-lived links, and a daily job that deletes photos 90 days after delivery.
- [ ] Payment webhook: the gateway confirms payment, the server creates the order, then the scan unlocks. Never trust the browser for payment status.
- [ ] Move the review console onto the server (a queue, assignment, approve/return), so reviewers can work from any device.
- [ ] After-image generation through an image API, under a contract that forbids keeping or training on the photos. The prompts and realism checks already exist.
- [ ] Notifications: WhatsApp Business (via the Meta API or a provider) and email (Resend is connected) for "payment received", "in review" and "report ready".
- [ ] Settings: download my data, delete my account.

### 4. Data protection (week 2–5)
- [ ] Assess the **CITRA Data Privacy Protection Regulation** (Kuwait's Communication and Information Technology Regulatory Authority) with the lawyer: consent wording, storing data outside Kuwait (Supabase and Vercel are in Europe and the US), breach notification, and a named contact.
- [ ] Privacy policy and terms (English and Arabic), and an **explicit consent screen for face and body photos** before upload.
- [ ] Data-processing agreements with Supabase, Vercel, the image API, the SMS/WhatsApp provider and Resend.
- [ ] 18+ only (age confirmation at sign-up).

### 5. Reviewers (week 3–6)
- [ ] At least **one male and one female reviewer** before launch: the site promises women are reviewed only by women.
- [ ] Reviewer contract with confidentiality, a training session on the console, and a written review checklist (it already exists in the console).
- [ ] Decide how reviewers are credited on reports (name only, unless they hold a licence they agree to show).

### 6. Make sure the results hold up (week 3–6)
- [ ] **Calibration study:** 30–50 consenting people (both sexes, a range of skin tones, with and without beards and hijab), measured with calipers or by a clinician, compared with the app. Fix whatever is off, and only claim the accuracy you measured.
- [ ] Test real phone photos (bad light, mirrors, glasses, hijab, beards) and tighten the photo guide and error messages.
- [ ] **Paid beta:** 20–30 real customers at 20 KWD (friends and network), full flow end to end, with turnaround and feedback tracked.

### 7. Product finishing (week 4–7)
- [ ] Choose the name and set it (one setting plus the app manifest).
- [ ] Arabic inside the app and the PDF (only the landing page is Arabic today).
- [ ] The issues from the launch audit (below).
- [ ] Speed: load the 54 MB of face/body models only on the scan page, and split the app code from the landing page.
- [ ] Error monitoring (Sentry), uptime alerts, backups.

### 8. Marketing (week 5 → launch)
- [ ] Final domain, then build with `VITE_SITE_URL=https://<domain> VITE_INDEXABLE=1 npm run build:site`, and submit to Google Search Console.
- [ ] Analytics with consent, plus the **Snapchat, Instagram and TikTok** pixels (Snapchat and Instagram are the big ones in Kuwait).
- [ ] Waitlist form now, so there is a list on launch day.
- [ ] Influencers need the Ministry of Information's advertising licence, and every paid post must say it's an ad. Health-related ad claims may need Ministry of Health approval; keep to the wording in `docs/CLAIMS.md`.
- [ ] Launch content: feature breakdowns with drawings and the synthetic sample (no photos of women), Kuwaiti Arabic first.
- [ ] Support: a WhatsApp Business number on the site.

### 9. Launch checklist (the day before)
- [ ] A real 20 KWD KNET payment, then a refund, both work.
- [ ] A full order (man and woman) goes from payment to delivered report within the promised time.
- [ ] Deletion works (account delete and the 90-day job, run manually once).
- [ ] Every claim on the site is true today (`docs/CLAIMS.md`, rows marked launch blocker).
- [ ] Privacy policy, terms and refund policy are live and linked in the footer.

## Launch audit findings

See the section added below by the audit.
