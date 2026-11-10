# Landing page: Arabic copy (UAE + KSA)

Review document for the Arabic landing page. This is transcreation, not translation: each line was rewritten to do the same job (persuade, explain, reassure or disclaim) for a Gulf reader, while keeping every fact, number, hedge and disclaimer.

- **Source:** `app/src/pages/Landing.tsx`, `LandingSections.tsx`, `LandingSections2.tsx`
- **Strings file:** `app/src/i18n/ar.json` (457 entries, keyed by the exact English string)
- **Not covered:** strings that come from other modules. These are `SCORE_LABEL` (lib/report), `GradeBadge`’s “Evidence {grade}” (components/ui), feature-library titles and definitions (lib/library), the sample persona’s data (name, ethnicity, location, reviewer note) and reference titles (lib/science). They need their own pass. The brand name **Facet** stays Latin.

## 1. Style guide

### Voice
A smart friend who knows the science: warm, confident, short sentences, no hype. We explain and invite; we never pressure or shame. Persuasive lines use everyday Gulf speech. Disclaimers, legal, medical and privacy lines move toward light MSA (ليست، لم، يُشترط), because Gulf readers expect that register for anything binding.

### Dialect: “white” Khaleeji
Every choice was checked for being understood, and sounding natural, in both Riyadh/Jeddah and Dubai/Abu Dhabi.

| Use | Avoid | Why |
|---|---|---|
| ليش، إيه، بس، مو، لين، كم صورة، يلا، أول شي | وش (Saudi) / شو (Emirati), مب (Emirati), شقد/قد إيش, حق (possessive) | Words shared by both markets. Where Saudi and Emirati differ, we rephrased with «اللي» or «من وين». |
| جوال، شغل، الجنب، شفايف، الشهور، الطلّة، إطلالة، الماكروز، كوتش، تقسيمة | هاتف، عمل (in casual lines), Egyptian/Levantine forms (عايز، هلق، كتير) | Everyday Gulf vocabulary, including Gulf gym and beauty slang. |
| Gulf future بـ (بيتّضح), passive ين- (ينراجع، تنحذف، ينرسل) | Stiff MSA passives in marketing lines | This is how Gulf speakers form the future and the passive. |
| Latin for brands, regulators, methods and citations: MediaPipe, InBody, DEXA, DHA/MOH, CIELAB, Fitzpatrick, BMI, fWHR, IQ, grade letters A–C, author names | Arabic transliteration of these | Readers recognise and search them in Latin. |

### Gender (Arabic forces it; the English is neutral)
We avoided gender marking rather than defaulting to the masculine. The tools we used:
1. **Possessive -ك**: unmarked in unvowelled script (تحليلك، خطتك، وجهك), so it reads for both.
2. **Verbal nouns for buttons and lists**: فتح التطبيق، رفع الصور، استكشاف…، متابعة تقدّمك. This is also standard Arabic UI style.
3. **“Let’s” / first person**: يلا نبدأ التحليل; FAQ and chat questions in the first person (أحتاج، أقدر ألغي، من وين أبدأ؟).
4. **Third-person subjects**: يبان لك، تتضح لك، القرار بيدك، بيتّضح لك, ما يحتاج جراحة.
5. **Adjectives attached to a noun, not the person**: اللي شكلهم جذاب (agrees with شكل), so we never need جذاب/جذابة for the reader.
6. **Profile values**: العلاجات في العيادة واردة instead of منفتح/منفتحة.

Lines that are inherently gendered in the source (male/female axis, “typical for men”, beard) keep the English meaning. Plurals for groups (الموظفين، المعلمين، المتهمين) are the standard generic plural and include women.

### Cultural notes
- **Dating:** we use «التعارف» (how Gulf users refer to meeting a partner, as in dating apps), not «المواعدة». The Walster “matched dance” becomes «حفلة تعارف» without changing the finding.
- **Alcohol:** “drinking” is a real intake field, so it is rendered plainly as «الكحول». The founder should decide whether KSA copy keeps this field (see report).
- **Skin:** “even” is always «موحّد / متجانس اللون», never «فاتح / تفتيح». CLAIMS bans lightening language, and we added «يحافظ على لون بشرتك» wording where the English says “keep your skin tone”.
- **No body-shaming:** «أرشق» rather than «أنحف»; «أقل حدّة» rather than «أنعم» for a man’s face («ناعم» said of a man is a slur in Gulf slang); «المجعّد الملفوف» rather than «خشن» for coiled hair.
- **Arrows** flip for RTL (→ becomes ←). Quotes become «».

### Numbers
Western digits 0–9 throughout. Ranges keep the en dash (5–10%, 1.5–3 m, ±4–5). Currency amounts put the number first («199 درهم»). Tip money stays in **USD** («1,261 دولار أمريكي»), because CLAIMS forbids converting it. Where the English writes a number as a word (“three phases”, “Six regions”), the Arabic also uses a word.

## 2. Glossary (EN → AR)

| English | Arabic | Note |
|---|---|---|
| analysis | تحليل | Also replaces “scan” («فحص» sounds medical). |
| measurement | قياس (pl. قياسات) | |
| assessment | تقييم | |
| marker | مؤشر | |
| score | درجة | Kept separate from “results” (نتائج) and “grade”. |
| evidence grade / evidence-graded | قوة الدليل / مصنّف حسب قوة الدليل (A–C) | Letters stay Latin. Badge: «الدليل A». |
| science-referenced / science-backed | بمراجع علمية / مدعوم بالعلم | Never «مثبت علميًا» (scientifically proven). |
| plan | خطة | |
| protocol | بروتوكول | Familiar from Gulf skincare and fitness content. |
| reviewer | المراجِع / مراجِعك | Kasra so it isn’t read as «مراجَع» (references). |
| reviewed by a human / person | يراجعه إنسان | |
| expert review | مراجعة مختص | Never «طبيب» (no clinician implied). |
| before / after | قبل / بعد | Captions: «صور «بعد»». |
| AI illustration | صورة تخيّلية بالذكاء الاصطناعي | «تخيّلية» (imagined) makes clear it is not a result. |
| visual (12-month visual) | تصوّر (تصوّرك بعد 12 شهر) | |
| projection / projected | تصوّر / متوقّع | |
| synthetic person / sample | شخص غير حقيقي / نموذج غير حقيقي | Clearer than «اصطناعي». |
| not medical advice | ليست استشارة طبية | MSA-leaning disclaimer. |
| body fat | نسبة الدهون (في الجسم) | The term Gulf users search. Error band: «نقاط مئوية». |
| body composition | تكوين الجسم | |
| posture | وضعية الجسم | |
| skin / skin type (Fitzpatrick) | البشرة / فئة البشرة (Fitzpatrick) | «نوع البشرة» means oily/dry in the Gulf. |
| canthal tilt | ميلان العين (canthal tilt) | |
| fWHR | نسبة عرض الوجه إلى طوله (fWHR) | |
| facial thirds | أثلاث الوجه | |
| symmetry / harmony | التماثل / التناسق | |
| landmarks | النقاط المرجعية | |
| membership | الاشتراك | |
| check-in | متابعة (شهرية / دورية) | |
| follow-up (with a specialist) | متابعة / موعد متابعة | |
| coming soon | قريبًا | |
| transformation | تحوّل / نقلة | |
| glow up | أحسن نسخة منك | Product name “Glow-Up Report” stays «تقرير Glow-Up». |
| personalised | مخصّص لك / على مقاسك | |

## 3. Copy by section

Columns: the exact English key, the Arabic value, and one line on why. `template` means placeholders; `composite` means a study heading (see the notes at the end). Strings used in several places are listed once, where they first appear.

### Navigation and footer

_Landing.tsx: nav bar, footer._

| English | Arabic | Why it’s written this way |
|---|---|---|
| Why glow up | <span dir="rtl">ليش المظهر يفرق؟</span> | Nav to the studies section. “Glow up” has no clean Arabic; the link’s job is “why looks matter”, so we say that. “يفرق” is shared Saudi/Emirati. |
| How it works | <span dir="rtl">كيف يشتغل؟</span> | Natural Gulf question form; used for nav, hero button and kicker. |
| Pricing | <span dir="rtl">الأسعار</span> | Standard. |
| FAQ | <span dir="rtl">الأسئلة الشائعة</span> | Standard Arabic label; Gulf users don’t use an acronym here. |
| Open app | <span dir="rtl">فتح التطبيق</span> | Verbal noun (masdar) for buttons: the Arabic UI convention, and it avoids a male/female imperative. |
| Methodology | <span dir="rtl">المنهجية العلمية</span> | Adding “العلمية” tells the reader what kind of method this is, which the English link only implies. |
| Not medical advice · Product imagery uses a synthetic person · After images are AI illustrations, not results · © {0} `template` | <span dir="rtl">ليست استشارة طبية · صور المنتج لشخص غير حقيقي · صور «بعد» تخيّلية بالذكاء الاصطناعي وليست نتائج فعلية · © {0}</span> | Legal footer, so MSA-leaning (“ليست”). “شخص غير حقيقي” is the plainest way to say synthetic. {0} = year. |

### Hero

_Landing.tsx › Hero._

| English | Arabic | Why it’s written this way |
|---|---|---|
| Facial & body analysis | <span dir="rtl">تحليل الوجه والجسم</span> | Eyebrow label. Code has &amp;; the key uses the rendered “&”. |
| See where you stand, | <span dir="rtl">موقعك الحقيقي،</span> | Line 1 of the H1. “اعرف/شوف” would force a male or female imperative, so the line becomes a noun phrase: “your real position”. |
| measured, not guessed. | <span dir="rtl">بالقياس، مو بالتخمين.</span> | Line 2 keeps the contrast and rhythm. “مو” is the widest-understood Gulf negator (Emirati “مب” would sound local). |
| A science-referenced analysis of your face and body, and a 12-month plan built from it. | <span dir="rtl">تحليل لوجهك وجسمك مبني على مراجع علمية، ومنه نطلع لك خطة لمدة 12 شهر.</span> | “Referenced”, not “proven” (مثبت). “نطلع لك” is a warm Gulf way to say “we build you”. “12 شهر” is the spoken Gulf form used in ads. |
| Start my scan | <span dir="rtl">يلا نبدأ التحليل</span> | Main CTA (×3). “Let’s start the analysis” works for any gender and is warmer than a bare imperative. “فحص” (scan) sounds medical, so we use “تحليل”. |
| Science-referenced | <span dir="rtl">بمراجع علمية</span> | Trust badge. Matches “referenced”, not “proven”. |
| Every step evidence-graded | <span dir="rtl">كل خطوة مصنّفة حسب قوة الدليل</span> | Glossary: evidence-graded → مصنّف حسب قوة الدليل. |
| Human-reviewed | <span dir="rtl">يراجعه إنسان</span> | “إنسان” makes the human-versus-AI contrast obvious. |
| Before you see it | <span dir="rtl">قبل ما يوصلك</span> | “Before it reaches you” avoids a gendered verb (تشوف/تشوفين). |
| Non-surgical | <span dir="rtl">بدون جراحة</span> | The phrase Gulf clinics use. |
| A habit-based 12-month plan | <span dir="rtl">خطة 12 شهر مبنية على العادات</span> | Literal is fine here. |
| Synthetic sample person | <span dir="rtl">نموذج: شخص غير حقيقي</span> | Disclaimer caption. “اصطناعي” reads as a technical term; “غير حقيقي” is unmistakable. |

### Life-changing transformations

_LandingSections2.tsx › LifeChanging._

| English | Arabic | Why it’s written this way |
|---|---|---|
| New approach | <span dir="rtl">أسلوب جديد</span> | Kicker. “أسلوب” is everyday Gulf; “نهج” is stiffer. |
| Life-changing | <span dir="rtl">نقلة</span> | H2 dark part. Read together: “نقلة تغيّر حياتك.” “نقلة” is the Gulf word for a big positive change. |
| transformations. | <span dir="rtl">تغيّر حياتك.</span> | H2 muted part. Arabic word order puts the noun first, so the emphasis moves to “نقلة”. The claim is no stronger than the English. |
| Research consistently links how people look with how they are treated, at work, in love and in daily life. | <span dir="rtl">الأبحاث تربط باستمرار بين شكل الشخص وطريقة تعامل الناس معه، في الشغل، وفي العلاقات العاطفية، وفي الحياة اليومية.</span> | “تربط” (links) keeps it a correlation, not a proof. “في الحب” sounds like a song lyric; “العلاقات العاطفية” is modest and still exact. |
| More career opportunities | <span dir="rtl">فرص وظيفية أكثر</span> | Benefit list item (cited hosoda2003). |
| A stronger first impression | <span dir="rtl">انطباع أول أقوى</span> | Direct; common phrase. |
| A better dating life | <span dir="rtl">فرص أحسن في التعارف</span> | “مواعدة” sounds Western and can feel off in KSA. “التعارف” is how Gulf users refer to meeting a partner (as in dating apps). We did not add marriage, which the study doesn’t cover. |
| A higher quality of life | <span dir="rtl">جودة حياة أعلى</span> | “جودة الحياة” also echoes the Saudi Vision 2030 programme name, so it reads as familiar. |
| Before (synthetic sample) | <span dir="rtl">قبل (نموذج غير حقيقي)</span> | Alt text, kept because it carries the disclaimer. |
| AI illustration of the 12-month plan (synthetic sample) | <span dir="rtl">صورة تخيّلية بالذكاء الاصطناعي لنهاية خطة الـ12 شهر (نموذج غير حقيقي)</span> | Alt text. “تخيّلية” (imagined) makes it clear this is not a result. |
| Body before (synthetic sample) | <span dir="rtl">الجسم قبل (نموذج غير حقيقي)</span> | Alt text. |
| AI illustration of the body after 12 months (synthetic sample) | <span dir="rtl">صورة تخيّلية بالذكاء الاصطناعي للجسم بعد 12 شهر (نموذج غير حقيقي)</span> | Alt text. |
| Before · 12-month projection (AI illustration, synthetic person) | <span dir="rtl">قبل · تصوّر بعد 12 شهر (صورة تخيّلية بالذكاء الاصطناعي، شخص غير حقيقي)</span> | Caption under the before/after pair. Both disclaimers are kept in full. |

### Studies: “your looks influence almost everything”

_LandingSections.tsx › LooksInfluence. Study card headings render as `<span>{muted}</span> {dark}`. Words like “Higher”, “More” and “Even” recur with different nouns, and Arabic puts the adjective after the noun, so a standalone fragment can’t be translated once. These keys are therefore the full visible heading (muted + space + dark). **In the Arabic, the first word is the muted part and the rest is the dark part.** Split on the first space. Body text is each paper’s own finding (docs/CLAIMS.md), with no qualifiers dropped._

| English | Arabic | Why it’s written this way |
|---|---|---|
| Studies show your looks influence almost everything, | <span dir="rtl">الدراسات تقول إن شكلك يؤثر على كل شي تقريبًا،</span> | Big heading, part 1 (the code has a trailing space before the span). “تقول” rather than “تثبت” (prove). “تقريبًا” is kept. |
| from your career to your romantic life. | <span dir="rtl">من شغلك لين حياتك العاطفية.</span> | Part 2 (muted). “لين” (until) is used in both Saudi and Emirati speech. “حياتك العاطفية” is acceptable and not explicit. |
| Finances | <span dir="rtl">المال</span> | Tab. |
| Dating | <span dir="rtl">التعارف</span> | Tab. See the dating note above. |
| Socialising | <span dir="rtl">الحياة الاجتماعية</span> | Tab. |
| Health | <span dir="rtl">الصحة</span> | Tab. |
| Education | <span dir="rtl">التعليم</span> | Tab. |
| Law | <span dir="rtl">القضاء</span> | Tab. The cards are about courts, sentences and bail, so “القضاء” (the judiciary) fits better than “القانون”. |
| Influence | <span dir="rtl">التأثير</span> | Tab. |
| Happiness | <span dir="rtl">السعادة</span> | Tab. |
| Higher pay `composite` | <span dir="rtl">دخل أعلى</span> | hamermesh1994 measured earnings, so “دخل” is more exact than “راتب” (salary). |
| Workers rated plain earned 5–10% less than average-looking colleagues, who earned less again than those rated good-looking. | <span dir="rtl">الموظفين اللي انقيّم شكلهم أقل من المتوسط كسبوا أقل بـ5–10% من زملائهم متوسطي الشكل، وهؤلاء بدورهم كسبوا أقل من اللي انقيّم شكلهم حلو.</span> | In Gulf speech “عادي” means average, so “plain” becomes “below average”. The three tiers and 5–10% are kept exactly. “حلو” works for any gender. |
| Easier hiring `composite` | <span dir="rtl">توظيف أسهل</span> | Direct; nothing to adapt. |
| Across experiments, attractive candidates were rated more favourably in hiring, performance and promotion decisions. | <span dir="rtl">في عدة تجارب، المرشحين اللي شكلهم جذاب انقيّموا بشكل أفضل في قرارات التوظيف والأداء والترقية.</span> | “اللي شكلهم جذاب”: the adjective goes with “شكل”, so it stays gender-neutral. “In experiments” is kept. |
| Bigger tips `composite` | <span dir="rtl">بقشيش أكبر</span> | “بقشيش” is understood across the Gulf. |
| Restaurant servers rated attractive earned about $1,261 more a year in tips. | <span dir="rtl">العاملين في خدمة المطاعم اللي انقيّم شكلهم جذاب كسبوا تقريبًا 1,261 دولار أمريكي زيادة بالسنة من البقشيش.</span> | USD is kept, as CLAIMS requires (no conversion to AED or SAR). “About” becomes “تقريبًا”. “1,261 دولار أمريكي” avoids $ jumping position in right-to-left text. |
| More confidence `composite` | <span dir="rtl">ثقة أكبر</span> | Direct; nothing to adapt. |
| In a lab job market, attractive workers were more confident and employers expected more of them. | <span dir="rtl">في سوق عمل تجريبي داخل المختبر، الموظفين أصحاب الشكل الجذاب كانوا أكثر ثقة، وأصحاب العمل توقعوا منهم أكثر.</span> | “Lab” is kept so it isn’t read as a real-world finding. |
| First dates `composite` | <span dir="rtl">اللقاء الأول</span> | Direct; nothing to adapt. |
| At a matched dance, a partner’s looks were the strongest predictor of wanting to see them again. | <span dir="rtl">في حفلة تعارف رُتّب فيها الحضور في ثنائيات، كان شكل الطرف الثاني أقوى مؤشر على الرغبة في لقائه مرة ثانية.</span> | Cultural choice: “dance” becomes “حفلة تعارف” (paired-up social event). The finding is unchanged; the founder can put back “حفلة رقص” if wanted. “الطرف الثاني” is gender-neutral. |
| Speed dating `composite` | <span dir="rtl">تعارف سريع</span> | Muted “تعارف”, dark “سريع”. Avoids “مواعدة سريعة”, which reads as a Western term. |
| Looks predicted romantic interest just as strongly for women as for men. | <span dir="rtl">الشكل تنبّأ بالاهتمام العاطفي عند النساء بنفس قوته عند الرجال.</span> | Exact. “Just as strongly” → “بنفس قوته”. |
| Second looks `composite` | <span dir="rtl">معاملة أفضل</span> | Transcreated. The pun on “second looks” (a second glance) has no Arabic equivalent, so the heading says what the card says: better treatment. |
| Attractive adults were judged and treated more positively across dozens of studies. | <span dir="rtl">عبر عشرات الدراسات، البالغين أصحاب الشكل الجذاب انحكم عليهم وتعامل الناس معهم بإيجابية أكبر.</span> | “Dozens” → “عشرات”, not “hundreds” or “all”. |
| Warmer assumptions `composite` | <span dir="rtl">ظنّ أحسن</span> | Draws on the Gulf idiom “حسن الظن” (giving the benefit of the doubt). Muted “ظنّ”, dark “أحسن”. |
| People assumed attractive strangers had better personalities and happier lives. | <span dir="rtl">الناس افترضوا إن الغرباء أصحاب الشكل الجذاب شخصياتهم أحسن وحياتهم أسعد.</span> | “Assumed” stays a perception, not a fact. |
| More social credit `composite` | <span dir="rtl">رصيد اجتماعي أكبر</span> | “رصيد” (balance/credit) carries the same banking metaphor. |
| The halo was strongest for judgements of social competence, and weak for honesty or kindness. | <span dir="rtl">«تأثير الهالة» كان أقوى ما يكون في الحكم على المهارات الاجتماعية، وضعيف في الحكم على الأمانة أو الطيبة.</span> | “تأثير الهالة” is the established Arabic term for the halo effect. The “weak for honesty” limit is kept. |
| Faster judgements `composite` | <span dir="rtl">أحكام أسرع</span> | Direct; nothing to adapt. |
| A tenth of a second of seeing a face was enough to form trait impressions. | <span dir="rtl">عُشر ثانية من رؤية الوجه كان كافي عشان يتكوّن انطباع عن صفات الشخص.</span> | Exact (100 ms). |
| Leaner faces `composite` | <span dir="rtl">وجه أرشق</span> | “أرشق” (slimmer, trimmer) is positive. “أنحف” or “ضعيف” could read as body-shaming. |
| Perceived facial fat tracks BMI and is linked to how healthy a face looks. | <span dir="rtl">الدهون اللي تبان في الوجه تمشي مع مؤشر كتلة الجسم (BMI)، ومرتبطة بمدى ما يبان الوجه صحي.</span> | “Perceived” → “اللي تبان” (what shows). “Linked”, not “causes”. BMI is kept in English in brackets, as Gulf users search it. |
| Even skin `composite` | <span dir="rtl">بشرة موحّدة</span> | “Even” means uniform colour. We never use “فاتحة” or “تفتيح”, which would imply skin lightening and is banned in CLAIMS. |
| An even skin tone made faces look younger and healthier. | <span dir="rtl">لون البشرة الموحّد خلّى الوجوه تبان أصغر وأصح.</span> | Same rule: uniform, never lighter. |
| Rested eyes `composite` | <span dir="rtl">عيون مرتاحة</span> | Direct; nothing to adapt. |
| After sleep loss, faces looked more tired, with hanging lids and darker circles. | <span dir="rtl">بعد قلة النوم، الوجوه بانت أتعب، مع جفون مرتخية وهالات أغمق.</span> | “هالات” is the standard Gulf beauty word for dark circles. |
| Higher expectations `composite` | <span dir="rtl">توقعات أعلى</span> | Direct; nothing to adapt. |
| Teachers tended to judge attractive students as brighter and expect more of them. | <span dir="rtl">المعلمين كانوا يميلون يحكمون على الطلاب أصحاب الشكل الجذاب إنهم أذكى، ويتوقعون منهم أكثر.</span> | “Tended to” → “يميلون”. The hedge is kept. |
| Same report card `composite` | <span dir="rtl">نفس الشهادة</span> | In Gulf schools a report card is “الشهادة”. |
| Given identical report cards, teachers expected the attractive child to have a higher IQ. | <span dir="rtl">مع إن الشهادات كانت متطابقة، كان المعلمين يتوقعون إن الطفل صاحب الشكل الجذاب معدل ذكائه (IQ) أعلى.</span> | IQ stays in brackets because it is used as-is in the Gulf. |
| Lighter sentences `composite` | <span dir="rtl">أحكام أخف</span> | Direct; nothing to adapt. |
| In real criminal cases, more attractive defendants received lighter sentences. | <span dir="rtl">في قضايا جنائية حقيقية، المتهمين الأكثر جاذبية أخذوا أحكام أخف.</span> | “Real cases” is kept. It separates this study from the mock-jury one. |
| Lower bail `composite` | <span dir="rtl">كفالة أقل</span> | Direct; nothing to adapt. |
| In real misdemeanour cases, judges set lower bail and fines for more attractive defendants. | <span dir="rtl">في قضايا جنح حقيقية، القضاة حددوا كفالات وغرامات أقل للمتهمين الأكثر جاذبية.</span> | “جنح” is the legal term for misdemeanours. |
| Fewer convictions `composite` | <span dir="rtl">إدانات أقل</span> | Direct; nothing to adapt. |
| Mock jurors were somewhat less likely to convict attractive defendants; the effect was small. | <span dir="rtl">في محاكمات تمثيلية، المحلّفين كانوا أقل ميلًا بشوي لإدانة المتهمين أصحاب الشكل الجذاب؛ والتأثير كان صغير.</span> | There are no juries in the Gulf, so “محاكمات تمثيلية” (staged trials) makes the setting clear. Both hedges (“somewhat”, “small”) are kept. |
| More persuasive `composite` | <span dir="rtl">إقناع أقوى</span> | Direct; nothing to adapt. |
| Attractive communicators got more people to sign a petition. | <span dir="rtl">المتحدثين أصحاب الشكل الجذاب قدروا يقنعون ناس أكثر يوقّعون على عريضة.</span> | Exact. |
| Faces win votes `composite` | <span dir="rtl">الوجوه تكسب الأصوات</span> | Muted “الوجوه”, dark “تكسب الأصوات”. Kept as faces, not looks: CLAIMS says these are competence judgements. |
| Competence judged from brief looks at candidates’ faces predicted about 70% of US Senate races. | <span dir="rtl">الحكم على كفاءة المرشحين من نظرة سريعة لوجوههم توقّع نتيجة حوالي 70% من سباقات مجلس الشيوخ الأمريكي.</span> | “Competence” is kept up front, so this isn’t presented as an attractiveness effect. “About 70%” → “حوالي 70%”. |
| Even children `composite` | <span dir="rtl">حتى الأطفال</span> | Muted “حتى”, dark “الأطفال”. The emphasis lands the same way as in English. |
| Children picking a face to captain a ship chose the winners of French run-offs about 71% of the time. | <span dir="rtl">أطفال طُلب منهم يختارون وجه «قبطان» لسفينة، واختاروا الفائزين في جولات الإعادة في الانتخابات الفرنسية في حوالي 71% من المرات.</span> | “Run-offs” → “جولات الإعادة”, adding “في الانتخابات” so Gulf readers know what they are. |
| Higher life satisfaction `composite` | <span dir="rtl">رضا أعلى عن الحياة</span> | Muted “رضا”, dark “أعلى عن الحياة”. |
| Better-looking people reported higher life satisfaction, partly through better economic outcomes. | <span dir="rtl">الأشخاص الأحلى شكلًا قالوا إن رضاهم عن حياتهم أعلى، وجزء من السبب أوضاعهم الاقتصادية الأفضل.</span> | “Reported” → “قالوا” (self-report). “Partly” is kept. |
| Self presentation `composite` | <span dir="rtl">العناية بالطلّة</span> | Transcreated. “الطلّة” is the everyday Gulf word for how you present yourself. Muted “العناية”, dark “بالطلّة”. |
| Looks rated by others were only weakly tied to happiness; grooming and presentation carried part of the link. | <span dir="rtl">الشكل حسب تقييم الآخرين كان مرتبط بالسعادة بشكل ضعيف بس؛ والعناية بالنفس وطريقة الظهور فسّرت جزء من هالعلاقة.</span> | “Only weakly” → “بشكل ضعيف بس”. This hedge matters most of all and is kept. |
| Averages from published studies, mostly in Western samples. They describe how people tend to be judged, not what anyone is worth. | <span dir="rtl">هذي متوسطات من دراسات منشورة، أغلبها على عيّنات غربية. توصف كيف الناس عادةً ينحكم عليهم، مو قيمة أي شخص.</span> | Footnote. The anti-body-shaming line is kept word for word in meaning. |
| {0} et al. ({1}). {2}. `template` | <span dir="rtl">{0} et al. ({1}). {2}.</span> | Citation line (Source component). Kept in Latin and left-to-right; wrap in dir="ltr". Mixing Arabic “وآخرون” into a Latin citation breaks bidi layout. Author and journal names stay Latin. |

### A new way to glow up

_Landing.tsx › BetterWay / Rail._

| English | Arabic | Why it’s written this way |
|---|---|---|
| Personalised analysis | <span dir="rtl">تحليل مخصّص لك</span> | Kicker (×3). |
| A new way to | <span dir="rtl">طريقة جديدة</span> | H2 dark part. |
| glow up. | <span dir="rtl">لأحسن نسخة منك.</span> | H2 muted part. “Glow up” becomes “the best version of you”, an idea Gulf audiences already use. Gender-neutral (منك). |
| Most advice is one-size-fits-all and starts with a procedure. We start with your measurements, your goals and the evidence. | <span dir="rtl">أغلب النصايح «مقاس واحد للكل» وتبدأ بإجراء تجميلي. إحنا نبدأ من قياساتك وأهدافك والأدلة العلمية.</span> | “Procedure” → “إجراء تجميلي”, the meaning from context. “إحنا” is used in both Saudi and Emirati speech. |
| The old way | <span dir="rtl">الطريقة القديمة</span> | Direct; nothing to adapt. |
| The new way | <span dir="rtl">الطريقة الجديدة</span> | Direct; nothing to adapt. |
| Step {0} `template` | <span dir="rtl">الخطوة {0}</span> | Rail step label. |
| Fixate on one feature | <span dir="rtl">التركيز على ملمح واحد بس</span> | Old-way list in verbal-noun form, so it is gender-neutral. |
| Visit a clinic | <span dir="rtl">زيارة عيادة</span> | Direct; nothing to adapt. |
| No assessment | <span dir="rtl">بدون تقييم</span> | Direct; nothing to adapt. |
| Procedures first | <span dir="rtl">الإجراءات أول شي</span> | “أول شي” is natural Gulf speech. |
| Results that don't fit you | <span dir="rtl">نتائج ما تناسبك</span> | Direct; nothing to adapt. |
| Look at your face and body as a whole | <span dir="rtl">نظرة شاملة لوجهك وجسمك مع بعض</span> | Noun phrase, not imperative. |
| Your analysis, reviewed by a person | <span dir="rtl">تحليلك، يراجعه إنسان</span> | Direct; nothing to adapt. |
| See your 12-month visual | <span dir="rtl">تصوّرك بعد 12 شهر</span> | Glossary: visual → تصوّر. “See” is dropped to avoid a gendered verb. |
| Your personalised protocol | <span dir="rtl">بروتوكولك المخصّص</span> | “بروتوكول” is a familiar word in Gulf skincare and fitness content. |
| Track real change | <span dir="rtl">تتبّع التغيّر الحقيقي</span> | Without diacritics “تتبّع” reads as a verbal noun, so it is neutral. |

### Your complete facial analysis

_LandingSections.tsx › CompleteAnalysis (glass data cards)._

| English | Arabic | Why it’s written this way |
|---|---|---|
| Your complete | <span dir="rtl">تحليلك الشامل</span> | H2 dark part. Note: CLAIMS lists “complete analysis” under Don’t say (see weak strings). |
| facial analysis | <span dir="rtl">لملامح الوجه</span> | H2 muted part. Read together: “تحليلك الشامل لملامح الوجه”. |
| Every face is different. We measure 48 markers across face, skin and body and explain what each one means for you. | <span dir="rtl">ما في وجه يشبه الثاني. نقيس 48 مؤشر في الوجه والبشرة والجسم، ونشرح لك معنى كل واحد منها بالنسبة لك.</span> | “No face is like another” is idiomatic. 48 is kept. “مؤشر” is used for marker. |
| Synthetic sample client | <span dir="rtl">نموذج لشخص غير حقيقي</span> | Alt text. “عميل” is masculine, so we avoid it. |
| Shape · contrast | <span dir="rtl">الشكل · التباين</span> | Direct; nothing to adapt. |
| Feature map from feminine to masculine and subtle to bold | <span dir="rtl">خريطة الملامح من أنثوي إلى رجولي، ومن هادئ إلى بارز</span> | aria-label. “رجولي” rather than “ذكوري”, which carries a patriarchal meaning. |
| Feminine | <span dir="rtl">أنثوي</span> | Direct; nothing to adapt. |
| Masculine | <span dir="rtl">رجولي</span> | See above. |
| Shape reads softer than typical for men; strong feature contrast. | <span dir="rtl">شكل الوجه أقل حدّة من المعتاد عند الرجال؛ وتباين الملامح قوي.</span> | Sensitive: in Gulf slang “ناعم” said of a man reads as effeminate. “أقل حدّة” (less angular) is the neutral, accurate geometry. |
| Brow thickness | <span dir="rtl">سماكة الحاجب</span> | Direct; nothing to adapt. |
| Fine | <span dir="rtl">رفيع</span> | Brow scale. |
| Even | <span dir="rtl">معتدل</span> | Brow scale middle band (thickness). Only used here as a standalone string. |
| Full | <span dir="rtl">ممتلئ</span> | Shared by the brow and lip scales. “حواجب ممتلئة” and “شفايف ممتلئة” are both normal Gulf beauty vocabulary. |
| {0}% of brow length · even thickness `template` | <span dir="rtl">{0}% من طول الحاجب · سماكة معتدلة</span> | Caption. Matches the “Even” band label. |
| Lip fullness | <span dir="rtl">امتلاء الشفايف</span> | “شفايف” is the Gulf plural. |
| Thin | <span dir="rtl">رفيع</span> | Lip scale. |
| Medium | <span dir="rtl">متوسط</span> | Direct; nothing to adapt. |
| Lip height ÷ mouth width | <span dir="rtl">ارتفاع الشفايف ÷ عرض الفم</span> | Direct; nothing to adapt. |
| Skin type | <span dir="rtl">فئة البشرة</span> | This is a Fitzpatrick phototype. In the Gulf “نوع البشرة” means oily/dry/combination, so it would mislead. “فئة” avoids that. |
| Fitzpatrick type {0} · skin score {1}/100 `template` | <span dir="rtl">فئة Fitzpatrick {0} · درجة البشرة {1}/100</span> | Fitzpatrick stays Latin (the name used in clinics). Score → درجة. |
| Facial thirds | <span dir="rtl">أثلاث الوجه</span> | Glossary term. |
| Middle | <span dir="rtl">الأوسط</span> | Direct; nothing to adapt. |
| Lower | <span dir="rtl">السفلي</span> | Direct; nothing to adapt. |
| Middle ÷ lower {0} · classical canon 1.00 `template` | <span dir="rtl">الأوسط ÷ السفلي {0} · النسبة الكلاسيكية 1.00</span> | “Canon” → “النسبة الكلاسيكية”, which is clearer than “القانون”. |
| Symmetry | <span dir="rtl">التماثل</span> | Symmetry → تماثل. Harmony → تناسق (kept separate). |
| Asymmetrical | <span dir="rtl">غير متماثل</span> | Direct; nothing to adapt. |
| Symmetrical | <span dir="rtl">متماثل</span> | Direct; nothing to adapt. |
| You {0}/100 · 100 = perfectly mirrored `template` | <span dir="rtl">درجتك {0}/100 · 100 = تماثل تام</span> | “You” → “درجتك” (your score) to avoid gendered “أنت/أنتِ”. |
| Real measurements of a synthetic sample person | <span dir="rtl">قياسات فعلية على صورة شخص غير حقيقي</span> | “فعلية” instead of a second “حقيقية”, so the two “real/not real” words don’t clash. |

### Taking into account your…

_LandingSections.tsx › TakingIntoAccount._

| English | Arabic | Why it’s written this way |
|---|---|---|
| Taking into account | <span dir="rtl">ناخذ بالحسبان</span> | H2 dark part. “We take into account” is the natural Gulf phrasing. |
| your… | <span dir="rtl">كل ما يخصّك…</span> | H2 muted part. Arabic needs a noun after “your”, so “everything that’s yours”. |
| Background | <span dir="rtl">الأصل</span> | Row title, profile label and kicker. “الأصل” is softer than “العرق” (race). |
| Features are read against published references for your background where they exist; eye-tilt norms, for example, differ by ethnicity. | <span dir="rtl">نقرأ ملامحك مقارنةً بمراجع منشورة تناسب أصلك، إذا كانت متوفرة؛ مثلًا، المعدلات الطبيعية لميلان العين تختلف حسب العِرق.</span> | “Where they exist” → “إذا كانت متوفرة” is kept. “عِرق” is used once, where a technical term is needed. |
| Choices | <span dir="rtl">اختياراتك</span> | Direct; nothing to adapt. |
| You pick the hair and beard. The plan respects what you won’t do, such as no clinical treatments. | <span dir="rtl">الشعر واللحية على اختيارك. والخطة تلتزم بحدودك، مثل رفض أي علاجات في العيادة.</span> | “What you won’t do” → “حدودك” (your limits), which avoids gendered “ما تبي/ما تبين”. |
| Lifestyle | <span dir="rtl">نمط الحياة</span> | Direct; nothing to adapt. |
| Sleep, training, smoking and drinking shape your plan and how fast it moves. | <span dir="rtl">النوم والتمرين والتدخين والكحول، كلها تشكّل خطتك وتحدد سرعة تقدّمها.</span> | “Drinking” means alcohol; the intake asks about it, so it is named plainly. It is a sensitive topic in KSA, so the founder should decide (see report). |
| Sleep | <span dir="rtl">النوم</span> | Direct; nothing to adapt. |
|  h | <span dir="rtl"> ساعات</span> | Unit after the sleep number (leading space is in the code). |
| Training | <span dir="rtl">التمرين</span> | Direct; nothing to adapt. |
|  d/wk | <span dir="rtl"> أيام/أسبوع</span> | Unit (leading space is in the code). |
| Body | <span dir="rtl">الجسم</span> | Direct; nothing to adapt. |
| Height, weight and waist set your calorie targets and body-fat estimate. | <span dir="rtl">طولك ووزنك ومقاس خصرك تحدد أهداف السعرات وتقدير نسبة الدهون في جسمك.</span> | “Estimate” is kept. |
| Region | <span dir="rtl">المنطقة</span> | Direct; nothing to adapt. |
| Prices in AED or SAR, sun protection for Gulf UV, and specialist partners in the UAE and Saudi Arabia (coming soon). | <span dir="rtl">أسعار بالدرهم الإماراتي أو الريال السعودي، وحماية من الشمس تناسب أشعة الخليج فوق البنفسجية، وشركاء متخصصين في الإمارات والسعودية (قريبًا).</span> | Currencies are named in full. “(Coming soon)” is kept. |
| AED | <span dir="rtl">درهم</span> | Currency toggle/chip. Short form for a toggle. |
| SAR | <span dir="rtl">ريال</span> | Currency toggle/chip. |
| EUR | <span dir="rtl">يورو</span> | Currency toggle. |

### You will learn…

_LandingSections.tsx › YouWillLearn._

| English | Arabic | Why it’s written this way |
|---|---|---|
| Informative | <span dir="rtl">معلومات تهمّك</span> | Kicker (×2). “Information that matters to you” is warmer than “تثقيفي”. |
| You will | <span dir="rtl">بيتّضح</span> | H2 dark part. “بتعرف” would be masculine, so we use “it will become clear…” (Gulf future بـ). |
| learn… | <span dir="rtl">لك…</span> | H2 muted part. Read together: “بيتّضح لك…”, gender-neutral. |
| Your scores | <span dir="rtl">درجاتك</span> | Score → درجة, which keeps it apart from “results” (نتائج). |
| Where you stand today and your realistic 12-month potential. | <span dir="rtl">موقعك اليوم، وإمكانيتك الواقعية خلال 12 شهر.</span> | “Realistic” is kept. |
| How each feature reads | <span dir="rtl">قراءة كل ملمح</span> | Direct; nothing to adapt. |
| Feature-by-feature breakdowns, with the research behind each one. | <span dir="rtl">تحليل ملمح ملمح، مع الأبحاث اللي ورا كل واحد.</span> | “ملمح ملمح” is natural Gulf repetition for “one by one”. |
| The harmony of your face | <span dir="rtl">تناسق وجهك</span> | Harmony → تناسق. |
| How your proportions work together, from the front and in profile. | <span dir="rtl">كيف تتناسق نسب وجهك مع بعض، من الأمام ومن الجنب.</span> | “الجنب” is the everyday word for side/profile. |
| Where you can gain most | <span dir="rtl">وين أكبر مجال للتحسّن</span> | Direct; nothing to adapt. |
| What you can improve without surgery, ranked by expected effect. | <span dir="rtl">الجوانب القابلة للتحسين بدون جراحة، مرتّبة حسب التأثير المتوقّع.</span> | Rephrased as a noun phrase to avoid “تحسّنه/تحسّنينه”. “Expected” is kept. |
| The science behind your plan | <span dir="rtl">العلم اللي ورا خطتك</span> | Direct; nothing to adapt. |
| Every step is graded A–C by the strength of its evidence, with the sources linked. | <span dir="rtl">كل خطوة مصنّفة من A إلى C حسب قوة الدليل العلمي، مع روابط المصادر.</span> | Grade letters stay Latin A–C, as on the badges. |
| Evidence A | <span dir="rtl">الدليل A</span> | Badge. |

### Get your personalised plan

_LandingSections.tsx › PersonalPlan (device mock-up)._

| English | Arabic | Why it’s written this way |
|---|---|---|
| Personalised plan | <span dir="rtl">خطة مخصّصة</span> | Kicker. |
| Get your | <span dir="rtl">خطة مفصّلة</span> | H2 dark part. “احصل على” is masculine, so we transcreated to “a plan tailored…”. |
| personalised plan | <span dir="rtl">على مقاسك</span> | H2 muted part. “على مقاسك” (made to your size) is the Gulf tailoring idiom for “personalised”. |
| Understand your features and act on them today, with a plan built for your face, body and life. | <span dir="rtl">من اليوم، ملامحك تصير مفهومة وخطواتك واضحة، بخطة مبنية على وجهك وجسمك وحياتك.</span> | Rebuilt without imperatives (افهم/اشتغل) so it reads the same for everyone. |
| Your expert-reviewed analysis | <span dir="rtl">تحليلك بمراجعة مختص</span> | “مختص”, not “طبيب”: CLAIMS forbids implying a clinician reviewed it. |
| See a realistic 12-month visual | <span dir="rtl">تصوّر واقعي لك بعد 12 شهر</span> | Direct; nothing to adapt. |
| Your step-by-step protocol | <span dir="rtl">بروتوكولك خطوة بخطوة</span> | Direct; nothing to adapt. |
| Track your progress monthly | <span dir="rtl">متابعة تقدّمك كل شهر</span> | Direct; nothing to adapt. |
| {0}’s Protocol `template` | <span dir="rtl">بروتوكول {0}</span> | The Arabic order is reversed: render “بروتوكول” as the muted span, then the name. |
| Page / 04 | <span dir="rtl">صفحة / 04</span> | Direct; nothing to adapt. |
| Sample client before | <span dir="rtl">النموذج قبل</span> | Alt text. |
| AI illustration of the 12-month plan | <span dir="rtl">صورة تخيّلية بالذكاء الاصطناعي لنهاية خطة الـ12 شهر</span> | Alt text. |
| Before | <span dir="rtl">قبل</span> | Direct; nothing to adapt. |
| 12 months · AI illustration | <span dir="rtl">بعد 12 شهر · صورة تخيّلية بالذكاء الاصطناعي</span> | Direct; nothing to adapt. |
| Projected potential | <span dir="rtl">الإمكانية المتوقّعة</span> | Direct; nothing to adapt. |
| This plan is organised around {0} steps across skin, leanness, rest, grooming and body. Score now {1}, projected {2}. `template` | <span dir="rtl">خطوات الخطة: {0}، موزّعة على البشرة، ورشاقة الوجه، والراحة، والعناية بالمظهر، والجسم. الدرجة اليوم {1}، والمتوقّعة {2}.</span> | The number goes after a colon so Arabic number–noun agreement can’t break. “Leanness” → “رشاقة الوجه”, the plan’s facial-leanness area. |
| Projected | <span dir="rtl">المتوقّعة</span> | Radar legend. |
| Now | <span dir="rtl">اليوم</span> | Radar legend and chart axis. “اليوم” is natural and neutral. |
| Client profile | <span dir="rtl">الملف الشخصي</span> | Avoids masculine “العميل”. |
| Sample · synthetic person | <span dir="rtl">نموذج · شخص غير حقيقي</span> | Direct; nothing to adapt. |
| Age | <span dir="rtl">العمر</span> | Direct; nothing to adapt. |
| Gender | <span dir="rtl">الجنس</span> | Direct; nothing to adapt. |
| Male | <span dir="rtl">ذكر</span> | Direct; nothing to adapt. |
| Female | <span dir="rtl">أنثى</span> | Direct; nothing to adapt. |
| Preferences | <span dir="rtl">التفضيلات</span> | Direct; nothing to adapt. |
| Non-invasive only | <span dir="rtl">غير تدخّلي فقط</span> | Profile value. Includes no injections; “غير جراحي” alone would be too narrow. |
| Open to clinical | <span dir="rtl">العلاجات في العيادة واردة</span> | “واردة” (on the table) avoids gendered “منفتح/منفتحة”. |
| Open to surgical | <span dir="rtl">الجراحة واردة</span> | Same construction. |
| Smoking | <span dir="rtl">التدخين</span> | Direct; nothing to adapt. |
| No | <span dir="rtl">لا</span> | Direct; nothing to adapt. |
| Drinking | <span dir="rtl">الكحول</span> | Profile label. Explicit for accuracy; see the note on drinking. |
| Never | <span dir="rtl">أبدًا</span> | Direct; nothing to adapt. |
| Fitzpatrick {0} `template` | <span dir="rtl">Fitzpatrick {0}</span> | Value. Roman numerals stay Latin. |
| Location | <span dir="rtl">الموقع</span> | Direct; nothing to adapt. |
| Limitations | <span dir="rtl">القيود</span> | Injuries or health limits. |
| None reported | <span dir="rtl">ما في شي مذكور</span> | Direct; nothing to adapt. |
| Profession | <span dir="rtl">المهنة</span> | Direct; nothing to adapt. |
| Reviewer’s note | <span dir="rtl">ملاحظة المراجِع</span> | Kasra on the jim so it isn’t read as “مراجَع” (references). |
| Start with sleep, protein and the training plan. | <span dir="rtl">البداية: النوم، والبروتين، وخطة التمرين.</span> | Fallback note, written without an imperative. |

### No need for surgery

_LandingSections2.tsx › NoSurgery._

| English | Arabic | Why it’s written this way |
|---|---|---|
| Surgery-free transformations | <span dir="rtl">تحوّل بدون جراحة</span> | Kicker. |
| No need for | <span dir="rtl">ما يحتاج</span> | H2 dark part. Third person (“it doesn’t need”) is neutral and very Gulf. |
| surgery. | <span dir="rtl">جراحة.</span> | H2 muted part. |
| Measurements, evidence and a person’s review, turned into a plan built around your features, goals and preferences. Nothing in it needs a scalpel. | <span dir="rtl">قياسات وأدلة علمية ومراجعة من إنسان، تتحوّل لخطة مبنية على ملامحك وأهدافك وتفضيلاتك. ولا شي فيها يحتاج مشرط.</span> | “Scalpel” → “مشرط” keeps the concrete image. |
| Face · 12 months | <span dir="rtl">الوجه · 12 شهر</span> | Direct; nothing to adapt. |
| Skin routine, fat loss, sleep, haircut and beard shaping. | <span dir="rtl">روتين بشرة، خسارة دهون، نوم، قصة شعر، وتحديد لحية.</span> | “تحديد لحية” is the Gulf barber term. |
| Body · 12 months | <span dir="rtl">الجسم · 12 شهر</span> | Direct; nothing to adapt. |
| Training, nutrition and posture work. | <span dir="rtl">تمرين، تغذية، وتمارين لوضعية الجسم.</span> | Direct; nothing to adapt. |
| AI illustration after 12 months | <span dir="rtl">صورة تخيّلية بالذكاء الاصطناعي بعد 12 شهر</span> | Alt text. |
| See the detailed transformation → | <span dir="rtl">التحوّل بالتفصيل ←</span> | Arrow flipped for right-to-left. Noun phrase instead of an imperative. |
| Projections are AI illustrations of the plan’s end point for a synthetic person, not real results. | <span dir="rtl">التصوّرات صور تخيّلية بالذكاء الاصطناعي لنهاية الخطة عند شخص غير حقيقي، وليست نتائج فعلية.</span> | Disclaimer, kept just as clear. |

### Simply follow your plan

_LandingSections2.tsx › FollowPlan._

| English | Arabic | Why it’s written this way |
|---|---|---|
| Your plan | <span dir="rtl">خطتك</span> | Kicker, hub centre, How-it-works step 3. |
| Simply follow your plan. | <span dir="rtl">خطة واضحة، خطوة بخطوة.</span> | H2 dark part. “التزم بخطتك” is a masculine command; a promise of clarity does the same job. |
| See your face transform. | <span dir="rtl">ووجهك يتغيّر قدام عيونك.</span> | H2 muted part. The same strength as the English, no more (see weak strings). |
| A step-by-step plan to improve how you look without surgery, in three phases. | <span dir="rtl">خطة خطوة بخطوة لتحسين مظهرك بدون جراحة، على ثلاث مراحل.</span> | “Three” is a word in the English, so it stays a word. |
| Every step tied to one of your measurements or answers | <span dir="rtl">كل خطوة مربوطة بأحد قياساتك أو إجاباتك</span> | Direct; nothing to adapt. |
| Each step graded A–C by the strength of its evidence | <span dir="rtl">كل خطوة مصنّفة من A إلى C حسب قوة الدليل العلمي</span> | Direct; nothing to adapt. |
| A realistic visual of where the plan leads | <span dir="rtl">تصوّر واقعي لوين توصلك الخطة</span> | Direct; nothing to adapt. |
| Your reviewer’s notes on the steps that matter most | <span dir="rtl">ملاحظات مراجِعك على أهم الخطوات</span> | Direct; nothing to adapt. |
| {0} steps in Khalid’s plan, across {1} areas. `template` | <span dir="rtl">{0} خطوة في خطة خالد، موزّعة على {1} مجالات.</span> | Correct for 11+ steps and 3–10 areas (the sample has 11+ steps). Otherwise use ICU plurals; see templates. |
| Foundations | <span dir="rtl">الأساسيات</span> | Phase 1. |
| Weeks 0–4 | <span dir="rtl">الأسابيع 0–4</span> | En dash kept. |
| Build | <span dir="rtl">البناء</span> | Phase 2. |
| Months 1–3 | <span dir="rtl">الشهور 1–3</span> | “الشهور” is the spoken plural. |
| Refine | <span dir="rtl">التحسين</span> | Phase 3. |
| Months 3–12 | <span dir="rtl">الشهور 3–12</span> | Direct; nothing to adapt. |

### See your future you (visualisation)

_Landing.tsx › FutureSelf._

| English | Arabic | Why it’s written this way |
|---|---|---|
| Visualisation | <span dir="rtl">التصوّر</span> | Kicker. |
| See your | <span dir="rtl">لمحة عن</span> | H2 dark part. “A glimpse of” is softer than “see”, so it matches the AI-illustration disclaimer. |
| future you. | <span dir="rtl">نسختك الجاية.</span> | H2 muted part. “نسختك الجاية” is current Gulf slang for “the next version of you”. See weak strings: CLAIMS bans “your future face”. |
| Ever wondered what you would look like at your best? An AI illustration of your plan’s end point, not a photo or a guarantee. | <span dir="rtl">عندك فضول عن شكلك في أحسن حالاته؟ هذي صورة تخيّلية بالذكاء الاصطناعي لنهاية خطتك، مو صورة حقيقية ولا ضمان.</span> | “تساءلت” is gendered, so we use “عندك فضول” instead. The disclaimer is kept in full. |
| Realistic visualisation | <span dir="rtl">تصوّر واقعي</span> | Direct; nothing to adapt. |
| Only changes that skin care, fat loss, grooming and training can make. | <span dir="rtl">فقط التغييرات اللي ممكن تحققها العناية بالبشرة، وخسارة الدهون، والعناية بالمظهر، والتمرين.</span> | “Only” is placed first for emphasis. |
| Ethnicity-aware | <span dir="rtl">يراعي أصلك</span> | Softer than “واعٍ بالعرق”. |
| Generated to keep your skin tone and features — checked by a human. | <span dir="rtl">مصمّم يحافظ على لون بشرتك وملامحك، ويراجعه إنسان.</span> | “يحافظ على لون بشرتك” rules out any reading of lightening. |
| Achievable without surgery | <span dir="rtl">ممكن بدون جراحة</span> | Direct; nothing to adapt. |
| Bone structure stays the same; we re-measure it to check. | <span dir="rtl">بنية العظام تبقى مثل ما هي؛ ونعيد قياسها عشان نتأكد.</span> | Direct; nothing to adapt. |
| Reviewed by a human | <span dir="rtl">يراجعه إنسان</span> | Direct; nothing to adapt. |
| Every image is checked before it reaches you. | <span dir="rtl">كل صورة تنراجع قبل ما توصلك.</span> | Direct; nothing to adapt. |
| AI-generated 12-month visual (synthetic sample) | <span dir="rtl">تصوّر بعد 12 شهر مولّد بالذكاء الاصطناعي (نموذج غير حقيقي)</span> | Alt text. |
| AI illustration · 12 months · synthetic sample | <span dir="rtl">صورة تخيّلية بالذكاء الاصطناعي · 12 شهر · نموذج غير حقيقي</span> | Caption. |

### Track your progress

_Landing.tsx › Track / MetricCard / Chart._

| English | Arabic | Why it’s written this way |
|---|---|---|
| Your biometrics | <span dir="rtl">مؤشراتك</span> | Kicker. In the Gulf “بيومتري/البصمة” means government fingerprint ID, so we say “your indicators”. |
| Track your progress. | <span dir="rtl">تقدّمك تحت عينك.</span> | H2 dark part. “Under your eye” is an idiom with no gendered imperative. |
| See where you’re heading. | <span dir="rtl">واتجاهك واضح.</span> | H2 muted part. Avoids gendered “رايح/رايحة”. |
| Monthly check-ins in the same set-up, measured against your baseline. Scores are our composites of literature-based measures, not clinical scores. | <span dir="rtl">متابعة شهرية بنفس الإعداد، تنقاس مقارنةً بنقطة بدايتك. الدرجات مؤشرات مركّبة من إعدادنا، مبنية على قياسات من الأبحاث، وليست درجات سريرية.</span> | Second sentence is a disclaimer, so it is MSA-leaning (“وليست”). |
| Improving | <span dir="rtl">يتحسّن</span> | Status pill. |
| Balanced | <span dir="rtl">متوازن</span> | Direct; nothing to adapt. |
| Focus | <span dir="rtl">يحتاج تركيز</span> | “Needs focus”; a bare “تركيز” reads as an instruction. |
| 0 | <span dir="rtl">0</span> | Scale end label (kept). |
| You | <span dir="rtl">موقعك</span> | Scale marker label. “أنت” is gendered, so we use “your position”. |
| 100 | <span dir="rtl">100</span> | Scale end label (kept). |
| With plan | <span dir="rtl">مع الخطة</span> | Direct; nothing to adapt. |
| Without | <span dir="rtl">بدونها</span> | Direct; nothing to adapt. |
| Overall score (composite) | <span dir="rtl">الدرجة الإجمالية (مركّبة)</span> | Direct; nothing to adapt. |
| 6 mo | <span dir="rtl">6 شهور</span> | Axis. |
| 12 mo | <span dir="rtl">12 شهر</span> | Axis. Arabic number agreement differs for 6 and 12. |
| Projected estimate, not a guarantee · synthetic sample | <span dir="rtl">تقدير متوقّع، وليس ضمانًا · نموذج غير حقيقي</span> | Disclaimer, MSA-leaning. |

### Four pillars

_LandingSections2.tsx › Pillars._

| English | Arabic | Why it’s written this way |
|---|---|---|
| Reviewed by a person | <span dir="rtl">يراجعه إنسان</span> | Direct; nothing to adapt. |
| Every report is checked before you see it. | <span dir="rtl">كل تقرير ينراجع قبل ما يوصلك.</span> | Direct; nothing to adapt. |
| Surgery-free | <span dir="rtl">بدون جراحة</span> | Direct; nothing to adapt. |
| Habits, skin care, grooming and training only. | <span dir="rtl">عادات، وعناية بالبشرة والمظهر، وتمرين. بس.</span> | “بس.” at the end hits like “only”. |
| 100% personalised | <span dir="rtl">مخصّص لك 100%</span> | The % sign follows Arabic convention after the number. |
| Built from your measurements and answers. | <span dir="rtl">مبني على قياساتك وإجاباتك.</span> | Direct; nothing to adapt. |
| Science-backed | <span dir="rtl">مدعوم بالعلم</span> | Not “مثبت علميًا” (scientifically proven), which CLAIMS forbids. |
| Every step cites its research. | <span dir="rtl">كل خطوة معها مصدرها العلمي.</span> | Direct; nothing to adapt. |

### What we measure (assessments)

_Landing.tsx › Measures + MEASURES. The heading’s dark part is the computed number (48)._

| English | Arabic | Why it’s written this way |
|---|---|---|
| Assessments | <span dir="rtl">التقييمات</span> | Kicker. |
| assessments. | <span dir="rtl">تقييم.</span> | H2 muted part after the number 48. Singular after 11+ is correct Arabic. |
| Included in your analysis, across {0} areas, from a few guided photos at home. Plus 100 feature types in the library. `template` | <span dir="rtl">كلها ضمن تحليلك، في {0} مجالات، من كم صورة في البيت بخطوات موجّهة. وفوقها 100 نوع من الملامح في المكتبة.</span> | {0}=9, so “مجالات” is correct. “كم صورة” is Gulf for “a few photos”. |
| {0} measurements `template` | <span dir="rtl">{0} قياسات</span> | Row counter, n=3–8, so the plural is correct. If n can exceed 10, switch to ICU plurals. |
| Face proportions | <span dir="rtl">نسب الوجه</span> | Direct; nothing to adapt. |
| Facial thirds and fifths, nose and mouth widths, lip-to-chin height — against anthropometric norms. | <span dir="rtl">أثلاث الوجه وأخماسه، وعرض الأنف والفم، والمسافة من الشفة للذقن، مقارنةً بالمعايير الأنثروبومترية (مقاييس جسم الإنسان).</span> | The technical term is glossed in brackets. |
| Symmetry & averageness | <span dir="rtl">التماثل والقرب من المتوسط</span> | “Averageness” → “closeness to average”. Never “عادي”, which sounds like “ordinary”. |
| 17 mirrored landmark pairs after 3D head-pose correction; closeness to population averages. | <span dir="rtl">17 زوج من النقاط المرجعية المتقابلة بعد تصحيح وضعية الرأس بالأبعاد الثلاثية (3D)؛ ومدى قرب الملامح من متوسط السكان.</span> | 17 and 3D are exact. |
| Eyes & brows | <span dir="rtl">العيون والحواجب</span> | Direct; nothing to adapt. |
| Canthal tilt, eye openness and spacing; brow arch, peak, thickness and height. | <span dir="rtl">ميلان العين (canthal tilt)، وانفتاح العين والمسافة بين العينين؛ وتقوّس الحاجب وقمّته وسماكته وارتفاعه.</span> | Gulf looksmax users search the English “canthal tilt”, so it goes in brackets. |
| Nose & lips | <span dir="rtl">الأنف والشفايف</span> | Direct; nothing to adapt. |
| Nasal width vs. eye spacing, lip ratio and fullness, mouth-corner tilt. | <span dir="rtl">عرض الأنف مقارنةً بالمسافة بين العينين، ونسبة الشفايف وامتلاؤها، وميلان زوايا الفم.</span> | Direct; nothing to adapt. |
| Jaw & chin | <span dir="rtl">الفك والذقن</span> | Direct; nothing to adapt. |
| Jaw-to-face width, chin width, facial width-to-height ratio. | <span dir="rtl">عرض الفك نسبةً لعرض الوجه، وعرض الذقن، ونسبة عرض الوجه إلى طوله (fWHR).</span> | fWHR goes in brackets because it’s the searchable term. |
| Skin | <span dir="rtl">البشرة</span> | Direct; nothing to adapt. |
| Six regions read in CIELAB colour space: pigment, redness, texture and evenness. | <span dir="rtl">ست مناطق تنقرأ في فضاء الألوان CIELAB: التصبّغ، والاحمرار، والملمس، وتجانس اللون.</span> | “Evenness” → “تجانس اللون” (uniformity), never lightening. |
| Body proportions | <span dir="rtl">نسب الجسم</span> | Direct; nothing to adapt. |
| Shoulder-to-waist, waist-to-hip, chest and arm widths, left/right balance. | <span dir="rtl">الكتف إلى الخصر، والخصر إلى الورك، وعرض الصدر والذراعين، والتوازن بين اليمين واليسار.</span> | Direct; nothing to adapt. |
| Posture | <span dir="rtl">وضعية الجسم</span> | “القوام” is literary; “وضعية الجسم” is what people search for. |
| Shoulder and pelvis lines from the front; head and shoulder position from the side. | <span dir="rtl">خطوط الكتفين والحوض من الأمام؛ ووضع الرأس والكتفين من الجنب.</span> | Direct; nothing to adapt. |
| Composition | <span dir="rtl">تكوين الجسم</span> | Arabic needs “of the body”. |
| BMI, photo-estimated waist, waist-to-height and body-fat estimate (±4–5 points). | <span dir="rtl">مؤشر كتلة الجسم (BMI)، ومقاس الخصر المقدّر من الصورة، ونسبة الخصر للطول، وتقدير نسبة الدهون (±4–5 نقاط مئوية).</span> | “Points” → “نقاط مئوية” (percentage points), which is what the English means. The ± range is kept. |
| Nutrition | <span dir="rtl">التغذية</span> | Direct; nothing to adapt. |
| Energy needs, calorie target, protein, fat, carbs and fibre for each phase. | <span dir="rtl">احتياج الطاقة، وهدف السعرات، والبروتين، والدهون، والكربوهيدرات، والألياف لكل مرحلة.</span> | Direct; nothing to adapt. |

### Discover what makes you, you

_LandingSections2.tsx › DiscoverYou. Feature titles and definitions come from lib/library and are out of scope._

| English | Arabic | Why it’s written this way |
|---|---|---|
| Learn about your face | <span dir="rtl">ملامحك بالتفصيل</span> | Kicker. “تعرّف على” is a gendered imperative. |
| Discover what | <span dir="rtl">سرّ ملامحك</span> | H2 dark part. The idiom “what makes you, you” is rebuilt as “the secret of your features”. |
| makes you, you. | <span dir="rtl">اللي تميّزك عن غيرك.</span> | H2 muted part. “تميّزك” agrees with “ملامح”, so it’s neutral. |
| Every feature, its type, and what it does for your look, with the research behind it. | <span dir="rtl">كل ملمح، ونوعه، واللي يضيفه لإطلالتك، مع الأبحاث اللي وراه.</span> | “إطلالتك” is the Gulf beauty word for “your look”. |
| Explore the feature library | <span dir="rtl">استكشاف مكتبة الملامح</span> | Button, verbal noun. |
| Your type | <span dir="rtl">نوعك</span> | Direct; nothing to adapt. |
| Measured: {0} `template` | <span dir="rtl">القياس: {0}</span> | Direct; nothing to adapt. |
| {0}, AI-generated synthetic example `template` | <span dir="rtl">{0}، مثال غير حقيقي مولّد بالذكاء الاصطناعي</span> | Alt text with a disclaimer, so it is kept. |

### Technology

_LandingSections2.tsx › Technology._

| English | Arabic | Why it’s written this way |
|---|---|---|
| Technology | <span dir="rtl">التقنية</span> | Kicker. |
| The technology behind | <span dir="rtl">التقنية اللي ورا</span> | H2 dark part. |
| your transformation. | <span dir="rtl">تحوّلك.</span> | H2 muted part. |
| Measurement, evidence and a person’s judgement. No guesswork. | <span dir="rtl">قياس، وأدلة علمية، وتقدير إنسان. بدون تخمين.</span> | Direct; nothing to adapt. |
| Precision landmarking | <span dir="rtl">تحديد دقيق للنقاط المرجعية</span> | Direct; nothing to adapt. |
| A 478-point face mesh and a 33-point body pose, run on your device, then corrected for head tilt before any ratio is measured. | <span dir="rtl">شبكة وجه من 478 نقطة ونموذج وضعية جسم من 33 نقطة، يشتغلون على جهازك، وبعدها نصحّح ميلان الرأس قبل ما نقيس أي نسبة.</span> | 478 and 33 are exact. |
| Real personalisation | <span dir="rtl">تخصيص حقيقي</span> | Direct; nothing to adapt. |
| Your age, background, location, lifestyle, budget and preferences shape every plan. No two are the same. | <span dir="rtl">عمرك وأصلك ومكانك ونمط حياتك وميزانيتك وتفضيلاتك تشكّل كل خطة. وما في خطتين نفس بعض.</span> | Direct; nothing to adapt. |
| The science of appearance | <span dir="rtl">علم المظهر</span> | Direct; nothing to adapt. |
| 48 measurements and 100 feature types, each compared with published reference ranges and graded by evidence. | <span dir="rtl">48 قياس و100 نوع من الملامح، كل واحد منها يُقارن بنطاقات مرجعية منشورة، ومصنّف حسب قوة الدليل.</span> | Direct; nothing to adapt. |
| Reviewed by humans | <span dir="rtl">مراجعة بشرية</span> | Direct; nothing to adapt. |
| A named reviewer checks the landmarks, the plan and the visuals, and visuals are re-measured for realism before release. | <span dir="rtl">مراجِع معروف بالاسم يدقّق النقاط المرجعية والخطة والتصوّرات، والتصوّرات ينعاد قياسها للتأكد من واقعيتها قبل ما توصلك.</span> | “Named” → “معروف بالاسم”. Implies no credential. |

### Your face tells your story

_LandingSections2.tsx › Ancestry. Citation lines use the cite() template below._

| English | Arabic | Why it’s written this way |
|---|---|---|
| Your face tells | <span dir="rtl">وجهك يحكي</span> | H2 dark part. |
| your story. | <span dir="rtl">قصتك.</span> | H2 muted part. |
| How some features reflect ancestry, and why we read yours against references that fit you. | <span dir="rtl">كيف بعض الملامح تعكس أصول أجدادك، وليش نقرأ ملامحك مقارنةً بمراجع تناسبك.</span> | “Some” → “بعض” is kept (not all features). |
| Nostril width varies with the temperature and humidity of ancestral climates. | <span dir="rtl">عرض فتحات الأنف يختلف حسب حرارة ورطوبة المناخ اللي عاش فيه الأجداد.</span> | Direct; nothing to adapt. |
| A single eyelid, with no visible crease, is common in East Asian people and is normal anatomy. | <span dir="rtl">الجفن الأحادي، بدون ثنية واضحة، منتشر عند شعوب شرق آسيا، وهو تشريح طبيعي.</span> | “Normal anatomy” is kept: the anti-shaming point. |
| Attractive eye tilt differs by ethnicity: steeper in Caucasian and African composites, less steep in Asian ones. | <span dir="rtl">ميلان العين اللي يُعتبر جذاب يختلف حسب العِرق: أكثر حدّة في الصور المركّبة لوجوه قوقازية وأفريقية، وأقل حدّة في الآسيوية.</span> | “Composites” → “الصور المركّبة” keeps it about averaged images, not individuals. |
| Hair runs on a continuum from straight to tightly coiled, with every shape found worldwide. | <span dir="rtl">الشعر يتدرّج من الناعم المسترسل إلى المجعّد الملفوف بقوة، وكل الأشكال موجودة في كل مكان بالعالم.</span> | Avoids “خشن” (coarse), which is commonly used as a put-down for curly hair. |
| {0} et al. {1} `template` | <span dir="rtl">{0} et al. {1}</span> | Short citation (cite()). Kept in Latin, left-to-right. |

### Start your transformation (CTA band)

_LandingSections2.tsx › StartCta._

| English | Arabic | Why it’s written this way |
|---|---|---|
| Get started | <span dir="rtl">يلا نبدأ</span> | Kicker. |
| Start your | <span dir="rtl">رحلة تحوّلك</span> | H2 dark part. “ابدأ” is masculine, so “your transformation journey…” |
| transformation. | <span dir="rtl">تبدأ من هنا.</span> | H2 muted part: “…starts here.” |
| Your personalised analysis and 12-month plan, built from your face, your body and the evidence. | <span dir="rtl">تحليلك المخصّص وخطتك لـ12 شهر، مبنية على وجهك وجسمك والأدلة العلمية.</span> | Direct; nothing to adapt. |

### How it works

_Landing.tsx › How._

| English | Arabic | Why it’s written this way |
|---|---|---|
| How it | <span dir="rtl">كيف</span> | H2 dark part. |
| works. | <span dir="rtl">يشتغل؟</span> | H2 muted part. A question reads more naturally than a statement here. |
| Your personalised analysis from home, in three simple steps. | <span dir="rtl">تحليلك المخصّص من بيتك، بثلاث خطوات بسيطة.</span> | Direct; nothing to adapt. |
| Upload photos | <span dir="rtl">رفع الصور</span> | Upload widget, verbal noun. |
| Upload | <span dir="rtl">رفع الصور</span> | Step 1 title. |
| A front portrait, a full-body and a side photo, plus height and weight. | <span dir="rtl">صورة للوجه من الأمام، وصورة للجسم كامل، وصورة جانبية، مع الطول والوزن.</span> | Direct; nothing to adapt. |
| Facial landmarks | <span dir="rtl">نقاط الوجه المرجعية</span> | Direct; nothing to adapt. |
| Skin regions | <span dir="rtl">مناطق البشرة</span> | Direct; nothing to adapt. |
| Body silhouette | <span dir="rtl">هيئة الجسم</span> | Direct; nothing to adapt. |
| Expert review | <span dir="rtl">مراجعة مختص</span> | Not “طبيب”. |
| Measure & review | <span dir="rtl">القياس والمراجعة</span> | Code has &amp;. |
| Measured on your device, then checked by a human before release. | <span dir="rtl">القياس يصير على جهازك، وبعدها يراجعه إنسان قبل ما يوصلك.</span> | Direct; nothing to adapt. |
| Your report | <span dir="rtl">تقريرك</span> | Direct; nothing to adapt. |
| Your analysis, your 12-month visual and an evidence-graded plan. | <span dir="rtl">تحليلك، وتصوّرك بعد 12 شهر، وخطة مصنّفة حسب قوة الدليل.</span> | Direct; nothing to adapt. |

### Pricing

_Landing.tsx › Pricing + PRICE table._

| English | Arabic | Why it’s written this way |
|---|---|---|
| One analysis. | <span dir="rtl">تحليل واحد.</span> | H2 dark part. |
| A plan for the year. | <span dir="rtl">وخطة لسنة كاملة.</span> | H2 muted part. |
| Prices include VAT. | <span dir="rtl">الأسعار شاملة ضريبة القيمة المضافة.</span> | The official term in both countries. |
| Face & body analysis | <span dir="rtl">تحليل الوجه والجسم</span> | Direct; nothing to adapt. |
| 48 measurements against reference ranges. | <span dir="rtl">48 قياس مقارنةً بنطاقات مرجعية.</span> | Direct; nothing to adapt. |
| Evidence-graded 12-month plan | <span dir="rtl">خطة 12 شهر مصنّفة حسب قوة الدليل</span> | Direct; nothing to adapt. |
| Every step graded A–C and cited. | <span dir="rtl">كل خطوة مصنّفة من A إلى C ومعها مصدرها.</span> | Direct; nothing to adapt. |
| Your 12-month visuals | <span dir="rtl">تصوّراتك بعد 12 شهر</span> | Direct; nothing to adapt. |
| Face and body, front and side — reviewed by a human. | <span dir="rtl">الوجه والجسم، من الأمام والجنب، ويراجعها إنسان.</span> | Direct; nothing to adapt. |
| Nutrition targets | <span dir="rtl">أهداف التغذية</span> | Direct; nothing to adapt. |
| Calories and macros for each phase of your plan. | <span dir="rtl">السعرات والماكروز لكل مرحلة من خطتك.</span> | “الماكروز” is what Gulf gym-goers say. |
| Progress tracking | <span dir="rtl">متابعة التقدّم</span> | Direct; nothing to adapt. |
| Check in and compare against your baseline. | <span dir="rtl">متابعة دورية ومقارنة مع نقطة بدايتك.</span> | Verbal nouns, gender-neutral. |
| Glow-Up Report | <span dir="rtl">تقرير Glow-Up</span> | Product name. “Glow-Up” stays Latin as a brand-like name (recommendation; see report). |
| One-off · face + body | <span dir="rtl">دفعة وحدة · وجه + جسم</span> | “دفعة وحدة” (one payment) is clearer than “لمرة واحدة” for pricing. |
| Premium | <span dir="rtl">بريميوم</span> | Tier name, transliterated as Gulf apps usually do. |
| + style previews, video consult, 3 months tracking | <span dir="rtl">+ معاينة الستايلات، واستشارة بالفيديو، ومتابعة 3 شهور</span> | “الستايلات” is the everyday word for looks/styles. |
| Membership | <span dir="rtl">الاشتراك</span> | Gulf apps call this اشتراك, not عضوية. |
| Monthly check-ins and plan updates | <span dir="rtl">متابعة شهرية وتحديثات للخطة</span> | Direct; nothing to adapt. |
| {0}/mo · {1}/yr `template` | <span dir="rtl">{0} شهريًا · {1} سنويًا</span> | Direct; nothing to adapt. |
| AED 199 | <span dir="rtl">199 درهم</span> | Report price. Amount unchanged; the unit follows the number in Arabic. |
| SAR 199 | <span dir="rtl">199 ريال</span> | Direct; nothing to adapt. |
| €49 | <span dir="rtl">49 يورو</span> | Direct; nothing to adapt. |
| AED 399 | <span dir="rtl">399 درهم</span> | Premium and yearly. |
| SAR 399 | <span dir="rtl">399 ريال</span> | Direct; nothing to adapt. |
| €99 | <span dir="rtl">99 يورو</span> | Direct; nothing to adapt. |
| AED 49 | <span dir="rtl">49 درهم</span> | Monthly. |
| SAR 49 | <span dir="rtl">49 ريال</span> | Direct; nothing to adapt. |
| €12 | <span dir="rtl">12 يورو</span> | Direct; nothing to adapt. |

### Your support system

_LandingSections2.tsx › Support (incl. example chat)._

| English | Arabic | Why it’s written this way |
|---|---|---|
| Your support | <span dir="rtl">سندك</span> | H2 dark part. “سند” is the warm Gulf word for someone who has your back. |
| system. | <span dir="rtl">طول الطريق.</span> | H2 muted part: “…all the way”. “نظام دعم” would be a stiff calque. |
| A person reviews your report before release and stays on your plan with you: notes on the steps that matter, and monthly check-ins that update it. | <span dir="rtl">شخص حقيقي يراجع تقريرك قبل ما يوصلك، ويكمل معك على خطتك: ملاحظات على الخطوات المهمة، ومتابعة شهرية تحدّث الخطة.</span> | Direct; nothing to adapt. |
| A named reviewer on every report | <span dir="rtl">مراجِع معروف بالاسم لكل تقرير</span> | Direct; nothing to adapt. |
| Notes from your reviewer on the steps that matter | <span dir="rtl">ملاحظات من مراجِعك على الخطوات المهمة</span> | Direct; nothing to adapt. |
| Monthly check-ins that update your plan | <span dir="rtl">متابعة شهرية تحدّث خطتك</span> | Direct; nothing to adapt. |
| Specialist partners in the UAE and KSA (coming soon) | <span dir="rtl">شركاء متخصصين في الإمارات والسعودية (قريبًا)</span> | Direct; nothing to adapt. |
| Example of a reviewer note | <span dir="rtl">مثال على ملاحظة من المراجِع</span> | aria-label. |
| Your reviewer | <span dir="rtl">مراجِعك</span> | Kasra marks it as “your reviewer”, not “your references”. |
| Note on your plan | <span dir="rtl">ملاحظة على خطتك</span> | Direct; nothing to adapt. |
| My results say “mild asymmetry”. Is that normal? | <span dir="rtl">نتايجي تقول «عدم تماثل بسيط». هذا طبيعي؟</span> | User bubble in the first person, so it is neutral. Guillemets «» are the Arabic quote marks. |
| Yes. Almost every face has small left–right differences, and yours is within the normal range. Nothing in your plan tries to change it. | <span dir="rtl">إيه، طبيعي. تقريبًا كل وجه فيه فروق بسيطة بين اليمين واليسار، ووجهك ضمن المعدل الطبيعي. ولا شي في خطتك يحاول يغيّره.</span> | “إيه” is the shared Gulf “yes”. Reassuring tone. |
| What should I start with? | <span dir="rtl">من وين أبدأ؟</span> | “من وين” is neutral between Saudi “وش” and Emirati “شو”. |
| Sleep and protein first. They drive most of the change in your 12-month visual. | <span dir="rtl">النوم والبروتين أول شي. هم وراء أغلب التغيير في تصوّرك بعد 12 شهر.</span> | “Most” → “أغلب”, not “all”. |
| Example · in-app messaging is coming soon | <span dir="rtl">مثال · المراسلة داخل التطبيق قريبًا</span> | Direct; nothing to adapt. |

### Care network (coming soon)

_Landing.tsx › CareNetwork + PARTNERS + FOLLOW. Every line must keep the not-yet-live status._

| English | Arabic | Why it’s written this way |
|---|---|---|
| Care network · coming soon | <span dir="rtl">شبكة الرعاية · قريبًا</span> | Kicker. |
| Your plan, carried out | <span dir="rtl">خطتك، بتنفيذ</span> | H2 dark part. |
| by specialists. | <span dir="rtl">مختصين.</span> | H2 muted part. Read together: “خطتك، بتنفيذ مختصين.” |
| Coming soon: licensed dermatologists, registered dietitians and vetted specialists, connected to your plan with follow-ups built in. We're onboarding partners now. | <span dir="rtl">قريبًا: أطباء جلدية مرخّصين، وأخصائيي تغذية مسجّلين، ومختصين نتحقق منهم، مربوطين بخطتك ومعهم مواعيد متابعة جاهزة. نضمّ الشركاء حاليًا.</span> | “Registered” → “مسجّلين”, not “معتمدين” (accredited), so it isn’t overstated. |
| Targets · follow-ups · results | <span dir="rtl">الأهداف · المتابعة · النتائج</span> | Hub centre. |
| Dermatologists | <span dir="rtl">أطباء الجلدية</span> | Direct; nothing to adapt. |
| Licensed (DHA / MOH registration required) | <span dir="rtl">مرخّصين (يُشترط التسجيل لدى DHA / MOH)</span> | Regulator acronyms stay Latin, as written on licences. |
| Your skin findings & photos you choose to share | <span dir="rtl">نتائج بشرتك، والصور اللي تنشارك بموافقتك</span> | “Photos shared with your consent”, which avoids gendered “تختار/تختارين”. |
| Prescriptions and notes update your skin plan | <span dir="rtl">الوصفات والملاحظات تحدّث خطة بشرتك</span> | Direct; nothing to adapt. |
| Follow-ups at weeks 6 and 12 | <span dir="rtl">متابعة في الأسبوع 6 و12</span> | Direct; nothing to adapt. |
| Dietitians & meal kitchens | <span dir="rtl">أخصائيو التغذية ومطابخ الوجبات</span> | “مطابخ الوجبات” fits the Gulf meal-plan subscription market. |
| Registered dietitians, macro-matched meals | <span dir="rtl">أخصائيو تغذية مسجّلين، ووجبات مضبوطة على الماكروز</span> | Direct; nothing to adapt. |
| Calorie & macro targets, phase, allergies | <span dir="rtl">أهداف السعرات والماكروز، والمرحلة، والحساسية</span> | Direct; nothing to adapt. |
| Weekly weigh-ins adjust your targets | <span dir="rtl">الوزن الأسبوعي يعدّل أهدافك</span> | Direct; nothing to adapt. |
| Check-ins every 2 weeks | <span dir="rtl">متابعة كل أسبوعين</span> | Arabic dual “أسبوعين” = exactly 2 weeks. |
| Body composition | <span dir="rtl">تكوين الجسم</span> | Direct; nothing to adapt. |
| InBody & DEXA centres | <span dir="rtl">مراكز InBody وDEXA</span> | Brand and device names stay Latin. |
| Booking request only | <span dir="rtl">طلب حجز فقط</span> | Direct; nothing to adapt. |
| Measured body fat replaces the photo estimate | <span dir="rtl">نسبة الدهون المقاسة تحل محل التقدير من الصور</span> | Direct; nothing to adapt. |
| Baseline, then every 3 months | <span dir="rtl">قياس أساسي، وبعدها كل 3 شهور</span> | Direct; nothing to adapt. |
| Coaches & trainers | <span dir="rtl">الكوتشز والمدرّبين</span> | “كوتش” is standard Gulf gym vocabulary. |
| Certified personal trainers | <span dir="rtl">مدرّبين شخصيين معتمدين</span> | Direct; nothing to adapt. |
| Your training split & posture priorities | <span dir="rtl">تقسيمة تمارينك وأولويات وضعية الجسم</span> | “تقسيمة” is what Gulf gym-goers call a split. |
| Logged sessions feed your progress | <span dir="rtl">الحصص المسجّلة تنضاف لتقدّمك</span> | Direct; nothing to adapt. |
| Weekly sessions | <span dir="rtl">حصص أسبوعية</span> | Direct; nothing to adapt. |
| Non-surgical clinics | <span dir="rtl">عيادات غير جراحية</span> | Direct; nothing to adapt. |
| Licensed aesthetic practitioners | <span dir="rtl">مختصين تجميل مرخّصين</span> | Direct; nothing to adapt. |
| Only the plan section you select | <span dir="rtl">الجزء المختار من خطتك فقط</span> | Direct; nothing to adapt. |
| Consultation outcome added to your plan | <span dir="rtl">نتيجة الاستشارة تنضاف لخطتك</span> | Direct; nothing to adapt. |
| Consultation first, always | <span dir="rtl">الاستشارة أول، دايمًا</span> | Direct; nothing to adapt. |
| Planned integration | <span dir="rtl">تكامل مخطّط له</span> | “Planned” is kept, so it isn’t read as live. |
| Sent from your plan | <span dir="rtl">اللي ينرسل من خطتك</span> | Direct; nothing to adapt. |
| Comes back | <span dir="rtl">اللي يرجع لك</span> | Direct; nothing to adapt. |
| Follow-up | <span dir="rtl">المتابعة</span> | Direct; nothing to adapt. |
| You choose what's shared, booking by booking. Photos are never shared automatically. | <span dir="rtl">القرار لك في كل حجز بخصوص اللي ينشارك. والصور ما تنشارك تلقائيًا أبدًا.</span> | “القرار لك” (the decision is yours) is neutral and reassuring. |
| Week 0 | <span dir="rtl">الأسبوع 0</span> | Direct; nothing to adapt. |
| Analysis & plan, reviewed | <span dir="rtl">التحليل والخطة، بعد المراجعة</span> | Direct; nothing to adapt. |
| Week 2 | <span dir="rtl">الأسبوع 2</span> | Direct; nothing to adapt. |
| Partner intros booked | <span dir="rtl">حجز أول لقاء مع الشركاء</span> | Direct; nothing to adapt. |
| Week 6 | <span dir="rtl">الأسبوع 6</span> | Direct; nothing to adapt. |
| Dermatologist follow-up | <span dir="rtl">متابعة مع طبيب الجلدية</span> | Direct; nothing to adapt. |
| Month 3 | <span dir="rtl">الشهر 3</span> | Direct; nothing to adapt. |
| InBody re-scan · plan update | <span dir="rtl">إعادة قياس InBody · تحديث الخطة</span> | Direct; nothing to adapt. |
| Month 6 | <span dir="rtl">الشهر 6</span> | Direct; nothing to adapt. |
| Check-in · new 12-month visual | <span dir="rtl">متابعة · تصوّر جديد لـ12 شهر</span> | Direct; nothing to adapt. |
| Month 12 | <span dir="rtl">الشهر 12</span> | Direct; nothing to adapt. |
| Final report & next goals | <span dir="rtl">التقرير النهائي والأهداف الجاية</span> | Direct; nothing to adapt. |
| Partner network not yet live · launching in the UAE & Saudi Arabia | <span dir="rtl">شبكة الشركاء لم تنطلق بعد · الإطلاق قريبًا في الإمارات والسعودية</span> | Status disclaimer, MSA-leaning (“لم تنطلق بعد”). |

### FAQ

_Landing.tsx › Faq._

| English | Arabic | Why it’s written this way |
|---|---|---|
| Your questions | <span dir="rtl">أسئلتك</span> | Kicker (×2). |
| Frequently asked | <span dir="rtl">الأسئلة</span> | H2 dark part. |
| questions. | <span dir="rtl">الشائعة.</span> | H2 muted part. Arabic order (noun + adjective) flips which word carries the emphasis. |
| Is it medical advice? | <span dir="rtl">هل هو استشارة طبية؟</span> | MSA-leaning, because this is the disclaimer question. |
| No. It's aesthetic and wellness guidance. Anything clinical points you to a licensed practitioner. | <span dir="rtl">لا. هو إرشاد للمظهر والعافية العامة. وأي شي طبي نوجّهك فيه لممارس صحي مرخّص.</span> | The “not medical” line stays unambiguous. |
| How accurate is it? | <span dir="rtl">مدى دقة التحليل؟</span> | “قد إيش” (Hejazi) and “شقد” (Emirati) are each local; the MSA-light form works for both. |
| Measurements use established face and pose landmark models (MediaPipe) and are compared with published norms where they exist. They are estimates — body-fat estimates carry errors of roughly ±4–5 points, and photo conditions matter, so we flag selfies, head turns and cropped body shots. | <span dir="rtl">القياسات تعتمد على نماذج معروفة لتحديد نقاط الوجه ووضعية الجسم (MediaPipe)، وتنقارن بالمعايير المنشورة إذا كانت متوفرة. وهي تقديرات: تقدير نسبة الدهون فيه هامش خطأ تقريبًا ±4–5 نقاط مئوية، وظروف التصوير تفرق، عشان كذا ننبّهك على صور السيلفي، والتفات الرأس، وصور الجسم المقصوصة.</span> | Every hedge is kept (estimates, roughly, ±4–5, where they exist). |
| Who sees my photos? | <span dir="rtl">مين يشوف صوري؟</span> | First person, so it is neutral. |
| Analysis runs on your device. Photos you send for your report are seen only by your reviewer and deleted 90 days after delivery. | <span dir="rtl">التحليل يصير على جهازك. والصور المرسلة لتقريرك ما يشوفها إلا مراجِعك، وتنحذف بعد 90 يوم من تسليم التقرير.</span> | 90 days is exact. “Only” → “ما… إلا” is the strongest natural Arabic form and matches the English. |
| Do I need special equipment? | <span dir="rtl">أحتاج أدوات خاصة؟</span> | Direct; nothing to adapt. |
| No. A phone, a plain wall and someone (or a timer) to take the photos from about 1.5–3 m. | <span dir="rtl">لا. جوال، وجدار سادة، وأحد يصوّرك (أو مؤقّت الكاميرا) من مسافة تقريبًا 1.5–3 متر.</span> | “جوال” is the Gulf word for phone. “سادة” means plain. Distance is exact. |
| Can I cancel the membership? | <span dir="rtl">أقدر ألغي الاشتراك؟</span> | Direct; nothing to adapt. |
| Yes, anytime. Your report and plan stay yours. | <span dir="rtl">إيه، في أي وقت. وتقريرك وخطتك يبقون لك.</span> | Direct; nothing to adapt. |

### Mindset

_LandingSections2.tsx › Mindset._

| English | Arabic | Why it’s written this way |
|---|---|---|
| Will analysing my face | <span dir="rtl">تحليل وجهي</span> | H2 dark part (first person). |
| make me insecure? | <span dir="rtl">بيهزّ ثقتي بنفسي؟</span> | H2 muted part. “يهزّ ثقتي” (shake my confidence) is the idiomatic Gulf expression for insecurity. |
| Worry often comes from guessing. A clear, honest read of your face replaces guesses with facts, including what is normal and what doesn’t need changing. | <span dir="rtl">القلق غالبًا يجي من التخمين. وقراءة واضحة وصادقة لوجهك تحط الحقائق مكان التخمينات، ومنها اللي هو طبيعي واللي ما يحتاج تغيير.</span> | “Often” → “غالبًا” is kept. |
| You learn what is genuinely yours. | <span dir="rtl">تتضح لك ملامحك على حقيقتها.</span> | Third person (“your features become clear to you”) avoids gendered “تعرف/تعرفين”. |
| Many features people worry about are normal variation. Types describe your face; none is better than another. | <span dir="rtl">ملامح كثيرة يقلق منها الناس هي مجرد تنوّع طبيعي. الأنواع توصف وجهك، وما في نوع أحسن من الثاني.</span> | Anti-shaming line, kept exactly. |
| You see what can and can’t change. | <span dir="rtl">يبان لك اللي يتغيّر واللي ما يتغيّر.</span> | Direct; nothing to adapt. |
| Small asymmetries are normal and are never a target. Bone doesn’t change with habits, and we say so. | <span dir="rtl">الفروق البسيطة في التماثل طبيعية وما نستهدفها أبدًا. والعظم ما يتغيّر بالعادات، ونقولها لك بصراحة.</span> | The bone line is kept: CLAIMS never allows a promise of bone change. |
| You stay in control. | <span dir="rtl">القرار بيدك.</span> | Idiomatic and neutral. |
| You choose your hair and beard, what you won’t do, and how much detail you see. | <span dir="rtl">شكل شعرك ولحيتك، وحدودك، ومستوى التفاصيل اللي يظهر لك، كله باختيارك.</span> | Rebuilt around “باختيارك” to avoid three gendered verbs. |
| If thinking about your appearance is causing you real distress, please talk to a doctor or mental-health professional before starting. | <span dir="rtl">إذا كان التفكير في مظهرك يسبّب لك ضيق حقيقي، نرجو استشارة طبيب أو مختص في الصحة النفسية قبل البدء.</span> | Safety note, MSA-leaning and caring. “استشارة” (verbal noun) avoids “تتكلم/تتكلمين”. |

## __templates

Keys whose `${…}` / JSX expressions were replaced by `{0}`, `{1}`, `{2}` (same placeholders in the Arabic). Arabic may reorder them.

- `Not medical advice · Product imagery uses a synthetic person · After images are AI illustrations, not results · © {0}` → <span dir="rtl">ليست استشارة طبية · صور المنتج لشخص غير حقيقي · صور «بعد» تخيّلية بالذكاء الاصطناعي وليست نتائج فعلية · © {0}</span>
- `{0} et al. ({1}). {2}.` → <span dir="rtl">{0} et al. ({1}). {2}.</span>
- `Step {0}` → <span dir="rtl">الخطوة {0}</span>
- `{0}% of brow length · even thickness` → <span dir="rtl">{0}% من طول الحاجب · سماكة معتدلة</span>
- `Fitzpatrick type {0} · skin score {1}/100` → <span dir="rtl">فئة Fitzpatrick {0} · درجة البشرة {1}/100</span>
- `Middle ÷ lower {0} · classical canon 1.00` → <span dir="rtl">الأوسط ÷ السفلي {0} · النسبة الكلاسيكية 1.00</span>
- `You {0}/100 · 100 = perfectly mirrored` → <span dir="rtl">درجتك {0}/100 · 100 = تماثل تام</span>
- `{0}’s Protocol` → <span dir="rtl">بروتوكول {0}</span>
- `This plan is organised around {0} steps across skin, leanness, rest, grooming and body. Score now {1}, projected {2}.` → <span dir="rtl">خطوات الخطة: {0}، موزّعة على البشرة، ورشاقة الوجه، والراحة، والعناية بالمظهر، والجسم. الدرجة اليوم {1}، والمتوقّعة {2}.</span>
- `Fitzpatrick {0}` → <span dir="rtl">Fitzpatrick {0}</span>
- `{0} steps in Khalid’s plan, across {1} areas.` → <span dir="rtl">{0} خطوة في خطة خالد، موزّعة على {1} مجالات.</span>
- `Included in your analysis, across {0} areas, from a few guided photos at home. Plus 100 feature types in the library.` → <span dir="rtl">كلها ضمن تحليلك، في {0} مجالات، من كم صورة في البيت بخطوات موجّهة. وفوقها 100 نوع من الملامح في المكتبة.</span>
- `{0} measurements` → <span dir="rtl">{0} قياسات</span>
- `Measured: {0}` → <span dir="rtl">القياس: {0}</span>
- `{0}, AI-generated synthetic example` → <span dir="rtl">{0}، مثال غير حقيقي مولّد بالذكاء الاصطناعي</span>
- `{0} et al. {1}` → <span dir="rtl">{0} et al. {1}</span>
- `{0}/mo · {1}/yr` → <span dir="rtl">{0} شهريًا · {1} سنويًا</span>

**Plural note.** Arabic counted nouns change form with the number (3–10 plural, 11+ singular). `{0} measurements` (n = 3–8), the assessments line (9 areas) and `{0} steps in Khalid’s plan` (sample has 11+ steps) are correct for today’s values. If those ranges can change, move these keys to ICU `plural` messages (`zero/one/two/few/many/other`).

**Bidi note.** The two citation templates stay Latin. Render them in an element with `dir="ltr"`.

## __composite (study card headings)

These keys are the visible heading `muted + " " + dark` from `STUDIES` in LandingSections.tsx. In the Arabic value, **the first word is the muted span and the rest is the dark span**. To use them, look up `` `${c.muted} ${c.dark}` `` and split the Arabic on the first space.

- `Higher pay` → muted <span dir="rtl">دخل</span> · dark <span dir="rtl">أعلى</span>
- `Easier hiring` → muted <span dir="rtl">توظيف</span> · dark <span dir="rtl">أسهل</span>
- `Bigger tips` → muted <span dir="rtl">بقشيش</span> · dark <span dir="rtl">أكبر</span>
- `More confidence` → muted <span dir="rtl">ثقة</span> · dark <span dir="rtl">أكبر</span>
- `First dates` → muted <span dir="rtl">اللقاء</span> · dark <span dir="rtl">الأول</span>
- `Speed dating` → muted <span dir="rtl">تعارف</span> · dark <span dir="rtl">سريع</span>
- `Second looks` → muted <span dir="rtl">معاملة</span> · dark <span dir="rtl">أفضل</span>
- `Warmer assumptions` → muted <span dir="rtl">ظنّ</span> · dark <span dir="rtl">أحسن</span>
- `More social credit` → muted <span dir="rtl">رصيد</span> · dark <span dir="rtl">اجتماعي أكبر</span>
- `Faster judgements` → muted <span dir="rtl">أحكام</span> · dark <span dir="rtl">أسرع</span>
- `Leaner faces` → muted <span dir="rtl">وجه</span> · dark <span dir="rtl">أرشق</span>
- `Even skin` → muted <span dir="rtl">بشرة</span> · dark <span dir="rtl">موحّدة</span>
- `Rested eyes` → muted <span dir="rtl">عيون</span> · dark <span dir="rtl">مرتاحة</span>
- `Higher expectations` → muted <span dir="rtl">توقعات</span> · dark <span dir="rtl">أعلى</span>
- `Same report card` → muted <span dir="rtl">نفس</span> · dark <span dir="rtl">الشهادة</span>
- `Lighter sentences` → muted <span dir="rtl">أحكام</span> · dark <span dir="rtl">أخف</span>
- `Lower bail` → muted <span dir="rtl">كفالة</span> · dark <span dir="rtl">أقل</span>
- `Fewer convictions` → muted <span dir="rtl">إدانات</span> · dark <span dir="rtl">أقل</span>
- `More persuasive` → muted <span dir="rtl">إقناع</span> · dark <span dir="rtl">أقوى</span>
- `Faces win votes` → muted <span dir="rtl">الوجوه</span> · dark <span dir="rtl">تكسب الأصوات</span>
- `Even children` → muted <span dir="rtl">حتى</span> · dark <span dir="rtl">الأطفال</span>
- `Higher life satisfaction` → muted <span dir="rtl">رضا</span> · dark <span dir="rtl">أعلى عن الحياة</span>
- `Self presentation` → muted <span dir="rtl">العناية</span> · dark <span dir="rtl">بالطلّة</span>
