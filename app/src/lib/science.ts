/**
 * Evidence base. Every metric and every plan item points at one or more
 * entries here so the UI can show *why* a number or a recommendation exists.
 */

export type EvidenceGrade = "A" | "B" | "C";

export const GRADE_LABEL: Record<EvidenceGrade, string> = {
  A: "Strong — randomised trials or meta-analyses",
  B: "Moderate — controlled or large observational studies",
  C: "Limited — small studies, expert consensus or mechanistic rationale",
};

export interface Reference {
  id: string;
  authors: string;
  year: number;
  title: string;
  source: string;
  finding: string;
}

export const REFS: Record<string, Reference> = {
  farkas1994: {
    id: "farkas1994",
    authors: "Farkas LG",
    year: 1994,
    title: "Anthropometry of the Head and Face (2nd ed.)",
    source: "Raven Press, New York",
    finding: "Population norms for facial proportions, including thirds, fifths, intercanthal and nasal widths.",
  },
  langlois1990: {
    id: "langlois1990",
    authors: "Langlois JH, Roggman LA",
    year: 1990,
    title: "Attractive faces are only average",
    source: "Psychological Science 1(2):115–121",
    finding: "Composite (mathematically averaged) faces are rated more attractive than most individual faces.",
  },
  rhodes2006: {
    id: "rhodes2006",
    authors: "Rhodes G",
    year: 2006,
    title: "The evolutionary psychology of facial beauty",
    source: "Annual Review of Psychology 57:199–226",
    finding: "Review: averageness, symmetry and sexual dimorphism are each associated with attractiveness ratings.",
  },
  grammer1994: {
    id: "grammer1994",
    authors: "Grammer K, Thornhill R",
    year: 1994,
    title: "Human facial attractiveness and sexual selection: the role of symmetry and averageness",
    source: "Journal of Comparative Psychology 108(3):233–242",
    finding: "Bilateral facial symmetry correlates with attractiveness ratings.",
  },
  perrett1998: {
    id: "perrett1998",
    authors: "Perrett DI, Lee KJ, Penton-Voak I, et al.",
    year: 1998,
    title: "Effects of sexual dimorphism on facial attractiveness",
    source: "Nature 394:884–887",
    finding: "Feminised shapes were preferred for female faces and, in this sample, slightly feminised shapes for male faces.",
  },
  carre2008: {
    id: "carre2008",
    authors: "Carré JM, McCormick CM",
    year: 2008,
    title: "In your face: facial metrics predict aggressive behaviour in the laboratory and in varsity and professional hockey players",
    source: "Proceedings of the Royal Society B 275:2651–2656",
    finding: "Facial width-to-height ratio (fWHR) is associated with perceived and behavioural aggression in men.",
  },
  geniole2015: {
    id: "geniole2015",
    authors: "Geniole SN, Denson TF, Dixson BJ, Carré JM, McCormick CM",
    year: 2015,
    title: "Evidence from meta-analyses of the facial width-to-height ratio as an evolved cue of threat",
    source: "PLoS ONE 10(7): e0132726",
    finding: "Meta-analysis: higher fWHR is reliably perceived as more threatening/dominant.",
  },
  coetzee2009: {
    id: "coetzee2009",
    authors: "Coetzee V, Perrett DI, Stephen ID",
    year: 2009,
    title: "Facial adiposity: a cue to health?",
    source: "Perception 38(11):1700–1711",
    finding: "Perceived facial adiposity tracks BMI and is linked to perceived health and attractiveness.",
  },
  russell2009: {
    id: "russell2009",
    authors: "Russell R",
    year: 2009,
    title: "A sex difference in facial contrast and its exaggeration by cosmetics",
    source: "Perception 38(8):1211–1219",
    finding: "Luminance contrast between eyes/lips and surrounding skin is a cue to femininity and attractiveness.",
  },
  porcheron2013: {
    id: "porcheron2013",
    authors: "Porcheron A, Mauger E, Russell R",
    year: 2013,
    title: "Aspects of facial contrast decrease with age and are cues for age perception",
    source: "PLoS ONE 8(3): e57985",
    finding: "Facial contrast declines with age; higher contrast faces look younger.",
  },
  cunningham1986: {
    id: "cunningham1986",
    authors: "Cunningham MR",
    year: 1986,
    title: "Measuring the physical in physical attractiveness",
    source: "Journal of Personality and Social Psychology 50(5):925–935",
    finding: "Neotenous features (large eyes, small nose/chin) are associated with attractiveness ratings of female faces.",
  },
  willis2006: {
    id: "willis2006",
    authors: "Willis J, Todorov A",
    year: 2006,
    title: "First impressions: making up your mind after a 100-ms exposure to a face",
    source: "Psychological Science 17(7):592–598",
    finding: "Trait judgements (trust, competence, likeability) form within 100 ms of seeing a face.",
  },
  oosterhof2008: {
    id: "oosterhof2008",
    authors: "Oosterhof NN, Todorov A",
    year: 2008,
    title: "The functional basis of face evaluation",
    source: "PNAS 105(32):11087–11092",
    finding: "Face evaluation is largely captured by two dimensions: trustworthiness and dominance.",
  },
  reis1990: {
    id: "reis1990",
    authors: "Reis HT, Wilson IM, Monestere C, et al.",
    year: 1990,
    title: "What is smiling is beautiful and good",
    source: "European Journal of Social Psychology 20(3):259–267",
    finding: "Smiling faces are rated more attractive, sincere and sociable.",
  },
  rhee2012: {
    id: "rhee2012",
    authors: "Rhee SC, Woo KS, Kwon B",
    year: 2012,
    title: "Biometric study of eyelid shape and dimensions of different races with references to beauty",
    source: "Aesthetic Plastic Surgery 36(5):1236–1245",
    finding: "Eyes rated attractive tend to have a mildly positive canthal tilt.",
  },
  popenko2017: {
    id: "popenko2017",
    authors: "Popenko NA, Tripathi PB, Devcic Z, et al.",
    year: 2017,
    title: "A quantitative approach to determining the ideal female lip aesthetic and its effect on facial attractiveness",
    source: "JAMA Facial Plastic Surgery 19(4):261–267",
    finding: "An upper-to-lower lip ratio near 1:2 was rated most attractive.",
  },
  sadr2003: {
    id: "sadr2003",
    authors: "Sadr J, Jarudi I, Sinha P",
    year: 2003,
    title: "The role of eyebrows in face recognition",
    source: "Perception 32(3):285–293",
    finding: "Eyebrows are among the most important features for face recognition and expression.",
  },
  fink2006: {
    id: "fink2006",
    authors: "Fink B, Grammer K, Matts PJ",
    year: 2006,
    title: "Visible skin color distribution plays a role in the perception of age, attractiveness, and health in female faces",
    source: "Evolution and Human Behavior 27(6):433–442",
    finding: "Even skin tone distribution makes faces look younger, healthier and more attractive.",
  },
  hughes2013: {
    id: "hughes2013",
    authors: "Hughes MCB, Williams GM, Baker P, Green AC",
    year: 2013,
    title: "Sunscreen and prevention of skin aging: a randomized trial",
    source: "Annals of Internal Medicine 158(11):781–790",
    finding: "Daily broad-spectrum sunscreen use showed no detectable increase in skin aging over 4.5 years vs. discretionary use.",
  },
  weiss1988: {
    id: "weiss1988",
    authors: "Weiss JS, Ellis CN, Headington JT, et al.",
    year: 1988,
    title: "Topical tretinoin improves photoaged skin: a double-blind vehicle-controlled study",
    source: "JAMA 259(4):527–532",
    finding: "Tretinoin improved fine wrinkling, roughness and mottled pigmentation vs. vehicle.",
  },
  mukherjee2006: {
    id: "mukherjee2006",
    authors: "Mukherjee S, Date A, Patravale V, et al.",
    year: 2006,
    title: "Retinoids in the treatment of skin aging: an overview of clinical efficacy and safety",
    source: "Clinical Interventions in Aging 1(4):327–348",
    finding: "Review of retinoid efficacy for photoaging, including over-the-counter retinol.",
  },
  bissett2005: {
    id: "bissett2005",
    authors: "Bissett DL, Oblong JE, Berge CA",
    year: 2005,
    title: "Niacinamide: a B vitamin that improves aging facial skin appearance",
    source: "Dermatologic Surgery 31(7 Pt 2):860–865",
    finding: "5% niacinamide improved hyperpigmentation, redness, texture and fine lines vs. vehicle.",
  },
  traikovich1999: {
    id: "traikovich1999",
    authors: "Traikovich SS",
    year: 1999,
    title: "Use of topical ascorbic acid and its effects on photodamaged skin topography",
    source: "Archives of Otolaryngology–Head & Neck Surgery 125(10):1091–1098",
    finding: "Topical vitamin C improved photodamaged skin texture vs. vehicle.",
  },
  axelsson2010: {
    id: "axelsson2010",
    authors: "Axelsson J, Sundelin T, Ingre M, et al.",
    year: 2010,
    title: "Beauty sleep: experimental study on the perceived health and attractiveness of sleep deprived people",
    source: "BMJ 341:c6614",
    finding: "After sleep deprivation, people were rated less healthy, less attractive and more tired.",
  },
  sundelin2017: {
    id: "sundelin2017",
    authors: "Sundelin T, Lekander M, Sorjonen K, Axelsson J",
    year: 2017,
    title: "Negative effects of restricted sleep on facial appearance and social appeal",
    source: "Royal Society Open Science 4(5):160918",
    finding: "Two nights of restricted sleep reduced rated attractiveness and others' willingness to socialise.",
  },
  stephen2011: {
    id: "stephen2011",
    authors: "Stephen ID, Coetzee V, Perrett DI",
    year: 2011,
    title: "Carotenoid and melanin pigment coloration affect perceived human health",
    source: "Evolution and Human Behavior 32(3):216–227",
    finding: "Carotenoid-linked skin yellowness increases perceived health.",
  },
  whitehead2012: {
    id: "whitehead2012",
    authors: "Whitehead RD, Re D, Xiao D, Ozakinci G, Perrett DI",
    year: 2012,
    title: "You are what you eat: within-subject increases in fruit and vegetable consumption confer beneficial skin-color changes",
    source: "PLoS ONE 7(3): e32988",
    finding: "Raising fruit and vegetable intake produced perceptible, attractive skin colour changes within ~6 weeks.",
  },
  morita2007: {
    id: "morita2007",
    authors: "Morita A",
    year: 2007,
    title: "Tobacco smoke causes premature skin aging",
    source: "Journal of Dermatological Science 48(3):169–175",
    finding: "Smoking accelerates skin aging via MMP induction and reduced collagen synthesis.",
  },
  goodman2019: {
    id: "goodman2019",
    authors: "Goodman GD, Kaufman J, Day D, et al.",
    year: 2019,
    title: "Impact of smoking and alcohol use on facial aging in women",
    source: "Journal of Clinical and Aesthetic Dermatology 12(8):28–39",
    finding: "Heavy alcohol use was associated with more under-eye puffiness, mid-face volume loss and vessels.",
  },
  morton2018: {
    id: "morton2018",
    authors: "Morton RW, Murphy KT, McKellar SR, et al.",
    year: 2018,
    title: "A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength",
    source: "British Journal of Sports Medicine 52(6):376–384",
    finding: "Protein intake up to ~1.6 g/kg/day augments resistance-training gains in lean mass.",
  },
  schoenfeld2016: {
    id: "schoenfeld2016",
    authors: "Schoenfeld BJ, Ogborn D, Krieger JW",
    year: 2016,
    title: "Effects of resistance training frequency on measures of muscle hypertrophy: a systematic review and meta-analysis",
    source: "Sports Medicine 46(11):1689–1697",
    finding: "Training each muscle group at least twice weekly yields more hypertrophy than once weekly.",
  },
  schoenfeld2017: {
    id: "schoenfeld2017",
    authors: "Schoenfeld BJ, Ogborn D, Krieger JW",
    year: 2017,
    title: "Dose-response relationship between weekly resistance training volume and increases in muscle mass",
    source: "Journal of Sports Sciences 35(11):1073–1082",
    finding: "More weekly sets per muscle (≥10) is associated with greater hypertrophy.",
  },
  hall2011: {
    id: "hall2011",
    authors: "Hall KD, Sacks G, Chandramohan D, et al.",
    year: 2011,
    title: "Quantification of the effect of energy imbalance on bodyweight",
    source: "The Lancet 378(9793):826–837",
    finding: "Sustained energy deficit drives weight loss; models realistic rates and plateaus.",
  },
  singh1993: {
    id: "singh1993",
    authors: "Singh D",
    year: 1993,
    title: "Adaptive significance of female physical attractiveness: role of waist-to-hip ratio",
    source: "Journal of Personality and Social Psychology 65(2):293–307",
    finding: "Female figures with a waist-to-hip ratio around 0.7 were rated most attractive.",
  },
  sell2017: {
    id: "sell2017",
    authors: "Sell A, Lukaszewski AW, Townsley M",
    year: 2017,
    title: "Cues of upper body strength account for most of the variance in men's bodily attractiveness",
    source: "Proceedings of the Royal Society B 284: 20171819",
    finding: "Perceived upper-body strength explained ~70% of variance in men's bodily attractiveness.",
  },
  deurenberg1991: {
    id: "deurenberg1991",
    authors: "Deurenberg P, Weststrate JA, Seidell JC",
    year: 1991,
    title: "Body mass index as a measure of body fatness: age- and sex-specific prediction formulas",
    source: "British Journal of Nutrition 65(2):105–114",
    finding: "Body fat % ≈ 1.2·BMI + 0.23·age − 10.8·sex − 5.4 (sex: male = 1, female = 0).",
  },
  who2008: {
    id: "who2008",
    authors: "World Health Organization",
    year: 2008,
    title: "Waist circumference and waist–hip ratio: report of a WHO expert consultation",
    source: "WHO, Geneva",
    finding: "Defines WHR risk thresholds (≥0.90 men, ≥0.85 women) and BMI categories.",
  },
  kendall2005: {
    id: "kendall2005",
    authors: "Kendall FP, McCreary EK, Provance PG, et al.",
    year: 2005,
    title: "Muscles: Testing and Function with Posture and Pain (5th ed.)",
    source: "Lippincott Williams & Wilkins",
    finding: "Reference for standing postural alignment in the frontal plane (level shoulders and pelvis).",
  },
  alam2018: {
    id: "alam2018",
    authors: "Alam M, Walter AJ, Geisler A, et al.",
    year: 2018,
    title: "Association of facial exercise with the appearance of aging",
    source: "JAMA Dermatology 154(3):365–367",
    finding: "Small uncontrolled pilot (n=16): facial exercise associated with modest upper-cheek fullness gains.",
  },
};

export const ref = (id: string) => REFS[id];

/* ------------------------------------------------------------------ */
/*  Metric methodology                                                 */
/* ------------------------------------------------------------------ */

export interface Method {
  how: string;
  norm: string;
  refs: string[];
}

export const METHODS: Record<string, Method> = {
  symmetry: {
    how: "17 bilateral landmark pairs are mirrored across the facial midline after correcting head roll; the mean mirrored displacement is expressed relative to face width.",
    norm: "Mean displacement below ~1.5% of face width is typical of faces rated highly symmetric.",
    refs: ["grammer1994", "rhodes2006"],
  },
  averageness: {
    how: "Ten proportion ratios are compared with anthropometric population means; the score falls as the average standardised deviation grows.",
    norm: "Faces close to the population mean on most ratios score above 75.",
    refs: ["langlois1990", "farkas1994", "rhodes2006"],
  },
  dimorphism: {
    how: "Combines jaw-to-face width, brow-to-eye distance, fWHR, lip fullness and eye openness — features that differ on average between male and female faces.",
    norm: "Reported on a feminine ↔ masculine axis relative to your stated gender's reference range.",
    refs: ["perrett1998", "rhodes2006"],
  },
  fwhr: {
    how: "Bizygomatic width divided by the distance from the lower brow to the upper lip.",
    norm: "Typical adult range 1.7–2.1. Higher values are perceived as more dominant.",
    refs: ["carre2008", "geniole2015"],
  },
  proportions: {
    how: "Facial thirds (glabella–subnasale vs. subnasale–menton), rule of fifths (eye width vs. intercanthal width), nasal width vs. intercanthal width, mouth width vs. nasal width.",
    norm: "Classical/anthropometric norms: middle ≈ lower third, intercanthal ≈ eye width, nasal width ≈ intercanthal, mouth ≈ 1.5× nasal width.",
    refs: ["farkas1994"],
  },
  neoteny: {
    how: "Eye size relative to face width, lower-face height, nose length and lip fullness are combined into a youthfulness index.",
    norm: "Higher values read as more youthful; associated with attractiveness ratings, especially of female faces.",
    refs: ["cunningham1986"],
  },
  adiposity: {
    how: "Face width-to-height and cheek-to-jaw width ratios approximate facial fullness.",
    norm: "Facial adiposity tracks BMI; moderate values are rated healthiest.",
    refs: ["coetzee2009"],
  },
  contrast: {
    how: "Mean CIE L* luminance of brows, eyes and lips is compared with the surrounding skin.",
    norm: "Higher contrast is perceived as younger and, in female faces, more feminine.",
    refs: ["russell2009", "porcheron2013"],
  },
  skin: {
    how: "Each region is converted to CIELAB; pixels darker than their local neighbourhood (pigmentation) or redder than the regional median (erythema) are flagged. Coverage is the flagged share; texture is high-frequency luminance variation.",
    norm: "Lower coverage and more even colour distribution are perceived as younger and healthier.",
    refs: ["fink2006", "stephen2011"],
  },
  canthal: {
    how: "Angle of the line from inner to outer eye corner, after correcting head roll.",
    norm: "A mildly positive tilt (+2° to +6°) is most often rated attractive.",
    refs: ["rhee2012"],
  },
  lips: {
    how: "Upper vs. lower vermilion height, and total lip height relative to mouth width.",
    norm: "An upper:lower ratio near 1:2 was rated most attractive in female faces.",
    refs: ["popenko2017"],
  },
  brows: {
    how: "Brow landmarks give arch height (relative to brow length), peak position, tilt, thickness and brow-to-lid distance.",
    norm: "Brows strongly shape expression and recognition; lower, straighter brows read as more masculine.",
    refs: ["sadr2003", "perrett1998"],
  },
  impression: {
    how: "Trait indices combine shape cues identified in face-perception research (e.g. mouth-corner tilt and symmetry for trust, fWHR and jaw width for dominance).",
    norm: "These are perception estimates, not personality measures.",
    refs: ["willis2006", "oosterhof2008", "reis1990"],
  },
  body: {
    how: "33 pose landmarks plus a person-segmentation mask; widths are measured from the silhouette at shoulder, natural waist and hip levels.",
    norm: "Shoulder-to-waist ≈ 1.4–1.6 (men) and waist-to-hip ≈ 0.7 (women) are commonly preferred; WHO waist-to-hip health thresholds 0.90 (men) / 0.85 (women).",
    refs: ["sell2017", "singh1993", "who2008"],
  },
  posture: {
    how: "Frontal-plane tilt of the shoulder and pelvis lines, and lateral head offset from the body midline.",
    norm: "Ideal standing alignment has level shoulders and pelvis (≈0°) with the head centred.",
    refs: ["kendall2005"],
  },
  composition: {
    how: "BMI from your height and weight; body-fat estimated with the Deurenberg equation.",
    norm: "BMI 18.5–24.9 is the WHO healthy range; the estimate has a standard error of roughly ±4% body fat.",
    refs: ["deurenberg1991", "who2008"],
  },
};

export const LIMITATIONS = [
  "A single 2D photo cannot capture depth (e.g. chin projection, nasal profile). Lens distance distorts proportions — selfies taken closer than ~1 m widen the nose and narrow the face.",
  "Expression, head rotation and lighting affect landmark placement and skin readings. Use neutral expression, even front lighting, and the same set-up for each check-in.",
  "Attractiveness research is mostly based on Western, young-adult rater samples; norms vary across cultures and ethnicities.",
  "Scores are estimates for tracking change over time, not medical diagnoses. Consult a board-certified dermatologist or physician before starting prescription or clinical treatments.",
];
