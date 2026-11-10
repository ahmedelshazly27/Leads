# Facial marker catalogue: index

Three literature-sourced catalogues, built November 2026. Every norm traces to a cited source; "not found" means no published norm was located. Markers are the basis for the next version of the analysis.

| File | Scope | Markers | References |
|---|---|---|---|
| [frontal.md](frontal.md) | Front view: proportions, eyes, brows, nose, lips, cheeks, jaw/chin, ears | 89 (+1 calibration entry) | 47 |
| [profile_smile_neck_ear.md](profile_smile_neck_ear.md) | Side profile, nose, lips, chin, jaw, neck, ear, smile, 45° view | 90 | 88 |
| [skin_eyes_constructs.md](skin_eyes_constructs.md) | Skin, eye appearance, global constructs (averageness, symmetry, dimorphism, adiposity, contrast, perceived age/health, first impressions) | 56 | 106 |
| **Total** | | **235 rows (≈220 distinct after overlaps)** | |

## Against the competitor's 169

| Region (competitor count) | Catalogue rows | Where |
|---|---|---|
| General (8) | 34 | frontal general 14 + global constructs 20 |
| Eyebrows (14) | 10 | frontal |
| Eyes (26) | 27 | frontal 17 + eye appearance 10 |
| Nose (17) | 30 | frontal 12 + profile 18 |
| Lips (16) | 29 | frontal 17 + profile 12 |
| Cheeks (13) | 9 | frontal 5 + 45° 4 |
| Jaw (11) + Chin (8) | 18 | frontal 9 + profile chin 5 + jaw 4 |
| Smile (13) | 14 | smile |
| Neck (11) | 9 | neck |
| Ear (12) | 17 | frontal 5 + profile 12 |
| Skin (20) | 26 | skin |
| Profile / overall (no equivalent) | 12 | profile |
| Body (no equivalent) | 15 already built | app |

Thinner than the competitor on brows and cheeks; the literature has few quantified cheek measures (malar prominence and ogee curve are mostly reviewer judgements).

## Photos each group needs

- **Front, neutral:** frontal markers and most skin markers (with a colour reference card for colour metrics).
- **Left and right profile, level camera:** 49 profile markers can be read from the silhouette outline alone on a plain backdrop.
- **45°:** cheek/ogee and jawline, reviewer-graded.
- **Smile (front, natural):** 14 smile markers.
- **Expressions (frown, smile, brow raise):** wrinkle grades.
- **Scale:** iris diameter (≈11.7 mm) converts ratios to mm without a ruler.

## Corrections to the current app found by the review

- `lipRatio` "ideal 0.62" matches no source: Popenko found 1:2 most attractive (women), Heidekrueger 1:1, population means ≈0.84–0.93.
- "Ideal ≈ 1" for eye spacing and for nose width vs intercanthal fails in Saudi data (nose wider than intercanthal in 92% of men, 56% of women).
- `noseLengthToFace` and `faceWHR` use mesh point 10 (upper forehead), not the hairline; prefer nasion-based face height (Saudi 3D norms exist).
- Canthal-tilt norms range ≈1°–8.5° depending on definition; the app should state its definition and use a matching norm.

## Gulf / Arab norm coverage

Saudi norms exist for: frontal proportions (Al-Sebaei 2015; Alhazmi 2026, 3D), nose (Aljabaa 2019; Al-Qattan 2012), lips (Bakri 2025), profile (AlBarakati 2011), ears (Hiware 2024; Alshwareb 2026), smile (Ismail 2026; Ganem 2026) and attractiveness ratings by Saudi raters (several). Also Yemeni, Egyptian, Persian, Lebanese, Turkish and Syrian data. No Emirati/Kuwaiti/Qatari/Omani frontal norms; one Emirati profile study (Abutayyem 2021) flagged for implausible values. No Gulf data for under-eye darkness, melasma prevalence, neck angles, ear protrusion or 45° measures.
