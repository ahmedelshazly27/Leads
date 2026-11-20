/*
 * Legal texts (privacy policy, terms, refund policy) in English and Arabic.
 *
 * DRAFT for counsel. These texts cover customers in the six GCC countries
 * (Kuwait, Saudi Arabia, the UAE, Qatar, Bahrain, Oman), with Dutch law and
 * the GDPR as the home law of the B.V. They follow the verified research in
 * docs/legal/LEGAL_MEMO.md. Every [BRACKETED] value is a placeholder or a note
 * for counsel and must be resolved before launch (docs/LAUNCH.md lists them).
 * Never replace a placeholder with a registration number we do not hold.
 * The pages show a small "draft" note in development builds only.
 *
 * Inline markup used in the strings below:
 *   [[label|terms]]            link to another legal page (privacy, terms, refunds)
 *   [[label|https://...]]      external link
 *   [UPPERCASE PLACEHOLDER]    highlighted so it is easy to find and replace
 *   [COUNSEL: ...]             highlighted note for the reviewing lawyer
 *
 * When the wording changes, bump CONSENT_VERSION in lib/backend/consents.ts so
 * we know which version each person agreed to (see CONSENT_VERSION_BUMP below).
 */
import { BRAND_NAME, BRAND_NAME_AR } from "../../lib/brand";
import { CONSENT_VERSION } from "../../lib/backend/consents";
import TABLE from "../../lib/prices.json";
import { COUNTRIES, formatPrice } from "../../lib/pricing";

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

/**
 * The texts in this file, ConsentGate.tsx and waiver.ts changed on 2026-11-20
 * (GCC-wide terms, per-country privacy sections, separate transfer and AI
 * illustration confirmations on the photo step). Whoever merges this must set
 * CONSENT_VERSION in lib/backend/consents.ts to `to`, so new consent records
 * point at the new wording. Old records keep their old version.
 */
export const CONSENT_VERSION_BUMP = {
  from: "2026-11-19.2",
  to: "2026-11-20.1",
  reason: "GCC-wide legal texts; photo consent now names storage countries, transfers and AI illustrations",
} as const;

export const COMPANY = {
  name: "[COMPANY NAME B.V.]",
  kvk: "[KVK NUMBER]",
  address: "[ADDRESS]",
  email: "[CONTACT EMAIL]",
};

/** The countries the legal texts cover, in the order of the price table. */
export const LEGAL_COUNTRIES = ["KW", "SA", "AE", "QA", "BH", "OM"] as const;

/** VAT rate per country, as included in the shown price (research: market-entry-tax). 0 = no VAT. */
export const VAT_RATE: Record<(typeof LEGAL_COUNTRIES)[number], number> = { KW: 0, SA: 15, AE: 5, QA: 0, BH: 10, OM: 5 };

type PriceRow = { report: number; monthly: number; yearly: number };

/** Price table rows from lib/prices.json, so the legal pages always match checkout. */
function priceRows(lang: LegalLang): string[][] {
  const countries = TABLE.countries as Record<string, string>;
  const currencies = TABLE.currencies as Record<string, PriceRow>;
  return LEGAL_COUNTRIES.map((code) => {
    const cur = countries[code];
    const p = currencies[cur];
    const c = COUNTRIES.find((x) => x.code === code);
    const name = c ? (lang === "ar" ? c.ar : c.en) : code;
    const vat = VAT_RATE[code];
    const vatText = vat
      ? lang === "ar"
        ? `شامل ضريبة القيمة المضافة ${vat}%`
        : `Includes ${vat}% VAT`
      : lang === "ar"
        ? "لا تُفرض ضريبة قيمة مضافة"
        : "No VAT applies";
    return [name, formatPrice(p.report, cur, lang), formatPrice(p.monthly, cur, lang), formatPrice(p.yearly, cur, lang), vatText];
  });
}

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
    contactLine: `Write to us at ${COMPANY.email}, in Arabic or English. ${COMPANY.name}, ${COMPANY.address}, the Netherlands. Chamber of Commerce (KvK) ${COMPANY.kvk}.`,
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
    contactLine: `راسلونا على ${COMPANY.email} باللغة العربية أو الإنجليزية. ${COMPANY.name}، ${COMPANY.address}، هولندا. رقم السجل التجاري الهولندي (KvK): ${COMPANY.kvk}.`,
    draft: "مسودة لم يراجعها محامٍ بعد. هذه الملاحظة تظهر في نسخة التطوير فقط.",
    translationNote:
      "النسختان العربية والإنجليزية متساويتان في الحجية. وإذا اختلف المعنى بينهما، يُعتمد المعنى الأفضل لكم.",
    print: "طباعة",
  },
};

/* ------------------------------------------------------------------ */
/*  Privacy policy                                                     */
/* ------------------------------------------------------------------ */

const privacyEn: LegalDoc = {
  key: "privacy",
  title: "Privacy policy",
  description: `How ${BRAND_NAME} collects, uses, stores and deletes your data and photos, for customers in the Gulf, under the GDPR and the data-protection laws of your country.`,
  summary: [
    "Your photos are measured on your device first. They are sent to us only when you submit them for review in a paid order.",
    "Our database and your photos are stored in the European Union (Frankfurt, Germany) by our company in the Netherlands. Our image provider and email provider are in the United States.",
    "We use your photos and the measurements taken from them only with your explicit consent, only to prepare your report, and never to identify you.",
    "Photos are deleted 90 days after your report is delivered, or straight away if you withdraw your photo consent or delete your account.",
    "Your photos are seen by the reviewer assigned to your order. Our admins, a small number of authorised staff, can also open orders to check quality and to help with support.",
    "\"After\" pictures in your plan are AI-generated illustrations, not photos and not predictions.",
    "We never sell your data and never use your photos in marketing.",
    "You can download or delete your data at any time. Section 11 explains the extra rights and authorities for your country.",
  ],
  sections: [
    {
      id: "who",
      heading: "1. Who we are",
      blocks: [
        `${BRAND_NAME} is run by ${COMPANY.name}, a private limited company registered in the Netherlands (Chamber of Commerce number ${COMPANY.kvk}), at ${COMPANY.address}. We are the "controller" of your personal data: we decide why and how it is used, and we are responsible for it. We have no office in the Gulf.`,
        `For any privacy question or request, write to ${COMPANY.email}, in Arabic or English. [DPO: name a data-protection officer here if counsel advises one is required.]`,
        "This policy covers our website, the app and the service we provide to customers in Kuwait, Saudi Arabia, the United Arab Emirates, Qatar, Bahrain and Oman. Because we are a Dutch company, the EU General Data Protection Regulation (\"GDPR\") applies to everything we do with your data, wherever you live. The data-protection law of your own country may also apply; section 11 explains what that means for you.",
      ],
    },
    {
      id: "what",
      heading: "2. What we collect",
      blocks: [
        { list: [
          "Account details: your email address, and if you give them, your name and phone number. Your country, your preferred language, your gender and your birth year.",
          "Consent records: what you agreed to (for example the terms, the privacy policy, photo processing, data transfers) and when, with the version and language of the text.",
          "Orders and payments: what you bought, the amount and currency, the order status and payment references. Card and wallet payments are handled by Stripe; we never see or store your full card number. Stripe stores your billing name, email and country.",
          "Your answers: what you tell us in the questionnaire, such as height, weight, goals and habits (for example smoking, skin and hair concerns). Some answers and results are health information; we use them only with your explicit consent.",
          "Photos: your face from several angles and expressions, and your body from the front and side, as the photo guide asks.",
          "Results: the measurements, scores and 12-month plan worked out from your photos and answers (including a body-fat estimate and waist ratios), notes from the reviewer, and the AI illustrations made for your plan.",
          "Technical data: your IP address, browser and device type, and logs of sign-ins and errors, used to keep the service secure and working.",
          "Waitlist: your email, your phone number if you give it, the service you are waiting for (for example the women's service), your country, your preferred language and the page you signed up on. We ask you to confirm that you are 18 or older before you join.",
        ] },
      ],
    },
    {
      id: "device",
      heading: "3. What happens on your device",
      blocks: [
        "The first analysis of your photos runs in your browser, on your own device. Taking photos and seeing your first measurements does not send them to us. Your photos leave your device only when you submit them for review as part of a paid order.",
        "We do not use facial recognition. We do not use your photos or measurements to identify you, to check who you are, or to recognise you in other photos.",
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
            ["Use your health-related answers and results to build your plan", "Weight, body-fat estimate, waist ratios, smoking, skin and hair concerns", "Your explicit consent (GDPR art. 9(2)(a)), and our contract with you (GDPR art. 6(1)(b))"],
            ["Analyse your photos, have a person review them, and create your AI illustrations", "Photos and the facial and body measurements taken from them", "Your explicit consent (GDPR art. 9(2)(a)), and our contract with you (GDPR art. 6(1)(b))"],
            ["Store and process your data outside your country (section 8)", "All of the above", "Your explicit consent where your country's law requires it, and the safeguards in section 8"],
            ["Take payments and keep accounting and tax records", "Order and payment data", "Contract, and our legal obligations under Dutch tax law and the tax law of your country (GDPR art. 6(1)(c))"],
            ["Keep the service secure, prevent fraud and abuse", "Technical data, sign-in records", "Our legitimate interest in a safe, working service (GDPR art. 6(1)(f))"],
            ["Send emails about your order and account", "Email address", "Performance of our contract with you"],
            ["Send news and offers", "Email address", "Your consent, which you can withdraw at any time on your Account page or by writing to us"],
            ["Tell you when the service opens for you (waitlist)", "Waitlist details", "Your consent"],
          ],
        } },
        "Photos of your face and body, and the measurements taken from them, can reveal information about your physical condition, and some laws treat them as sensitive or biometric data. We treat them as sensitive data in every country and process them only with your explicit consent, given on a separate screen before you take your photos.",
        "We do not make decisions about you that have legal or similarly significant effects based only on automated processing. Scores are calculated automatically, and a person checks every report before it reaches you.",
        "The service is not medical. We do not diagnose, treat or prevent any condition, and nothing in your report is medical advice.",
      ],
    },
    {
      id: "ai",
      heading: "5. AI illustrations",
      blocks: [
        "Your plan includes \"after\" pictures made by artificial intelligence from your photos. They are AI-generated or AI-altered images, and each one is labelled as an AI illustration. They show one possible direction for non-surgical changes your plan covers. They are not photos of you, not a prediction and not a promise of any result.",
        "To make them, we send only the photos needed to our image provider, [IMAGE PROVIDER], in the United States (section 7). A person from our team checks every illustration before you see it.",
        "Your illustrations are private. We never use them in advertising or show them publicly.",
      ],
    },
    {
      id: "never",
      heading: "6. What we will never do",
      blocks: [
        { list: [
          "Sell or rent your personal data to anyone.",
          "Use your photos, results or AI illustrations in advertising or marketing, or show them publicly.",
          "Use your photos or data to train AI models, or let our providers do so.",
          "Share your data with third parties for their own marketing.",
          "Send your photos, results or anything about your appearance or health to Meta or any other advertising platform.",
        ] },
        "[NO-TRAINING: keep the training promise only once the signed contract with [IMAGE PROVIDER] forbids training and storage on our requests. See docs/legal/VENDOR_CONTRACTS.md.]",
      ],
    },
    {
      id: "who-sees",
      heading: "7. Who sees your data",
      blocks: [
        "Inside our team: the reviewer assigned to your order sees your photos, answers and results to check your report. Our admins, a small number of authorised staff, can also open orders, including the photos, to check the quality of our work, to answer a support request or to fix a problem. Access is limited by role, and everyone with access is bound by confidentiality.",
        "Our reviewers work for us under a written contract with confidentiality and data-protection terms. They may only use our review console, may not download or copy photos, and lose access when they stop working for us. [REVIEWERS: state where reviewers work. If any work from outside the EU, say so here and that they access data under the European Commission's standard contractual clauses and any clauses your country's law requires. Confirm with the lawyer.]",
        "Service providers (\"processors\") that handle data for us, only on our instructions and under a data processing agreement:",
        { table: {
          head: ["Provider", "What they do for us", "Where"],
          rows: [
            ["Supabase", "Database, sign-in (including sending your sign-in code by email) and private file storage (including your photos)", "EU (Frankfurt, Germany) [FUNCTIONS REGION: Supabase Edge Functions are not yet pinned to eu-central-1 and run near the caller; pin them before launch or change this cell.]"],
            ["Vercel", "Hosting and delivering the website (no photos)", "United States company, worldwide delivery network"],
            ["[IMAGE PROVIDER]", "Creating your AI illustrations from the photos needed for them", "United States [IMAGE PROVIDER SUB-PROCESSORS: with fal and the nano-banana model the request almost certainly passes to Google; name Google here once fal confirms it in writing.]"],
            ["Resend", "Sending emails about your order, your membership and your account (emails contain links, not your photos or results)", "United States [SMTP: sign-in codes go through Supabase's default email service today. Once Supabase Auth uses Resend as its SMTP, move the sign-in code to this row.]"],
          ],
        } },
        "Payments: Stripe Payments Europe handles card, Apple Pay and Google Pay payments, subscriptions and refunds. For fraud prevention and its own legal duties, Stripe is a separate controller under its own [[privacy policy|https://stripe.com/privacy]]. Your card issuer, the card networks and Apple or Google (if you use their wallet) also process your payment under their own policies.",
        "We advertise on Meta (Facebook and Instagram). This site has no Meta pixel or other advertising tracker, and we do not send your data to Meta: we only read total campaign figures, such as spend and clicks, from our own ad account. If we ever add the pixel, we will ask for your consent first and add Meta to this list.",
        "We may also share data when the law requires it, for example with tax authorities or in answer to a valid court order.",
      ],
    },
    {
      id: "transfers",
      heading: "8. Where your data goes, and international transfers",
      blocks: [
        "You use the service from your country, and we are a company in the Netherlands. So your data leaves your country: it is stored in the European Union (Frankfurt, Germany), managed from the Netherlands, and the photos needed for your AI illustrations, and your email address, are processed in the United States by the providers named in section 7.",
        "How your data is protected in each case:",
        { list: [
          "Into the EU (Germany and the Netherlands): the GDPR protects your data there.",
          "From the EU to the United States: the EU-US Data Privacy Framework where the provider is certified, and the European Commission's standard contractual clauses in every case.",
          "From Saudi Arabia: the transfer is needed to perform our contract with you, and where required we use the standard contractual clauses issued by the Saudi Data and AI Authority (SDAIA). [COUNSEL: confirm the Saudi transfer basis.]",
          "From the United Arab Emirates and Oman: your explicit consent to the transfer, which we ask for on the photo-consent screen.",
          "From Bahrain: the Netherlands and Germany are on Bahrain's list of countries with adequate protection.",
          "From Kuwait and Qatar: your explicit consent on the photo-consent screen, and the safeguards above.",
        ] },
        `You can ask us for a copy of these safeguards at ${COMPANY.email}.`,
      ],
    },
    {
      id: "retention",
      heading: "9. How long we keep your data",
      blocks: [
        { table: {
          head: ["Data", "How long"],
          rows: [
            ["Photos you submit", "Deleted automatically 90 days after your report is delivered. Deleted straight away if you withdraw your photo consent or delete your account. If an order is cancelled or refunded, or never completed, its photos are deleted 90 days after it closed or the photos were taken."],
            ["AI illustrations made from your photos", "Kept in your account so you can see your plan, until you delete your account, or 24 months after your last activity (your last order or the end of your membership), whichever comes first. Illustrations for an order that is cancelled or refunded before delivery are deleted with its photos."],
            ["Measurements, scores, health answers, plan and reviewer notes (without photos)", "Until you delete your account, or 24 months after your last activity, whichever comes first. If you withdraw your photo consent, we also delete the measurements and health answers taken from your photos straight away."],
            ["Account details and consent records", "Until you delete your account. Consent records may be kept longer where we need to show what you agreed to."],
            ["Payment, invoice and accounting records", "7 years, as Dutch tax law requires, or longer where the tax law of your country requires it. When you delete your account, these records are separated from your profile."],
            ["Security and error logs", "A limited time: [LOG RETENTION: state the log retention of our Supabase and Vercel plans; Resend keeps email logs for 30 days.]"],
            ["Backups", "Deleted data can stay in encrypted backups until they expire, at most [BACKUP WINDOW]. Backups are not used for anything else."],
            ["Waitlist entries", "Deleted 24 months after you join, or earlier if you ask to be removed"],
          ],
        } },
        "Our image provider may keep the photos it receives only for the period agreed in our contract with it. [IMAGE PROVIDER RETENTION: state the agreed period once the contract and settings are in place. fal stores request inputs and outputs by default until X-Fal-Store-IO: 0 and a short media lifecycle are sent.]",
      ],
    },
    {
      id: "rights",
      heading: "10. Your rights",
      blocks: [
        "Wherever you live, you have these rights with us under the GDPR:",
        { list: [
          "Access: get a copy of the data we hold about you.",
          "Rectification: have incorrect data corrected.",
          "Erasure: have your data deleted.",
          "Portability: receive your data in a common, machine-readable format.",
          "Objection: object to processing based on our legitimate interest.",
          "Restriction: ask us to limit how we use your data in some situations.",
          "Withdraw consent at any time, for example for your photos, for transfers or for marketing emails. This does not affect what we did before you withdrew it.",
        ] },
        `You can download or delete your data yourself on your Account page, or write to ${COMPANY.email}. We answer within one month. We may ask you to confirm your identity first.`,
        "If you withdraw your photo consent, we delete your photos and the measurements and health answers taken from them. If you do this before your report is delivered, we cannot complete the review. What happens to your payment is explained in the [[refund policy|refunds]].",
        "If you are unhappy with how we handle your data, please tell us first so we can put it right. You also have the right to complain to the Dutch data-protection authority, the [[Autoriteit Persoonsgegevens|https://autoriteitpersoonsgegevens.nl]], or to the data-protection authority in your country (section 11).",
      ],
    },
    {
      id: "country",
      heading: "11. Information for your country",
      blocks: [
        "Saudi Arabia. The Personal Data Protection Law (PDPL) applies to our processing of the data of people in the Kingdom, even though we are outside it. You have the rights the PDPL gives you, including to be informed, to access your data and get a copy, to have it corrected, and to have it destroyed when it is no longer needed. We treat your photos, measurements and health answers as sensitive data and process them with your explicit consent. If a breach of your data occurs, we notify the Saudi Data and AI Authority (SDAIA) as the PDPL requires. You can complain to SDAIA. [COUNSEL: confirm the PDPL rights list and article numbers; check whether the draft amendments of October 2026 (in-Kingdom storage, registration) have been adopted.]",
        "United Arab Emirates. The Federal Decree-Law on the Protection of Personal Data (No. 45 of 2021) may apply to our processing of the data of people in the UAE. We process your sensitive data, and transfer it out of the UAE, on the basis of your explicit and specific consent, which you can withdraw at any time. You can complain to the competent UAE data authority. [COUNSEL: confirm scope (Art. 2) and name the competent authority once it is operating.]",
        "Kuwait. Kuwait's data-privacy regulation issued by CITRA applies to licensed telecom and internet providers, and Kuwait has no general data-protection law that we know applies to us. We give you the full protection of this policy and the GDPR. [COUNSEL: confirm the scope of CITRA Decision 26/2024 and whether Decree-Law 10/2026 on digital commerce adds data duties.]",
        "Qatar. Qatar's Law No. 13 of 2016 on personal data privacy may apply. It treats data about physical condition as data of a special nature. Where the law applies, we process it only with the permission it requires and with your explicit consent. You can complain to the competent Qatari authority. [COUNSEL: confirm territorial scope, whether a permit is needed and from which authority, before orders from Qatar are accepted.]",
        "Bahrain. Bahrain's Personal Data Protection Law (Law No. 30 of 2018) applies where data is processed by means in Bahrain; we have none, so it probably does not apply to us. If it does, your health-related data is processed with your explicit consent, and transfers to the Netherlands and Germany are allowed because both are on Bahrain's adequacy list. You can complain to Bahrain's Personal Data Protection Authority. [COUNSEL: confirm.]",
        "Oman. Oman's Personal Data Protection Law (Royal Decree 6/2022, as amended by Royal Decree 68/2026) applies to the data of people in Oman, also when it is processed outside Oman. It treats biometric data, including facial images, and health data as sensitive. We process them only with your explicit consent and only once we hold any permit the law requires, and we transfer your data outside Oman on the basis of your explicit consent. You can complain to the Ministry of Transport, Communications and Information Technology. [COUNSEL: confirm the permit position before orders from Oman are accepted.]",
      ],
    },
    {
      id: "security",
      heading: "12. How we protect your data",
      blocks: [
        "Data is encrypted in transit and at rest. Photos are kept in private storage that only you, your assigned reviewer and authorised staff can reach, and they are shown through links that expire (within one hour for links shown to you). Access inside our team is limited to people who need it.",
        "If a data breach puts your rights at risk, we tell you, and we notify the Dutch authority within 72 hours and any other authority your country's law requires.",
      ],
    },
    {
      id: "cookies",
      heading: "13. Cookies and browser storage",
      blocks: [
        "We use only the browser storage the service needs to work, such as keeping you signed in and remembering your language and country. We do not use advertising cookies or tracking pixels. If we add analytics or advertising tools that need your permission, we will ask first and update this policy.",
        "We do not load fonts or other files from third-party servers when you visit. [FONTS: the site still loads Google Fonts; self-host them before launch, then delete this note.]",
      ],
    },
    {
      id: "age",
      heading: "14. Age and who the service is for",
      blocks: [
        "The service is only for people aged 18 or older. We ask you to confirm your age before you sign up. If we learn that someone under 18 has given us data, we delete it.",
        "At launch the service is available to men only. Women can join the waitlist; we use waitlist details only to tell you when the service opens for you.",
      ],
    },
    {
      id: "changes",
      heading: "15. Changes to this policy",
      blocks: [
        "If we change this policy, we update the version date at the top. If the change matters for how we use your data, we will tell you by email or in the app before it takes effect, and ask for your consent again where the law requires it.",
      ],
    },
  ],
};

const privacyAr: LegalDoc = {
  key: "privacy",
  title: "سياسة الخصوصية",
  description: `كيف يجمع ${BRAND_NAME_AR} بياناتكم وصوركم ويستخدمها ويحفظها ويحذفها، لعملائنا في دول الخليج، وفق اللائحة الأوروبية لحماية البيانات وقوانين حماية البيانات في بلدكم.`,
  summary: [
    "تُحلَّل صوركم أولاً على جهازكم، ولا تُرسَل إلينا إلا عندما ترسلونها للمراجعة ضمن طلب مدفوع.",
    "تحفظ شركتنا في هولندا قاعدة البيانات وصوركم داخل الاتحاد الأوروبي (فرانكفورت، ألمانيا). ويقع مزوّد خدمة إنشاء الصور ومزوّد البريد الإلكتروني في الولايات المتحدة.",
    "لا نستخدم صوركم والقياسات المأخوذة منها إلا بموافقتكم الصريحة، ولإعداد تقريركم فقط، ولا نستخدمها أبداً للتعرّف على هويتكم.",
    "تُحذَف الصور بعد 90 يوماً من تسليم التقرير، أو فوراً إذا سحبتم موافقتكم على معالجة الصور أو حذفتم حسابكم.",
    "يطّلع على صوركم المراجِع المكلّف بطلبكم. ويمكن أيضاً لمسؤولي النظام لدينا، وهم عدد محدود من الموظفين المخوّلين، فتح الطلبات لمراجعة الجودة وللمساعدة في الدعم.",
    "صور \"بعد\" في خطتكم صور توضيحية مُنشأة بالذكاء الاصطناعي، وليست صوراً حقيقية ولا توقّعات.",
    "لا نبيع بياناتكم أبداً، ولا نستخدم صوركم في التسويق.",
    "يمكنكم تنزيل بياناتكم أو حذفها في أي وقت. ويوضّح البند 11 الحقوق الإضافية والجهات المختصة في بلدكم.",
  ],
  sections: [
    {
      id: "who",
      heading: "1. من نحن",
      blocks: [
        `تُدير ${BRAND_NAME_AR} شركة ${COMPANY.name}، وهي شركة ذات مسؤولية محدودة مسجّلة في هولندا (رقم السجل التجاري ${COMPANY.kvk})، وعنوانها ${COMPANY.address}. نحن "المسؤول عن معالجة" بياناتكم الشخصية، أي أننا نحدد سبب استخدامها وطريقته، ونتحمّل المسؤولية عنها. وليس لدينا مكتب في دول الخليج.`,
        `لأي سؤال أو طلب يخص الخصوصية، راسلونا على ${COMPANY.email} باللغة العربية أو الإنجليزية. [DPO: name a data-protection officer here if counsel advises one is required.]`,
        "تشمل هذه السياسة موقعنا والتطبيق والخدمة التي نقدّمها للعملاء في الكويت والمملكة العربية السعودية والإمارات العربية المتحدة وقطر والبحرين وعُمان. ولأننا شركة هولندية، تنطبق اللائحة العامة لحماية البيانات في الاتحاد الأوروبي (\"اللائحة الأوروبية\") على كل ما نقوم به ببياناتكم، أينما كنتم. وقد ينطبق أيضاً قانون حماية البيانات في بلدكم، ويوضّح البند 11 ما يعنيه ذلك لكم.",
      ],
    },
    {
      id: "what",
      heading: "2. البيانات التي نجمعها",
      blocks: [
        { list: [
          "بيانات الحساب: البريد الإلكتروني، والاسم ورقم الهاتف إذا قدّمتموهما، والبلد، واللغة المفضّلة، والجنس، وسنة الميلاد.",
          "سجلات الموافقة: ما وافقتم عليه (مثل الشروط وسياسة الخصوصية ومعالجة الصور ونقل البيانات) ومتى، مع رقم إصدار النص ولغته.",
          "الطلبات والمدفوعات: ما اشتريتموه، والمبلغ والعملة، وحالة الطلب، ومراجع الدفع. تتولّى Stripe مدفوعات البطاقات والمحافظ الرقمية، ولا نرى رقم بطاقتكم الكامل ولا نحفظه. وتحفظ Stripe اسمكم في الفاتورة وبريدكم الإلكتروني وبلدكم.",
          "إجاباتكم: ما تذكرونه في الاستبيان، مثل الطول والوزن والأهداف والعادات (مثل التدخين ومشاكل البشرة والشعر). وبعض الإجابات والنتائج معلومات صحية، ولا نستخدمها إلا بموافقتكم الصريحة.",
          "الصور: صور الوجه من عدة زوايا وتعابير، وصور الجسم من الأمام والجانب، حسب دليل التصوير.",
          "النتائج: القياسات والدرجات وخطة الـ 12 شهراً المستخرجة من صوركم وإجاباتكم (ومنها تقدير نسبة الدهون في الجسم ونِسَب محيط الخصر)، وملاحظات المراجِع، والصور التوضيحية المُنشأة بالذكاء الاصطناعي لخطتكم.",
          "البيانات التقنية: عنوان IP، ونوع المتصفح والجهاز، وسجلات الدخول والأخطاء، لحماية الخدمة وضمان عملها.",
          "قائمة الانتظار: بريدكم الإلكتروني، ورقم هاتفكم إذا قدّمتموه، والخدمة التي تنتظرونها (مثل خدمة النساء)، وبلدكم، واللغة المفضّلة، والصفحة التي سجّلتم منها. ونطلب منكم تأكيد أن أعماركم 18 سنة أو أكثر قبل الانضمام.",
        ] },
      ],
    },
    {
      id: "device",
      heading: "3. ما يحدث على جهازكم",
      blocks: [
        "يتم التحليل الأولي لصوركم داخل المتصفح على جهازكم أنتم. التقاط الصور ورؤية القياسات الأولى لا يرسلها إلينا. ولا تغادر صوركم جهازكم إلا عندما ترسلونها للمراجعة ضمن طلب مدفوع.",
        "لا نستخدم تقنية التعرّف على الوجه، ولا نستخدم صوركم أو قياساتكم للتعرّف على هويتكم أو للتحقق منها أو لتمييزكم في صور أخرى.",
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
            ["إنشاء حسابكم، واستلام طلبكم، وتسليم التقرير والخطة، وتقديم المتابعات الشهرية للعضوية", "بيانات الحساب، بيانات الطلب", "تنفيذ العقد بيننا وبينكم (المادة 6(1)(ب) من اللائحة الأوروبية)"],
            ["استخدام إجاباتكم ونتائجكم المتعلقة بالصحة لإعداد خطتكم", "الوزن، وتقدير نسبة الدهون، ونِسَب محيط الخصر، والتدخين، ومشاكل البشرة والشعر", "موافقتكم الصريحة (المادة 9(2)(أ) من اللائحة الأوروبية)، والعقد بيننا وبينكم (المادة 6(1)(ب))"],
            ["تحليل صوركم، ومراجعتها من قبل شخص، وإنشاء الصور التوضيحية بالذكاء الاصطناعي", "الصور وقياسات الوجه والجسم المأخوذة منها", "موافقتكم الصريحة (المادة 9(2)(أ) من اللائحة الأوروبية)، والعقد بيننا وبينكم (المادة 6(1)(ب))"],
            ["حفظ بياناتكم ومعالجتها خارج بلدكم (البند 8)", "كل ما سبق", "موافقتكم الصريحة حيث يشترطها قانون بلدكم، والضمانات المذكورة في البند 8"],
            ["استلام المدفوعات والاحتفاظ بالسجلات المحاسبية والضريبية", "بيانات الطلب والدفع", "العقد، والتزاماتنا القانونية وفق قانون الضرائب الهولندي وقانون الضرائب في بلدكم (المادة 6(1)(ج) من اللائحة الأوروبية)"],
            ["حماية الخدمة ومنع الاحتيال وإساءة الاستخدام", "البيانات التقنية، سجلات الدخول", "مصلحتنا المشروعة في خدمة آمنة تعمل بشكل سليم (المادة 6(1)(و) من اللائحة الأوروبية)"],
            ["إرسال رسائل عن طلبكم وحسابكم", "البريد الإلكتروني", "تنفيذ العقد بيننا وبينكم"],
            ["إرسال الأخبار والعروض", "البريد الإلكتروني", "موافقتكم، ويمكنكم سحبها في أي وقت من صفحة حسابكم أو بمراسلتنا"],
            ["إبلاغكم عند افتتاح الخدمة لكم (قائمة الانتظار)", "بيانات قائمة الانتظار", "موافقتكم"],
          ],
        } },
        "قد تكشف صور الوجه والجسم، والقياسات المأخوذة منها، معلومات عن حالتكم الجسدية، وتعدّها بعض القوانين بيانات حساسة أو بيانات بيومترية. لذلك نتعامل معها في كل الدول على أنها بيانات حساسة، ولا نعالجها إلا بموافقتكم الصريحة التي تقدّمونها في شاشة مستقلة قبل التقاط الصور.",
        "لا نتخذ بشأنكم قرارات لها آثار قانونية أو آثار مهمة مماثلة بناءً على المعالجة الآلية وحدها. تُحسَب الدرجات آلياً، ويراجع شخص من فريقنا كل تقرير قبل أن يصلكم.",
        "الخدمة ليست طبية. فنحن لا نشخّص أي حالة ولا نعالجها ولا نقي منها، ولا يُعدّ أي شيء في تقريركم استشارة طبية.",
      ],
    },
    {
      id: "ai",
      heading: "5. الصور التوضيحية بالذكاء الاصطناعي",
      blocks: [
        "تتضمّن خطتكم صور \"بعد\" يُنشئها الذكاء الاصطناعي من صوركم. وهي صور مُنشأة أو معدّلة بالذكاء الاصطناعي، وتحمل كل صورة منها علامة توضّح أنها صورة توضيحية بالذكاء الاصطناعي. وهي تعرض اتجاهاً محتملاً لتغييرات غير جراحية تشملها خطتكم، وليست صوراً لكم، ولا توقّعاً، ولا وعداً بأي نتيجة.",
        "ولإنشائها، نرسل الصور اللازمة فقط إلى مزوّد خدمة إنشاء الصور، [IMAGE PROVIDER]، في الولايات المتحدة (البند 7). ويراجع شخص من فريقنا كل صورة توضيحية قبل أن تروها.",
        "صوركم التوضيحية خاصة بكم، ولا نستخدمها أبداً في الإعلانات ولا نعرضها للعامة.",
      ],
    },
    {
      id: "never",
      heading: "6. ما لن نفعله أبداً",
      blocks: [
        { list: [
          "بيع بياناتكم الشخصية أو تأجيرها لأي جهة.",
          "استخدام صوركم أو نتائجكم أو صوركم التوضيحية في الإعلانات أو التسويق، أو عرضها للعامة.",
          "استخدام صوركم أو بياناتكم لتدريب نماذج الذكاء الاصطناعي، أو السماح لمزوّدينا بذلك.",
          "مشاركة بياناتكم مع أطراف أخرى لأغراضها التسويقية.",
          "إرسال صوركم أو نتائجكم أو أي معلومة عن مظهركم أو صحتكم إلى Meta أو أي منصة إعلانية أخرى.",
        ] },
        "[NO-TRAINING: keep the training promise only once the signed contract with [IMAGE PROVIDER] forbids training and storage on our requests. See docs/legal/VENDOR_CONTRACTS.md.]",
      ],
    },
    {
      id: "who-sees",
      heading: "7. من يطّلع على بياناتكم",
      blocks: [
        "داخل فريقنا: يطّلع المراجِع المكلّف بطلبكم على صوركم وإجاباتكم ونتائجكم لمراجعة تقريركم. ويمكن أيضاً لمسؤولي النظام لدينا، وهم عدد محدود من الموظفين المخوّلين، فتح الطلبات بما فيها الصور، لمراجعة جودة عملنا أو للرد على طلب دعم أو لإصلاح مشكلة. والوصول محدود حسب الدور، وكل من لديه صلاحية وصول ملتزم بالسرية.",
        "يعمل المراجِعون لدينا بموجب عقد مكتوب يتضمّن شروط السرية وحماية البيانات. ولا يجوز لهم العمل إلا من خلال نظام المراجعة لدينا، ولا يجوز لهم تنزيل الصور أو نسخها، وتُلغى صلاحياتهم عند توقّفهم عن العمل معنا. [REVIEWERS: state where reviewers work. If any work from outside the EU, say so here and that they access data under the European Commission's standard contractual clauses and any clauses your country's law requires. Confirm with the lawyer.]",
        "مزوّدو الخدمات (\"جهات المعالجة\") الذين يعالجون البيانات نيابةً عنا، وفق تعليماتنا فقط وبموجب اتفاقية معالجة بيانات:",
        { table: {
          head: ["المزوّد", "ما يقدّمه لنا", "الموقع"],
          rows: [
            ["Supabase", "قاعدة البيانات وتسجيل الدخول (ومنه إرسال رمز تسجيل الدخول بالبريد الإلكتروني) والتخزين الخاص للملفات (ومنها صوركم)", "الاتحاد الأوروبي (فرانكفورت، ألمانيا) [FUNCTIONS REGION: Supabase Edge Functions are not yet pinned to eu-central-1 and run near the caller; pin them before launch or change this cell.]"],
            ["Vercel", "استضافة الموقع وتشغيله (دون صور)", "شركة أمريكية، وشبكة توصيل حول العالم"],
            ["[IMAGE PROVIDER]", "إنشاء الصور التوضيحية بالذكاء الاصطناعي من الصور اللازمة لها", "الولايات المتحدة [IMAGE PROVIDER SUB-PROCESSORS: with fal and the nano-banana model the request almost certainly passes to Google; name Google here once fal confirms it in writing.]"],
            ["Resend", "إرسال الرسائل الإلكترونية الخاصة بطلبكم وعضويتكم وحسابكم (تحتوي الرسائل على روابط فقط، وليس على صوركم أو نتائجكم)", "الولايات المتحدة [SMTP: sign-in codes go through Supabase's default email service today. Once Supabase Auth uses Resend as its SMTP, move the sign-in code to this row.]"],
          ],
        } },
        "المدفوعات: تتولّى شركة Stripe Payments Europe مدفوعات البطاقات وApple Pay وGoogle Pay والاشتراكات والمبالغ المستردة. ولأغراض منع الاحتيال والتزاماتها القانونية، تكون Stripe جهة مسؤولة مستقلة وفق [[سياسة الخصوصية الخاصة بها|https://stripe.com/privacy]]. كما يعالج البنك المُصدِر لبطاقتكم وشبكات البطاقات وApple أو Google (إذا استخدمتم محفظتهما) بيانات الدفع وفق سياساتهم الخاصة.",
        "نعلن على منصات Meta (فيسبوك وإنستغرام). ولا يوجد في هذا الموقع بكسل Meta ولا أي أداة تتبّع إعلاني، ولا نرسل بياناتكم إلى Meta: نقرأ فقط الأرقام الإجمالية للحملات، مثل الإنفاق وعدد النقرات، من حسابنا الإعلاني. وإذا أضفنا البكسل يوماً، سنطلب موافقتكم أولاً ونضيف Meta إلى هذه القائمة.",
        "وقد نشارك البيانات عندما يُلزمنا القانون بذلك، مثل الجهات الضريبية أو تنفيذاً لأمر قضائي صحيح.",
      ],
    },
    {
      id: "transfers",
      heading: "8. أين تذهب بياناتكم، ونقلها خارج بلدكم",
      blocks: [
        "تستخدمون الخدمة من بلدكم، ونحن شركة في هولندا. لذلك تخرج بياناتكم من بلدكم: فهي تُحفَظ داخل الاتحاد الأوروبي (فرانكفورت، ألمانيا) وتُدار من هولندا، وتُعالَج الصور اللازمة لإنشاء صوركم التوضيحية، وكذلك بريدكم الإلكتروني، في الولايات المتحدة لدى المزوّدين المذكورين في البند 7.",
        "وهذه طريقة حماية بياناتكم في كل حالة:",
        { list: [
          "داخل الاتحاد الأوروبي (ألمانيا وهولندا): تحمي اللائحة الأوروبية بياناتكم هناك.",
          "من الاتحاد الأوروبي إلى الولايات المتحدة: إطار خصوصية البيانات بين الاتحاد الأوروبي والولايات المتحدة إذا كان المزوّد معتمداً فيه، والبنود التعاقدية النموذجية الصادرة عن المفوضية الأوروبية في جميع الحالات.",
          "من المملكة العربية السعودية: النقل لازم لتنفيذ العقد بيننا وبينكم، ونستخدم عند الحاجة البنود التعاقدية النموذجية الصادرة عن الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا). [COUNSEL: confirm the Saudi transfer basis.]",
          "من الإمارات العربية المتحدة وعُمان: موافقتكم الصريحة على النقل، التي نطلبها في شاشة الموافقة على الصور.",
          "من البحرين: هولندا وألمانيا مدرجتان في قائمة البحرين للدول التي توفّر حماية كافية.",
          "من الكويت وقطر: موافقتكم الصريحة في شاشة الموافقة على الصور، والضمانات المذكورة أعلاه.",
        ] },
        `ويمكنكم طلب نسخة من هذه الضمانات على ${COMPANY.email}.`,
      ],
    },
    {
      id: "retention",
      heading: "9. مدة الاحتفاظ بالبيانات",
      blocks: [
        { table: {
          head: ["البيانات", "المدة"],
          rows: [
            ["الصور التي ترسلونها", "تُحذَف تلقائياً بعد 90 يوماً من تسليم التقرير. وتُحذَف فوراً إذا سحبتم موافقتكم على معالجة الصور أو حذفتم حسابكم. وإذا أُلغي الطلب أو استُرد مبلغه أو لم يكتمل، تُحذَف صوره بعد 90 يوماً من إغلاقه أو من التقاط الصور."],
            ["الصور التوضيحية المُنشأة من صوركم", "تبقى في حسابكم لتتمكّنوا من الاطلاع على خطتكم، حتى تحذفوا حسابكم، أو بعد 24 شهراً من آخر نشاط لكم (آخر طلب أو انتهاء عضويتكم)، أيهما أسبق. وتُحذَف الصور التوضيحية لأي طلب أُلغي أو استُرد مبلغه قبل التسليم مع صوره."],
            ["القياسات والدرجات والإجابات الصحية والخطة وملاحظات المراجِع (بدون صور)", "حتى تحذفوا حسابكم، أو بعد 24 شهراً من آخر نشاط لكم، أيهما أسبق. وإذا سحبتم موافقتكم على معالجة الصور، نحذف أيضاً فوراً القياسات والإجابات الصحية المأخوذة من صوركم."],
            ["بيانات الحساب وسجلات الموافقة", "حتى تحذفوا حسابكم. وقد نحتفظ بسجلات الموافقة مدة أطول إذا احتجنا إلى إثبات ما وافقتم عليه."],
            ["سجلات الدفع والفواتير والمحاسبة", "7 سنوات كما يشترط قانون الضرائب الهولندي، أو مدة أطول إذا اشترطها قانون الضرائب في بلدكم. وعند حذف حسابكم تُفصَل هذه السجلات عن ملفكم الشخصي."],
            ["سجلات الأمان والأخطاء", "مدة محدودة: [LOG RETENTION: state the log retention of our Supabase and Vercel plans; Resend keeps email logs for 30 days.]"],
            ["النسخ الاحتياطية", "قد تبقى البيانات المحذوفة في نسخ احتياطية مشفّرة حتى انتهاء صلاحيتها، بحد أقصى [BACKUP WINDOW]. ولا تُستخدم النسخ الاحتياطية لأي غرض آخر."],
            ["بيانات قائمة الانتظار", "تُحذَف بعد 24 شهراً من التسجيل، أو قبل ذلك إذا طلبتم إزالتها"],
          ],
        } },
        "لا يجوز لمزوّد خدمة إنشاء الصور الاحتفاظ بالصور التي يتلقّاها إلا للمدة المتفق عليها في عقدنا معه. [IMAGE PROVIDER RETENTION: state the agreed period once the contract and settings are in place. fal stores request inputs and outputs by default until X-Fal-Store-IO: 0 and a short media lifecycle are sent.]",
      ],
    },
    {
      id: "rights",
      heading: "10. حقوقكم",
      blocks: [
        "أينما كنتم، لكم لدينا الحقوق التالية بموجب اللائحة الأوروبية:",
        { list: [
          "الاطلاع: الحصول على نسخة من بياناتكم التي لدينا.",
          "التصحيح: تصحيح أي بيانات غير صحيحة.",
          "الحذف: حذف بياناتكم.",
          "قابلية النقل: استلام بياناتكم بصيغة شائعة يمكن قراءتها آلياً.",
          "الاعتراض: الاعتراض على المعالجة القائمة على مصلحتنا المشروعة.",
          "التقييد: طلب تقييد استخدامنا لبياناتكم في حالات معيّنة.",
          "سحب الموافقة في أي وقت، مثل موافقتكم على معالجة الصور أو على نقل البيانات أو على الرسائل التسويقية. ولا يؤثر ذلك على ما تم قبل سحبها.",
        ] },
        `يمكنكم تنزيل بياناتكم أو حذفها بأنفسكم من صفحة حسابكم، أو مراسلتنا على ${COMPANY.email}. نرد خلال شهر واحد، وقد نطلب منكم تأكيد هويتكم أولاً.`,
        "إذا سحبتم موافقتكم على معالجة الصور، نحذف صوركم والقياسات والإجابات الصحية المأخوذة منها. وإذا فعلتم ذلك قبل تسليم التقرير، لا نستطيع إكمال المراجعة. وتوضّح [[سياسة الاسترداد|refunds]] ما يحدث للمبلغ المدفوع.",
        "إذا لم تكونوا راضين عن طريقة تعاملنا مع بياناتكم، نرجو إبلاغنا أولاً لنصحّح الأمر. ويحق لكم أيضاً تقديم شكوى إلى هيئة حماية البيانات الهولندية [[Autoriteit Persoonsgegevens|https://autoriteitpersoonsgegevens.nl]]، أو إلى الجهة المختصة بحماية البيانات في بلدكم (البند 11).",
      ],
    },
    {
      id: "country",
      heading: "11. معلومات خاصة ببلدكم",
      blocks: [
        "المملكة العربية السعودية: ينطبق نظام حماية البيانات الشخصية على معالجتنا لبيانات الأشخاص المقيمين في المملكة، رغم أننا خارجها. ولكم الحقوق التي يمنحها النظام، ومنها الحق في العلم، والحق في الوصول إلى بياناتكم والحصول على نسخة منها، والحق في تصحيحها، والحق في إتلافها عند انتهاء الحاجة إليها. ونتعامل مع صوركم وقياساتكم وإجاباتكم الصحية على أنها بيانات حساسة، ونعالجها بموافقتكم الصريحة. وإذا وقع تسرّب لبياناتكم، نبلغ الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا) وفق ما يشترطه النظام. ويحق لكم تقديم شكوى إلى سدايا. [COUNSEL: confirm the PDPL rights list and article numbers; check whether the draft amendments of October 2026 (in-Kingdom storage, registration) have been adopted.]",
        "الإمارات العربية المتحدة: قد ينطبق المرسوم بقانون اتحادي رقم 45 لسنة 2021 بشأن حماية البيانات الشخصية على معالجتنا لبيانات الأشخاص في الدولة. ونعالج بياناتكم الحساسة، وننقلها خارج الدولة، بناءً على موافقتكم الصريحة والمحددة، ويمكنكم سحبها في أي وقت. ويحق لكم تقديم شكوى إلى الجهة الاتحادية المختصة بحماية البيانات. [COUNSEL: confirm scope (Art. 2) and name the competent authority once it is operating.]",
        "الكويت: تنطبق لائحة حماية خصوصية البيانات الصادرة عن هيئة الاتصالات وتقنية المعلومات على مزوّدي خدمات الاتصالات والإنترنت المرخّصين، ولا نعلم بوجود قانون عام لحماية البيانات في الكويت ينطبق علينا. ومع ذلك نمنحكم الحماية الكاملة الواردة في هذه السياسة وفي اللائحة الأوروبية. [COUNSEL: confirm the scope of CITRA Decision 26/2024 and whether Decree-Law 10/2026 on digital commerce adds data duties.]",
        "قطر: قد ينطبق القانون رقم 13 لسنة 2016 بشأن حماية خصوصية البيانات الشخصية، وهو يعدّ البيانات المتعلقة بالحالة الجسدية بيانات ذات طبيعة خاصة. وحيث ينطبق القانون، لا نعالجها إلا بالإذن الذي يشترطه وبموافقتكم الصريحة. ويحق لكم تقديم شكوى إلى الجهة القطرية المختصة. [COUNSEL: confirm territorial scope, whether a permit is needed and from which authority, before orders from Qatar are accepted.]",
        "البحرين: ينطبق قانون حماية البيانات الشخصية (القانون رقم 30 لسنة 2018) عندما تُعالَج البيانات بوسائل موجودة في البحرين، وليس لدينا أي منها، لذلك يُرجَّح أنه لا ينطبق علينا. وإذا انطبق، نعالج بياناتكم المتعلقة بالصحة بموافقتكم الصريحة، ويجوز نقلها إلى هولندا وألمانيا لأنهما مدرجتان في قائمة البحرين للدول التي توفّر حماية كافية. ويحق لكم تقديم شكوى إلى هيئة حماية البيانات الشخصية في البحرين. [COUNSEL: confirm.]",
        "عُمان: ينطبق قانون حماية البيانات الشخصية (المرسوم السلطاني رقم 6/2022، بتعديلاته بالمرسوم السلطاني رقم 68/2026) على بيانات الأشخاص في عُمان، حتى عند معالجتها خارجها. ويعدّ القانون البيانات الحيوية، ومنها صور الوجه، والبيانات الصحية بيانات حساسة. ولا نعالجها إلا بموافقتكم الصريحة وبعد حصولنا على أي تصريح يشترطه القانون، وننقل بياناتكم خارج عُمان بناءً على موافقتكم الصريحة. ويحق لكم تقديم شكوى إلى وزارة النقل والاتصالات وتقنية المعلومات. [COUNSEL: confirm the permit position before orders from Oman are accepted.]",
      ],
    },
    {
      id: "security",
      heading: "12. كيف نحمي بياناتكم",
      blocks: [
        "البيانات مشفّرة أثناء النقل وأثناء التخزين. تُحفَظ الصور في تخزين خاص لا يصل إليه إلا أنتم والمراجِع المكلّف بطلبكم والموظفون المخوّلون، وتُعرَض عبر روابط تنتهي صلاحيتها (خلال ساعة واحدة للروابط المعروضة لكم). ويقتصر الوصول داخل فريقنا على من يحتاج إليه.",
        "إذا وقع اختراق للبيانات يعرّض حقوقكم للخطر، نبلغكم، ونبلغ الهيئة الهولندية خلال 72 ساعة، وأي جهة أخرى يشترطها قانون بلدكم.",
      ],
    },
    {
      id: "cookies",
      heading: "13. ملفات تعريف الارتباط وتخزين المتصفح",
      blocks: [
        "نستخدم فقط تخزين المتصفح الذي تحتاجه الخدمة لتعمل، مثل إبقائكم مسجّلين وتذكّر لغتكم وبلدكم. ولا نستخدم ملفات تعريف الارتباط الإعلانية ولا أدوات التتبّع الإعلاني. وإذا أضفنا أدوات تحليل أو إعلان تحتاج إلى إذنكم، فسنطلب موافقتكم أولاً ونحدّث هذه السياسة.",
        "لا نحمّل الخطوط أو أي ملفات أخرى من خوادم جهات أخرى عند زيارتكم. [FONTS: the site still loads Google Fonts; self-host them before launch, then delete this note.]",
      ],
    },
    {
      id: "age",
      heading: "14. العمر ولمن الخدمة",
      blocks: [
        "الخدمة مخصّصة فقط لمن أعمارهم 18 سنة فأكثر، ونطلب تأكيد العمر قبل التسجيل. وإذا علمنا أن شخصاً دون 18 سنة قدّم لنا بيانات، نحذفها.",
        "عند الإطلاق، الخدمة متاحة للرجال فقط. ويمكن للنساء الانضمام إلى قائمة الانتظار، ولا نستخدم بيانات القائمة إلا لإبلاغكنّ عند افتتاح الخدمة.",
      ],
    },
    {
      id: "changes",
      heading: "15. التغييرات على هذه السياسة",
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
  description: `The terms for using ${BRAND_NAME} in the Gulf: what the service is and is not, prices in your currency including VAT, membership and cancellation, and your rights.`,
  summary: [
    "Wellness and aesthetic guidance. Not medical advice, diagnosis or treatment.",
    "AI illustrations are labelled as AI-generated. They show a possible direction, not a promised result.",
    "For adults aged 18 or older in Kuwait, Saudi Arabia, the UAE, Qatar, Bahrain and Oman. Men only at launch; women can join the waitlist.",
    "Prices are in your local currency and include VAT where VAT applies. The report includes the first 30 days of membership. Membership after that is optional and can be cancelled online at any time.",
    "Full refund on request as long as our review of your photos has not started. If it has not started 14 days after you buy, you can still cancel with a full refund until it does.",
    "We aim to deliver within 72 hours after you submit your photos.",
  ],
  sections: [
    {
      id: "about",
      heading: "1. About these terms and about us",
      blocks: [
        `These terms are a contract between you and ${COMPANY.name}, registered in the Netherlands (Chamber of Commerce number ${COMPANY.kvk}), ${COMPANY.address} ("we", "us"). They apply when you use ${BRAND_NAME} and when you buy a report or a membership. Please read them together with our [[privacy policy|privacy]] and [[refund policy|refunds]].`,
        `Contact: ${COMPANY.email}, in Arabic or English. Our tax registration numbers, where we are registered: [VAT NUMBERS: Saudi Arabia, UAE, Bahrain, Oman — add only once issued]. Local licences or registrations: [LOCAL REGISTRATIONS: add only once obtained, e.g. Kuwait Ministry of Commerce and Industry].`,
      ],
    },
    {
      id: "service",
      heading: "2. What the service is",
      blocks: [
        `${BRAND_NAME} measures your face and body from photos you take, explains the results, and gives you a 12-month plan for skin, grooming, hair, training, nutrition and posture. The first measurements run on your device. A person from our team reviews each report before you receive it. The plan includes AI illustrations that show a possible direction for non-surgical changes.`,
        "The service gives wellness and aesthetic guidance. It is not medical advice and does not diagnose, treat or prevent any disease or condition. Scores and measurements are estimates from photos and can be affected by lighting, angle and camera. Results vary from person to person. Talk to a doctor before you change your diet, start a new training routine or use any treatment, especially if you have a health condition or take medication.",
      ],
    },
    {
      id: "ai",
      heading: "3. AI illustrations",
      blocks: [
        "AI illustrations are images generated or altered by artificial intelligence, and each is labelled \"AI-generated illustration\". They are not photos of you, not a prediction, and not a promise or guarantee of any result. They are limited to changes your plan covers (such as grooming, hair, skin and body composition) and are checked by a person before you see them. To make them, the photos needed are sent to our image provider, as explained in the [[privacy policy|privacy]]. Your own results depend on many things, including how closely you follow the plan.",
      ],
    },
    {
      id: "eligibility",
      heading: "4. Who can use the service",
      blocks: [
        { list: [
          "You must be 18 or older. [COUNSEL: age of majority in Kuwait and Bahrain may be 21; decide whether to gate at 21 there.]",
          "At launch the service is for men only. Women can join the waitlist and we will tell them when it opens.",
          "The service is offered to consumers living in Kuwait, Saudi Arabia, the United Arab Emirates, Qatar, Bahrain and Oman, in the countries where checkout is open. We may open these countries at different times. Prices shown to visitors elsewhere are for information only.",
          "The service is not offered in countries under international sanctions.",
          "You must use the service for yourself, as a consumer, and the information you give us, including your age and country, must be true.",
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
          head: ["Product", "What you get"],
          rows: [
            ["Report (one payment)", "Your face and body analysis, 12-month plan, AI illustrations and PDF, reviewed by a person. Includes the first 30 days of membership."],
            ["Membership, monthly", "A monthly check-in scan with updated scores and plan, a reviewer note each month, and a new 12-month illustration every 3 months."],
            ["Membership, 12 months", "The same as monthly, paid once for the first 12 months. After that it continues month to month at the monthly price, and you can cancel at any time."],
          ],
        } },
        "Prices by country (what you pay):",
        { table: {
          head: ["Country", "Report", "Monthly", "12 months", "VAT"],
          rows: priceRows("en"),
        } },
        "Prices are shown and charged in the currency of your country. Where VAT applies (Saudi Arabia, the UAE, Bahrain and Oman), the price shown already includes it. Kuwait and Qatar have no VAT. There are no hidden fees. The price that applies is the one shown at checkout, together with the renewal price and date, before you pay.",
      ],
    },
    {
      id: "order",
      heading: "7. How the contract is made",
      blocks: [
        "You choose a product, see the total price, what renews and when, and can go back and correct your choice before you pay. The contract is made when your payment is accepted. We then send you a confirmation by email with these terms, the price you paid and how to cancel. [BUILD: the app sends no order-confirmation email today (only report-ready, changes-requested and membership reminders); build it, with these terms attached or linked, or change this wording.]",
      ],
    },
    {
      id: "membership",
      heading: "8. Membership, renewal and cancellation",
      blocks: [
        { list: [
          "If you buy the report on its own, you get 30 days of membership benefits. Nothing renews and you will not be charged again. We email you about 5 days before those 30 days end, with how to continue if you want to.",
          "If you buy the report with a membership, you choose this with a separate checkbox. Your membership continues after the first 30 days on the plan you chose, and the first membership payment is taken when those 30 days end. Checkout shows its date and amount before you pay.",
          "A monthly membership renews every month at the monthly price, and we charge the card or wallet you used, until you cancel.",
          "A 12-month membership is paid once for the first 12 months. After that it continues month to month at the monthly price, and you can cancel at any time; it then ends at the end of that month. It never renews into a new 12-month term. We remind you by email about 30 days before the 12 months end.",
          "You can cancel at any time on your Account page, in two clicks, without any fee. A monthly membership ends at the end of the month you have paid for, and you keep your benefits until then.",
          "If you end a 12-month membership during its first 12 months, we refund a proportional part of the price for the full months that are left. The details are in the [[refund policy|refunds]].",
          "If a membership payment fails, we may try again over the following days. If it still fails, your membership ends at the end of the period already paid for. We charge no fee for a failed payment. [BUILD: set Stripe's subscription setting to cancel the subscription after the final retry, so this is what happens.]",
          "If we change the membership price, we will tell you at least 30 days before the change applies to you, and you can cancel before then. If VAT is introduced or changes in your country, we will tell you before it affects your price.",
        ] },
      ],
    },
    {
      id: "withdrawal",
      heading: "9. Your right to cancel and get a refund",
      blocks: [
        `You can withdraw from your purchase within 14 days of buying it, without giving a reason. If you withdraw before our review of your photos starts, you get a full refund. If our review has not started when the 14 days end, you can still cancel with a full refund until it starts. If you withdraw after our review has started, see the next paragraph. Tell us at ${COMPANY.email}, use the button on your Account page, or send the model form in the [[refund policy|refunds]]. Sending it in time is enough. [BUILD: the withdraw/cancel-purchase button on the Account page is not built yet; build it (EU withdrawal button, applies from 19 June 2026) or remove this wording.]`,
        "Before you submit your photos, we ask you to confirm on a separate, un-ticked checkbox that you want us to start your report straight away, within the 14 days, and that you understand two things: if you withdraw after our review has started, you pay a proportional amount for the work already done; and once your report has been delivered, you lose the right to withdraw. We keep a record of this confirmation and send it to you by email. Without it we cannot start your review. [BUILD: the confirmation email with this waiver is not sent yet; build it or remove this wording.]",
        "For a membership, the 14 days run from the day you start it.",
        "We refund you within 14 days of receiving your withdrawal, to the card or wallet you paid with, in the currency you paid.",
        "If you live in Saudi Arabia, you also have the right under the E-Commerce Law to cancel within 7 days as long as you have not benefited from the service; our policy above gives you at least that. Your rights under the mandatory consumer law of your country are not affected by anything in these terms. [COUNSEL: Kuwait Decree-Law 10/2026 cooling-off; new Saudi Consumer Protection Law once published.]",
      ],
    },
    {
      id: "payment",
      heading: "10. Payment and invoices",
      blocks: [
        "Payments are processed by Stripe and charged in the currency of your country. You can pay by card, Apple Pay or Google Pay where shown at checkout. Your card details go directly to Stripe and are not stored by us. Because we are a company based outside your country, your bank may treat the payment as an international transaction and charge its own fee. We do not receive that fee and cannot refund it.",
        "You receive a receipt by email. Where VAT applies, we issue a tax invoice in Arabic and English with our VAT registration number for your country. [BUILD: Stripe receipts are English-only; a bilingual tax invoice must exist before checkout opens in a VAT country.]",
      ],
    },
    {
      id: "delivery",
      heading: "11. Delivery",
      blocks: [
        "After you pay, you take your photos with the guided scan and submit them. We aim to deliver your report within 72 hours after you submit your photos. This is a target, not a guarantee; we will tell you if it will take longer. If your photos cannot be used, we will ask you to retake them, and the 72 hours start again from the new photos.",
        "If we have not delivered your report 15 days after you submitted usable photos, you can cancel and get a full refund. If we cannot deliver your report at all, you get a full refund as set out in the [[refund policy|refunds]].",
      ],
    },
    {
      id: "your-part",
      heading: "12. Your photos and your responsibilities",
      blocks: [
        { list: [
          "Upload only photos of yourself. Do not upload photos of anyone else, and never of anyone under 18.",
          "Follow the photo guide. Do not upload nude or intimate images.",
          "Use the service for yourself only, and not for any business purpose.",
          "Do not copy, resell, scrape or reverse engineer the service, or try to get around its security or limits.",
        ] },
        "We may suspend or close an account that breaks these rules, and delete photos that should not have been uploaded. We will tell you why.",
      ],
    },
    {
      id: "ip",
      heading: "13. Intellectual property",
      blocks: [
        "We own the service, including the app, the methods, the text, the design and the reports' format. Your report is for your personal use.",
        "Your photos remain yours. You give us permission to use them only to provide the service to you, as described in our [[privacy policy|privacy]]. We do not use them in marketing and do not use them to train AI models. This permission ends when your photos are deleted.",
      ],
    },
    {
      id: "liability",
      heading: "14. Our liability",
      blocks: [
        "We provide the service with reasonable care and skill. Because the results are estimates and guidance, we cannot promise any particular outcome.",
        "We are liable for loss we cause by breaking these terms or the law. We are not liable for loss that was not foreseeable, or for loss caused by things outside our control. [COUNSEL: whether to cap liability for ordinary negligence at the fees paid in the last 12 months.]",
        "Nothing in these terms limits or excludes our liability for death or personal injury, for fraud or gross negligence, for breaches of our legal duties (including data protection), or any other liability that cannot be limited by law. Nothing in these terms limits your rights under mandatory consumer law.",
      ],
    },
    {
      id: "changes-service",
      heading: "15. Changes to the service and to these terms",
      blocks: [
        "We may improve or change the service. If we change these terms in a way that matters to you, we will tell you at least 30 days before the change applies. If you do not agree, you can cancel your membership before then, without any fee.",
      ],
    },
    {
      id: "ending",
      heading: "16. Ending the contract",
      blocks: [
        "You can stop using the service and delete your account at any time on your Account page. We can end the contract if you seriously break these terms, and will tell you why. If we end it without such a reason, we refund any period you have paid for and not used. [COUNSEL: Dutch law (BW 7:408 with 7:413(2)) lets a consumer end a services contract at any time; confirm what is owed for a prepaid period and whether this section must say so.]",
      ],
    },
    {
      id: "complaints",
      heading: "17. Complaints",
      blocks: [
        `If something goes wrong, please contact us first at ${COMPANY.email}, in Arabic or English. Complaints are free. We confirm receipt within 2 working days and give you an answer within 14 days. If you are not satisfied, you can go to the consumer-protection authority or the courts of your country, or to the courts in the Netherlands.`,
      ],
    },
    {
      id: "law",
      heading: "18. Governing law and disputes",
      blocks: [
        "These terms are governed by Dutch law. This choice does not deprive you of the protection of the mandatory consumer-protection rules of the country where you live.",
        "You can bring a dispute before the competent court in the Netherlands or before the courts or consumer authority of the country where you live. We will only bring a claim against you in the courts of the country where you live. Nothing in these terms requires you to go to arbitration.",
      ],
    },
    {
      id: "language",
      heading: "19. Language",
      blocks: [
        "These terms are available in Arabic and English, and you can contact us in either language. Both versions are equally valid; if they differ, the meaning more favourable to you applies. [COUNSEL: or state that the Arabic version prevails for customers in the GCC.]",
      ],
    },
  ],
};

const termsAr: LegalDoc = {
  key: "terms",
  title: "الشروط والأحكام",
  description: `شروط استخدام ${BRAND_NAME_AR} في دول الخليج: ما هي الخدمة وما ليست هي، والأسعار بعملة بلدكم شاملة ضريبة القيمة المضافة، والعضوية والإلغاء، وحقوقكم.`,
  summary: [
    "إرشادات للعناية بالصحة العامة والمظهر، وليست استشارة طبية ولا تشخيصاً ولا علاجاً.",
    "تحمل الصور التوضيحية علامة توضّح أنها مُنشأة بالذكاء الاصطناعي، وهي تعرض اتجاهاً محتملاً وليست نتيجة مضمونة.",
    "للبالغين من عمر 18 سنة فأكثر في الكويت والسعودية والإمارات وقطر والبحرين وعُمان. للرجال فقط عند الإطلاق، ويمكن للنساء الانضمام إلى قائمة الانتظار.",
    "الأسعار بعملة بلدكم وتشمل ضريبة القيمة المضافة حيثما وُجدت. ويشمل التقرير أول 30 يوماً من العضوية. والعضوية بعدها اختيارية، ويمكن إلغاؤها عبر الإنترنت في أي وقت.",
    "تستردّون المبلغ كاملاً عند الطلب ما دامت مراجعتنا لصوركم لم تبدأ. وإذا لم تبدأ خلال 14 يوماً من الشراء، يبقى لكم حق الإلغاء مع استرداد كامل المبلغ إلى أن تبدأ.",
    "نسعى لتسليم التقرير خلال 72 ساعة من إرسال صوركم.",
  ],
  sections: [
    {
      id: "about",
      heading: "1. عن هذه الشروط وعنّا",
      blocks: [
        `هذه الشروط عقد بينكم وبين شركة ${COMPANY.name}، المسجّلة في هولندا (رقم السجل التجاري ${COMPANY.kvk})، وعنوانها ${COMPANY.address} ("نحن"). وتنطبق عند استخدامكم ${BRAND_NAME_AR} وعند شراء تقرير أو عضوية. يُرجى قراءتها مع [[سياسة الخصوصية|privacy]] و[[سياسة الاسترداد|refunds]].`,
        `للتواصل: ${COMPANY.email} باللغة العربية أو الإنجليزية. أرقام تسجيلنا الضريبي حيث نكون مسجّلين: [VAT NUMBERS: Saudi Arabia, UAE, Bahrain, Oman — add only once issued]. التراخيص أو التسجيلات المحلية: [LOCAL REGISTRATIONS: add only once obtained, e.g. Kuwait Ministry of Commerce and Industry].`,
      ],
    },
    {
      id: "service",
      heading: "2. ما هي الخدمة",
      blocks: [
        `يقيس ${BRAND_NAME_AR} ملامح الوجه والجسم من الصور التي تلتقطونها، ويشرح النتائج، ويقدّم لكم خطة لمدة 12 شهراً تشمل البشرة والعناية الشخصية والشعر والتمارين والتغذية وطريقة الوقوف. وتُحسَب القياسات الأولى على جهازكم، ويراجع شخص من فريقنا كل تقرير قبل أن يصلكم. وتتضمّن الخطة صوراً توضيحية بالذكاء الاصطناعي تعرض اتجاهاً محتملاً لتغييرات غير جراحية.`,
        "تقدّم الخدمة إرشادات للعناية بالصحة العامة والمظهر. وهي ليست استشارة طبية، ولا تشخّص أي مرض أو حالة ولا تعالجها ولا تقي منها. الدرجات والقياسات تقديرات مأخوذة من الصور، وقد تتأثر بالإضاءة والزاوية والكاميرا، وتختلف النتائج من شخص لآخر. استشيروا الطبيب قبل تغيير نظامكم الغذائي أو البدء بتمارين جديدة أو استخدام أي علاج، خاصةً إذا كانت لديكم حالة صحية أو تتناولون أدوية.",
      ],
    },
    {
      id: "ai",
      heading: "3. الصور التوضيحية بالذكاء الاصطناعي",
      blocks: [
        "الصور التوضيحية صور مُنشأة أو معدّلة بالذكاء الاصطناعي، وتحمل كل منها عبارة \"صورة توضيحية مُنشأة بالذكاء الاصطناعي\". وهي ليست صوراً لكم، وليست توقّعاً، ولا تعِد بأي نتيجة ولا تضمنها. وهي مقتصرة على التغييرات التي تشملها خطتكم (مثل العناية الشخصية والشعر والبشرة وتكوين الجسم)، ويراجعها شخص قبل أن تروها. ولإنشائها تُرسَل الصور اللازمة إلى مزوّد خدمة إنشاء الصور، كما توضّح [[سياسة الخصوصية|privacy]]. ونتائجكم الفعلية تعتمد على أمور كثيرة، منها مدى التزامكم بالخطة.",
      ],
    },
    {
      id: "eligibility",
      heading: "4. من يمكنه استخدام الخدمة",
      blocks: [
        { list: [
          "يجب أن يكون عمركم 18 سنة أو أكثر. [COUNSEL: age of majority in Kuwait and Bahrain may be 21; decide whether to gate at 21 there.]",
          "عند الإطلاق، الخدمة للرجال فقط. ويمكن للنساء الانضمام إلى قائمة الانتظار، وسنبلغهنّ عند افتتاحها.",
          "تُقدَّم الخدمة للمستهلكين المقيمين في الكويت والمملكة العربية السعودية والإمارات العربية المتحدة وقطر والبحرين وعُمان، في الدول التي يكون فيها الدفع متاحاً. وقد نفتتح الخدمة في هذه الدول في أوقات مختلفة. والأسعار المعروضة للزوار من دول أخرى للعلم فقط.",
          "لا تُقدَّم الخدمة في الدول الخاضعة لعقوبات دولية.",
          "يجب أن تستخدموا الخدمة لأنفسكم بصفتكم مستهلكين، وأن تكون المعلومات التي تقدّمونها، ومنها العمر والبلد، صحيحة.",
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
          head: ["المنتج", "ما تحصلون عليه"],
          rows: [
            ["التقرير (دفعة واحدة)", "تحليل الوجه والجسم، وخطة 12 شهراً، وصور توضيحية بالذكاء الاصطناعي، وملف PDF، بمراجعة شخص من فريقنا. ويشمل أول 30 يوماً من العضوية."],
            ["العضوية الشهرية", "فحص متابعة شهري مع تحديث الدرجات والخطة، وملاحظة من المراجِع كل شهر، وصورة توضيحية جديدة لخطة الـ 12 شهراً كل 3 أشهر."],
            ["عضوية 12 شهراً", "نفس مزايا العضوية الشهرية، بدفعة واحدة لأول 12 شهراً. وبعدها تستمر شهرياً بالسعر الشهري، ويمكنكم إلغاؤها في أي وقت."],
          ],
        } },
        "الأسعار حسب البلد (المبلغ الذي تدفعونه):",
        { table: {
          head: ["البلد", "التقرير", "شهرياً", "12 شهراً", "الضريبة"],
          rows: priceRows("ar"),
        } },
        "تُعرَض الأسعار وتُحصَّل بعملة بلدكم. وحيث تُفرض ضريبة القيمة المضافة (السعودية والإمارات والبحرين وعُمان)، يكون السعر المعروض شاملاً لها. ولا توجد ضريبة قيمة مضافة في الكويت وقطر. ولا توجد أي رسوم خفية. والسعر المعتمد هو المعروض عند الدفع، مع سعر التجديد وتاريخه، قبل أن تدفعوا.",
      ],
    },
    {
      id: "order",
      heading: "7. كيف يُبرَم العقد",
      blocks: [
        "تختارون المنتج، وترون السعر الإجمالي وما يتجدّد ومتى، ويمكنكم الرجوع وتصحيح اختياركم قبل الدفع. ويُبرَم العقد عند قبول دفعتكم. ثم نرسل لكم تأكيداً بالبريد الإلكتروني يتضمّن هذه الشروط والمبلغ الذي دفعتموه وطريقة الإلغاء. [BUILD: the app sends no order-confirmation email today (only report-ready, changes-requested and membership reminders); build it, with these terms attached or linked, or change this wording.]",
      ],
    },
    {
      id: "membership",
      heading: "8. العضوية والتجديد والإلغاء",
      blocks: [
        { list: [
          "إذا اشتريتم التقرير وحده، تحصلون على مزايا العضوية لمدة 30 يوماً. لا يتجدّد شيء ولن يُخصم منكم أي مبلغ آخر. ونراسلكم بالبريد الإلكتروني قبل نحو 5 أيام من انتهاء هذه الأيام الثلاثين، مع طريقة الاستمرار إذا رغبتم.",
          "إذا اشتريتم التقرير مع العضوية، تختارون ذلك بخانة اختيار مستقلة. وتستمر عضويتكم بعد أول 30 يوماً على الخطة التي اخترتموها، وتُخصم أول دفعة للعضوية عند انتهاء هذه الأيام الثلاثين. وتعرض صفحة الدفع تاريخها ومبلغها قبل أن تدفعوا.",
          "تتجدّد العضوية الشهرية كل شهر بالسعر الشهري، ونخصم المبلغ من البطاقة أو المحفظة التي استخدمتموها، إلى أن تلغوها.",
          "تُدفع عضوية الـ 12 شهراً دفعة واحدة لأول 12 شهراً. وبعدها تستمر شهرياً بالسعر الشهري، ويمكنكم إلغاؤها في أي وقت، فتنتهي في نهاية ذلك الشهر. ولا تتجدّد أبداً لمدة 12 شهراً جديدة. ونذكّركم بالبريد الإلكتروني قبل نحو 30 يوماً من انتهاء الأشهر الاثني عشر.",
          "يمكنكم الإلغاء في أي وقت من صفحة حسابكم بنقرتين ودون أي رسوم. تنتهي العضوية الشهرية في نهاية الشهر المدفوع، وتبقى المزايا متاحة لكم حتى ذلك الحين.",
          "إذا أنهيتم عضوية الـ 12 شهراً خلال أول 12 شهراً، نردّ لكم جزءاً متناسباً من السعر عن الأشهر الكاملة المتبقية. والتفاصيل في [[سياسة الاسترداد|refunds]].",
          "إذا تعذّر تحصيل دفعة العضوية، قد نحاول مرة أخرى خلال الأيام التالية. وإذا استمر التعذّر، تنتهي عضويتكم في نهاية المدة المدفوعة. ولا نفرض أي رسوم على الدفعة المتعذّرة. [BUILD: set Stripe's subscription setting to cancel the subscription after the final retry, so this is what happens.]",
          "إذا غيّرنا سعر العضوية، نبلغكم قبل 30 يوماً على الأقل من تطبيق التغيير عليكم، ويمكنكم الإلغاء قبل ذلك. وإذا فُرضت ضريبة القيمة المضافة في بلدكم أو تغيّرت، نبلغكم قبل أن تؤثر على سعركم.",
        ] },
      ],
    },
    {
      id: "withdrawal",
      heading: "9. حقكم في الإلغاء واسترداد المبلغ",
      blocks: [
        `يمكنكم الانسحاب من الشراء خلال 14 يوماً من تاريخه، دون ذكر أي سبب. وإذا انسحبتم قبل أن تبدأ مراجعتنا لصوركم، تستردّون المبلغ كاملاً. وإذا لم تكن المراجعة قد بدأت عند انتهاء الأيام الأربعة عشر، يبقى لكم حق الإلغاء مع استرداد كامل المبلغ إلى أن تبدأ. وإذا انسحبتم بعد بدء مراجعتنا، فاطّلعوا على الفقرة التالية. أبلغونا على ${COMPANY.email}، أو استخدموا الزر في صفحة حسابكم، أو أرسلوا نموذج الانسحاب الموجود في [[سياسة الاسترداد|refunds]]. ويكفي أن ترسلوه في الموعد. [BUILD: the withdraw/cancel-purchase button on the Account page is not built yet; build it (EU withdrawal button, applies from 19 June 2026) or remove this wording.]`,
        "قبل إرسال صوركم، نطلب منكم أن تؤكدوا، في خانة مستقلة غير محدّدة مسبقاً، أنكم تريدون منا البدء في إعداد تقريركم فوراً، خلال الأيام الأربعة عشر، وأنكم تفهمون أمرين: إذا انسحبتم بعد بدء مراجعتنا، تدفعون مبلغاً متناسباً مقابل العمل المُنجز؛ وبعد تسليم تقريركم، تفقدون حق الانسحاب. ونحتفظ بسجل لهذا التأكيد ونرسله إليكم بالبريد الإلكتروني، ولا نستطيع بدء المراجعة بدونه. [BUILD: the confirmation email with this waiver is not sent yet; build it or remove this wording.]",
        "بالنسبة للعضوية، تبدأ الأيام الأربعة عشر من يوم بدئها.",
        "نردّ لكم المبلغ خلال 14 يوماً من استلام طلب الانسحاب، إلى البطاقة أو المحفظة التي دفعتم بها، وبالعملة التي دفعتم بها.",
        "إذا كنتم مقيمين في المملكة العربية السعودية، فلكم أيضاً بموجب نظام التجارة الإلكترونية حق فسخ العقد خلال 7 أيام ما لم تكونوا قد انتفعتم بالخدمة، وتمنحكم سياستنا أعلاه هذا الحق على الأقل. ولا يمسّ أي شيء في هذه الشروط حقوقكم بموجب قوانين حماية المستهلك الإلزامية في بلدكم. [COUNSEL: Kuwait Decree-Law 10/2026 cooling-off; new Saudi Consumer Protection Law once published.]",
      ],
    },
    {
      id: "payment",
      heading: "10. الدفع والفواتير",
      blocks: [
        "تتم معالجة المدفوعات عن طريق Stripe وتُحصَّل بعملة بلدكم. ويمكنكم الدفع بالبطاقة أو Apple Pay أو Google Pay حيث تظهر في صفحة الدفع. وتذهب بيانات بطاقتكم مباشرة إلى Stripe ولا نحفظها. ولأننا شركة مقرّها خارج بلدكم، قد يعتبر بنككم الدفعة معاملة دولية ويفرض رسوماً خاصة به. هذه الرسوم لا تصلنا ولا نستطيع ردّها.",
        "تصلكم إيصالات الدفع بالبريد الإلكتروني. وحيث تُفرض ضريبة القيمة المضافة، نُصدر فاتورة ضريبية باللغتين العربية والإنجليزية تتضمّن رقم تسجيلنا الضريبي في بلدكم. [BUILD: Stripe receipts are English-only; a bilingual tax invoice must exist before checkout opens in a VAT country.]",
      ],
    },
    {
      id: "delivery",
      heading: "11. التسليم",
      blocks: [
        "بعد الدفع، تلتقطون صوركم باتباع خطوات الفحص الموجّه ثم ترسلونها. نسعى لتسليم تقريركم خلال 72 ساعة من إرسال الصور. هذا هدف وليس ضماناً، وسنبلغكم إذا احتاج الأمر وقتاً أطول. وإذا لم تكن الصور صالحة، سنطلب منكم إعادة التصوير، وتبدأ الـ 72 ساعة من جديد من وقت إرسال الصور الجديدة.",
        "إذا لم نسلّم تقريركم بعد 15 يوماً من إرسالكم صوراً صالحة، يمكنكم الإلغاء واسترداد المبلغ كاملاً. وإذا لم نتمكّن من تسليم تقريركم إطلاقاً، تستردّون المبلغ كاملاً كما هو موضّح في [[سياسة الاسترداد|refunds]].",
      ],
    },
    {
      id: "your-part",
      heading: "12. صوركم ومسؤولياتكم",
      blocks: [
        { list: [
          "ارفعوا صوركم أنتم فقط. لا ترفعوا صور أي شخص آخر، ولا صور أي شخص دون 18 سنة إطلاقاً.",
          "اتبعوا دليل التصوير. لا ترفعوا صوراً عارية أو خاصة.",
          "استخدموا الخدمة لأنفسكم فقط، وليس لأي غرض تجاري.",
          "لا تنسخوا الخدمة أو تعيدوا بيعها أو تستخرجوا بياناتها آلياً أو تحاولوا تفكيكها، ولا تحاولوا تجاوز حمايتها أو حدودها.",
        ] },
        "قد نوقف أو نغلق أي حساب يخالف هذه القواعد، ونحذف الصور التي ما كان يجب رفعها، وسنوضّح لكم السبب.",
      ],
    },
    {
      id: "ip",
      heading: "13. الملكية الفكرية",
      blocks: [
        "نملك الخدمة، بما فيها التطبيق والأساليب والنصوص والتصميم وشكل التقارير. وتقريركم لاستخدامكم الشخصي.",
        "صوركم تبقى ملككم. وتمنحوننا الإذن باستخدامها فقط لتقديم الخدمة لكم، كما توضّح [[سياسة الخصوصية|privacy]]. لا نستخدمها في التسويق ولا في تدريب نماذج الذكاء الاصطناعي. وينتهي هذا الإذن عند حذف صوركم.",
      ],
    },
    {
      id: "liability",
      heading: "14. مسؤوليتنا",
      blocks: [
        "نقدّم الخدمة بعناية ومهارة معقولتين. ولأن النتائج تقديرات وإرشادات، لا نستطيع أن نعِد بنتيجة معيّنة.",
        "نحن مسؤولون عن الخسائر التي نسبّبها بمخالفة هذه الشروط أو القانون. ولسنا مسؤولين عن الخسائر التي لم يكن من الممكن توقّعها، أو عن الخسائر الناتجة عن أمور خارجة عن سيطرتنا. [COUNSEL: whether to cap liability for ordinary negligence at the fees paid in the last 12 months.]",
        "لا يحدّ أي شيء في هذه الشروط من مسؤوليتنا ولا يستبعدها في حالات الوفاة أو الإصابة الجسدية، أو الغش أو الإهمال الجسيم، أو الإخلال بالتزاماتنا القانونية (ومنها حماية البيانات)، أو أي مسؤولية أخرى لا يجوز تحديدها قانوناً. ولا يحدّ أي شيء فيها من حقوقكم بموجب قوانين حماية المستهلك الإلزامية.",
      ],
    },
    {
      id: "changes-service",
      heading: "15. التغييرات على الخدمة وعلى هذه الشروط",
      blocks: [
        "قد نطوّر الخدمة أو نغيّرها. وإذا غيّرنا هذه الشروط بشكل يهمّكم، نبلغكم قبل 30 يوماً على الأقل من سريان التغيير. وإذا لم توافقوا، يمكنكم إلغاء عضويتكم قبل ذلك دون أي رسوم.",
      ],
    },
    {
      id: "ending",
      heading: "16. إنهاء العقد",
      blocks: [
        "يمكنكم التوقف عن استخدام الخدمة وحذف حسابكم في أي وقت من صفحة حسابكم. ويحق لنا إنهاء العقد إذا خالفتم هذه الشروط مخالفة جسيمة، وسنوضّح لكم السبب. وإذا أنهيناه دون سبب كهذا، نردّ لكم قيمة أي مدة دفعتموها ولم تستفيدوا منها. [COUNSEL: Dutch law (BW 7:408 with 7:413(2)) lets a consumer end a services contract at any time; confirm what is owed for a prepaid period and whether this section must say so.]",
      ],
    },
    {
      id: "complaints",
      heading: "17. الشكاوى",
      blocks: [
        `إذا حدثت أي مشكلة، تواصلوا معنا أولاً على ${COMPANY.email} باللغة العربية أو الإنجليزية. تقديم الشكوى مجاني. نؤكد استلامها خلال يومَي عمل، ونرد عليكم خلال 14 يوماً. وإذا لم تكونوا راضين، يمكنكم اللجوء إلى جهة حماية المستهلك أو المحاكم في بلدكم، أو إلى المحاكم في هولندا.`,
      ],
    },
    {
      id: "law",
      heading: "18. القانون المطبّق والنزاعات",
      blocks: [
        "تخضع هذه الشروط للقانون الهولندي. ولا يحرمكم هذا الاختيار من حماية قواعد حماية المستهلك الإلزامية في بلد إقامتكم.",
        "يمكنكم رفع أي نزاع أمام المحكمة المختصة في هولندا أو أمام المحاكم أو جهة حماية المستهلك في بلد إقامتكم. ولن نرفع أي دعوى ضدكم إلا أمام محاكم بلد إقامتكم. ولا يُلزمكم أي شيء في هذه الشروط باللجوء إلى التحكيم.",
      ],
    },
    {
      id: "language",
      heading: "19. اللغة",
      blocks: [
        "هذه الشروط متاحة باللغتين العربية والإنجليزية، ويمكنكم التواصل معنا بأي منهما. والنسختان متساويتان في الحجية، وإذا اختلف المعنى بينهما، يُعتمد المعنى الأفضل لكم. [COUNSEL: or state that the Arabic version prevails for customers in the GCC.]",
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
  description: `When ${BRAND_NAME} refunds a report or a membership, for customers in Kuwait, Saudi Arabia, the UAE, Qatar, Bahrain and Oman.`,
  summary: [
    "Full refund on request, for any reason, as long as our review of your photos has not started. This window is never shorter than 14 days from purchase if the review has not started by then.",
    "After our review has started but before delivery: refund, less a proportional amount for the work already done.",
    "After delivery: we fix or refund a report that is faulty, incomplete or not as described.",
    "If we cannot deliver your report, full refund.",
    "Membership: cancel online any time, no fee. A 12-month membership ended early is refunded for the full months left.",
    "Refunds go back to your card or wallet, in the currency you paid. Your legal rights are never affected.",
  ],
  sections: [
    {
      id: "withdraw",
      heading: "1. Cancelling before our review starts",
      blocks: [
        `You can withdraw from your purchase within 14 days of buying it, without giving a reason. If you withdraw before our review of your photos starts, you get a full refund. If our review has not started when the 14 days end, you can still cancel with a full refund until it starts. Tell us at ${COMPANY.email}, use the button on your Account page, or send the model form in section 7. Sending it in time is enough. [BUILD: the withdraw/cancel-purchase button on the Account page is not built yet; build it (EU withdrawal button, applies from 19 June 2026) or remove this wording.]`,
        "Before you submit your photos, you ask us to start your report straight away and confirm that you understand the following. If you withdraw after our review has started, you pay a proportional amount for the work already done. Once your report has been delivered, you lose the right to withdraw. Your rights if the report is faulty or not as described are not affected.",
        "For a membership, the 14 days run from the day you start it.",
        "We refund you within 14 days of receiving your request.",
      ],
    },
    {
      id: "before",
      heading: "2. Before and after our review starts",
      blocks: [
        { list: [
          "Before you submit your photos, or after you submit them but before our review has started: full refund, for any reason.",
          "After our review has started but before your report is delivered: we refund the price, less a proportional amount for the work already done. We tell you the amount and how we worked it out.",
        ] },
      ],
    },
    {
      id: "cannot-deliver",
      heading: "3. If we cannot deliver",
      blocks: [
        "If we cannot deliver your report, for example because of a technical problem on our side or because we cannot complete the review, we refund you in full.",
        "If we have not delivered your report 15 days after you submitted usable photos, you can cancel and we refund you in full.",
        "If your photos cannot be used, we first ask you to retake them at no cost. If it is still not possible to produce a report from your photos, we refund you in full. [COUNSEL: whether a stated reasonable fee may be kept when the customer does not retake unusable photos.]",
        "If you withdraw your photo consent before delivery, we delete your photos and cannot finish the report. If our review has not started yet, we refund you in full. If it has, we refund the price less a proportional amount for the work already done.",
      ],
    },
    {
      id: "after",
      heading: "4. After delivery",
      blocks: [
        "If your report is faulty, incomplete or not as described, we put it right or refund you. For example, when:",
        { list: [
          "the report is incomplete or does not work;",
          "the results are clearly not based on your own photos and answers; or",
          "an AI illustration changes things your plan does not cover, such as your face shape, bone structure or identity.",
        ] },
        "Please tell us as soon as you notice a problem, ideally within 14 days of delivery, so we can fix it quickly. This does not limit your legal rights. We will first try to fix the problem or redo the affected part. If we cannot, we refund you in full.",
        "Apart from this, there is no change-of-mind refund once your report has been delivered, because the service has then been fully provided. Disagreeing with a score, or the results not being what you hoped, does not by itself mean the report is not as described. Scores are estimates from photos, and we explain how each one is measured.",
      ],
    },
    {
      id: "membership",
      heading: "5. Membership",
      blocks: [
        { list: [
          "You can cancel at any time on your Account page, without any fee.",
          "A monthly membership ends at the end of the month you have paid for. You keep your benefits until then.",
          "A 12-month membership is paid once for the first 12 months, then continues month to month at the monthly price, and you can cancel at any time.",
          "If you end a 12-month membership during its first 12 months, we refund a proportional part of the price for the full months that are left. [COUNSEL: check whether Dutch law (BW 7:408) requires a refund for the unused part of the current month too.]",
          "The 30 days of membership included with the report are part of the report price and are not refunded separately.",
          "If we cannot deliver a monthly check-in, we refund that month (or the matching part of a 12-month membership) or extend your membership, as you prefer.",
        ] },
      ],
    },
    {
      id: "how",
      heading: "6. How to ask for a refund",
      blocks: [
        `Write to ${COMPANY.email} from the email address on your account, in Arabic or English, with your order number if you have it. We reply within 5 working days.`,
        "Approved refunds are paid in the currency you paid, to the card or wallet you paid with, through Stripe. Any VAT you paid is refunded with the price. Banks usually take 5 to 10 working days to show the refund. Fees your bank charged for an international payment are set by your bank and are not refunded by us.",
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
      heading: "8. Your legal rights in your country",
      blocks: [
        "This policy does not limit any rights you have under mandatory consumer law, in the Netherlands or in the country where you live. In particular:",
        { list: [
          "Saudi Arabia: you may cancel within 7 days under the E-Commerce Law as long as you have not benefited from the service. Section 1 gives you at least that.",
          "Kuwait, the UAE, Qatar, Bahrain and Oman: you keep every right your country's consumer law gives you, including to a repair, replacement or refund of a service that is faulty or not as described.",
        ] },
        "[COUNSEL: confirm per country, including Kuwait Decree-Law 10/2026 and the new Saudi Consumer Protection Law once in force.]",
      ],
    },
  ],
};

const refundsAr: LegalDoc = {
  key: "refunds",
  title: "سياسة الاسترداد",
  description: `متى يردّ ${BRAND_NAME_AR} قيمة التقرير أو العضوية، لعملائنا في الكويت والسعودية والإمارات وقطر والبحرين وعُمان.`,
  summary: [
    "تستردّون المبلغ كاملاً عند الطلب، لأي سبب، ما دامت مراجعتنا لصوركم لم تبدأ. ولا تقل هذه المدة عن 14 يوماً من الشراء إذا لم تكن المراجعة قد بدأت حتى ذلك الحين.",
    "بعد بدء المراجعة وقبل التسليم: نردّ المبلغ بعد خصم جزء متناسب مقابل العمل المُنجز.",
    "بعد التسليم: نصلح التقرير أو نردّ قيمته إذا كان معيباً أو ناقصاً أو غير مطابق لما وُصف.",
    "إذا لم نتمكّن من تسليم تقريركم، تستردّون المبلغ كاملاً.",
    "العضوية: يمكنكم إلغاؤها عبر الإنترنت في أي وقت دون رسوم. وإذا أنهيتم عضوية الـ 12 شهراً مبكراً، نردّ قيمة الأشهر الكاملة المتبقية.",
    "تُردّ المبالغ إلى بطاقتكم أو محفظتكم بالعملة التي دفعتم بها. ولا تمسّ هذه السياسة حقوقكم القانونية أبداً.",
  ],
  sections: [
    {
      id: "withdraw",
      heading: "1. الإلغاء قبل بدء المراجعة",
      blocks: [
        `يمكنكم الانسحاب من الشراء خلال 14 يوماً من تاريخه، دون ذكر أي سبب. وإذا انسحبتم قبل أن تبدأ مراجعتنا لصوركم، تستردّون المبلغ كاملاً. وإذا لم تكن المراجعة قد بدأت عند انتهاء الأيام الأربعة عشر، يبقى لكم حق الإلغاء مع استرداد كامل المبلغ إلى أن تبدأ. أبلغونا على ${COMPANY.email}، أو استخدموا الزر في صفحة حسابكم، أو أرسلوا النموذج الموجود في البند 7. ويكفي أن ترسلوه في الموعد. [BUILD: the withdraw/cancel-purchase button on the Account page is not built yet; build it (EU withdrawal button, applies from 19 June 2026) or remove this wording.]`,
        "قبل إرسال صوركم، تطلبون منا البدء في إعداد تقريركم فوراً وتؤكدون أنكم تفهمون ما يلي: إذا انسحبتم بعد بدء مراجعتنا، تدفعون مبلغاً متناسباً مقابل العمل المُنجز. وبعد تسليم تقريركم، تفقدون حق الانسحاب. ولا يمسّ ذلك حقوقكم إذا كان التقرير معيباً أو غير مطابق لما وُصف.",
        "بالنسبة للعضوية، تبدأ الأيام الأربعة عشر من يوم بدئها.",
        "نردّ لكم المبلغ خلال 14 يوماً من استلام طلبكم.",
      ],
    },
    {
      id: "before",
      heading: "2. قبل بدء المراجعة وبعده",
      blocks: [
        { list: [
          "قبل إرسال الصور، أو بعد إرسالها وقبل بدء مراجعتنا: تستردّون المبلغ كاملاً لأي سبب.",
          "بعد بدء المراجعة وقبل تسليم التقرير: نردّ لكم السعر بعد خصم جزء متناسب مقابل العمل المُنجز، ونوضّح لكم المبلغ وطريقة حسابه.",
        ] },
      ],
    },
    {
      id: "cannot-deliver",
      heading: "3. إذا لم نتمكّن من التسليم",
      blocks: [
        "إذا لم نتمكّن من تسليم تقريركم، مثلاً بسبب مشكلة تقنية من جهتنا أو لعدم قدرتنا على إكمال المراجعة، نردّ لكم المبلغ كاملاً.",
        "إذا لم نسلّم تقريركم بعد 15 يوماً من إرسالكم صوراً صالحة، يمكنكم الإلغاء ونردّ لكم المبلغ كاملاً.",
        "إذا لم تكن صوركم صالحة، نطلب منكم أولاً إعادة التصوير دون أي تكلفة. وإذا ظل إعداد التقرير من صوركم غير ممكن، نردّ لكم المبلغ كاملاً. [COUNSEL: whether a stated reasonable fee may be kept when the customer does not retake unusable photos.]",
        "إذا سحبتم موافقتكم على معالجة الصور قبل التسليم، نحذف صوركم ولا نستطيع إكمال التقرير. إذا لم تكن المراجعة قد بدأت، نردّ لكم المبلغ كاملاً. وإذا كانت قد بدأت، نردّ لكم السعر بعد خصم مبلغ متناسب مقابل العمل المُنجز.",
      ],
    },
    {
      id: "after",
      heading: "4. بعد التسليم",
      blocks: [
        "إذا كان تقريركم معيباً أو ناقصاً أو غير مطابق لما وُصف، نصلحه أو نردّ لكم المبلغ. مثلاً إذا كان:",
        { list: [
          "التقرير ناقصاً أو لا يعمل؛",
          "النتائج لا تستند بوضوح إلى صوركم وإجاباتكم؛ أو",
          "صورة توضيحية بالذكاء الاصطناعي غيّرت أموراً لا تشملها خطتكم، مثل شكل الوجه أو بنية العظام أو الهوية.",
        ] },
        "يُرجى إبلاغنا فور ملاحظة أي مشكلة، ويُفضَّل خلال 14 يوماً من التسليم، لنتمكّن من إصلاحها بسرعة. ولا يحدّ ذلك من حقوقكم القانونية. سنحاول أولاً إصلاح المشكلة أو إعادة الجزء المتأثر، وإذا لم نتمكّن، نردّ لكم المبلغ كاملاً.",
        "وفيما عدا ذلك، لا يُردّ المبلغ لمجرد تغيير الرأي بعد تسليم التقرير، لأن الخدمة تكون قد قُدّمت كاملة. وعدم الاتفاق مع درجة معيّنة، أو أن تكون النتائج غير ما كنتم تأملون، لا يعني وحده أن التقرير غير مطابق لما وُصف. فالدرجات تقديرات من الصور، ونشرح طريقة قياس كل واحدة منها.",
      ],
    },
    {
      id: "membership",
      heading: "5. العضوية",
      blocks: [
        { list: [
          "يمكنكم الإلغاء في أي وقت من صفحة حسابكم دون أي رسوم.",
          "تنتهي العضوية الشهرية في نهاية الشهر المدفوع، وتبقى المزايا متاحة لكم حتى ذلك الحين.",
          "تُدفع عضوية الـ 12 شهراً دفعة واحدة لأول 12 شهراً، ثم تستمر شهرياً بالسعر الشهري، ويمكنكم إلغاؤها في أي وقت.",
          "إذا أنهيتم عضوية الـ 12 شهراً خلال أول 12 شهراً، نردّ لكم جزءاً متناسباً من السعر عن الأشهر الكاملة المتبقية. [COUNSEL: check whether Dutch law (BW 7:408) requires a refund for the unused part of the current month too.]",
          "الأيام الثلاثون من العضوية المشمولة مع التقرير جزء من سعر التقرير، ولا تُستردّ قيمتها بشكل منفصل.",
          "إذا لم نتمكّن من تقديم فحص المتابعة الشهري، نردّ قيمة ذلك الشهر (أو الجزء المقابل من عضوية الـ 12 شهراً) أو نمدّد عضويتكم، حسب ما تفضّلون.",
        ] },
      ],
    },
    {
      id: "how",
      heading: "6. كيف تطلبون الاسترداد",
      blocks: [
        `راسلونا على ${COMPANY.email} من البريد الإلكتروني المسجّل في حسابكم، باللغة العربية أو الإنجليزية، مع رقم الطلب إن وُجد. نرد خلال 5 أيام عمل.`,
        "تُدفَع المبالغ المستردّة المعتمدة بالعملة التي دفعتم بها، إلى البطاقة أو المحفظة التي دفعتم بها، عن طريق Stripe. وتُردّ أي ضريبة قيمة مضافة دفعتموها مع السعر. وعادةً تحتاج البنوك من 5 إلى 10 أيام عمل لإظهار المبلغ. أما الرسوم التي فرضها بنككم على الدفع الدولي فيحدّدها البنك، ولا نردّها.",
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
      heading: "8. حقوقكم القانونية في بلدكم",
      blocks: [
        "لا تحدّ هذه السياسة من أي حقوق تمنحكم إياها قوانين حماية المستهلك الإلزامية، في هولندا أو في بلد إقامتكم. وعلى وجه الخصوص:",
        { list: [
          "المملكة العربية السعودية: يحق لكم فسخ العقد خلال 7 أيام بموجب نظام التجارة الإلكترونية ما لم تكونوا قد انتفعتم بالخدمة، ويمنحكم البند 1 هذا الحق على الأقل.",
          "الكويت والإمارات وقطر والبحرين وعُمان: تبقى لكم جميع الحقوق التي يمنحها قانون حماية المستهلك في بلدكم، ومنها إصلاح الخدمة المعيبة أو غير المطابقة لما وُصف أو استبدالها أو ردّ قيمتها.",
        ] },
        "[COUNSEL: confirm per country, including Kuwait Decree-Law 10/2026 and the new Saudi Consumer Protection Law once in force.]",
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

const INLINE_RE =
  /\[\[([^|\]]+)\|([^\]]+)\]\]|(\[[A-Z][A-Z0-9 .,:'()\-/]*[A-Z0-9.)]\]|\[(?:KUWAIT|REVIEWERS|COUNSEL|NO-TRAINING|FONTS|BUILD|DPO|VAT NUMBERS|LOCAL REGISTRATIONS|IMAGE PROVIDER RETENTION|IMAGE PROVIDER SUB-PROCESSORS|FUNCTIONS REGION|SMTP|LOG RETENTION):(?:[^\][]|\[[^\]]*\])*\])/g;

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
