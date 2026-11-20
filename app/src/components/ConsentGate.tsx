/*
 * Step-by-step consent: 18+ check, terms + privacy, and explicit photo consent.
 * It does not save anything itself: `onComplete` receives the consents to
 * record (kind + version), e.g. with recordConsents() from lib/backend/consents.
 *
 * Use `steps` to show only part of it, e.g. ["age", "terms"] on /start and
 * ["photos"] before the intake questionnaire (it also covers the health-related
 * answers, so it must come before them, not only before the camera).
 *
 * The photos step is the separate, explicit consent for sensitive data (face
 * and body photos, the measurements taken from them, health-related answers).
 * It has four required, un-ticked boxes that are all recorded as one consent
 * of kind "photos": (1) explicit consent to the analysis and human review,
 * (2) storage in the EU and transfer to the named countries (needed for the
 * UAE and Oman, research: data-protection.verified.md section 10), (3) the AI
 * illustration notice (EU AI Act art. 50(4)), (4) "these are photos of me".
 * Recording (2) and (3) as their own consent kinds, or making (3) optional,
 * needs new ConsentKind values (lib/backend/types.ts) and a migration; see
 * docs/legal/LEGAL_MEMO.md.
 *
 * The photos step also asks, by default, for the request to start work within
 * the 14-day withdrawal period (terms section 9, refund policy section 1). It is
 * returned in `consents` as kind "withdrawal_waiver" (submit-scan refuses the
 * photos without it) and, for convenience, also as `withdrawalWaiver`.
 *
 * Wording changed 2026-11-20: CONSENT_VERSION must be bumped (see
 * CONSENT_VERSION_BUMP in pages/legal/content.ts).
 */
import { useId, useMemo, useState, type ReactNode } from "react";
import { CONSENT_VERSION } from "../lib/backend/consents";
import { PHOTO_ACCESS_TEXT, WAIVER_TEXT } from "../pages/legal/waiver";
import type { ConsentKind } from "../lib/backend/types";
import { LegalText, useLegalLang } from "../pages/legal/Privacy";
import type { LegalLang } from "../pages/legal/content";
import "./ConsentGate.css";

export type ConsentStep = "age" | "terms" | "photos";

export interface GivenConsent {
  kind: ConsentKind;
  version: string;
}

export interface ConsentResult {
  consents: GivenConsent[];
  /** only the year is kept (null when the person confirmed age without a date) */
  birthYear: number | null;
  ageMethod: "dob" | "confirmed" | null;
  /** the request to start work now, losing the right to withdraw once delivered; null when not asked */
  withdrawalWaiver: { version: string; givenAt: string } | null;
}

export interface ConsentGateProps {
  onComplete: (result: ConsentResult) => void;
  /** shown as a "Back" button on the first step */
  onCancel?: () => void;
  /** called when someone is under 18 (nothing they entered is passed on) */
  onUnderage?: () => void;
  steps?: ConsentStep[];
  /** add an optional marketing-email checkbox to the terms step */
  askMarketing?: boolean;
  /** ask, on the photos step, for the request to start work within the 14-day withdrawal period (default true) */
  askWithdrawalWaiver?: boolean;
  lang?: LegalLang;
  /** disables the final button while the caller saves */
  busy?: boolean;
  /** consent text version to record; defaults to CONSENT_VERSION */
  version?: string;
  className?: string;
}

const MONTHS: Record<LegalLang, string[]> = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
};

const T = {
  en: {
    stepOf: (n: number, t: number) => `Step ${n} of ${t}`,
    next: "Continue",
    back: "Back",
    finish: "Agree and continue",
    age: {
      title: "First, your age",
      lead: "This service is for adults only. Please enter your date of birth. We keep only the year.",
      day: "Day",
      month: "Month",
      year: "Year",
      noDob: "I'd rather not enter my date of birth",
      useDob: "Enter my date of birth instead",
      confirm: "I confirm that I am 18 or older.",
      invalid: "Please choose a valid date.",
    },
    under: {
      title: "Sorry, this isn't for you yet",
      body: "This service is only for people aged 18 or older, so we can't continue. Nothing you entered has been saved. We wish you well, and you're welcome back once you're 18.",
      mistake: "Entered the wrong date? Go back",
    },
    terms: {
      title: "Terms and privacy",
      lead: "Please read these and accept them before you continue. Links open in a new tab.",
      terms: "I accept the [[Terms|terms]] and the [[Refund policy|refunds]]. I understand this is wellness and aesthetic guidance, not medical advice.",
      privacy: "I have read the [[Privacy policy|privacy]] and understand how my data is used.",
      marketing: "Send me occasional news and offers by email (optional). I can unsubscribe at any time.",
    },
    photos: {
      title: "Your photos",
      lead: "Before you take your photos, here is exactly what happens to them. This is a separate consent: please read it and tick each box yourself.",
      items: [
        ["What we capture", "Your face from the front, both sides and at an angle, with a few expressions (smile, frown, raised brows), and your body from the front and side. Plus the answers you give, such as height, weight, smoking, and skin and hair concerns. Some of these answers, and results such as your body-fat estimate, are health information."],
        ["Why", "Only to prepare your report and plan: a person reviews your photos and measurements, and we make your AI illustrations. We never use them to identify you or recognise you, and never for facial recognition. This is not medical advice and not a diagnosis."],
        ["Where", "Measurements are made on your device first. When you submit, your photos are uploaded encrypted to our servers in the EU (Frankfurt, Germany), run by our company in the Netherlands. To make your AI illustrations, the photos needed are sent to our image provider, [IMAGE PROVIDER], in the United States. Our email provider in the United States receives your email address, never your photos."],
        ["Who sees them", PHOTO_ACCESS_TEXT.en],
        ["Leaving your country", "Your data leaves your country for the Netherlands, Germany and the United States. It is protected there by the GDPR and the EU's standard contractual clauses (and the EU-US Data Privacy Framework where the provider is certified). Where your country's law needs your consent to this transfer, you give it below. Details are in the [[privacy policy|privacy]]."],
        ["AI illustrations", "The \"after\" pictures in your plan are made by AI from your photos and are labelled as AI illustrations. They are not photos of you, not a prediction and not a promise of any result. They are never used in advertising."],
        ["Never", "Your photos are never sold, never used in marketing and never used to train AI models. [NO-TRAINING: keep the training promise only once the signed contract with [IMAGE PROVIDER] forbids training on our requests.]"],
        ["Deletion", "Photos are deleted automatically 90 days after your report is delivered, or earlier if you ask. Your measurements and plan stay in your account until you delete it, or at most 24 months after your last order or membership ends."],
        ["Changing your mind", "You can withdraw this consent at any time on your Account page or by email, and we delete your photos and the measurements and health answers taken from them. If you do this before delivery, we can't finish your report; see the [[refund policy|refunds]]."],
      ] as [string, string][],
      consent: "I give my explicit consent for my photos, the face and body measurements taken from them, and the health-related answers I give (such as weight, smoking, skin and hair concerns) to be processed as described above, including review by the reviewer assigned to my order and authorised staff. I know I can withdraw this consent at any time.",
      transfer: "I explicitly agree that my photos and data are stored and processed outside my country: in the Netherlands and Germany (EU), and, for my AI illustrations and emails, by the providers named above in the United States.",
      ai: "I understand that my plan includes AI-generated illustrations made from my photos by our image provider, and that they are not real results or predictions.",
      own: "These photos are of me only. They show no one else and no one under 18.",
      // the canonical wording, shared with terms section 9 and refund policy section 1
      waiver: WAIVER_TEXT.en,
      waiverMore: "Until our review starts you can still cancel for a full refund. Your rights are explained in the [[Terms|terms]] and the [[Refund policy|refunds]].",
      more: "Full details are in the [[Privacy policy|privacy]].",
    },
  },
  ar: {
    stepOf: (n: number, t: number) => `الخطوة ${n} من ${t}`,
    next: "متابعة",
    back: "رجوع",
    finish: "أوافق وأتابع",
    age: {
      title: "أولاً: العمر",
      lead: "هذه الخدمة للبالغين فقط. أدخلوا تاريخ ميلادكم، ونحتفظ بسنة الميلاد فقط.",
      day: "اليوم",
      month: "الشهر",
      year: "السنة",
      noDob: "أفضّل عدم إدخال تاريخ الميلاد",
      useDob: "إدخال تاريخ الميلاد بدلاً من ذلك",
      confirm: "أؤكد أن عمري 18 سنة أو أكثر.",
      invalid: "اختاروا تاريخاً صحيحاً.",
    },
    under: {
      title: "عذراً، الخدمة غير متاحة لكم حالياً",
      body: "هذه الخدمة لمن أعمارهم 18 سنة فأكثر فقط، لذلك لا يمكننا المتابعة. لم نحفظ أي شيء أدخلتموه. نتمنى لكم كل خير، وأهلاً بكم عندما تبلغون 18 سنة.",
      mistake: "أدخلتم تاريخاً غير صحيح؟ ارجعوا لتعديله",
    },
    terms: {
      title: "الشروط والخصوصية",
      lead: "يرجى قراءة هذه النصوص والموافقة عليها قبل المتابعة. الروابط تفتح في صفحة جديدة.",
      terms: "أوافق على [[الشروط والأحكام|terms]] و[[سياسة الاسترداد|refunds]]، وأفهم أن هذه إرشادات للعناية بالصحة العامة والمظهر وليست استشارة طبية.",
      privacy: "قرأت [[سياسة الخصوصية|privacy]] وفهمت كيف تُستخدم بياناتي.",
      marketing: "أرسلوا لي أخباراً وعروضاً من حين لآخر بالبريد الإلكتروني (اختياري). ويمكنني إلغاء الاشتراك في أي وقت.",
    },
    photos: {
      title: "صوركم",
      lead: "قبل التقاط صوركم، إليكم بالتحديد ما يحدث لها. هذه موافقة مستقلة: يُرجى قراءتها وتحديد كل خانة بأنفسكم.",
      items: [
        ["ما نلتقطه", "وجهكم من الأمام ومن الجانبين ومن زاوية مائلة، مع بعض التعابير (ابتسامة، تقطيب، رفع الحواجب)، وجسمكم من الأمام والجانب. بالإضافة إلى إجاباتكم مثل الطول والوزن والتدخين ومشاكل البشرة والشعر. وبعض هذه الإجابات، وبعض النتائج مثل تقدير نسبة الدهون في الجسم، معلومات صحية."],
        ["لماذا", "لإعداد تقريركم وخطتكم فقط: يراجع شخص من فريقنا صوركم وقياساتكم، ونُنشئ صوركم التوضيحية بالذكاء الاصطناعي. ولا نستخدمها أبداً للتعرّف على هويتكم أو لتمييزكم، ولا لأي تقنية للتعرّف على الوجه. وهذه ليست استشارة طبية ولا تشخيصاً."],
        ["أين", "تُحسَب القياسات على جهازكم أولاً. وعند الإرسال، تُرفَع صوركم مشفّرة إلى خوادمنا في الاتحاد الأوروبي (فرانكفورت، ألمانيا)، وتديرها شركتنا في هولندا. ولإنشاء الصور التوضيحية، تُرسَل الصور اللازمة إلى مزوّد خدمة إنشاء الصور، [IMAGE PROVIDER]، في الولايات المتحدة. ويتلقّى مزوّد البريد الإلكتروني في الولايات المتحدة عنوان بريدكم فقط، ولا يتلقّى صوركم أبداً."],
        ["من يراها", PHOTO_ACCESS_TEXT.ar],
        ["خروج البيانات من بلدكم", "تخرج بياناتكم من بلدكم إلى هولندا وألمانيا والولايات المتحدة، وتحميها هناك اللائحة الأوروبية لحماية البيانات والبنود التعاقدية النموذجية للاتحاد الأوروبي (وإطار خصوصية البيانات بين الاتحاد الأوروبي والولايات المتحدة إذا كان المزوّد معتمداً فيه). وحيث يشترط قانون بلدكم موافقتكم على هذا النقل، تقدّمونها أدناه. والتفاصيل في [[سياسة الخصوصية|privacy]]."],
        ["الصور التوضيحية", "صور \"بعد\" في خطتكم يُنشئها الذكاء الاصطناعي من صوركم، وتحمل علامة توضّح أنها صور توضيحية بالذكاء الاصطناعي. وهي ليست صوراً لكم، ولا توقّعاً، ولا وعداً بأي نتيجة، ولا تُستخدم أبداً في الإعلانات."],
        ["أبداً", "صوركم لا تُباع، ولا تُستخدم في التسويق، ولا تُستخدم لتدريب نماذج الذكاء الاصطناعي. [NO-TRAINING: keep the training promise only once the signed contract with [IMAGE PROVIDER] forbids training on our requests.]"],
        ["الحذف", "تُحذَف الصور تلقائياً بعد 90 يوماً من تسليم التقرير، أو قبل ذلك إذا طلبتم. وتبقى قياساتكم وخطتكم في حسابكم حتى تحذفوه، أو 24 شهراً كحد أقصى بعد آخر طلب أو انتهاء عضويتكم."],
        ["إذا غيّرتم رأيكم", "يمكنكم سحب هذه الموافقة في أي وقت من صفحة حسابكم أو بالبريد الإلكتروني، وعندها نحذف صوركم والقياسات والإجابات الصحية المأخوذة منها. وإذا سحبتموها قبل التسليم، لا يمكننا إكمال تقريركم؛ اطّلعوا على [[سياسة الاسترداد|refunds]]."],
      ] as [string, string][],
      consent: "أوافق موافقة صريحة على معالجة صوري، وقياسات الوجه والجسم المأخوذة منها، وإجاباتي المتعلقة بالصحة (مثل الوزن والتدخين ومشاكل البشرة والشعر)، كما هو موضّح أعلاه، بما في ذلك مراجعتها من قبل المراجِع المكلّف بطلبي والموظفين المخوّلين. وأعلم أنه يمكنني سحب هذه الموافقة في أي وقت.",
      transfer: "أوافق صراحةً على حفظ صوري وبياناتي ومعالجتها خارج بلدي: في هولندا وألمانيا (الاتحاد الأوروبي)، ولدى المزوّدين المذكورين أعلاه في الولايات المتحدة لإنشاء صوري التوضيحية وإرسال الرسائل الإلكترونية.",
      ai: "أفهم أن خطتي تتضمّن صوراً توضيحية يُنشئها مزوّد خدمة إنشاء الصور بالذكاء الاصطناعي من صوري، وأنها ليست نتائج حقيقية ولا توقّعات.",
      own: "هذه الصور لي أنا فقط، ولا يظهر فيها أي شخص آخر ولا أي شخص دون 18 سنة.",
      waiver: WAIVER_TEXT.ar,
      waiverMore: "يمكنكم الإلغاء مع استرداد المبلغ كاملاً إلى أن تبدأ مراجعتنا. وحقوقكم موضّحة في [[الشروط والأحكام|terms]] و[[سياسة الاسترداد|refunds]].",
      more: "التفاصيل الكاملة في [[سياسة الخصوصية|privacy]].",
    },
  },
};

/** Age in whole years on `now`, or null when the date does not exist. */
export function ageFromDob(year: number, month: number, day: number, now = new Date()): number | null {
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  if (d > now) return null;
  let age = now.getFullYear() - year;
  const before = now.getMonth() < month - 1 || (now.getMonth() === month - 1 && now.getDate() < day);
  if (before) age -= 1;
  return age;
}

function Check({ checked, onChange, children, required }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; required?: boolean }) {
  const id = useId();
  return (
    <div className={`cg-check${checked ? " is-on" : ""}`}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-required={required || undefined} />
      <label htmlFor={id}>{children}</label>
    </div>
  );
}

export function ConsentGate({
  onComplete,
  onCancel,
  onUnderage,
  steps = ["age", "terms", "photos"],
  askMarketing = false,
  askWithdrawalWaiver = true,
  lang: langProp,
  busy = false,
  version = CONSENT_VERSION,
  className,
}: ConsentGateProps) {
  const lang = useLegalLang(langProp);
  const t = T[lang];
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const last = index === steps.length - 1;

  // age
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [noDob, setNoDob] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [underage, setUnderage] = useState(false);
  const [dateError, setDateError] = useState(false);
  // terms
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [marketing, setMarketing] = useState(false);
  // photos
  const [photos, setPhotos] = useState(false);
  const [transfer, setTransfer] = useState(false);
  const [aiNotice, setAiNotice] = useState(false);
  const [ownPhotos, setOwnPhotos] = useState(false);
  const [waiver, setWaiver] = useState(false);
  const needWaiver = askWithdrawalWaiver && steps.includes("photos");

  const now = useMemo(() => new Date(), []);
  const years = useMemo(() => Array.from({ length: 101 }, (_, i) => now.getFullYear() - i), [now]);
  const dobComplete = day !== "" && month !== "" && year !== "";
  const dobAge = dobComplete ? ageFromDob(+year, +month, +day, now) : null;

  const canContinue =
    step === "age" ? (noDob ? ageConfirmed : dobComplete) : step === "terms" ? terms && privacy : step === "photos" ? photos && transfer && aiNotice && ownPhotos && (!needWaiver || waiver) : false;

  function finish() {
    const consents: GivenConsent[] = [];
    const add = (kind: ConsentKind) => consents.push({ kind, version });
    if (steps.includes("age")) add("age18");
    if (steps.includes("terms")) {
      add("terms");
      add("privacy");
      if (askMarketing && marketing) add("marketing");
    }
    if (steps.includes("photos")) add("photos");
    if (needWaiver && waiver) add("withdrawal_waiver");
    const usedDob = steps.includes("age") && !noDob;
    onComplete({
      consents,
      birthYear: usedDob ? +year : null,
      ageMethod: steps.includes("age") ? (noDob ? "confirmed" : "dob") : null,
      withdrawalWaiver: needWaiver && waiver ? { version, givenAt: new Date().toISOString() } : null,
    });
  }

  function next() {
    if (!canContinue || busy) return;
    if (step === "age" && !noDob) {
      if (dobAge === null) {
        setDateError(true);
        return;
      }
      if (dobAge < 18) {
        setUnderage(true);
        onUnderage?.();
        return;
      }
    }
    if (last) finish();
    else setIndex(index + 1);
  }

  function back() {
    if (index === 0) onCancel?.();
    else setIndex(index - 1);
  }

  const dir = lang === "ar" ? "rtl" : "ltr";

  if (underage) {
    return (
      <div className={`cg${className ? " " + className : ""}`} dir={dir} lang={lang}>
        <div className="cg-card cg-stop" role="alert">
          <h2 className="cg-title">{t.under.title}</h2>
          <p className="cg-lead">{t.under.body}</p>
          <button
            type="button"
            className="cg-link"
            onClick={() => {
              setUnderage(false);
              setDay("");
              setMonth("");
              setYear("");
            }}
          >
            {t.under.mistake}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`cg${className ? " " + className : ""}`} dir={dir} lang={lang}>
      <form
        className="cg-card"
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
        noValidate
      >
        {steps.length > 1 && (
          <div className="cg-progress" aria-hidden="true">
            {steps.map((s, i) => (
              <span key={s} className={i <= index ? "is-on" : ""} />
            ))}
          </div>
        )}
        {steps.length > 1 && <p className="cg-step">{t.stepOf(index + 1, steps.length)}</p>}

        {step === "age" && (
          <fieldset className="cg-fs">
            <legend className="cg-title">{t.age.title}</legend>
            <p className="cg-lead">{t.age.lead}</p>
            {!noDob ? (
              <>
                <div className="cg-dob">
                  <label className="cg-field">
                    <span>{t.age.day}</span>
                    <select value={day} onChange={(e) => (setDay(e.target.value), setDateError(false))} autoComplete="bday-day">
                      <option value="">–</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="cg-field cg-field-wide">
                    <span>{t.age.month}</span>
                    <select value={month} onChange={(e) => (setMonth(e.target.value), setDateError(false))} autoComplete="bday-month">
                      <option value="">–</option>
                      {MONTHS[lang].map((m, i) => (
                        <option key={m} value={i + 1}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="cg-field">
                    <span>{t.age.year}</span>
                    <select value={year} onChange={(e) => (setYear(e.target.value), setDateError(false))} autoComplete="bday-year">
                      <option value="">–</option>
                      {years.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {dateError && (
                  <p className="cg-error" role="alert">
                    {t.age.invalid}
                  </p>
                )}
                <button type="button" className="cg-link" onClick={() => setNoDob(true)}>
                  {t.age.noDob}
                </button>
              </>
            ) : (
              <>
                <Check checked={ageConfirmed} onChange={setAgeConfirmed} required>
                  {t.age.confirm}
                </Check>
                <button
                  type="button"
                  className="cg-link"
                  onClick={() => {
                    setNoDob(false);
                    setAgeConfirmed(false);
                  }}
                >
                  {t.age.useDob}
                </button>
              </>
            )}
          </fieldset>
        )}

        {step === "terms" && (
          <fieldset className="cg-fs">
            <legend className="cg-title">{t.terms.title}</legend>
            <p className="cg-lead">{t.terms.lead}</p>
            <Check checked={terms} onChange={setTerms} required>
              <LegalText text={t.terms.terms} lang={lang} newTab />
            </Check>
            <Check checked={privacy} onChange={setPrivacy} required>
              <LegalText text={t.terms.privacy} lang={lang} newTab />
            </Check>
            {askMarketing && (
              <Check checked={marketing} onChange={setMarketing}>
                {t.terms.marketing}
              </Check>
            )}
          </fieldset>
        )}

        {step === "photos" && (
          <fieldset className="cg-fs">
            <legend className="cg-title">{t.photos.title}</legend>
            <p className="cg-lead">{t.photos.lead}</p>
            <dl className="cg-facts">
              {t.photos.items.map(([h, body]) => (
                <div key={h} className="cg-fact">
                  <dt>{h}</dt>
                  <dd>
                    <LegalText text={body} lang={lang} newTab />
                  </dd>
                </div>
              ))}
            </dl>
            <p className="cg-more">
              <LegalText text={t.photos.more} lang={lang} newTab />
            </p>
            <Check checked={photos} onChange={setPhotos} required>
              {t.photos.consent}
            </Check>
            <Check checked={transfer} onChange={setTransfer} required>
              {t.photos.transfer}
            </Check>
            <Check checked={aiNotice} onChange={setAiNotice} required>
              {t.photos.ai}
            </Check>
            <Check checked={ownPhotos} onChange={setOwnPhotos} required>
              {t.photos.own}
            </Check>
            {needWaiver && (
              <>
                <Check checked={waiver} onChange={setWaiver} required>
                  {t.photos.waiver}
                </Check>
                <p className="cg-more">
                  <LegalText text={t.photos.waiverMore} lang={lang} newTab />
                </p>
              </>
            )}
          </fieldset>
        )}

        <div className="cg-actions">
          {(index > 0 || onCancel) && (
            <button type="button" className="cg-btn cg-btn-ghost" onClick={back}>
              {t.back}
            </button>
          )}
          <button type="submit" className="cg-btn cg-btn-accent" disabled={!canContinue || (last && busy)} aria-busy={last && busy ? true : undefined}>
            {last ? t.finish : t.next}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ConsentGate;
