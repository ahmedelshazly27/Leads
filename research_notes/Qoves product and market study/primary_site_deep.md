# Qoves live site, primary-source deep read (www.qoves.com, fetched 2026-11-08)

Method: curl + python text extraction of homepage, sitemap (146 URLs), robots.txt, legal, about-us, man-protocol, for-doctors, security, research, 7 attraction-science guides, 8 comparison pages, 65 measurement pages; homepage FAQ (53 Qs) from JSON-LD; CSS and public JS bundles. Live price is injected from app.api.qoves.com (not fetched). Raw files: scratchpad qv/.

## Q1. Offer, price, add-ons, turnaround, refunds
Takeaway: single product — yearly membership $150, cancel anytime; analysis + protocol + visualisations + biometric scores + letter, refreshed yearly; up to 28 days; one-time add-ons (Express 48 h; "comprehensive-report", apparently surgical recs); refunds only before photos/questionnaire submitted (≤90 days).
- "QOVES is a yearly membership at $150, cancellable any time"; "150 USD per year (qoves.com, 2026)" — https://www.qoves.com/insights/qoves-vs-umax (same on vs Azure, Face++, Perfect Corp pages)
- "It costs $150. That covers the measurement, a human reviewer checking what the software found, and the written report" — https://www.qoves.com/insights/how-a-glow-up-actually-happens
- Pricing block: "What could cost you ~~$10,000~~ is [price]"; "One analysis per year. No hidden fees."; CTA "Get Access" — https://www.qoves.com/
- Benefits: complete facial analysis; personalised protocol; biometric scores & tracking; before/after visualisations; "Ask us anything, anytime" via dashboard.
- FAQ: members receive analysis, glow-up protocol, biometric scores, visualisations, "protocol letter from our team", "constant messaging access to our care team"; updated yearly. "No contracts. Cancel or pause anytime."
- Turnaround "up to 28 days from the moment you upload your photos". Support within 5 min; beauty questions within 24 h; "Always real people".
- Refunds: full refund until pictures/questionnaire submitted, ≤90 days; none after upload/work started; Express fees non-refundable once any part delivered; revisions via care team — https://www.qoves.com/legal/terms-and-conditions
- Checkout code: "One-time add-ons"; IDs express-delivery, comprehensive-report; "Express delivers only your main report and protocol within 48 hours"; "express orders with surgical recommendations may take up to 7 working days"; Stripe — https://www.qoves.com/welcome/checkout
- Inference: comprehensive-report add-on = surgical recommendations; price/currency API-driven (USD/EUR formatting).
- Gaps: add-on prices; live price confirmation.

## Q2. Report contents, counts, photos, questionnaire
Takeaway: inconsistent counts — 160+ assessments (home), 100+ tests (FAQ/for-doctors), 200+ tests across 18 sections and "47 modules / 1,200+ measurements across nine photos" (comparison pages); 521 vs 512 landmarks; 6 vs 9 photos.
- Homepage catalogue "160+ Aesthetic Assessments … Assessed 1x a year, From home", each defined: General 8, Eyebrows 14, Eyes 26, Nose 17, Lips 16, Cheeks 13, Jaw 11, Chin 8, Smile 13, Neck 11, Ear 12, Skin 20 (=169).
- General 8: First Impression, Facial Masculinity, Facial Femininity, Facial Averageness, Facial Proportions, Facial Symmetry, Perceived Youthfulness, Face Shape.
- Examples: limbal ring visibility, scleral colour (Eyes); buccal corridors, Duchenne activation (Smile); Adam's apple visibility (Neck); oiliness (Skin).
- "map 521 facial points" vs "We landmark 512 points"; "450+ evidence-based methods".
- Six score pillars: Proportion, Dimorphism, Averageness, Neoteny, Contrast, Symmetry.
- Dashboard tiles: Facial Femininity (>90 ideal), Averageness, Symmetry (>75), Homogeneity (>75), Proportionality (>80), Visual Age; year-over-year "With QOVES Recommendations / Without QOVES" chart.
- Report style: value vs demographic norm, e.g. "curvature value of 0.23 whereas the average for your demographic is 0.21", band "25-32 WHITE FEMALE 0.18–0.26"; sample "Emma's Report" forehead wrinkle depth in μm.
- "You will learn": biometrics & scores with improvement potential; how each feature affects appearance; per-feature breakdowns; facial harmony; highest-potential features; science behind protocol.
- Protocol: phased timeline ("Key vitality signals" 0–1 mo; "Basic facial proportions" 1–2 mo; "Balancing dimorphism" 2–4 mo); each action: cost, frequency, time-to-result, difficulty (e.g. retinol 0.5% $35–55, nightly, 8+ weeks); multiple alternatives per change; realistic visualisations; "Products Recommended" with risk level.
- FAQ protocol contents: per-feature improvements with explanations, visualisations, alternative products/exercises/treatments, step-by-step instructions, letter; types: products, skincare, hair & facial hair, OTC.
- "Man protocol" 6 steps: maximise perceived health; adjust proportions (thirds/fifths); balance masculinity; consider each feature; add uniqueness and charm; maintenance plan; "4.7/5 stars … 600+ reviews" — https://www.qoves.com/man-protocol
- Photos: "Upload 6 clear photos … Six specific angles … No special equipment"; poses widget shows Front, Right Side, Left Side, Right Quarter (carousel likely truncated).
- Onboarding: pay → create account → questionnaire + photo upload in browser; no app. Questionnaire: demographics, lifestyle, goals; recommendation types you're unwilling to do; past cosmetic procedures; personalisation by ethnicity, age, location, lifestyle (diet, climate, stress, sleep), budget, preferences, ageing, cultural standards.
- Checkout: email (+marketing consent) → add-ons → Stripe.
- Gaps: no sample report page; "18 sections" not named; six poses not fully named.

## Q3. Measurement pages (65 in sitemap; index lists 68)
Template: definition → how measured (landmarks) → why it matters → range cards (men/women/typical) → by-demographic table with per-row source → FAQ. All stamped "Reviewed October 6, 2026". Most-cited: Naini (2011/2014/2022 Facial Aesthetics), Farkas, Springer, Ofodile, Leong; author–year only, no DOIs, measurement-page reviewer unnamed.
Ranges (men / women / typical):
- alar-width 39 / 37 mm (Korean CBCT); EN-EN = AL-AL (Lee 2024, Leong 2006, Springer 2008, Ofodile 1993)
- brow-apex-angle 150–165° / 135–150° / 140–160° (Roth & Metzinger 2003, Russell 2015, Naini 2011); brow-elevation 3–7 / 7–10 mm; brow-position 18–22 / 22–27 mm
- canthal-tilt 0 to +4° / +2 to +8° / 0 to +10° (Kuraguchi 2015, Cunningham 1990, Naini 2011, Pascali 2017)
- chin-height 26–34 / 22–30 mm; chin-projection 90–92° / 88–90° (Naini 2022), Powell & Humphreys 102.5±2.7°; chin-width qualitative
- columella-show 1–3 / 2–4 mm; cupids-bow mid-philtral 20±2 mm (women), 1:1 vermilion (Heydenrych 2024)
- dorsal-axis-angle 62–68° / 60–66°; double-break-angle <30° / 30–45° / >45°
- ear-axis-angle 15–20° / 15–20° / 15–25°; ear-size 50–60% / 55–65%; earlobe-size 12.1 / 11.9 mm
- eye-almondness-ratio 0.28–0.33 / 0.30–0.35; eye-aperture 30–31 / 28–30 mm; eye-spacing-ratio <0.30 / 0.30–0.38 / >0.38
- facial-convexity-angle 165–175°; facial-depth 138–146° / 142–149°; facial-fifths ~20% each; facial-index 84–88 / 81–85 (78–93); facial-thirds middle:lower 1.00–1.05 / 0.95–1.05; facial-width 134–144 / 128–137 mm; forehead-width 112–126 / 105–118 mm
- fwhr men 1.7–2.1 (Lefevre 2013), women 1.7–2.0 (Kordsmeyer 2019), hockey players 1.9–2.2 (Carré & McCormick 2008)
- gonial-angle 118–130° / 118–126°; lower-gonial ~70° / ~75°; upper-gonial ~52° / ~55° (Naini)
- intercanthal-width 31–35 / 30–34 mm; interpupillary-distance 60–68 / 58–65 mm; jaw-width 100–115 / 95–105 mm
- labiomental-angle 115–145° / 120–130°; lower-anterior-face-height 33–36% / 32–34%; lower-face-height 46–54 / 42–48 mm
- mandible-body-length 79–87 / 72 mm; mandibular-plane-angle 22–26° / 25–30°; mentolabial-depth 4–8 / 2–6 mm; mouth-width 50–55 / 45–50 mm
- nasal-aspect-ratio leptorrhine 55–70 / mesorrhine 70–85 / platyrrhine ≥85; nasal-bridge-width 13–16 / 11–14 mm; nasal-height 50–55 / 44–50 mm; nasal-length 49–54 / 44–49 mm; nasal-root-width 16–20 / 14–18 mm; nasal-tip-projection Goode 0.55–0.60; nasal-tip-rotation 90–95° / 95–110°; nasal-tip-width 22–26 / 18–22 mm
- naso-oral-ratio 1.3–1.5:1 / 1.4–1.6:1; nasofacial 34–38° / 32–36°; nasofrontal 115–130° / 130–135°; nasolabial 90–95° / 95–110°; nasomaxillary ~129° / ~135°
- neck-length qualitative; nose-width 34–40 / 31–37 mm; nostril-vertical-span 12–16 / 10–14 mm; oral-commissure-tilt −1 to +3 / 0 to +4 mm; philtrum-length 22±2 / 20±2 mm
- ramus-length 50–65 / 45–55 mm (ramus:body 5:7); ricketts-e-line upper −4 to −6, lower −2 to −4 mm
- smile-width ~50 / ~48 mm; submental-angle ~95° most attractive, 105–120° classical; submental-cervical 115–130° / 110–125°; supratip-break 170–178° / 160–170°
- upper-eyelid-curvature open 0.38–0.45, hooded 0.25–0.32; upper-lower-lip-ratio 1:1.5 (men), 1:1.6 most attractive
Demographic rows: East Asian (Korean CBCT), Black American, nasal types, Middle Eastern, Hispanic/Mestizo, older adults.
Guides (averageness, symmetry, dimorphism, neoteny, adiposity, harmony, proportionality): "An Evidence-Based Guide", TL;DR + abstract, Oct 2025–Jan 2026, author Santiago Grandas Forero (MSc Psych Research, Oxford), reviewer Macken Murphy (MSc Cognitive & Evolutionary Anthropology, Oxford); proportionality guide rejects the rigid golden ratio.
Other insight sections: 17 concerns, 14 procedures, 8 attraction-science, 8 comparison articles (vs Umax, Looksmax.ai, Haut.AI, YouCam, Perfect Corp, Face++, Azure Face API, Amazon Rekognition).
Inferences: norms mostly Caucasian/clinical-textbook (Naini, Farkas) with a few ethnicity rows; no systematic means±SD by ethnicity; identical review date suggests batch/template.

## Q4. Reviewers, AI vs human, safety
- "Every analysis is carefully reviewed by our team"; "every analysis reviewed by specialists"; "a real person is reading your face".
- "we use tools like Claude to help articulate findings clearly. But the analysis itself … is powered by proprietary models … combined with the hands-on expertise of our team." (FAQ)
- 10 named advisors (Lara Devgan, John Shamoun, Neelam Khan, Daniel Gould, Ayad Harb, Gary Linkov, Michael Keyes, Shim Ching, Jonathan Zelken, Oliver Zolman); quotes from Linkov, Zelken, Ching.
- Chief Scientist Macken Murphy; about-us: five full-time scientists (Oxford, Max Planck), "seven years of studying the facial aesthetics literature".
- Company facts inconsistent: about-us founded 2019, London HQ, 121 team, 80K+ clients; JSON-LD foundingDate 2024 (founders Shafee Hassan CTO, Leo Guillot CEO); legal entity Qoves Inc., Wilmington, Delaware.
- Safety: 18+ in Terms; "not a replacement for professional medical advice"; "We do not guarantee the accuracy of all analyses"; "of sound mind"; footer "does not provide licensed clinical or medical services… Some images … digitally generated"; FAQ "not able to assess whether any product, treatment or procedure is safe or suitable for you".
- Mental health: "If you are already checking your reflection more than you would like, it is not what you need"; FAQ "Will this make me feel worse about myself?"; BDD only mentioned in passing in two articles; no BDD screening found.
- Research: Advarra IRB exempt determination for Facial Perception Research Program; fellowships up to $2,500 (exceptional $10,000); studies on freckles and LLM face ratings.
- Data: GDPR-aligned, European data residency, essential staff only see photos; deletion from account settings; robots.txt ai-train=no.
- Gaps: reviewers' identity/qualifications undefined; no published model accuracy/validation.

## Q5. Design language, homepage order
- Fonts: PP Neue Montreal (body), Zagma (display), from cdn.qoves.com.
- Colours: #f2f2f2, #233137 (text/logo), #758084, #9aaeb5 (buttons; hover #aec2c9), #e8e8e8 borders, #515255, #cddbe1, #f2f5f5, #fafafa, #0b1315.
- Homepage order: nav (Why Glow-up / How it works / FAQ / Login / Start my plan) → hero "Join 80,000+ people · Improve your looks without surgery" + 3 badges → As Seen In → before/projection sliders → ~27 cited attractiveness-outcome stats → old vs new way → complete facial analysis (160+ markers) → "Taking into account your…" → "You will learn" → 4-step plan → surgery-free transformations → protocol timeline (450+ methods) → visualisation → ethnicity-aware block → biometrics & tracking → 2M+ followers → 160+ assessment catalogue (12 categories) → advisors → technology (521 points, 6 pillars) → "Reviewed by Humans" → ancestry → transformations gallery → testimonials → how it works (3 steps) → pricing → support chat → letter → lifetime tracking → chief scientist quote → FAQ (9 tabs) → mindset sections → footer disclaimers.

## Contradictions
100+ vs 160+ vs 200+ tests (47 modules / 1,200+ measurements); 521 vs 512 landmarks; 6 vs 9 photos; founded 2019 vs 2024; London vs Delaware; "only non-surgical" vs checkout "orders with surgical recommendations".
