# Service plan — analysis + glow-up as a paid, human-reviewed service (MENA)

Working draft. Brand and name to be decided later. Prices below are estimates to validate, not quotes.

## 1. The product in one line

A user pays once, uploads guided photos (face front + profiles, body front + side) and their height and weight. They receive a science-backed facial and body analysis, a 12-month glow-up plan, and before/after visuals reviewed by a human expert. From the plan they can book vetted partners: non-surgical clinics, InBody scans, dietitian meal services and personal trainers.

## 2. End-to-end flow (human in the loop)

```
Pay ─▶ Intake + guided photos ─▶ On-device analysis ─▶ Encrypted upload
   ─▶ Generation queue (baseline + after, face + body)
   ─▶ REVIEW CONSOLE (you / reviewers)
         • approve  • regenerate with an edited prompt  • tweak plan items / copy
         • flag photo retake (sends the user a guided-retake request)
   ─▶ Publish ─▶ User notified (WhatsApp / email) ─▶ Report unlocks in the app
   ─▶ Partner bookings (requests reviewed by partner) ─▶ Check-ins (upsell)
```

Order status machine: `paid → photos_received → analysing → generating → in_review → (changes_requested ↺) → approved → delivered → archived`.

What the reviewer sees for each order:
- Original photos, standardized baselines and generated "after" images side by side, with an identity-similarity score and a "changes vs. plan" checklist (each visual change must map to a plan item and stay within the 12-month rule).
- The auto-generated plan. Items can be toggled, reordered or rewritten, and edits are logged.
- Capture warnings (close-range selfie, head turn, body photo cut off) with a one-click retake request.
- A target of under 10 minutes per order; turnaround promise of 24–48 h.

## 3. Architecture (what to build next)

| Layer | Recommendation | Why |
|---|---|---|
| Client | This React app (PWA, mobile-first, RTL-ready for Arabic) | Already built; on-device analysis keeps raw biometrics local until upload |
| Backend | Supabase: Auth (phone OTP + Apple/Google), Postgres with row-level security, Storage (private buckets, signed URLs), Edge Functions, cron | Already connected; one vendor for auth, data, files and jobs |
| Image generation | Server-side job worker calling the model provider APIs directly | Keys never touch the client; retries, cost tracking, audit log |
| Review console | Separate admin route group with role-based access (`reviewer`, `admin`, `partner`) | Human-in-the-loop requirement |
| Payments | Tap Payments or Checkout.com (Mada, Apple Pay, STC Pay, cards); Tabby/Tamara BNPL later | Strongest MENA coverage; Stripe is limited in KSA |
| Notifications | WhatsApp Business API + email (Resend is already connected) | WhatsApp is the default channel in MENA |
| Partners | Directory + booking requests first (partner confirms by WhatsApp/portal); calendar sync later | Avoids building scheduling before demand is proven |

Models (tested in this project):
- Face baseline: FLUX 3 is the most identity-faithful.
- Face "after": Nano Banana Pro follows edits best.
- Body images (shirtless): Nano Banana Pro. FLUX blocks shirtless photos as NSFW.
- Use one provider path per image type, so results stay consistent across clients.

## 4. Privacy and compliance (MENA)

Facial and body photos are biometric/sensitive data under every relevant law. Treat them as the highest tier.

| Market | Law | Practical implications |
|---|---|---|
| Saudi Arabia | PDPL (enforced Sept 2024) + SDAIA transfer rules | Explicit consent for sensitive data; restrictions on transfer outside KSA; register/appoint DPO when required |
| UAE | Federal Decree-Law 45/2021 (PDPL); DIFC/ADGM have their own regimes | Explicit consent, purpose limitation, data subject rights |
| Egypt | Law 151/2020 | Licensing for processing sensitive data; cross-border transfer conditions |
| Qatar / Bahrain / Kuwait / Oman | National PDP laws | Similar consent and transfer rules |

Design commitments (also a selling point — say them on the landing page):
1. **Separate, explicit consents:** analysis, AI image generation by a named processor, human review, partner sharing (per partner, per booking), and an optional, off-by-default "use my images to improve the service".
2. **Data residency:** host the database and storage in-region where required (e.g. a GCC cloud region). Pick image-generation providers whose processing region and DPA you can document. Higgsfield is fine for prototyping; production needs a provider with a signed DPA and a known region.
3. **Minimisation:** analysis runs on-device. Upload only what review and generation need. Strip EXIF/location metadata. Body photos are optional, with a face-only package.
4. **Retention:** delete raw photos 30–90 days after delivery by default. Keep the report and generated images until the user deletes their account. Users can delete everything with one tap.
5. **Security:** private buckets, short-lived signed URLs, encryption at rest, audit log of every reviewer access, 2FA for staff.
6. **Cultural options:** same-gender reviewers on request; women can choose face-only or a covered-body flow; no images ever used in marketing without separate written consent.
7. **No medical claims:** position the product as aesthetic/wellness guidance. Clinical items say "consult a licensed practitioner". Partner clinics hold their own licences and do their own consultation.

Get a MENA privacy lawyer to confirm this before launch, especially:
- KSA cross-border transfer;
- Egypt licensing;
- whether referral fees from medical clinics are allowed in each market. Some regulators restrict commissions on medical referrals, so prefer flat listing fees or marketing partnerships where needed.

## 5. Unit economics (estimates — validate with real usage)

Per order (face + body package):

| Item | Assumption | Est. cost (USD) |
|---|---|---|
| Image generation | ~10 final images (face baseline, face after ×3 views, body baseline ×2, body after ×2, 2 style previews) + ~40% retries/edits ≈ 14 generations | ~$1–3 at direct API pricing for high-res image models (more via aggregator credits) |
| Storage | ~20–40 MB per order, raw photos deleted after 90 days | < $0.01/month |
| Backend | Supabase Pro + compute, shared across orders | ~$25–100/month fixed |
| Payment fees | MENA gateways ≈ 2.5–3% + fixed fee | ~$1–2 |
| Human review | ~10 min at a reviewer's hourly rate | Largest variable cost — $3–8 |
| **Total variable** |  | **≈ $6–15 per order** |

Example price ladder (to test; local currency):
- **Face analysis + plan:** 149–199 SAR/AED.
- **Face + body + visuals:** 299–399.
- **Premium:** adds a 20-minute video consult and a 3-month check-in: 599–799.
- **Check-in rescan:** 79–99. This is the retention loop: the same photo setup, a progress chart, and an updated plan.

Partner revenue, where legally allowed:
- per-booking referral fee or revenue share (clinics, InBody, PTs);
- subscription commission on meal plans;
- paid featured listings.

## 6. Partners — how the plan connects to bookings

| Plan item | Partner type | What gets shared (with consent) |
|---|---|---|
| Body fat / composition | InBody scan centres | Name, contact. The InBody result can be uploaded back and replaces the photo-based body-fat estimate, which is a real accuracy upgrade |
| Calorie / protein targets | Dietitian meal services | Calorie and protein targets, allergies, preferences. Not photos |
| Training split | Personal trainers / gyms | The training split and priorities (V-taper, posture). Not photos |
| Skin items needing prescription; clinical options (botulinum toxin, fillers) | Licensed dermatology / aesthetic clinics | The relevant section only, when the user chooses to share it. The clinic does its own consultation |

The plan engine already tags items by category and evidence grade. Each item gets a "Book with a partner" action filtered by city. Bookings start as requests that the partner confirms.

## 7. Decisions needed from you

1. Launch market(s) first: KSA, UAE or Egypt. This drives hosting region, payment gateway and legal review.
2. Packages and prices. Face-only and face + body, or a single package?
3. Reviewer model: you alone at first, or trained reviewers (including women reviewers for female clients)?
4. Image provider for production: direct Google (Nano Banana Pro) plus FLUX via BFL/Replicate, or keep an aggregator.
5. Raw-photo retention period: 30, 60 or 90 days.
6. Partner monetisation per vertical, after legal advice.
7. Arabic-first or English-first UI at launch. The layout is already RTL-ready.
