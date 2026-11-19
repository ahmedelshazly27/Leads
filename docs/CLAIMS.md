# Marketing claims register

Source of truth for every health, appearance and product claim used in ads, store listings, social posts, landing pages and sales material (launch: Kuwait only, men only, English and Arabic; the report at 20 KWD plus an optional membership). The operator is a Dutch B.V.; see `docs/LAUNCH.md`.

## How to use this register

- **Use only the "Claim (approved ad wording)" text**, or a shorter version with the same meaning. Don't make a claim stronger, drop its qualifier (for example "in a study", "estimate", "AI illustration"), or merge two claims into a bigger one.
- **Evidence** lists the `REFS` keys in `app/src/lib/science.ts`, which hold the full citation and DOI, plus a one-line finding. If a claim isn't in this table, it isn't approved. To add one, add the reference to `REFS` first (it must be peer-reviewed and verified to say what is claimed), then add a row here.
- **Grade:** A = randomised trials or meta-analyses; B = controlled or large observational studies; C = limited evidence, expert guidance or our own method; *product fact* = a description of what the product does. That description must stay true at the time the ad runs.
- **Don't say** lists risky variants we have seen or expect. Treat anything close to them as not approved.
- **Regulatory review is still required.** Health, cosmetic and appearance claims in ads are regulated in Kuwait (Ministry of Health for health-related advertising; Ministry of Information licensing for paid and influencer ads). Some ads may need prior approval, and before/after imagery and medical-sounding claims get particular scrutiny. This register is an evidence check, not legal clearance. Every campaign needs a review by local regulatory or legal counsel before it runs. This document does not state what those requirements are.
- Studies are cited for what they found, usually in specific samples (often Western, young-adult raters or particular patient groups). Never present a study result as a promise of an individual outcome.

## Face analysis

| Claim (approved ad wording) | Evidence | Grade | Don't say |
|---|---|---|---|
| "40+ measurements of your face and body from a few guided photos." | Product: count of measures in `Landing.tsx` MEASURES | product fact | "Complete / full / most accurate analysis"; "clinical-grade" |
| "Measures facial symmetry, proportions and averageness, which research links to attractiveness ratings." | grammer1994, rhodes2006: symmetry and averageness are associated with attractiveness ratings; langlois1990: averaged faces were rated more attractive than most individual faces | B | "Scientifically measures how attractive you are"; "your attractiveness score"; "beauty rating" |
| "Compares your facial proportions with published anthropometric norms." | farkas1994: population norms for facial thirds, fifths and widths | B | "Ideal / perfect proportions"; "golden ratio" |
| "Reads your skin in six regions for redness, pigment and texture. Even skin tone is linked to looking younger and healthier." | fink2006: even skin-colour distribution was rated younger, healthier and more attractive; stephen2011: skin colouration and perceived health | B | "Diagnoses skin conditions"; "detects acne / rosacea / melasma" |
| "Shows how facial cues are linked to first impressions, such as dominance and trustworthiness." | willis2006: trait judgements form within 100 ms; oosterhof2008: two dimensions, trust and dominance; geniole2015: higher fWHR is perceived as more dominant (meta-analysis) | B | "Reveals your personality"; "measures how confident / trustworthy you are". The trait indices are our own combinations of these cues. |
| "Selfie distance distorts your face, so we flag close-range photos." | ward2018: at 30 cm, nasal base width appears ~30% wider than at 1.5 m | B | "Corrects all photo distortion" |
| "Scores are our composites of literature-based measures, for tracking change over time." | LIMITATIONS in science.ts; SCORE_NOTE in report.ts | C (our method) | "Validated score"; "clinically validated"; "you're in the top X%"; "above/below average" (bands are fixed cut-offs, not percentiles) |

## Body analysis

| Claim (approved ad wording) | Evidence | Grade | Don't say |
|---|---|---|---|
| "Estimates body proportions, posture and body-fat range from photos plus your height and weight." | deurenberg1991, woolcott2018: BMI and waist-based fat equations (errors of about ±4–5 points); hodgdon1984 | B (equations) / C (photo waist) | "Measures your body fat"; "as accurate as DXA / InBody"; any exact body-fat % in ads |
| "A V-shaped torso and upper-body strength are linked to how men's bodies are rated." | maisey1999: waist-to-chest ratio was the main predictor of ratings; sell2017: perceived upper-body strength explained ~70% of variance | B | "Women will find you more attractive"; "the ideal male body" |
| "Flags waist-to-height and waist-to-hip ratios used as health-risk screening markers." | ashwell2012: waist-to-height ratio >0.5 (meta-analysis); who2008: WHR thresholds | B | "Diagnoses obesity / metabolic risk"; "health check" |
| "Checks head and shoulder position from the side photo." | yip2008: smaller craniovertebral angle in neck-pain patients | B (association) | "Diagnoses posture problems"; "fixes neck pain" |

## Plan: skin

| Claim (approved ad wording) | Evidence | Grade | Don't say |
|---|---|---|---|
| "Daily SPF: in a 4.5-year randomised trial, daily sunscreen users showed no detectable increase in skin ageing." | hughes2013 | A | "Reverses ageing"; "the #1 anti-ageing secret" |
| "Guideline-recommended first-line acne care (topical retinoid + benzoyl peroxide)." | zaenglein2016 (AAD guideline) | A | "Clears acne in X weeks"; "cures acne" |
| "Retinoids for texture: prescription tretinoin improved fine wrinkles in a controlled trial." | weiss1988; mukherjee2006 (retinol evidence weaker) | A (tretinoin) / B (OTC retinol) | "Retinol erases wrinkles" |
| "Niacinamide reduced redness and blotchiness vs. placebo in a controlled trial." | bissett2005 | B | "Brightens / whitens skin" (avoid skin-lightening language entirely) |
| "Eating more fruit and vegetables changed skin colour in a way rated healthier within ~6 weeks." | whitehead2012, stephen2011 | B | "Glowing skin in 6 weeks guaranteed"; "tan from food" |
| "Smoking speeds up skin ageing." | morita2007 (mechanistic review) | B | "Quit and look 10 years younger" |
| "Nicotine replacement raised quit rates by about 55% in a Cochrane review." | hartmannboyce2018 | A | "Doubles your chances"; "guaranteed to quit" |

## Plan: sleep

| Claim (approved ad wording) | Evidence | Grade | Don't say |
|---|---|---|---|
| "In experiments, sleep-deprived faces were rated less healthy and less attractive." | axelsson2010, sundelin2017 | B | "Sleep makes you more attractive" (as a promise); "beauty sleep guaranteed" |
| "Sleep loss shows in the face: more hanging eyelids, swollen eyes and darker circles." | sundelin2013 | B | "Removes dark circles" |
| "Adults should sleep 7+ hours a night (sleep-medicine consensus)." | watson2015 | B (consensus) | Implying the app treats insomnia or sleep disorders |

## Plan: nutrition and body composition

| Claim (approved ad wording) | Evidence | Grade | Don't say |
|---|---|---|---|
| "Calorie targets from a validated resting-energy equation, adjusted from your weigh-ins." | mifflin1990; hall2011 | B | "Exact calorie needs"; "personalised by AI to the calorie" |
| "Paced fat loss (~0.5–1% of body weight a week) to help keep muscle." | helms2014 (review); garthe2011: ~0.7%/wk increased lean mass in athletes, a faster rate did not | B | "Lose X kg in Y weeks"; "burn fat fast" |
| "Protein target based on a meta-analysis of resistance-training gains." | morton2018: benefit up to ~1.6 g/kg/day | A | "Maximises muscle growth"; "build muscle without training" |
| "Facial fullness tracks body fat, so losing fat can make your cheekbones and jawline more visible." | coetzee2009; re2016: ~1.3 BMI units was the smallest change noticeable in the face | B | "Get a sharper jawline"; "reshape your face"; "visible after 4 kg" (as a promise) |
| "Ab exercises alone don't burn belly fat. Overall fat loss does." | vispute2011 | B | "Flat stomach in X weeks" |

## Plan: training and posture

| Claim (approved ad wording) | Evidence | Grade | Don't say |
|---|---|---|---|
| "Training plan built on hypertrophy meta-analyses: each muscle 2×/week, 10+ sets." | schoenfeld2016, schoenfeld2017 | A | "Guaranteed gains"; "add X kg of muscle" |
| "Results vary widely between people." (required next to any projection) | hubal2005: 585 people on the same programme had muscle-size changes from about −2% to +59% | B | Any single-number projection without a range |
| "Exercise routine for forward head posture, based on a meta-analysis." | sheikhhoseini2018 | A (meta-analysis; our app's measure is a proxy) | "Fixes posture"; "cures neck pain"; "grow taller" |
| "Upper-back work for rounded shoulders, as tested in a small controlled trial." | lynch2010 (swimmers, n≈28); kendall2005 (textbook) | C | "Corrects shoulder posture in 8 weeks" |
| "Front-on alignment checks against textbook reference posture." | kendall2005 | C (expert guidance) | "Fixes uneven shoulders / scoliosis" |

## Plan: grooming and hair

| Claim (approved ad wording) | Evidence | Grade | Don't say |
|---|---|---|---|
| "Hairstyle changes how a face is judged, so your plan picks a cut for your face." | mesko2004: hairstyle changed ratings of the same (female) faces. The face-shape matching rules are our grooming guidance. | C | "Scientifically proven haircut for your face shape"; "the haircut that makes you X% more attractive" |
| "In a rating study, women rated heavy stubble as most attractive." | dixson2013; janif2014 (preferences shift with how common beards are) | B | "The beard women want"; "always trending" |
| "Beard and haircut suggestions come from a curated style library, reviewed monthly." | styles.ts REVIEWED_AT; editorial + search-trend sources | product fact / C | "Trend-proof"; "barber-approved" (no partner barbers yet) |
| "Hair grows about 1 cm a month, so we show styles you can actually reach in 12 months." | saitoh1970 | B | — |
| "Treatments for hair loss (minoxidil, finasteride) are backed by randomised trials. See a doctor first." | kaufman1998, olsen2002; ingprasert2016 (beard, small trial) | A (scalp) / B (beard) | "Regrow your hair"; "stop baldness"; naming prescription drugs in ads at all (check with counsel) |

## Plan: clinical (optional)

| Claim (approved ad wording) | Evidence | Grade | Don't say |
|---|---|---|---|
| "For clinical options, we refer you to a licensed practitioner. We never recommend injectables from photos." | product fact; cavallini2014: BoNT-A side effects such as eyelid or brow drooping; funt2013: all dermal fillers can cause complications | product fact / C | "Safe injectables"; "risk-free"; "Botox / filler recommendations"; any injectable brand name |
| "A dermatologist can assess acne scars. Microneedling improved scars in a randomised trial." | alam2014; zaenglein2016 | B | "Remove acne scars"; "scar-free skin" |
| "Not medical advice. Aesthetic and wellness guidance." | product positioning | product fact | "Doctor-designed", "clinically proven", "medical-grade" |

## Visuals / "after" images

| Claim (approved ad wording) | Evidence | Grade | Don't say |
|---|---|---|---|
| "See an AI illustration of your 12-month plan, limited to non-surgical changes." | product fact (plan.ts afterPrompt locks bone and identity) | product fact | "Your future face"; "see your results"; "real results"; "this is what you'll look like" |
| "Every visual is checked by a human before you see it." | product process | product fact (keep true) | "Guaranteed realistic" |
| "Nothing outside your plan changes: we re-measure bone proportions, lips, skin tone and eye colour against your photo before a person approves it." | product fact (realism.ts: 6 bone ratios, 2 lip ratios, skin and iris ΔE; checklist item after-fidelity). Positioning from Reddit buyer complaints about competitors' after images (research_notes/…/reddit_arctic_shift.md) | product fact (keep true) | "Identical to you"; "100% accurate"; naming a competitor's flaws in ads without legal review |
| "Reviewed by [name, credential]" on a report | review.reviewer, required before release | product fact | Any credential the reviewer does not hold; implying a clinician reviewed it when they did not |
| Every visual in an ad must be labelled "AI-generated illustration · synthetic person" (or "· not a real result"). | — | rule | Showing an AI after image next to a real "before" as if it were a real transformation; before/after pairs without the label |

## Product / process

| Claim (approved ad wording) | Evidence | Grade | Don't say |
|---|---|---|---|
| "Every plan step is graded A–C by the strength of its evidence and cited." | plan.ts (every item has grade + refs; C = limited evidence or guidance) | product fact | "Every step is scientifically proven"; "100% science-backed" |
| "Analysis runs on your device; photos you send for review are deleted 90 days after delivery." | product/privacy policy (verify before use) | product fact | "We never see your photos" |
| "The reviewer assigned to you sees your photos. Other staff open them only where their work needs it, and every access is logged." | backend: per-order reviewer assignment, row-level security on orders and the private photo bucket, audit log (`supabase/migrations`); admins can also open orders, as privacy policy section 6 says ("a small number of authorised staff ... every access to photos is logged") | product fact (keep true; re-check before ads) | "Only your reviewer sees your photos" / "seen by one reviewer" (admins can open them too); "Nobody sees your photos"; "no human sees your photos" |
| "At launch the service is for men aged 18 or over in Kuwait." | `/start` only lets men order; women are sent to the waitlist | product fact | "For men and women"; "for everyone" |
| "Coming for women: join the waitlist and we'll email you when it opens." | `WaitlistForm` (`gender="female"`), `join-waitlist` function | product fact | "The women's service is live"; "book now" (to women); any launch date |
| "When it opens, we plan to have women's photos and results reviewed only by female reviewers." (future tense only, as a plan) | backend trigger already refuses to assign a woman's order to a non-female reviewer; at least one female reviewer must be hired before women can order — **operational commitment** | plan (not live) | Present tense ("reviewed only by women", "a private service for women"); "women-only team"; "women's service is live" |
| "No photos of women on this site or in our marketing." | site audit (library women's types are drawn, photo files removed) + marketing policy | product fact | — |
| "We don't sell your data, use photos in marketing, or train AI models on them." | privacy policy + vendor DPAs | legal | "Your data never leaves your phone" |
| "Your data is encrypted, stored in the EU and handled under the GDPR, the EU's data-protection law." | Supabase project in Frankfurt (encryption at rest, private buckets); the Dutch B.V. is the GDPR controller; DPAs with every processor — **DPAs to be signed** (see `docs/LAUNCH.md`) | product fact once the DPAs are signed | "Stored in Kuwait"; "handled in line with Kuwait's data-protection rules" (until a lawyer has checked the CITRA regulation); "GDPR-certified" (there is no such certificate) |
| "Your photo goes to our image provider only to create the visual, under a contract that bars keeping or reusing it." | signed DPA with the image vendor that forbids retention/training — **must be confirmed with the vendor** | launch blocker | name the vendor without their consent |
| "Specialist partner network coming soon in Kuwait." | Landing.tsx (not yet live) | product fact | "Book a dermatologist now"; "our partner clinics"; "MOH-licensed partners" (until contracts are live) |
| "Membership: a re-scan every month with updated scores and an updated plan, a note from your reviewer each month, and a new 12-month visual every 3 months." | membership in the backend (monthly check-in orders from paid invoices / the `monthly-checkins-daily` job); reviewer note and the 3-monthly visual are reviewer tasks — **keep staffed** | product fact (keep true) | "Unlimited reviews"; "a reviewer on call"; "weekly check-ins" |
| "Monthly check-ins compared with your baseline" (only together with "with membership"). | as above | product fact | Implying check-ins come with the report alone after the first 30 days; "predicts your progress" |

## Never claim

- Any change to **bone structure, jaw, chin, cheekbones or skull** (including through mewing, jaw exercisers or face yoga).
- **Guaranteed or typical results**, specific timelines ("in 30 days"), or "results in X weeks" as a promise.
- **A specific % improvement in attractiveness**, or "X% more attractive / confident / successful". Also never claim that the app makes people date or get hired more.
- **Medical diagnosis or treatment**: "diagnoses", "detects disease", "treats acne / hair loss / insomnia / neck pain", "clinically proven", "clinically validated", "doctor-approved", "medical-grade".
- That **scores are validated** clinical or attractiveness measures, or percentile rankings ("top 10%", "above average").
- That **AI after images are real results, photos or predictions** of an individual's outcome, or showing them without an AI label.
- That the **partner network is live**, or naming partner clinics, doctors or licences before contracts are signed.
- **Superlatives and comparisons**: "best", "#1", "most accurate", "only app that…", "better than a dermatologist / trainer".
- **Skin lightening / whitening** language of any kind.
- That **KNET** is accepted (until it is live), **"no subscription"** (the membership is one), or that the first 30 days are **free** (they are part of the paid report).
- That the **women's service is live**, or anything about it in the present tense.
- Recommendations for specific **injectables or prescription drugs** in ads.
- Claims based on studies **not in `REFS`**, or a study result stated more broadly than its finding (for example, applying female-face hairstyle findings to men as proven).

## Why appearance matters (landing "Studies show…" section)

Approved wording is what the landing page shows; each line is the cited paper's own finding. Footnote on the page: averages from published studies, mostly Western samples; they describe how people tend to be judged, not what anyone is worth.

| Approved claim (as shown) | Source | Do not say |
|---|---|---|
| Workers rated plain earned 5–10% less than average-looking colleagues, who earned less again than those rated good-looking. | hamermesh1994 | "Attractive people earn 10–15% more" (overstates the paper) |
| Attractive candidates were rated more favourably in hiring, performance and promotion decisions (experiments). | hosoda2003 | "You'll get the job" |
| Servers rated attractive earned about $1,261 more a year in tips. | parrett2015 | Any other currency or a "per shift" figure |
| In a lab job market, attractive workers were more confident and employers expected more of them. | mobius2006 | |
| A partner's looks were the strongest predictor of wanting a second date (matched dance). | walster1966 | "Looks are all that matter in dating" |
| Looks predicted romantic interest as strongly for women as for men (speed dating). | eastwick2008 | |
| Attractive adults were judged and treated more positively across dozens of studies. | langlois2000 | |
| People assumed attractive strangers had better personalities and happier lives. | dion1972 | |
| The halo is strongest for social competence and weak for honesty or kindness. | eagly1991 | "Attractive people are better people" |
| Teachers judged attractive students as brighter and expected more of them; identical report cards, higher expected IQ. | ritts1992; clifford1973 | |
| Attractive defendants got lighter sentences (real cases), lower bail and fines (real misdemeanours), and were somewhat less often convicted by mock jurors (small effect). | stewart1980; downs1991; mazzella1994 | "Looks get you off" |
| Attractive communicators got more petition signatures. | chaiken1979 | |
| Competence judged from faces predicted ~70% of US Senate races; children's face picks predicted ~71% of French run-offs. | todorov2005; antonakis2009 | Presenting these as attractiveness effects (they are competence judgements) |
| Better-looking people reported higher life satisfaction, partly through economic outcomes; others' ratings were only weakly tied to happiness. | hamermesh2013; diener1995 | "Looking better will make you happy" |

## Price

| Claim | Evidence | Grade | Don't say |
|---|---|---|---|
| "Report 20 KWD, one payment, includes 30 days of membership. Optional membership 5 KWD a month or 45 KWD a year, cancel any time." | `PRICES_KWD` and `BUNDLE_TRIAL_DAYS` in `app/src/lib/backend/types.ts`; Stripe prices (README section 6) must match | product fact | "No subscription"; "one payment" without "for the report"; "free 30 days" / "free trial" / "free month" (the 30 days are part of the paid report); "free" in any form; any other price or currency in Kuwait marketing |
| "Yearly membership: 45 KWD for the first year, then 5 KWD a month. Cancel any time." (say this whenever the yearly price is shown on its own) | `membership_yearly` is put on a Stripe subscription schedule that continues month to month at 5 KWD after the first 12 months (docs/BACKEND.md, "Membership and refunds"; terms and refund policy say the same) | product fact | "45 KWD a year" on its own, as if it renewed yearly; "yearly, then it ends" |
| "Report only: the 30 days of membership simply end. Nothing renews." | `report` plan is a one-time Stripe payment with no subscription | product fact | — |
| "Pay by card, Apple Pay or Google Pay." | Stripe Checkout on the B.V., in KWD | product fact (keep true) | "KNET" (until KNET is live through a second processor); naming card brands Stripe isn't set up for |
