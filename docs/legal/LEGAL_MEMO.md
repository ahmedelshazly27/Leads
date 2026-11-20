# Waddah (وضّاح): legal launch memo for counsel

Draft, 2026-11-20. This memo prepares a review by qualified lawyers and a tax
adviser. It is not legal advice. It uses only the verified research in the
session scratchpad (`legal/*.verified.md`: market-entry-tax, data-protection,
consumer-terms, advertising, vendors, trademark). **[confirm with counsel]**
marks every point the research could not confirm from a primary source. No
statute was read in full: most findings rest on law-firm, Big-4 and press
summaries, dated in the research files.

Companion documents:
- [VENDOR_CONTRACTS.md](VENDOR_CONTRACTS.md): processor contracts and the reviewer agreement
- [AD_RULES.md](AD_RULES.md): advertising checklist and permits
- [TRADEMARK.md](TRADEMARK.md): name clearance and filing plan
- Customer texts: `app/src/pages/legal/content.ts` (privacy, terms, refunds, EN + AR)
  and `app/src/components/ConsentGate.tsx` (age, terms, photo consent, waiver)

## Executive summary

1. A Dutch B.V. with EU hosting can most likely sell this service online into all six GCC states without a local company. Local consumer, data and ad rules still apply to it.
2. What can block a country is registration, not hosting: VAT registration (KSA, UAE, Bahrain, Oman) before the first sale, a possible Kuwait digital-commerce registration, and data permits in Oman and possibly Qatar.
3. Kuwait: no VAT, low data friction, but Decree-Law 10/2026 may already be in force and may require Ministry of Commerce registration. Open only after a Kuwaiti firm answers that.
4. UAE: register for VAT (5%) before the first sale. Data rules are light today. Whether the B.V.'s own Meta ads need an NMA permit is the top advertising question.
5. Saudi Arabia: register for VAT (15%) before the first sale, with a tax representative or a guarantee. The PDPL applies; no representative is needed. Watch the October 2026 draft that would make in-Kingdom storage the default.
6. Bahrain: VAT (10%) needs a Bahrain-resident, NBR-approved representative first. Geo-block checkout until registered.
7. Oman: VAT (5%) needs a responsible person or a guarantee, and since 7 Sept 2026 the data law likely needs a Ministry permit for facial images and health data. Hold Omani orders.
8. Qatar: no VAT, but its data law may need prior permission for "physical condition" data. Get a scope opinion before taking orders.
9. Other MENA (Egypt, Jordan, Morocco, Iraq, Lebanon, Tunisia): not at launch. Egypt's data law is now enforceable with licences; Iraq, Lebanon and Tunisia are unresearched.
10. Before any country opens: DPIA, signed DPAs, self-hosted fonts, an image provider with written no-training/no-storage terms, the AI-illustration label (EU AI Act art. 50(4), applies now), and a Benelux trademark filing before ad spend.

## The owner's question: can I sell in the UAE and Saudi Arabia while the business and hosting are in the Netherlands?

Probably yes. No source in the research requires a local company for
cross-border online sales of this kind to consumers. Three things come with it:

- **VAT registration before the first sale.** Non-resident sellers of digital
  services have no threshold: UAE 5% (EmaraTax), Saudi Arabia 15% (ZATCA,
  with a tax representative or a bank guarantee). Prices must be shown VAT-inclusive.
- **Local rules still apply because we target those customers.** Saudi
  Arabia's E-Commerce Law expressly covers sellers outside the Kingdom
  (disclosures, a 7-day cancellation right, ad rules). The Saudi PDPL applies
  to our processing of residents' data. The UAE data law likely does too.
- **Open licensing question.** Whether either country also expects a foreign
  online seller to hold a local licence or registration (Saudi Ministry of
  Commerce / Maroof; UAE Decree-Law 14/2023) is unconfirmed. **[confirm with counsel]**

EU hosting is not a problem in itself under current law. The one thing to
watch is Saudi Arabia's October 2026 draft PDPL amendments, which would make
in-Kingdom storage the default (draft art. 23(2)); they were not adopted as of
20 Nov 2026.

## 1. Per-country launch readiness

Legend: **Open** = can open once the listed steps are done. **Hold** = do not
take orders until counsel clears the listed point. VAT rates are included in
the shown prices.

| | Kuwait | Saudi Arabia | UAE | Qatar | Bahrain | Oman |
|---|---|---|---|---|---|---|
| **Local licence / registration** | Decree-Law 10/2026 (digital commerce, gazetted 1 Mar 2026): MOCI registration before digital commerce, including online ads. In force either ~1 Sep 2026 or one month after Executive Regulations (due ~1 Mar 2027; none found). Reach to foreign sellers unknown **[confirm with counsel]** | E-Commerce Law applies to sellers outside KSA. No licence route for foreign remote sellers found. MoC / Maroof registration? **[confirm with counsel]** | Decree-Law 14/2023 in force; penalties in Cabinet Res. 200/2025. Reach to foreign sellers unknown **[confirm with counsel]** | Decision 25/2026 (in force 16 Mar 2026) appears aimed at locally registered businesses **[confirm with counsel]** | None identified (unconfirmed) | None identified (unconfirmed). Decision 499/2023 reach to foreign sellers **[confirm with counsel]** |
| **VAT** | None | 15%, no threshold, register before first sale. Representative optional since 2019 **or** a guarantee; ZATCA page reportedly still says one is required **[confirm with counsel]** | 5%, no threshold, register before first sale. Late registration AED 10,000; non-inclusive display AED 5,000 | None (e-invoicing draft only) | 10%, no threshold. **Resident NBR-approved representative required**, jointly liable | 5%, no threshold. Oman-resident responsible person, OTA-approved representative, or direct registration with a bank guarantee |
| **Data protection** | CITRA DPPR limited to CITRA licensees; no general law. Low | PDPL applies. No representative (removed 2023). Offshore registration rules promised, not issued. Breach notice to SDAIA in 72 h. Transfers: contract necessity or SDAIA SCCs. Oct 2026 draft: in-Kingdom storage default, registration on transfer (not adopted) | PDPL 45/2021 likely applies; no executive regulations; explicit consent incl. transfer; DPIA | Law 13/2016 scope **unclear**. If it applies: prior permission for special-nature (physical condition) data | "Means in Bahrain" test: probably not us. NL and DE on the adequacy list | **Applies since 7 Sept 2026** (RD 68/2026). Facial images are named as biometric data. **MTCIT permit likely needed** (decision within 45 days). Transfers: explicit consent |
| **Consumer law** | DL 10/2026 reportedly gives 14 days' cooling-off (article and scope unconfirmed). Age of majority may be 21 **[confirm with counsel]** | 7-day cancellation (E-Commerce Law art. 13) while the service is not used/benefited from; 15-day late-delivery cancellation. New Consumer Protection Law approved 10 Nov 2026, in force 180 days after gazette (~May–Jun 2027, unconfirmed); terms must be redone then | No general change-of-mind right for services found. Arabic invoices required (AED 100,000 fine reported). Age of majority now 18 | No cooling-off for services confirmed. Avoid "no return" wording | No cooling-off; 15 days covers defective goods only. "No return" wording **prohibited** | Return right (art. 16) for goods; services unconfirmed **[confirm with counsel]** |
| **Ads** | Brand ads: possible MOCI registration (DL 10/2026). Media law DL 102/2026 content rules bind commercial accounts from ~Apr 2027. Keep influencer records 5 years | No licence found for brand ads. Creators: Mawthooq (GAMR); non-Saudi creators via a MISA-licensed agency | **Open question #1:** NMA Advertiser Permit "own business" exemption reportedly needs a UAE trade licence; we have none. Creators: NMA permit | Not confirmed; no creators yet | Not confirmed; no creators yet | Creators: MOCIIP licence (unconfirmed) |
| **Verdict** | **Open first, after** a Kuwaiti firm confirms DL 10/2026 status and any foreign-seller registration | **Open after** ZATCA registration (representative or guarantee decided) | **Open after** EmaraTax registration and bilingual invoices; ads after counsel answers the NMA question | **Hold** until a data-scope opinion; permit first if in scope | **Hold** checkout until NBR representative appointed and VAT registered | **Hold** orders until the permit position is cleared (allow ≥ 45 days) and VAT route chosen |

### Other MENA countries

| Country | Position | Advice |
|---|---|---|
| Egypt | Data law enforceable since ~1 Nov 2026; reaches foreign sellers; licences incl. for transfers abroad. VAT 14% (10% for professional services, registration from the first sale for consultancy) | Not at launch |
| Jordan | Data law in force 2024 (regulations unconfirmed). GST 16%, threshold disputed | Phase 2, after a counsel check |
| Morocco | CNDP authorisation for sensitive data and transfers (not re-verified). Digital-services VAT 20% live since 11 Jun 2026 | Phase 2+ |
| Iraq, Lebanon, Tunisia | Not researched | Only after sanctions/AML review and country research |
| Sanctioned (Iran, Syria, etc.) | Excluded | Geo-block and billing-country block |

USD prices (fallback) are shown for information only; the terms say so.

## 2. Recommended launch sequence

The tax and data-protection tracks proposed different first waves. Combined:

1. **Weeks 0–2 (all countries):** GDPR basics (section 3, items 1–8), VAT
   classification opinion, SBI code check with KvK, Stripe test charges in all
   seven currencies, counsel instructed on the open questions below, Benelux
   trademark filing.
2. **Wave 1: Kuwait and the UAE.** Kuwait after the Kuwaiti firm's answer on
   DL 10/2026. UAE after EmaraTax registration and bilingual tax invoices
   (UAE ads wait for the NMA answer; the site can open before).
3. **Wave 1b: Saudi Arabia** after ZATCA registration. Expect lower card
   conversion without mada (Stripe does not route it; it needs a merchant ID from
   a Saudi acquirer, and local providers generally need a local entity or
   acquirer, unconfirmed for foreign merchants; KNET in Kuwait is the same).
   Plan to redo the terms when the new Consumer Protection Law takes effect.
4. **Wave 2: Qatar** (after the data-scope opinion, permit if needed) and
   **Bahrain** (after the NBR representative and VAT registration).
5. **Wave 3: Oman** after the MTCIT permit position is cleared and the VAT
   route (responsible person or guarantee) is chosen.
6. **Phase 4: Egypt, Jordan, Morocco**, one at a time, each with its own
   review. Iraq, Lebanon, Tunisia only after sanctions/AML review.

**Engineering consequence:** `app/src/lib/prices.json` (and the server copy in
`supabase/functions/_shared/prices.json`) currently lists all six countries in
`selling`. Until each country is cleared, remove it from `selling` so visitors
there see the waitlist instead of checkout. The legal texts already cover all
six and say checkout may open at different times.

## 3. Owner action list

Costs are listed only where the research confirmed them.

| # | Action | Deadline | Notes |
|---|---|---|---|
| 1 | Instruct counsel: Kuwaiti firm (DL 10/2026), Saudi/UAE firm (licensing, NMA permit, e-commerce), Omani firm (permit), Qatari opinion (scope), Dutch lawyer (terms, BW 7:408, DPIA review) | Week 0 | Questions in section 4 |
| 2 | Tax adviser: written classification opinion (EU art. 58/59(c); GCC equivalents; Egypt) | Week 2 | Decides Dutch VAT and Egypt later |
| 3 | DPIA, Art. 30 records, breach procedure (72 h to the AP; 72 h to SDAIA) | Before any country opens | Do the DPIA regardless of classification |
| 4 | Sign DPAs and change vendor settings | Before any country opens | [VENDOR_CONTRACTS.md](VENDOR_CONTRACTS.md) |
| 5 | Choose the image provider; get no-training and no-storage terms in writing; fal: send `X-Fal-Store-IO: 0` and a short media lifecycle | Before any country opens | Until then the privacy policy's training promise stays marked |
| 6 | Self-host the four fonts; remove the MediaPipe CDN fallback; check the network tab for third-party requests before consent | Before any country opens | LG München I, 3 O 17493/20 |
| 7 | Pin Supabase Edge Functions to eu-central-1 | Before any country opens | The privacy policy says data is processed in the EU |
| 8 | Reviewer contractor agreements signed before access | Before the first review | Outline in VENDOR_CONTRACTS.md |
| 9 | Build: withdraw/cancel-purchase button (Account + footer), waiver confirmation email, order-confirmation email (terms section 7), reminder 3–7 days before the first paid membership renewal; set Stripe to cancel a subscription after the final failed retry (terms section 8) | Before any country opens | EU withdrawal button applies since 19 Jun 2026; texts carry `[BUILD: …]` notes until done |
| 10 | Build: Arabic/English tax invoice with the VAT number per country | Before KSA, UAE, Bahrain, Oman open | Stripe receipts are English-only |
| 11 | UAE: EmaraTax VAT registration | Before the first UAE sale | Late registration AED 10,000 |
| 12 | KSA: ZATCA registration; decide representative or guarantee | Before the first Saudi sale | Budget the guarantee |
| 13 | Bahrain: appoint NBR-approved resident representative, then register | Before Bahrain checkout opens | Representative is jointly liable; expect fees |
| 14 | Oman: choose responsible person / representative / guarantee; apply for the MTCIT permit if counsel confirms it is needed | Before Oman opens; permit decision takes up to 45 days | |
| 15 | Kuwait: register with MOCI if counsel says so | Before Kuwait opens | Executive Regulations due ~1 Mar 2027 |
| 16 | Limit `selling` in prices.json to cleared countries | Now | Section 2 |
| 17 | Bump `CONSENT_VERSION` in `app/src/lib/backend/consents.ts` to `2026-11-20.1` | With this change | `CONSENT_VERSION_BUMP` in content.ts |
| 18 | Fill placeholders: `[COMPANY NAME B.V.]`, `[KVK NUMBER]`, `[ADDRESS]`, `[CONTACT EMAIL]`, `[IMAGE PROVIDER]`, `[BACKUP WINDOW]`, `[VAT NUMBERS: …]` (only once issued), `[LOCAL REGISTRATIONS: …]` (only once obtained), `[REVIEWERS: …]`, `[IMAGE PROVIDER RETENTION: …]`, `[IMAGE PROVIDER SUB-PROCESSORS: …]`, `[LOG RETENTION: …]`, `[SMTP: …]`, `[FUNCTIONS REGION: …]` | Before launch | Never invent a number |
| 19 | Trademark clearance search and Benelux filing; Madrid within 6 months; Kuwait national filing | Before public launch and ad spend | [TRADEMARK.md](TRADEMARK.md); BOIP €244 first class |
| 20 | Ads: run the pre-flight checklist on every ad; no creators until permits are checked | Every ad | [AD_RULES.md](AD_RULES.md) |
| 21 | Watch list: Kuwait DL 10/2026 regulations (~Mar 2027), Kuwait media law (~Apr 2027), Saudi Consumer Protection Law (~May–Jun 2027), Saudi PDPL draft, *Latombe* appeal C-703/25 P, Qatar VAT | Monthly | |

## 4. Open questions for counsel (priority order)

**Market entry and licensing**
1. Kuwait DL 10/2026: is it in force (6 months after publication vs 1 month after Executive Regulations)? Must a foreign online seller register with MOCI before selling or advertising? Does the CBK-licensed payment rule reach Stripe Payments Europe? Does the 14-day cooling-off cover a human-reviewed report?
2. UAE: does the NMA Advertiser Permit (or any NMA licence) apply to a foreign company without a UAE trade licence running paid Meta ads from its brand page? Does Decree-Law 14/2023 / Cabinet Res. 200/2025 bind a foreign remote seller?
3. Saudi Arabia: must a foreign B.V. register with the Ministry of Commerce or Maroof? Language of disclosures under the E-Commerce Law. Gazette date and services/digital rules of the new Consumer Protection Law.
4. Qatar Decision 25/2026 and Oman Decision 499/2023: do they reach foreign sellers with no local presence?
5. Is a men-only service lawful in each state?

**Tax**
6. Classification as an electronically supplied service (EU Reg. 282/2011 art. 7; Directive arts. 58 and 59(c); GCC equivalents; Egypt's professional-services category).
7. KSA: representative vs guarantee (amount); registration timing (30-day rule unconfirmed); FATOORA scope for non-residents; IR article for VAT-inclusive display.
8. UAE: the Executive Regulation article for VAT-inclusive display (art. 27 per Mondaq).
9. Bahrain and Oman: representative cost, liability and lead time; guarantee option; whether VAT-inclusive display is required.
10. Permanent-establishment risk from any GCC-based reviewer. Sanctions/AML screening adequacy. Notice needed to reprice subscriptions if Kuwait or Qatar introduces VAT.

**Data protection**
11. Oman: read Gazette 1664 (RD 68/2026): current art. 5 permit text, art. 1 biometric definition, Cyber Defence Centre role for data held abroad, representative, permit timing, MD 6/2025 grace-period end.
12. Saudi Arabia: fate of the Oct 2026 draft (arts. 23(2), 34); offshore registration; is direct collection by a foreign controller a "transfer"; are body and skin data health data (DPO trigger)? Confirm the PDPL rights list used in privacy section 11.
13. Qatar: territorial scope; is body analysis "physical condition" data; granting body (NCSA/NCGAA or NDPO) and form.
14. GDPR: classification (biometric / health / revealing ethnicity); DPO need; AI Act art. 50(4) label wording.
15. UAE: art. 2(1)(c) wording; art. 2(2) health carve-out; the competent authority to name.
16. Kuwait: Arabic text of CITRA Decision 26/2024.
17. Bahrain: the "means in Bahrain" test.
18. The photo consent records four confirmations as one `photos` consent. Is that enough evidence for the UAE/Oman transfer consent, or must transfer and AI illustrations be separate recorded consents (and AI illustrations optional)? Engineering needs new `ConsentKind` values and a migration for that.

**Consumer**
19. Age of majority in Kuwait, Bahrain, Saudi Arabia, Qatar and Oman (UAE resolved at 18). Gate at 21 where needed?
20. Netherlands: do BW 6:230g ff. and 6:230oa reach non-EU consumers? How does BW 7:408 affect the prepaid 12-month plan (pro rata incl. the current month)? Correct article for the online-cancellation duty.
21. Proportional charge after the review starts but before delivery: valid in Saudi Arabia (consumer has not yet "benefited") and Kuwait?
22. Unusable photos with no re-upload: full refund or refund less a stated fee?
23. Language precedence: "more favourable meaning" (current text) or "Arabic prevails for GCC customers"?
24. Liability cap at 12 months' fees for ordinary negligence: allowed?
25. UAE: reach of Federal Law 15/2020 and its Executive Regulation; Arabic invoice rule.

**Advertising**
26. Are non-medical appearance analysis and a grooming plan outside the health-advertising regimes (UAE, KSA, Kuwait)? Which words bring them in?
27. May AI "after" illustrations appear on the site (not ads) under GCC misleading-ad rules, and with what label?
28. UAE CD 66/2023: is Arabic mandatory for adverts? Arabic duties elsewhere.
29. Qatar and Bahrain creator licensing; testimonial and endorsement disclosure per country.

**Trademark**: see [TRADEMARK.md](TRADEMARK.md) (clearance, Arabic registrability, Saudi Madrid membership, Arabic-form route).

## 5. What changed in the customer texts (2026-11-20)

- Privacy, terms and refunds now cover all six GCC countries (no longer
  Kuwait-only), with the GDPR as home law and a per-country privacy section
  (Saudi PDPL rights and transfer basis, UAE PDPL, Kuwait CITRA, Qatar,
  Bahrain, Oman). Arabic versions are complete and use the Arabic brand name.
- Prices are a per-country table generated from `lib/prices.json` (KWD, SAR,
  AED, QAR, BHD, OMR), with the VAT included per country; USD is information only.
- Refunds: full refund until the review starts and for at least 14 days
  (extended until the review starts); 15-day late-delivery cancellation; no
  "non-refundable" wording; statutory rights preserved; Saudi 7-day right named.
- Subscriptions: separate opt-in, no renewal into a new 12-month term,
  two-click cancellation, no fees, failed-payment terms, 30 days' notice of
  price or terms changes.
- AI illustrations are described as AI-generated/altered and labelled (AI Act art. 50(4)).
- Complaints (Arabic channel, 14-day answer), non-exclusive jurisdiction, no
  arbitration, language clause, broader liability carve-outs.
- Photo consent: purpose, no identification, who sees photos, EU storage, the
  countries data goes to, AI illustration notice, "not medical advice", and two
  new required boxes (transfer; AI illustrations). Waiver text now says
  statutory rights for a faulty report are unaffected.
- Notes for counsel and the builder are highlighted in the drafts as
  `[COUNSEL: …]`, `[BUILD: …]`, `[NO-TRAINING: …]`, `[FONTS: …]`, `[DPO: …]`,
  `[SMTP: …]`, `[FUNCTIONS REGION: …]`, `[LOG RETENTION: …]`,
  `[IMAGE PROVIDER RETENTION: …]`, `[IMAGE PROVIDER SUB-PROCESSORS: …]`.
  Every one must be resolved or removed before publishing.
