/*
 * Legal texts (privacy policy, terms, refund policy) in English and Arabic.
 *
 * DRAFT: have a Dutch lawyer review before launch. Also check with counsel how
 * Kuwait's data-privacy rules (the CITRA Data Privacy Protection Regulation)
 * apply, since the servers are outside Kuwait. Every [BRACKETED] value is a
 * placeholder that must be filled in before launch. The pages show a small
 * "draft" note in development builds only.
 *
 * Inline markup used in the strings below:
 *   [[label|terms]]            link to another legal page (privacy, terms, refunds)
 *   [[label|https://...]]      external link
 *   [UPPERCASE PLACEHOLDER]    highlighted so it is easy to find and replace
 *
 * When the wording changes, bump CONSENT_VERSION in lib/backend/consents.ts so
 * we know which version each person agreed to.
 */
import { BRAND_NAME } from "../../lib/brand";
import { CONSENT_VERSION } from "../../lib/backend/consents";

export { PHOTO_ACCESS_TEXT, WAIVER_LABEL, WAIVER_TEXT } from "./waiver";

export type LegalLang = "en" | "ar";
export type LegalKey = "privacy" | "terms" | "refunds";

export type LegalBlock =
  | string
  | { list: string[] }
  | { table: { head: string[]; rows: string[][] } }
  | { note: string };

export interface LegalSection {
  id: string;
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalDoc {
  key: LegalKey;
  title: string;
  /** one-line description, used for search and social cards */
  description: string;
  /** short plain-language points shown above the full text */
  summary: string[];
  sections: LegalSection[];
}

export const LEGAL_VERSION = CONSENT_VERSION;

export const COMPANY = {
  name: "[COMPANY NAME B.V.]",
  kvk: "[KVK NUMBER]",
  address: "[ADDRESS]",
  email: "[CONTACT EMAIL]",
};

/** Prices in KWD, as charged. Keep in step with the Stripe prices. */
export const PRICES = {
  report: "20.000",
  monthly: "5.000",
  yearly: "45.000",
};

export const LEGAL_KEYS: LegalKey[] = ["privacy", "terms", "refunds"];

export function legalHref(key: LegalKey, lang: LegalLang): string {
  return lang === "ar" ? `/ar/${key}` : `/${key}`;
}

/* ------------------------------------------------------------------ */
/*  Interface text                                                     */
/* ------------------------------------------------------------------ */

export const LEGAL_UI = {
  en: {
    nav: { privacy: "Privacy", terms: "Terms", refunds: "Refunds" } as Record<LegalKey, string>,
    version: "Version",
    inShort: "In short",
    contents: "Contents",
    switchLang: "العربية",
    home: "Home",
    questions: "Questions about this page?",
    contactLine: `Write to us at ${COMPANY.email}. ${COMPANY.name}, ${COMPANY.address}, the Netherlands. Chamber of Commerce (KvK) ${COMPANY.kvk}.`,
    draft: "Draft, not yet reviewed by a lawyer. This note only shows in development builds.",
    translationNote: "The English and Arabic versions are equally valid. If they differ, the meaning more favourable to you applies.",
    print: "Print",
  },
  ar: {
    nav: { privacy: "الخصوصية", terms: "الشروط", refunds: "الاسترداد" } as Record<LegalKey, string>,
    version: "الإصدار",
    inShort: "باختصار",
    contents: "المحتويات",
    switchLang: "English",
    home: "الرئيسية",
    questions: "عندكم سؤال عن هذه الصفحة؟",
    contactLine: `راسلونا على ${COMPANY.email}. ${COMPANY.name}، ${COMPANY.address}، هولندا. رقم السجل التجاري الهولندي (KvK): ${COMPANY.kvk}.`,
    draft: "مسودة لم يراجعها محامٍ بعد. هذه الملاحظة تظهر في نسخة التطوير فقط.",
    translationNote:
      "هذه النسخة العربية والنسخة الإنجليزية متساويتان في الحجية. وإذا اختلف المعنى بينهما، يُعتمد التفسير الأفضل لكم.",
    print: "طباعة",
  },
};

/* ------------------------------------------------------------------ */
/*  Privacy policy                                                     */
/* ------------------------------------------------------------------ */

const privacyEn: LegalDoc = {
  key: "privacy",
  title: "Privacy policy",
  description: `How ${BRAND_NAME} collects, uses, stores and deletes your data and photos, and the rights you have under the GDPR.`,
  summary: [
    "Your photos are measured on your device first. They are sent to us only when you submit them for review in a paid order.",
    "Our database and your photos are stored in the European Union (Frankfurt, Germany). Some providers, such as our image provider, may process data outside the EU under GDPR safeguards.",
    "Photos are deleted 90 days after your report is delivered, or straight away if you withdraw your photo consent or delete your account.",
    "Your photos are seen by the reviewer assigned to your order. Our admins, a small number of authorised staff, can also open orders to check quality and to help with support.",
    "We never sell your data, never use your photos in marketing and never use them to train AI models.",
    "You can download or delete your data at any time.",
  ],
  sections: [
    {
      id: "who",
      heading: "1. Who we are",
      blocks: [
        `${BRAND_NAME} is run by ${COMPANY.name}, a private limited company registered in the Netherlands (Chamber of Commerce number ${COMPANY.kvk}), at ${COMPANY.address}. We are the "controller" of your personal data: we decide why and how it is used, and we are responsible for it.`,
        `For any privacy question or request, write to ${COMPANY.email}.`,
        "This policy covers our website, the app and the service we provide to customers in Kuwait. The Dutch and EU rules on data protection (the General Data Protection Regulation, \"GDPR\") apply to everything we do with your data, wherever you live.",
      ],
    },
    {
      id: "what",
      heading: "2. What we collect",
      blocks: [
        { list: [
          "Account details: your email address, and if you give them, your name and phone number. Your preferred language, your gender and your birth year.",
          "Consent records: what you agreed to (for example the terms, the privacy policy, photo processing) and when, with the version of the text.",
          "Orders and payments: what you bought, the amount, the order status and payment references. Card details are handled by Stripe; we never see or store your full card number.",
          "Your answers: what you tell us in the questionnaire, such as height, weight, goals and habits (for example smoking, alcohol, skin and hair concerns). Some answers and results are health information; we use them only with your explicit consent.",
          "Photos: your face from several angles and expressions, and your body from the front and side, as the photo guide asks.",
          "Results: the measurements, scores and 12-month plan worked out from your photos and answers (including a body-fat estimate and waist ratios), notes from the reviewer, and the AI illustrations made for your plan.",
          "Technical data: your IP address, browser and device type, and logs of sign-ins and errors, used to keep the service secure and working.",
          "Waitlist: your email, the service you are waiting for (for example the women's service), where you heard about us, your confirmation that you are 18 or older, and your preferred language.",
        ] },
        "We use only the browser storage that the service needs to work, such as keeping you signed in and remembering your language. We do not use advertising cookies or tracking pixels on this site. If we add analytics or advertising tools that need your permission, we will ask first and update this policy.",
      ],
    },
    {
      id: "device",
      heading: "3. What happens on your device",
      blocks: [
        "The analysis of your photos runs in your browser, on your own device. Taking photos and seeing your first measurements does not send them to us. Your photos leave your device only when you submit them for review as part of a paid order.",
      ],
    },
    {
      id: "why",
      heading: "4. Why we use your data, and our legal basis",
      blocks: [
        "Data-protection law requires a legal reason (a \"lawful basis\") for each use of personal data. These are ours:",
        { table: {
          head: ["What we do", "Data used", "Lawful basis"],
          rows: [
            ["Create your account, take your order, deliver your report and plan, provide membership check-ins", "Account details, order data", "Performance of our contract with you (GDPR art. 6(1)(b))"],
            ["Use your health-related answers and results to build your plan", "Weight, body-fat estimate, waist ratios, smoking, alcohol, skin and hair concerns", "Necessary for our contract (GDPR art. 6(1)(b)) and your explicit consent (GDPR art. 9(2)(a))"],
            ["Analyse your photos, have a person review them, and create your AI illustrations", "Photos and the facial and body measurements taken from them", "Necessary for our contract (GDPR art. 6(1)(b)) and your explicit consent (GDPR art. 9(2)(a))"],
            ["Take payments and keep accounting records", "Order and payment data", "Contract, and our legal obligation to keep accounts under Dutch tax law (GDPR art. 6(1)(c))"],
            ["Keep the service secure, prevent fraud and abuse", "Technical data, sign-in records", "Our legitimate interest in a safe, working service (GDPR art. 6(1)(f))"],
            ["Send emails about your order and account", "Email address", "Performance of our contract with you"],
            ["Send news and offers", "Email address", "Your consent, which you can withdraw in any email or on your Account page"],
            ["Tell you when the service opens for you (waitlist)", "Waitlist details", "Your consent"],
          ],
        } },
        "Measurements taken from photos of your face can count as sensitive (biometric) data. We do not use them to identify you or to recognise you in other photos, but we treat them with the same care as sensitive data and process them only with your explicit consent.",
        "We do not make decisions about you that have legal or similarly significant effects based only on automated processing. Scores are calculated automatically, and a person checks every report before it reaches you.",
      ],
    },
    {
      id: "never",
      heading: "5. What we will never do",
      blocks: [
        { list: [
          "Sell or rent your personal data to anyone.",
          "Use your photos, results or AI illustrations in advertising or marketing, or show them publicly.",
          "Use your photos or data to train AI models, or let our providers do so.",
          "Share your data with third parties for their own marketing.",
        ] },
      ],
    },
    {
      id: "who-sees",
      heading: "6. Who sees your data",
      blocks: [
        "Inside our team: the reviewer assigned to your order sees your photos, answers and results to check your report. Our admins, a small number of authorised staff, can also open orders, including the photos, to check the quality of our work, to answer a support request or to fix a problem. Access is limited by role, and everyone with access is bound by confidentiality.",
        "Our reviewers work for us under a written contract with confidentiality and data-protection terms. [REVIEWERS: state where reviewers work. If any work from Kuwait or another country outside the EU, say so here and that they access data under the European Commission's standard contractual clauses. Confirm with the lawyer.]",
        "Service providers (\"processors\") that handle data for us, only on our instructions and under a data processing agreement:",
        { table: {
          head: ["Provider", "What they do for us", "Where"],
          rows: [
            ["Supabase", "Database, sign-in and private file storage (including your photos)", "EU (Frankfurt, Germany)"],
            ["Vercel", "Hosting and delivering the website and app", "[REGION]"],
            ["Stripe", "Card payments, subscriptions and refunds", "[REGION]"],
            ["[IMAGE PROVIDER]", "Creating your AI illustrations from the photos needed for them", "[REGION]"],
            ["Resend", "Sending emails about your order, your membership and your account, including your sign-in code", "[REGION]"],
          ],
        } },
        "For some purposes, such as preventing fraud and meeting financial regulations, Stripe is responsible for its own processing as a separate controller under its own privacy policy.",
        "Our image provider receives only the photos needed to create your illustration, and may not keep them or use them for any other purpose, including training its models.",
        "We advertise on Meta (Facebook and Instagram). This site has no Meta pixel or other advertising tracker, and we do not send your data to Meta: we only read total campaign figures, such as spend and clicks, from our own ad account. If we ever add the pixel, we will ask for your consent first and add Meta to this list.",
        "We may also share data when the law requires it, for example with tax authorities or in answer to a valid court order.",
      ],
    },
    {
      id: "transfers",
      heading: "7. International transfers",
      blocks: [
        "You use the service from Kuwait, and your data is stored in the European Union (Frankfurt, Germany). When you use the service, your data travels from your device to our servers in the EU.",
        `Some of our providers are based in, or may access data from, countries outside the EU, such as the United States. Where that happens, we use the protections the GDPR requires, such as the EU-US Data Privacy Framework where the provider is certified, or the European Commission's standard contractual clauses. You can ask us for a copy of these safeguards at ${COMPANY.email}.`,
        "[KUWAIT: confirm with counsel how the CITRA Data Privacy Protection Regulation applies, including consent to transfer data outside Kuwait and breach notification, and add what is needed here.]",
      ],
    },
    {
      id: "retention",
      heading: "8. How long we keep your data",
      blocks: [
        { table: {
          head: ["Data", "How long"],
          rows: [
            ["Photos you submit", "Deleted automatically 90 days after your report is delivered. Deleted straight away if you withdraw your photo consent or delete your account. If an order is cancelled or refunded, or never completed, its photos are deleted 90 days after it closed or the photos were taken."],
            ["AI illustrations made from your photos", "Kept in your account so you can see your plan, until you delete your account, or 24 months after your last activity (your last order or the end of your membership), whichever comes first. Illustrations for an order that is cancelled or refunded before delivery are deleted with its photos."],
            ["Measurements, scores, health answers, plan and reviewer notes (without photos)", "Until you delete your account, or 24 months after your last activity (your last order or the end of your membership), whichever comes first. If you withdraw your photo consent, we also delete the measurements and health answers taken from your photos straight away."],
            ["Account details and consent records", "Until you delete your account. Consent records may be kept longer where we need to show what you agreed to."],
            ["Payment and accounting records", "7 years, as Dutch tax law requires. When you delete your account, these records are separated from your profile."],
            ["Security and error logs", "A limited time, normally no longer than 90 days"],
            ["Waitlist entries", "Deleted 24 months after you join, or earlier if you ask to be removed"],
          ],
        } },
      ],
    },
    {
      id: "rights",
      heading: "9. Your rights",
      blocks: [
        "Under the GDPR you have the right to:",
        { list: [
          "Access: get a copy of the data we hold about you.",
          "Rectification: have incorrect data corrected.",
          "Erasure: have your data deleted.",
          "Portability: receive your data in a common, machine-readable format.",
          "Objection: object to processing based on our legitimate interest.",
          "Restriction: ask us to limit how we use your data in some situations.",
          "Withdraw consent at any time, for example for your photos or for marketing emails. This does not affect what we did before you withdrew it.",
        ] },
        `You can download or delete your data yourself on your Account page, or write to ${COMPANY.email}. We answer within one month. We may ask you to confirm your identity first.`,
        "If you withdraw your photo consent, we delete your photos and the measurements and health answers taken from them. If you do this before your report is delivered, we cannot complete the review. What happens to your payment is explained in the [[refund policy|refunds]].",
        "If you are unhappy with how we handle your data, please tell us first so we can put it right. You also have the right to complain to the Dutch data-protection authority, the [[Autoriteit Persoonsgegevens|https://autoriteitpersoonsgegevens.nl]], or to a data-protection authority in the country where you live.",
      ],
    },
    {
      id: "security",
      heading: "10. How we protect your data",
      blocks: [
        "Data is encrypted in transit and at rest. Photos are kept in private storage that only you, your assigned reviewer and authorised staff can reach, and they are shown through links that expire. Access inside our team is limited to people who need it.",
        "If a data breach puts your rights at risk, we will tell you and the relevant authorities as the law requires.",
      ],
    },
    {
      id: "age",
      heading: "11. Age and who the service is for",
      blocks: [
        "The service is only for people aged 18 or older. We ask you to confirm your age before you sign up. If we learn that someone under 18 has given us data, we delete it.",
        "At launch the service is available to men only. Women can join the waitlist; we use waitlist details only to tell you when the service opens for you.",
      ],
    },
    {
      id: "changes",
      heading: "12. Changes to this policy",
      blocks: [
        "If we change this policy, we update the version date at the top. If the change matters for how we use your data, we will tell you by email or in the app before it takes effect, and ask for your consent again where the law requires it.",
      ],
    },
  ],
};

const privacyAr: LegalDoc = {
  key: "privacy",
  title: "سياسة الخصوصية",
  description: `كيف يجمع ${BRAND_NAME} بياناتكم وصوركم ويستخدمها ويحفظها ويحذفها، وحقوقكم بموجب اللائحة الأوروبية لحماية البيانات.`,
  summary: [
    "تُحلَّل صوركم أولاً على جهازكم، ولا تُرسَل إلينا إلا عندما ترسلونها للمراجعة ضمن طلب مدفوع.",
    "تُحفَظ قاعدة بياناتنا وصوركم داخل الاتحاد الأوروبي (فرانكفورت، ألمانيا). وقد يعالج بعض المزوّدين، مثل مزوّد خدمة إنشاء الصور، البيانات خارج الاتحاد الأوروبي وفق ضمانات اللائحة الأوروبية.",
    "تُحذَف الصور بعد 90 يوماً من تسليم التقرير، أو فوراً إذا سحبتم موافقتكم على معالجة الصور أو حذفتم حسابكم.",
    "يطّلع على صوركم المراجِع المكلّف بطلبكم. ويمكن أيضاً لمسؤولي النظام لدينا، وهم عدد محدود من الموظفين المخوّلين، فتح الطلبات لمراجعة الجودة وللمساعدة في الدعم.",
    "لا نبيع بياناتكم أبداً، ولا نستخدم صوركم في التسويق، ولا نستخدمها لتدريب نماذج الذكاء الاصطناعي.",
    "يمكنكم تنزيل بياناتكم أو حذفها في أي وقت.",
  ],
  sections: [
    {
      id: "who",
      heading: "1. من نحن",
      blocks: [
        `تُدير ${BRAND_NAME} شركة ${COMPANY.name}، وهي شركة ذات مسؤولية محدودة مسجّلة في هولندا (رقم السجل التجاري ${COMPANY.kvk})، وعنوانها ${COMPANY.address}. نحن "المسؤول عن معالجة" بياناتكم الشخصية، أي أننا نحدد سبب استخدامها وطريقته، ونتحمّل المسؤولية عنها.`,
        `لأي سؤال أو طلب يخص الخصوصية، راسلونا على ${COMPANY.email}.`,
        "تشمل هذه السياسة موقعنا والتطبيق والخدمة التي نقدّمها للعملاء في الكويت. وتنطبق قواعد حماية البيانات الهولندية والأوروبية (اللائحة العامة لحماية البيانات \"GDPR\") على كل ما نقوم به ببياناتكم، أينما كنتم.",
      ],
    },
    {
      id: "what",
      heading: "2. البيانات التي نجمعها",
      blocks: [
        { list: [
          "بيانات الحساب: البريد الإلكتروني، والاسم ورقم الهاتف إذا قدّمتموهما، واللغة المفضّلة، والجنس، وسنة الميلاد.",
          "سجلات الموافقة: ما وافقتم عليه (مثل الشروط وسياسة الخصوصية ومعالجة الصور) ومتى، مع رقم إصدار النص.",
          "الطلبات والمدفوعات: ما اشتريتموه، والمبلغ، وحالة الطلب، ومراجع الدفع. تتولّى Stripe بيانات البطاقة، ولا نرى رقم بطاقتكم الكامل ولا نحفظه.",
          "إجاباتكم: ما تذكرونه في الاستبيان، مثل الطول والوزن والأهداف والعادات (مثل التدخين والكحول ومشاكل البشرة والشعر). وبعض الإجابات والنتائج معلومات صحية، ولا نستخدمها إلا بموافقتكم الصريحة.",
          "الصور: صور الوجه من عدة زوايا وتعابير، وصور الجسم من الأمام والجانب، حسب دليل التصوير.",
          "النتائج: القياسات والدرجات وخطة الـ 12 شهراً المستخرجة من صوركم وإجاباتكم (ومنها تقدير نسبة الدهون في الجسم ونِسَب محيط الخصر)، وملاحظات المراجِع، والصور التوضيحية المُنشأة بالذكاء الاصطناعي لخطتكم.",
          "البيانات التقنية: عنوان IP، ونوع المتصفح والجهاز، وسجلات الدخول والأخطاء، لحماية الخدمة وضمان عملها.",
          "قائمة الانتظار: بريدكم الإلكتروني، والخدمة التي تنتظرونها (مثل خدمة النساء)، ومن أين عرفتم عنا، وتأكيدكم أن أعماركم 18 سنة أو أكثر، واللغة المفضّلة.",
        ] },
        "نستخدم فقط تخزين المتصفح الذي تحتاجه الخدمة لتعمل، مثل إبقائكم مسجّلين وتذكّر لغتكم. لا نستخدم ملفات تعريف الارتباط الإعلانية ولا أدوات التتبّع الإعلاني في هذا الموقع. وإذا أضفنا أدوات تحليل أو إعلان تحتاج إلى إذنكم، فسنطلب موافقتكم أولاً ونحدّث هذه السياسة.",
      ],
    },
    {
      id: "device",
      heading: "3. ما يحدث على جهازكم",
      blocks: [
        "يتم تحليل صوركم داخل المتصفح على جهازكم أنتم. التقاط الصور ورؤية القياسات الأولى لا يرسلها إلينا. لا تغادر صوركم جهازكم إلا عندما ترسلونها للمراجعة ضمن طلب مدفوع.",
      ],
    },
    {
      id: "why",
      heading: "4. لماذا نستخدم بياناتكم، وأساسنا القانوني",
      blocks: [
        "يشترط قانون حماية البيانات وجود سبب قانوني (\"أساس قانوني\") لكل استخدام للبيانات الشخصية. وهذه أسبابنا:",
        { table: {
          head: ["ما نقوم به", "البيانات المستخدمة", "الأساس القانوني"],
          rows: [
            ["إنشاء حسابكم، واستلام طلبكم، وتسليم التقرير والخطة، وتقديم المتابعات الشهرية للعضوية", "بيانات الحساب، بيانات الطلب", "تنفيذ العقد بيننا وبينكم (المادة 6(1)(ب) من اللائحة)"],
            ["استخدام إجاباتكم ونتائجكم المتعلقة بالصحة لإعداد خطتكم", "الوزن، وتقدير نسبة الدهون، ونِسَب محيط الخصر، والتدخين، والكحول، ومشاكل البشرة والشعر", "ضرورية لتنفيذ العقد (المادة 6(1)(ب) من اللائحة) وموافقتكم الصريحة (المادة 9(2)(أ) من اللائحة)"],
            ["تحليل صوركم، ومراجعتها من قبل شخص، وإنشاء الصور التوضيحية بالذكاء الاصطناعي", "الصور وقياسات الوجه والجسم المأخوذة منها", "ضرورية لتنفيذ العقد (المادة 6(1)(ب) من اللائحة) وموافقتكم الصريحة (المادة 9(2)(أ) من اللائحة)"],
            ["استلام المدفوعات والاحتفاظ بالسجلات المحاسبية", "بيانات الطلب والدفع", "العقد، والتزامنا القانوني بحفظ الحسابات وفق قانون الضرائب الهولندي (المادة 6(1)(ج) من اللائحة)"],
            ["حماية الخدمة ومنع الاحتيال وإساءة الاستخدام", "البيانات التقنية، سجلات الدخول", "مصلحتنا المشروعة في خدمة آمنة تعمل بشكل سليم (المادة 6(1)(و) من اللائحة)"],
            ["إرسال رسائل عن طلبكم وحسابكم", "البريد الإلكتروني", "تنفيذ العقد بيننا وبينكم"],
            ["إرسال الأخبار والعروض", "البريد الإلكتروني", "موافقتكم، ويمكنكم سحبها من أي رسالة أو من صفحة حسابكم"],
            ["إبلاغكم عند افتتاح الخدمة لكم (قائمة الانتظار)", "بيانات قائمة الانتظار", "موافقتكم"],
          ],
        } },
        "القياسات المأخوذة من صور الوجه قد تُعدّ بيانات حساسة (بيانات بيومترية). نحن لا نستخدمها للتعرّف على هويتكم ولا لتمييزكم في صور أخرى، لكننا نتعامل معها بنفس عناية البيانات الحساسة، ولا نعالجها إلا بموافقتكم الصريحة.",
        "لا نتخذ بشأنكم قرارات لها آثار قانونية أو آثار مهمة مماثلة بناءً على المعالجة الآلية وحدها. تُحسَب الدرجات آلياً، ويراجع شخص من فريقنا كل تقرير قبل أن يصلكم.",
      ],
    },
    {
      id: "never",
      heading: "5. ما لن نفعله أبداً",
      blocks: [
        { list: [
          "بيع بياناتكم الشخصية أو تأجيرها لأي جهة.",
          "استخدام صوركم أو نتائجكم أو صوركم التوضيحية في الإعلانات أو التسويق، أو عرضها للعامة.",
          "استخدام صوركم أو بياناتكم لتدريب نماذج الذكاء الاصطناعي، أو السماح لمزوّدينا بذلك.",
          "مشاركة بياناتكم مع أطراف أخرى لأغراضها التسويقية.",
        ] },
      ],
    },
    {
      id: "who-sees",
      heading: "6. من يطّلع على بياناتكم",
      blocks: [
        "داخل فريقنا: يطّلع المراجِع المكلّف بطلبكم على صوركم وإجاباتكم ونتائجكم لمراجعة تقريركم. ويمكن أيضاً لمسؤولي النظام لدينا، وهم عدد محدود من الموظفين المخوّلين، فتح الطلبات بما فيها الصور، لمراجعة جودة عملنا أو للرد على طلب دعم أو لإصلاح مشكلة. والوصول محدود حسب الدور، وكل من لديه صلاحية وصول ملتزم بالسرية.",
        "يعمل المراجِعون لدينا بموجب عقد مكتوب يتضمّن شروط السرية وحماية البيانات. [REVIEWERS: state where reviewers work. If any work from Kuwait or another country outside the EU, say so here and that they access data under the European Commission's standard contractual clauses. Confirm with the lawyer.]",
        "مزوّدو الخدمات (\"جهات المعالجة\") الذين يعالجون البيانات نيابةً عنا، وفق تعليماتنا فقط وبموجب اتفاقية معالجة بيانات:",
        { table: {
          head: ["المزوّد", "ما يقدّمه لنا", "الموقع"],
          rows: [
            ["Supabase", "قاعدة البيانات وتسجيل الدخول والتخزين الخاص للملفات (ومنها صوركم)", "الاتحاد الأوروبي (فرانكفورت، ألمانيا)"],
            ["Vercel", "استضافة الموقع والتطبيق وتشغيلهما", "[REGION]"],
            ["Stripe", "مدفوعات البطاقات والاشتراكات والمبالغ المستردة", "[REGION]"],
            ["[IMAGE PROVIDER]", "إنشاء الصور التوضيحية بالذكاء الاصطناعي من الصور اللازمة لها", "[REGION]"],
            ["Resend", "إرسال الرسائل الإلكترونية الخاصة بطلبكم وعضويتكم وحسابكم، ومنها رمز تسجيل الدخول", "[REGION]"],
          ],
        } },
        "في بعض الأغراض، مثل منع الاحتيال والالتزام بالأنظمة المالية، تكون Stripe مسؤولة عن معالجتها الخاصة بصفتها جهة مستقلة، وفق سياسة الخصوصية الخاصة بها.",
        "لا يتلقّى مزوّد خدمة إنشاء الصور إلا الصور اللازمة لإنشاء الصورة التوضيحية، ولا يُسمح له بالاحتفاظ بها أو استخدامها لأي غرض آخر، بما في ذلك تدريب نماذجه.",
        "نعلن على منصات Meta (فيسبوك وإنستغرام). ولا يوجد في هذا الموقع بكسل Meta ولا أي أداة تتبّع إعلاني، ولا نرسل بياناتكم إلى Meta: نقرأ فقط الأرقام الإجمالية للحملات، مثل الإنفاق وعدد النقرات، من حسابنا الإعلاني. وإذا أضفنا البكسل يوماً، سنطلب موافقتكم أولاً ونضيف Meta إلى هذه القائمة.",
        "وقد نشارك البيانات عندما يُلزمنا القانون بذلك، مثل الجهات الضريبية أو تنفيذاً لأمر قضائي صحيح.",
      ],
    },
    {
      id: "transfers",
      heading: "7. نقل البيانات خارج البلد",
      blocks: [
        "تستخدمون الخدمة من الكويت، وتُحفَظ بياناتكم داخل الاتحاد الأوروبي (فرانكفورت، ألمانيا). عند استخدام الخدمة، تنتقل بياناتكم من جهازكم إلى خوادمنا في الاتحاد الأوروبي.",
        `بعض مزوّدينا موجودون في دول خارج الاتحاد الأوروبي، مثل الولايات المتحدة، أو قد يصلون إلى البيانات منها. وفي هذه الحالة نطبّق الضمانات التي تشترطها اللائحة الأوروبية، مثل إطار خصوصية البيانات بين الاتحاد الأوروبي والولايات المتحدة إذا كان المزوّد معتمداً فيه، أو البنود التعاقدية النموذجية الصادرة عن المفوضية الأوروبية. ويمكنكم طلب نسخة من هذه الضمانات على ${COMPANY.email}.`,
        "[KUWAIT: confirm with counsel how the CITRA Data Privacy Protection Regulation applies, including consent to transfer data outside Kuwait and breach notification, and add what is needed here.]",
      ],
    },
    {
      id: "retention",
      heading: "8. مدة الاحتفاظ بالبيانات",
      blocks: [
        { table: {
          head: ["البيانات", "المدة"],
          rows: [
            ["الصور التي ترسلونها", "تُحذَف تلقائياً بعد 90 يوماً من تسليم التقرير. وتُحذَف فوراً إذا سحبتم موافقتكم على معالجة الصور أو حذفتم حسابكم. وإذا أُلغي الطلب أو استُرد مبلغه أو لم يكتمل، تُحذَف صوره بعد 90 يوماً من إغلاقه أو من التقاط الصور."],
            ["الصور التوضيحية المُنشأة من صوركم", "تبقى في حسابكم لتتمكّنوا من الاطلاع على خطتكم، حتى تحذفوا حسابكم، أو بعد 24 شهراً من آخر نشاط لكم (آخر طلب أو انتهاء عضويتكم)، أيهما أسبق. وتُحذَف الصور التوضيحية لأي طلب أُلغي أو استُرد مبلغه قبل التسليم مع صوره."],
            ["القياسات والدرجات والإجابات الصحية والخطة وملاحظات المراجِع (بدون صور)", "حتى تحذفوا حسابكم، أو بعد 24 شهراً من آخر نشاط لكم (آخر طلب أو انتهاء عضويتكم)، أيهما أسبق. وإذا سحبتم موافقتكم على معالجة الصور، نحذف أيضاً فوراً القياسات والإجابات الصحية المأخوذة من صوركم."],
            ["بيانات الحساب وسجلات الموافقة", "حتى تحذفوا حسابكم. وقد نحتفظ بسجلات الموافقة مدة أطول إذا احتجنا إلى إثبات ما وافقتم عليه."],
            ["سجلات الدفع والمحاسبة", "7 سنوات، كما يشترط قانون الضرائب الهولندي. وعند حذف حسابكم تُفصَل هذه السجلات عن ملفكم الشخصي."],
            ["سجلات الأمان والأخطاء", "مدة محدودة، لا تتجاوز عادةً 90 يوماً"],
            ["بيانات قائمة الانتظار", "تُحذَف بعد 24 شهراً من التسجيل، أو قبل ذلك إذا طلبتم إزالتها"],
          ],
        } },
      ],
    },
    {
      id: "rights",
      heading: "9. حقوقكم",
      blocks: [
        "بموجب اللائحة الأوروبية لحماية البيانات، يحق لكم:",
        { list: [
          "الاطلاع: الحصول على نسخة من بياناتكم التي لدينا.",
          "التصحيح: تصحيح أي بيانات غير صحيحة.",
          "الحذف: حذف بياناتكم.",
          "قابلية النقل: استلام بياناتكم بصيغة شائعة يمكن قراءتها آلياً.",
          "الاعتراض: الاعتراض على المعالجة القائمة على مصلحتنا المشروعة.",
          "التقييد: طلب تقييد استخدامنا لبياناتكم في حالات معيّنة.",
          "سحب الموافقة في أي وقت، مثل موافقتكم على معالجة الصور أو على الرسائل التسويقية. ولا يؤثر ذلك على ما تم قبل سحبها.",
        ] },
        `يمكنكم تنزيل بياناتكم أو حذفها بأنفسكم من صفحة حسابكم، أو مراسلتنا على ${COMPANY.email}. نرد خلال شهر واحد، وقد نطلب منكم تأكيد هويتكم أولاً.`,
        "إذا سحبتم موافقتكم على معالجة الصور، نحذف صوركم والقياسات والإجابات الصحية المأخوذة منها. وإذا فعلتم ذلك قبل تسليم التقرير، لا نستطيع إكمال المراجعة. وتوضّح [[سياسة الاسترداد|refunds]] ما يحدث للمبلغ المدفوع.",
        "إذا لم تكونوا راضين عن طريقة تعاملنا مع بياناتكم، نرجو إبلاغنا أولاً لنصحّح الأمر. ويحق لكم أيضاً تقديم شكوى إلى هيئة حماية البيانات الهولندية [[Autoriteit Persoonsgegevens|https://autoriteitpersoonsgegevens.nl]]، أو إلى جهة حماية البيانات في بلد إقامتكم.",
      ],
    },
    {
      id: "security",
      heading: "10. كيف نحمي بياناتكم",
      blocks: [
        "البيانات مشفّرة أثناء النقل وأثناء التخزين. تُحفَظ الصور في تخزين خاص لا يصل إليه إلا أنتم والمراجِع المكلّف بطلبكم والموظفون المخوّلون، وتُعرَض عبر روابط تنتهي صلاحيتها. ويقتصر الوصول داخل فريقنا على من يحتاج إليه.",
        "إذا وقع اختراق للبيانات يعرّض حقوقكم للخطر، سنبلغكم ونبلغ الجهات المختصة كما يشترط القانون.",
      ],
    },
    {
      id: "age",
      heading: "11. العمر ولمن الخدمة",
      blocks: [
        "الخدمة مخصّصة فقط لمن أعمارهم 18 سنة فأكثر، ونطلب تأكيد العمر قبل التسجيل. وإذا علمنا أن شخصاً دون 18 سنة قدّم لنا بيانات، نحذفها.",
        "عند الإطلاق، الخدمة متاحة للرجال فقط. ويمكن للنساء الانضمام إلى قائمة الانتظار، ولا نستخدم بيانات القائمة إلا لإبلاغكنّ عند افتتاح الخدمة.",
      ],
    },
    {
      id: "changes",
      heading: "12. التغييرات على هذه السياسة",
      blocks: [
        "إذا غيّرنا هذه السياسة، نحدّث تاريخ الإصدار في أعلى الصفحة. وإذا كان التغيير يؤثر على طريقة استخدامنا لبياناتكم، نبلغكم بالبريد الإلكتروني أو داخل التطبيق قبل سريانه، ونطلب موافقتكم من جديد عندما يشترط القانون ذلك.",
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/*  Terms of service                                                   */
/* ------------------------------------------------------------------ */

const termsEn: LegalDoc = {
  key: "terms",
  title: "Terms of service",
  description: `The terms for using ${BRAND_NAME}: what the service is and is not, prices in KWD, membership and cancellation, and your rights.`,
  summary: [
    "Wellness and aesthetic guidance. Not medical advice, diagnosis or treatment.",
    "AI illustrations show a possible direction, not a promised result.",
    "For adults aged 18 or older. Men only at launch; women can join the waitlist.",
    `Report ${PRICES.report} KWD, including the first 30 days of membership. After that, membership is optional: ${PRICES.monthly} KWD a month, or ${PRICES.yearly} KWD for 12 months, then ${PRICES.monthly} KWD a month. Cancel any time.`,
    "You can withdraw from a purchase within 14 days, as set out in section 8.",
    "We aim to deliver within 72 hours after you submit your photos.",
  ],
  sections: [
    {
      id: "about",
      heading: "1. About these terms",
      blocks: [
        `These terms are a contract between you and ${COMPANY.name}, registered in the Netherlands (Chamber of Commerce number ${COMPANY.kvk}), ${COMPANY.address} ("we", "us"). They apply when you use ${BRAND_NAME} and when you buy a report or a membership. Please read them together with our [[privacy policy|privacy]] and [[refund policy|refunds]].`,
      ],
    },
    {
      id: "service",
      heading: "2. What the service is",
      blocks: [
        `${BRAND_NAME} measures your face and body from photos you take, explains the results, and gives you a 12-month plan for skin, grooming, hair, training, nutrition and posture. A person from our team reviews each report before you receive it. The plan includes AI illustrations that show a possible direction for non-surgical changes.`,
        "The service gives wellness and aesthetic guidance. It is not medical advice and does not diagnose, treat or prevent any disease or condition. Scores and measurements are estimates from photos and can be affected by lighting, angle and camera. Talk to a doctor before you change your diet, start a new training routine or use any treatment, especially if you have a health condition or take medication.",
      ],
    },
    {
      id: "ai",
      heading: "3. AI illustrations",
      blocks: [
        "AI illustrations are generated images. They are not photos of you, not a prediction, and not a promise of any result. They are limited to changes your plan covers (such as grooming, hair, skin and body composition) and are checked by a person before you see them. Your own results depend on many things, including how closely you follow the plan.",
      ],
    },
    {
      id: "eligibility",
      heading: "4. Who can use the service",
      blocks: [
        { list: [
          "You must be 18 or older.",
          "At launch the service is for men only. Women can join the waitlist and we will tell them when it opens.",
          "The service is offered to customers in Kuwait.",
          "The information you give us, including your age, must be true.",
        ] },
      ],
    },
    {
      id: "account",
      heading: "5. Your account",
      blocks: [
        "You sign in with a one-time code sent to your email. Keep access to your email secure; anyone who can read it can sign in to your account. Tell us straight away if you think someone else has used your account.",
      ],
    },
    {
      id: "prices",
      heading: "6. Products and prices",
      blocks: [
        { table: {
          head: ["Product", "Price", "What you get"],
          rows: [
            ["Report", `${PRICES.report} KWD, one payment`, "Your face and body analysis, 12-month plan, AI illustrations and PDF, reviewed by a person. Includes the first 30 days of membership."],
            ["Membership, monthly", `${PRICES.monthly} KWD a month`, "A monthly check-in scan with updated scores and plan, a reviewer note each month, and a new 12-month illustration every 3 months."],
            ["Membership, yearly", `${PRICES.yearly} KWD for 12 months, then ${PRICES.monthly} KWD a month`, `The same as monthly, paid once for the first 12 months. After that it continues month to month at ${PRICES.monthly} KWD a month.`],
          ],
        } },
        "Prices are in Kuwaiti dinar (KWD) and are the total you pay to us. The price that applies is the one shown at checkout.",
      ],
    },
    {
      id: "membership",
      heading: "7. Membership, renewal and cancellation",
      blocks: [
        { list: [
          "If you buy the report on its own, you get 30 days of membership benefits. Nothing renews and you will not be charged again. We email you about 5 days before those 30 days end, with how to continue if you want to.",
          "If you buy the report with a membership, your membership continues after the first 30 days on the plan you chose (monthly or yearly), and the first membership payment is taken when those 30 days end.",
          "A monthly membership renews every month, and we charge the card you used, until you cancel.",
          `A yearly membership costs ${PRICES.yearly} KWD for 12 months, then ${PRICES.monthly} KWD a month. After the 12 months it continues month to month, and you can cancel at any time; it then ends at the end of that month. We remind you by email about 30 days before the 12 months end.`,
          "You can cancel at any time on your Account page. A monthly membership ends at the end of the month you have paid for, and you keep your benefits until then.",
          "If you end a yearly membership during its first 12 months, we refund a proportional part of the price for the full months that are left. The details are in the [[refund policy|refunds]].",
          "If we change the membership price, we will tell you at least 30 days before the change applies to you, and you can cancel before then.",
        ] },
      ],
    },
    {
      id: "withdrawal",
      heading: "8. Your right to withdraw (14 days)",
      blocks: [
        `You can withdraw from your purchase within 14 days of buying it without giving a reason. Tell us at ${COMPANY.email}, or use the model withdrawal form in the [[refund policy|refunds]]. Sending it before the 14 days end is enough.`,
        "Before you submit your photos, we ask you to confirm that you want us to start your report straight away, within the 14 days, and that you understand two things: if you withdraw after our review has started, you pay a proportional amount for the work already done; and once your report has been delivered, you lose the right to withdraw. We keep a record of this confirmation. Without it we cannot start your review.",
        "For a membership, the 14 days run from the day you start it.",
        "We refund you within 14 days of receiving your withdrawal, to the card you paid with.",
      ],
    },
    {
      id: "payment",
      heading: "9. Payment",
      blocks: [
        "Payments are processed by Stripe and charged in KWD. Your card details go directly to Stripe and are not stored by us. Because we are a company based outside Kuwait, your bank may treat the payment as an international transaction and charge its own fee. We do not receive that fee and cannot refund it.",
      ],
    },
    {
      id: "delivery",
      heading: "10. Delivery",
      blocks: [
        "After you pay, you take your photos with the guided scan and submit them. We aim to deliver your report within 72 hours after you submit your photos. This is a target, not a guarantee; we will tell you if it will take longer. If your photos cannot be used, we will ask you to retake them, and the 72 hours start again from the new photos.",
        "If we cannot deliver your report, you get a full refund as set out in the [[refund policy|refunds]].",
      ],
    },
    {
      id: "your-part",
      heading: "11. Your photos and your responsibilities",
      blocks: [
        { list: [
          "Upload only photos of yourself. Do not upload photos of anyone else, and never of anyone under 18.",
          "Follow the photo guide. Do not upload nude or intimate images.",
          "Use the service for yourself only, and not for any business purpose.",
          "Do not copy, resell, scrape or reverse engineer the service, or try to get around its security or limits.",
        ] },
        "We may suspend or close an account that breaks these rules, and delete photos that should not have been uploaded.",
      ],
    },
    {
      id: "ip",
      heading: "12. Intellectual property",
      blocks: [
        "We own the service, including the app, the methods, the text, the design and the reports' format. Your report is for your personal use.",
        "Your photos remain yours. You give us permission to use them only to provide the service to you, as described in our [[privacy policy|privacy]]. We do not use them in marketing and do not use them to train AI models. This permission ends when your photos are deleted.",
      ],
    },
    {
      id: "liability",
      heading: "13. Our liability",
      blocks: [
        "We provide the service with reasonable care and skill. Because the results are estimates and guidance, we cannot promise any particular outcome.",
        "We are liable for loss we cause by breaking these terms or the law. We are not liable for loss that was not foreseeable, or for loss caused by things outside our control. Nothing in these terms limits your rights under data-protection law or mandatory consumer law.",
        "Nothing in these terms limits liability that cannot be limited by law, such as liability for death or personal injury caused by negligence.",
      ],
    },
    {
      id: "changes-service",
      heading: "14. Changes to the service and to these terms",
      blocks: [
        "We may improve or change the service. If we change these terms in a way that matters to you, we will tell you before the change applies. If you do not agree, you can cancel your membership before then.",
      ],
    },
    {
      id: "ending",
      heading: "15. Ending the contract",
      blocks: [
        "You can stop using the service and delete your account at any time on your Account page. We can end the contract if you seriously break these terms, and will tell you why.",
      ],
    },
    {
      id: "law",
      heading: "16. Governing law and disputes",
      blocks: [
        "These terms are governed by Dutch law. If you are a consumer, you can bring a dispute before the competent court in the Netherlands or the courts of the country where you live, and you keep the protection of the mandatory consumer laws of that country. We will only bring a claim against you in the courts of the country where you live.",
        `If something goes wrong, please contact us first at ${COMPANY.email}. Most problems can be solved quickly that way.`,
      ],
    },
  ],
};

const termsAr: LegalDoc = {
  key: "terms",
  title: "الشروط والأحكام",
  description: `شروط استخدام ${BRAND_NAME}: ما هي الخدمة وما ليست هي، والأسعار بالدينار الكويتي، والعضوية والإلغاء، وحقوقكم.`,
  summary: [
    "إرشادات للعناية بالصحة العامة والمظهر، وليست استشارة طبية ولا تشخيصاً ولا علاجاً.",
    "الصور التوضيحية بالذكاء الاصطناعي تعرض اتجاهاً محتملاً، وليست نتيجة مضمونة.",
    "للبالغين من عمر 18 سنة فأكثر. للرجال فقط عند الإطلاق، ويمكن للنساء الانضمام إلى قائمة الانتظار.",
    `التقرير ${PRICES.report} د.ك ويشمل أول 30 يوماً من العضوية. وبعدها العضوية اختيارية: ${PRICES.monthly} د.ك شهرياً، أو ${PRICES.yearly} د.ك لمدة 12 شهراً ثم ${PRICES.monthly} د.ك شهرياً. ويمكن إلغاؤها في أي وقت.`,
    "يحق لكم الانسحاب من الشراء خلال 14 يوماً، كما هو موضّح في البند 8.",
    "نسعى لتسليم التقرير خلال 72 ساعة من إرسال صوركم.",
  ],
  sections: [
    {
      id: "about",
      heading: "1. عن هذه الشروط",
      blocks: [
        `هذه الشروط عقد بينكم وبين شركة ${COMPANY.name}، المسجّلة في هولندا (رقم السجل التجاري ${COMPANY.kvk})، وعنوانها ${COMPANY.address} ("نحن"). وتنطبق عند استخدامكم ${BRAND_NAME} وعند شراء تقرير أو عضوية. يُرجى قراءتها مع [[سياسة الخصوصية|privacy]] و[[سياسة الاسترداد|refunds]].`,
      ],
    },
    {
      id: "service",
      heading: "2. ما هي الخدمة",
      blocks: [
        `يقيس ${BRAND_NAME} ملامح الوجه والجسم من الصور التي تلتقطونها، ويشرح النتائج، ويقدّم لكم خطة لمدة 12 شهراً تشمل البشرة والعناية الشخصية والشعر والتمارين والتغذية وطريقة الوقوف. ويراجع شخص من فريقنا كل تقرير قبل أن يصلكم. وتتضمّن الخطة صوراً توضيحية بالذكاء الاصطناعي تعرض اتجاهاً محتملاً لتغييرات غير جراحية.`,
        "تقدّم الخدمة إرشادات للعناية بالصحة العامة والمظهر. وهي ليست استشارة طبية، ولا تشخّص أي مرض أو حالة ولا تعالجها ولا تقي منها. الدرجات والقياسات تقديرات مأخوذة من الصور، وقد تتأثر بالإضاءة والزاوية والكاميرا. استشيروا الطبيب قبل تغيير نظامكم الغذائي أو البدء بتمارين جديدة أو استخدام أي علاج، خاصةً إذا كانت لديكم حالة صحية أو تتناولون أدوية.",
      ],
    },
    {
      id: "ai",
      heading: "3. الصور التوضيحية بالذكاء الاصطناعي",
      blocks: [
        "الصور التوضيحية صور مُنشأة بالذكاء الاصطناعي. ليست صوراً لكم، وليست توقّعاً، ولا تعِد بأي نتيجة. وهي مقتصرة على التغييرات التي تشملها خطتكم (مثل العناية الشخصية والشعر والبشرة وتكوين الجسم)، ويراجعها شخص قبل أن تروها. نتائجكم الفعلية تعتمد على أمور كثيرة، منها مدى التزامكم بالخطة.",
      ],
    },
    {
      id: "eligibility",
      heading: "4. من يمكنه استخدام الخدمة",
      blocks: [
        { list: [
          "يجب أن يكون عمركم 18 سنة أو أكثر.",
          "عند الإطلاق، الخدمة للرجال فقط. ويمكن للنساء الانضمام إلى قائمة الانتظار، وسنبلغهنّ عند افتتاحها.",
          "تُقدَّم الخدمة للعملاء في الكويت.",
          "يجب أن تكون المعلومات التي تقدّمونها، ومنها العمر، صحيحة.",
        ] },
      ],
    },
    {
      id: "account",
      heading: "5. حسابكم",
      blocks: [
        "تسجّلون الدخول برمز يُرسَل مرة واحدة إلى بريدكم الإلكتروني. حافظوا على أمان بريدكم، فمن يستطيع قراءته يستطيع الدخول إلى حسابكم. وأبلغونا فوراً إذا اعتقدتم أن شخصاً آخر استخدم حسابكم.",
      ],
    },
    {
      id: "prices",
      heading: "6. المنتجات والأسعار",
      blocks: [
        { table: {
          head: ["المنتج", "السعر", "ما تحصلون عليه"],
          rows: [
            ["التقرير", `${PRICES.report} د.ك، دفعة واحدة`, "تحليل الوجه والجسم، وخطة 12 شهراً، وصور توضيحية بالذكاء الاصطناعي، وملف PDF، بمراجعة شخص من فريقنا. ويشمل أول 30 يوماً من العضوية."],
            ["العضوية الشهرية", `${PRICES.monthly} د.ك شهرياً`, "فحص متابعة شهري مع تحديث الدرجات والخطة، وملاحظة من المراجِع كل شهر، وصورة توضيحية جديدة لخطة الـ 12 شهراً كل 3 أشهر."],
            ["العضوية السنوية", `${PRICES.yearly} د.ك لمدة 12 شهراً، ثم ${PRICES.monthly} د.ك شهرياً`, `نفس مزايا العضوية الشهرية، بدفعة واحدة لأول 12 شهراً. وبعدها تستمر شهرياً بسعر ${PRICES.monthly} د.ك في الشهر.`],
          ],
        } },
        "الأسعار بالدينار الكويتي (د.ك) وهي المبلغ الكامل الذي تدفعونه لنا. والسعر المعتمد هو المعروض عند الدفع.",
      ],
    },
    {
      id: "membership",
      heading: "7. العضوية والتجديد والإلغاء",
      blocks: [
        { list: [
          "إذا اشتريتم التقرير وحده، تحصلون على مزايا العضوية لمدة 30 يوماً. لا يتجدّد شيء ولن يُخصم منكم أي مبلغ آخر. ونراسلكم بالبريد الإلكتروني قبل نحو 5 أيام من انتهاء هذه الأيام الثلاثين، مع طريقة الاستمرار إذا رغبتم.",
          "إذا اشتريتم التقرير مع العضوية، تستمر عضويتكم بعد أول 30 يوماً على الخطة التي اخترتموها (شهرية أو سنوية)، وتُخصم أول دفعة للعضوية عند انتهاء هذه الأيام الثلاثين.",
          "تتجدّد العضوية الشهرية كل شهر، ونخصم المبلغ من البطاقة التي استخدمتموها، إلى أن تلغوها.",
          `سعر العضوية السنوية ${PRICES.yearly} د.ك لمدة 12 شهراً، ثم ${PRICES.monthly} د.ك شهرياً. وبعد الأشهر الاثني عشر تستمر شهرياً، ويمكنكم إلغاؤها في أي وقت، فتنتهي في نهاية ذلك الشهر. ونذكّركم بالبريد الإلكتروني قبل نحو 30 يوماً من انتهاء الأشهر الاثني عشر.`,
          "يمكنكم الإلغاء في أي وقت من صفحة حسابكم. تنتهي العضوية الشهرية في نهاية الشهر المدفوع، وتبقى المزايا متاحة لكم حتى ذلك الحين.",
          "إذا أنهيتم العضوية السنوية خلال أول 12 شهراً، نردّ لكم جزءاً متناسباً من السعر عن الأشهر الكاملة المتبقية. والتفاصيل في [[سياسة الاسترداد|refunds]].",
          "إذا غيّرنا سعر العضوية، نبلغكم قبل 30 يوماً على الأقل من تطبيق التغيير عليكم، ويمكنكم الإلغاء قبل ذلك.",
        ] },
      ],
    },
    {
      id: "withdrawal",
      heading: "8. حقكم في الانسحاب (14 يوماً)",
      blocks: [
        `يمكنكم الانسحاب من الشراء خلال 14 يوماً من تاريخه دون ذكر أي سبب. أبلغونا على ${COMPANY.email}، أو استخدموا نموذج الانسحاب الموجود في [[سياسة الاسترداد|refunds]]. ويكفي أن ترسلوه قبل انتهاء الأيام الأربعة عشر.`,
        "قبل إرسال صوركم، نطلب منكم أن تؤكدوا أنكم تريدون منا البدء في إعداد تقريركم فوراً، خلال الأيام الأربعة عشر، وأنكم تفهمون أمرين: إذا انسحبتم بعد بدء مراجعتنا، تدفعون مبلغاً متناسباً مقابل العمل المُنجز؛ وبعد تسليم تقريركم، تفقدون حق الانسحاب. ونحتفظ بسجل لهذا التأكيد، ولا نستطيع بدء المراجعة بدونه.",
        "بالنسبة للعضوية، تبدأ الأيام الأربعة عشر من يوم بدئها.",
        "نردّ لكم المبلغ خلال 14 يوماً من استلام طلب الانسحاب، إلى البطاقة التي دفعتم بها.",
      ],
    },
    {
      id: "payment",
      heading: "9. الدفع",
      blocks: [
        "تتم معالجة المدفوعات عن طريق Stripe وتُحتسَب بالدينار الكويتي. تذهب بيانات بطاقتكم مباشرة إلى Stripe ولا نحفظها. ولأننا شركة مقرّها خارج الكويت، قد يعتبر بنككم الدفعة معاملة دولية ويفرض رسوماً خاصة به. هذه الرسوم لا تصلنا ولا نستطيع ردّها.",
      ],
    },
    {
      id: "delivery",
      heading: "10. التسليم",
      blocks: [
        "بعد الدفع، تلتقطون صوركم باتباع خطوات الفحص الموجّه ثم ترسلونها. نسعى لتسليم تقريركم خلال 72 ساعة من إرسال الصور. هذا هدف وليس ضماناً، وسنبلغكم إذا احتاج الأمر وقتاً أطول. وإذا لم تكن الصور صالحة، سنطلب منكم إعادة التصوير، وتبدأ الـ 72 ساعة من جديد من وقت إرسال الصور الجديدة.",
        "إذا لم نتمكّن من تسليم تقريركم، تحصلون على استرداد كامل كما هو موضّح في [[سياسة الاسترداد|refunds]].",
      ],
    },
    {
      id: "your-part",
      heading: "11. صوركم ومسؤولياتكم",
      blocks: [
        { list: [
          "ارفعوا صوركم أنتم فقط. لا ترفعوا صور أي شخص آخر، ولا صور أي شخص دون 18 سنة إطلاقاً.",
          "اتبعوا دليل التصوير. لا ترفعوا صوراً عارية أو خاصة.",
          "استخدموا الخدمة لأنفسكم فقط، وليس لأي غرض تجاري.",
          "لا تنسخوا الخدمة أو تعيدوا بيعها أو تستخرجوا بياناتها آلياً أو تحاولوا تفكيكها، ولا تحاولوا تجاوز حمايتها أو حدودها.",
        ] },
        "قد نوقف أو نغلق أي حساب يخالف هذه القواعد، ونحذف الصور التي ما كان يجب رفعها.",
      ],
    },
    {
      id: "ip",
      heading: "12. الملكية الفكرية",
      blocks: [
        "نملك الخدمة، بما فيها التطبيق والأساليب والنصوص والتصميم وشكل التقارير. وتقريركم لاستخدامكم الشخصي.",
        "صوركم تبقى ملككم. وتمنحوننا الإذن باستخدامها فقط لتقديم الخدمة لكم، كما توضّح [[سياسة الخصوصية|privacy]]. لا نستخدمها في التسويق ولا في تدريب نماذج الذكاء الاصطناعي. وينتهي هذا الإذن عند حذف صوركم.",
      ],
    },
    {
      id: "liability",
      heading: "13. مسؤوليتنا",
      blocks: [
        "نقدّم الخدمة بعناية ومهارة معقولتين. ولأن النتائج تقديرات وإرشادات، لا نستطيع أن نعِد بنتيجة معيّنة.",
        "نحن مسؤولون عن الخسائر التي نسبّبها بمخالفة هذه الشروط أو القانون. ولسنا مسؤولين عن الخسائر التي لم يكن من الممكن توقّعها، أو عن الخسائر الناتجة عن أمور خارجة عن سيطرتنا. ولا يحدّ أي شيء في هذه الشروط من حقوقكم بموجب قوانين حماية البيانات أو قوانين حماية المستهلك الإلزامية.",
        "لا يحدّ أي شيء في هذه الشروط من المسؤولية التي لا يجوز تحديدها قانوناً، مثل المسؤولية عن الوفاة أو الإصابة الجسدية الناتجة عن الإهمال.",
      ],
    },
    {
      id: "changes-service",
      heading: "14. التغييرات على الخدمة وعلى هذه الشروط",
      blocks: [
        "قد نطوّر الخدمة أو نغيّرها. وإذا غيّرنا هذه الشروط بشكل يهمّكم، نبلغكم قبل سريان التغيير. وإذا لم توافقوا، يمكنكم إلغاء عضويتكم قبل ذلك.",
      ],
    },
    {
      id: "ending",
      heading: "15. إنهاء العقد",
      blocks: [
        "يمكنكم التوقف عن استخدام الخدمة وحذف حسابكم في أي وقت من صفحة حسابكم. ويحق لنا إنهاء العقد إذا خالفتم هذه الشروط مخالفة جسيمة، وسنوضّح لكم السبب.",
      ],
    },
    {
      id: "law",
      heading: "16. القانون المطبّق والنزاعات",
      blocks: [
        "تخضع هذه الشروط للقانون الهولندي. وإذا كنتم مستهلكين، يمكنكم رفع أي نزاع أمام المحكمة المختصة في هولندا أو أمام محاكم بلد إقامتكم، وتبقى لكم حماية قوانين المستهلك الإلزامية في ذلك البلد. ولن نرفع أي دعوى ضدكم إلا أمام محاكم بلد إقامتكم.",
        `إذا حدثت أي مشكلة، تواصلوا معنا أولاً على ${COMPANY.email}، فأغلب المشاكل تُحَل بسرعة بهذه الطريقة.`,
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/*  Refund policy                                                      */
/* ------------------------------------------------------------------ */

const refundsEn: LegalDoc = {
  key: "refunds",
  title: "Refund policy",
  description: `Your 14-day right to withdraw, and when ${BRAND_NAME} refunds a report or a membership.`,
  summary: [
    "You can withdraw within 14 days of buying, without giving a reason.",
    "Before our review of your photos starts: full refund.",
    "After our review has started but before delivery: refund, less a proportional amount for the work already done.",
    "Once your report has been delivered, the right to withdraw no longer applies.",
    "If we cannot deliver your report, full refund.",
    "Membership: cancel any time. A yearly membership ended early is refunded for the full months left.",
  ],
  sections: [
    {
      id: "withdraw",
      heading: "1. Your right to withdraw (14 days)",
      blocks: [
        `You can withdraw from your purchase within 14 days of buying it without giving a reason. Tell us at ${COMPANY.email}, or send the model withdrawal form in section 7. Sending it before the 14 days end is enough.`,
        "Before you submit your photos, you ask us to start your report straight away and confirm that you understand the following. If you withdraw after our review has started, you pay a proportional amount for the work already done. Once your report has been delivered, you lose the right to withdraw.",
        "For a membership, the 14 days run from the day you start it.",
        "We refund you within 14 days of receiving your withdrawal.",
      ],
    },
    {
      id: "before",
      heading: "2. Before and after our review starts",
      blocks: [
        { list: [
          "Before you submit your photos, or after you submit them but before our review has started: you can ask for a full refund for any reason.",
          "After our review has started but before your report is delivered: we refund the price, less a proportional amount for the work already done.",
        ] },
      ],
    },
    {
      id: "cannot-deliver",
      heading: "3. If we cannot deliver",
      blocks: [
        "If we cannot deliver your report, for example because of a technical problem on our side or because we cannot complete the review, we refund you in full.",
        "If your photos cannot be used, we first ask you to retake them at no cost. If it is still not possible to produce a report from your photos, we refund you in full.",
        "If you withdraw your photo consent before delivery, we delete your photos and cannot finish the report. If our review has not started yet, we refund you in full. If it has, we refund the price less a proportional amount for the work already done.",
      ],
    },
    {
      id: "after",
      heading: "4. After delivery",
      blocks: [
        "If your report is not as described, we put it right or refund you. For example, when:",
        { list: [
          "the report is incomplete or does not work;",
          "the results are clearly not based on your own photos and answers; or",
          "an AI illustration changes things your plan does not cover, such as your face shape, bone structure or identity.",
        ] },
        "Please tell us as soon as you notice a problem, ideally within 14 days of delivery, so we can fix it quickly. This does not limit your legal rights if the report is not as described. We will first try to fix the problem or redo the affected part. If we cannot, we refund you in full.",
        "Disagreeing with a score, or the results not being what you hoped, does not by itself mean the report is not as described. Scores are estimates from photos, and we explain how each one is measured.",
      ],
    },
    {
      id: "membership",
      heading: "5. Membership",
      blocks: [
        { list: [
          "You can cancel at any time on your Account page.",
          "A monthly membership ends at the end of the month you have paid for. You keep your benefits until then.",
          `A yearly membership costs ${PRICES.yearly} KWD for 12 months, then ${PRICES.monthly} KWD a month. After the 12 months it continues month to month, and you can cancel at any time.`,
          "If you end a yearly membership during its first 12 months, we refund a proportional part of the price for the full months that are left.",
          "The 30 days of membership included with the report are part of the report price and are not refunded separately.",
          "If we cannot deliver a monthly check-in, we refund that month (or the matching part of a yearly membership) or extend your membership, as you prefer.",
        ] },
      ],
    },
    {
      id: "how",
      heading: "6. How to ask for a refund",
      blocks: [
        `Write to ${COMPANY.email} from the email address on your account, with your order number if you have it. We reply within 5 working days.`,
        "Approved refunds are paid in KWD to the card you paid with, through Stripe. Banks usually take 5 to 10 working days to show the refund. Fees your bank charged for an international payment are set by your bank and are not refunded by us.",
        "Please contact us before you dispute a payment with your bank. We can usually solve the problem faster.",
      ],
    },
    {
      id: "form",
      heading: "7. Model withdrawal form",
      blocks: [
        `Fill in and send this form only if you want to withdraw from your purchase. You can copy it into an email to ${COMPANY.email}.`,
        { list: [
          `To: ${COMPANY.name}, ${COMPANY.address}, the Netherlands, ${COMPANY.email}`,
          "I hereby give notice that I withdraw from my contract for the following service: [report / membership]",
          "Bought on: [date]",
          "Order number (if you have it):",
          "Your name:",
          "The email address on your account:",
          "Date:",
        ] },
      ],
    },
    {
      id: "rights",
      heading: "8. Your legal rights",
      blocks: [
        "This policy does not limit any rights you have under mandatory consumer law, in the Netherlands or in the country where you live.",
      ],
    },
  ],
};

const refundsAr: LegalDoc = {
  key: "refunds",
  title: "سياسة الاسترداد",
  description: `حقكم في الانسحاب خلال 14 يوماً، ومتى يردّ ${BRAND_NAME} قيمة التقرير أو العضوية.`,
  summary: [
    "يمكنكم الانسحاب خلال 14 يوماً من الشراء دون ذكر أي سبب.",
    "قبل بدء مراجعتنا لصوركم: تستردّون المبلغ كاملاً.",
    "بعد بدء المراجعة وقبل التسليم: نردّ المبلغ بعد خصم جزء متناسب مقابل العمل المُنجز.",
    "بعد تسليم تقريركم، لا يعود حق الانسحاب قائماً.",
    "إذا لم نتمكّن من تسليم تقريركم، تستردّون المبلغ كاملاً.",
    "العضوية: يمكنكم الإلغاء في أي وقت. وإذا أنهيتم العضوية السنوية مبكراً، نردّ قيمة الأشهر الكاملة المتبقية.",
  ],
  sections: [
    {
      id: "withdraw",
      heading: "1. حقكم في الانسحاب (14 يوماً)",
      blocks: [
        `يمكنكم الانسحاب من الشراء خلال 14 يوماً من تاريخه دون ذكر أي سبب. أبلغونا على ${COMPANY.email}، أو أرسلوا نموذج الانسحاب الموجود في البند 7. ويكفي أن ترسلوه قبل انتهاء الأيام الأربعة عشر.`,
        "قبل إرسال صوركم، تطلبون منا البدء في إعداد تقريركم فوراً وتؤكدون أنكم تفهمون ما يلي: إذا انسحبتم بعد بدء مراجعتنا، تدفعون مبلغاً متناسباً مقابل العمل المُنجز. وبعد تسليم تقريركم، تفقدون حق الانسحاب.",
        "بالنسبة للعضوية، تبدأ الأيام الأربعة عشر من يوم بدئها.",
        "نردّ لكم المبلغ خلال 14 يوماً من استلام طلب الانسحاب.",
      ],
    },
    {
      id: "before",
      heading: "2. قبل بدء المراجعة وبعده",
      blocks: [
        { list: [
          "قبل إرسال الصور، أو بعد إرسالها وقبل بدء مراجعتنا: يمكنكم طلب استرداد المبلغ كاملاً لأي سبب.",
          "بعد بدء المراجعة وقبل تسليم التقرير: نردّ لكم السعر بعد خصم جزء متناسب مقابل العمل المُنجز.",
        ] },
      ],
    },
    {
      id: "cannot-deliver",
      heading: "3. إذا لم نتمكّن من التسليم",
      blocks: [
        "إذا لم نتمكّن من تسليم تقريركم، مثلاً بسبب مشكلة تقنية من جهتنا أو لعدم قدرتنا على إكمال المراجعة، نردّ لكم المبلغ كاملاً.",
        "إذا لم تكن صوركم صالحة، نطلب منكم أولاً إعادة التصوير دون أي تكلفة. وإذا ظل إعداد التقرير من صوركم غير ممكن، نردّ لكم المبلغ كاملاً.",
        "إذا سحبتم موافقتكم على معالجة الصور قبل التسليم، نحذف صوركم ولا نستطيع إكمال التقرير. إذا لم تكن المراجعة قد بدأت، نردّ لكم المبلغ كاملاً. وإذا كانت قد بدأت، نردّ لكم السعر بعد خصم مبلغ متناسب مقابل العمل المُنجز.",
      ],
    },
    {
      id: "after",
      heading: "4. بعد التسليم",
      blocks: [
        "إذا لم يكن تقريركم مطابقاً لما وُصف، نصلحه أو نردّ لكم المبلغ. مثلاً إذا كان:",
        { list: [
          "التقرير ناقصاً أو لا يعمل؛",
          "النتائج لا تستند بوضوح إلى صوركم وإجاباتكم؛ أو",
          "صورة توضيحية بالذكاء الاصطناعي غيّرت أموراً لا تشملها خطتكم، مثل شكل الوجه أو بنية العظام أو الهوية.",
        ] },
        "يُرجى إبلاغنا فور ملاحظة أي مشكلة، ويُفضَّل خلال 14 يوماً من التسليم، لنتمكّن من إصلاحها بسرعة. ولا يحدّ ذلك من حقوقكم القانونية إذا لم يكن التقرير مطابقاً لما وُصف. سنحاول أولاً إصلاح المشكلة أو إعادة الجزء المتأثر، وإذا لم نتمكّن، نردّ لكم المبلغ كاملاً.",
        "عدم الاتفاق مع درجة معيّنة، أو أن تكون النتائج غير ما كنتم تأملون، لا يعني وحده أن التقرير غير مطابق لما وُصف. فالدرجات تقديرات من الصور، ونشرح طريقة قياس كل واحدة منها.",
      ],
    },
    {
      id: "membership",
      heading: "5. العضوية",
      blocks: [
        { list: [
          "يمكنكم الإلغاء في أي وقت من صفحة حسابكم.",
          "تنتهي العضوية الشهرية في نهاية الشهر المدفوع، وتبقى المزايا متاحة لكم حتى ذلك الحين.",
          `سعر العضوية السنوية ${PRICES.yearly} د.ك لمدة 12 شهراً، ثم ${PRICES.monthly} د.ك شهرياً. وبعد الأشهر الاثني عشر تستمر شهرياً، ويمكنكم إلغاؤها في أي وقت.`,
          "إذا أنهيتم العضوية السنوية خلال أول 12 شهراً، نردّ لكم جزءاً متناسباً من السعر عن الأشهر الكاملة المتبقية.",
          "الأيام الثلاثون من العضوية المشمولة مع التقرير جزء من سعر التقرير، ولا تُستردّ قيمتها بشكل منفصل.",
          "إذا لم نتمكّن من تقديم فحص المتابعة الشهري، نردّ قيمة ذلك الشهر (أو الجزء المقابل من العضوية السنوية) أو نمدّد عضويتكم، حسب ما تفضّلون.",
        ] },
      ],
    },
    {
      id: "how",
      heading: "6. كيف تطلبون الاسترداد",
      blocks: [
        `راسلونا على ${COMPANY.email} من البريد الإلكتروني المسجّل في حسابكم، مع رقم الطلب إن وُجد. نرد خلال 5 أيام عمل.`,
        "تُدفَع المبالغ المستردّة المعتمدة بالدينار الكويتي إلى البطاقة التي دفعتم بها، عن طريق Stripe. وعادةً تحتاج البنوك من 5 إلى 10 أيام عمل لإظهار المبلغ. أما الرسوم التي فرضها بنككم على الدفع الدولي فيحدّدها البنك، ولا نردّها.",
        "نرجو التواصل معنا قبل الاعتراض على الدفعة لدى بنككم، فعادةً نستطيع حل المشكلة بشكل أسرع.",
      ],
    },
    {
      id: "form",
      heading: "7. نموذج الانسحاب",
      blocks: [
        `املؤوا هذا النموذج وأرسلوه فقط إذا أردتم الانسحاب من الشراء. ويمكنكم نسخه في رسالة إلى ${COMPANY.email}.`,
        { list: [
          `إلى: ${COMPANY.name}، ${COMPANY.address}، هولندا، ${COMPANY.email}`,
          "أُبلغكم بانسحابي من العقد الخاص بالخدمة التالية: [التقرير / العضوية]",
          "تاريخ الشراء: [التاريخ]",
          "رقم الطلب (إن وُجد):",
          "الاسم:",
          "البريد الإلكتروني المسجّل في الحساب:",
          "التاريخ:",
        ] },
      ],
    },
    {
      id: "rights",
      heading: "8. حقوقكم القانونية",
      blocks: [
        "لا تحدّ هذه السياسة من أي حقوق تمنحكم إياها قوانين حماية المستهلك الإلزامية، في هولندا أو في بلد إقامتكم.",
      ],
    },
  ],
};

export const LEGAL_DOCS: Record<LegalKey, Record<LegalLang, LegalDoc>> = {
  privacy: { en: privacyEn, ar: privacyAr },
  terms: { en: termsEn, ar: termsAr },
  refunds: { en: refundsEn, ar: refundsAr },
};

/* ------------------------------------------------------------------ */
/*  Inline markup                                                      */
/* ------------------------------------------------------------------ */

export type InlinePart =
  | { kind: "text"; text: string }
  | { kind: "placeholder"; text: string }
  | { kind: "link"; text: string; href: string; external: boolean };

const INLINE_RE = /\[\[([^|\]]+)\|([^\]]+)\]\]|(\[[A-Z][A-Z0-9 .,:'()\-/]*[A-Z0-9.)]\]|\[(?:KUWAIT|REVIEWERS):[^\]]*\])/g;

/** Splits a legal string into text, links and highlighted placeholders. */
export function parseInline(text: string, lang: LegalLang): InlinePart[] {
  const out: InlinePart[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE_RE)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ kind: "text", text: text.slice(last, i) });
    if (m[1] && m[2]) {
      const target = m[2];
      const external = /^https?:\/\//.test(target);
      const href = external ? target : (LEGAL_KEYS as string[]).includes(target) ? legalHref(target as LegalKey, lang) : target;
      out.push({ kind: "link", text: m[1], href, external });
    } else if (m[3]) {
      out.push({ kind: "placeholder", text: m[3] });
    }
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}
