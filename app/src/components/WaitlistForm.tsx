/*
 * Waitlist sign-up (EN/AR). At launch the service is for men only, so women
 * join this list and hear from us when it opens for them. Pass gender="female"
 * for that list; leave it out for a general launch list (gender is then sent
 * as null, never guessed). 18+ only, like the service.
 *
 * The person's country is sent with the entry (the visitor's country from
 * lib/pricing, which they can change in the form), so we know where to open
 * next and whom to tell when we do.
 *
 * No phone field: there is no WhatsApp/SMS provider under contract yet. Add it
 * back together with that provider's row in the privacy policy.
 */
import { useId, useState, type FormEvent } from "react";
import { joinWaitlist, type WaitlistResult } from "../lib/backend/waitlist";
import { BackendError } from "../lib/backend/client";
import type { GenderCode } from "../lib/backend/types";
import { LegalText, useLegalLang } from "../pages/legal/Privacy";
import type { LegalLang } from "../pages/legal/content";
import { CountrySelect } from "./CountrySelect";
import { useCountry, type CountryCode } from "../lib/pricing";
import "./WaitlistForm.css";

export interface WaitlistFormProps {
  /** where the person came from, e.g. "start", "landing", "instagram" */
  source: string;
  /** the service the person is waiting for; omit for a general list (sent as null) */
  gender?: GenderCode | null;
  lang?: LegalLang;
  /** the person's country (ISO-2); defaults to the visitor's country, which the form lets them change */
  country?: CountryCode;
  /** hide the heading and intro when the surrounding page already explains it */
  bare?: boolean;
  onJoined?: (result: WaitlistResult) => void;
  className?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const T = {
  en: {
    title: "Join the waitlist",
    introWomen: "Our service for women isn't open yet. Leave your email and we'll tell you as soon as it is.",
    introGeneral: "We're not open yet. Leave your email and we'll tell you as soon as we are.",
    email: "Email",
    country: "Country",
    adult: "I am 18 or older.",
    language: "Write to me in",
    submit: "Join the waitlist",
    sending: "Joining…",
    privacy: "We use your details only to tell you when we open. We never sell them or share them for anyone else's marketing. You can ask to be removed at any time. See our [[privacy policy|privacy]].",
    errEmail: "Please enter a valid email address.",
    errAdult: "This service is only for people aged 18 or older.",
    errGeneric: "Something went wrong on our side. Please try again in a moment.",
    joinedTitle: "You're on the list",
    joinedBody: "Thank you. We'll email you as soon as the service opens for you.",
    alreadyTitle: "You're already on the list",
    alreadyBody: "This email is already on our waitlist. We'll be in touch when we open.",
    localNote: "Demo mode: saved on this device only.",
  },
  ar: {
    title: "انضمّوا إلى قائمة الانتظار",
    introWomen: "خدمتنا للنساء لم تُفتح بعد. اتركوا بريدكم الإلكتروني ونبلغكم أول ما تنفتح.",
    introGeneral: "ما فتحنا بعد. اتركوا بريدكم الإلكتروني ونبلغكم أول ما نفتح.",
    email: "البريد الإلكتروني",
    country: "الدولة",
    adult: "عمري 18 سنة أو أكثر.",
    language: "راسلوني باللغة",
    submit: "انضمام إلى القائمة",
    sending: "جارٍ الانضمام…",
    privacy: "نستخدم بياناتكم فقط لإبلاغكم عند الافتتاح، ولا نبيعها ولا نشاركها لأغراض تسويقية لأي جهة. ويمكنكم طلب حذفها في أي وقت. اطّلعوا على [[سياسة الخصوصية|privacy]].",
    errEmail: "أدخلوا بريداً إلكترونياً صحيحاً.",
    errAdult: "هذه الخدمة لمن أعمارهم 18 سنة فأكثر فقط.",
    errGeneric: "صار خطأ من جهتنا. حاولوا مرة ثانية بعد قليل.",
    joinedTitle: "تم تسجيلكم في القائمة",
    joinedBody: "شكراً لكم. نراسلكم بالبريد أول ما تنفتح الخدمة لكم.",
    alreadyTitle: "أنتم مسجّلون في القائمة من قبل",
    alreadyBody: "هذا البريد موجود في قائمة الانتظار. نتواصل معكم عند الافتتاح.",
    localNote: "وضع تجريبي: محفوظ على هذا الجهاز فقط.",
  },
};

/**
 * Arabic for the women's list speaks to one woman in Gulf Arabic (feminine
 * forms), the same register as the waitlist intro on /ar/start and the landing.
 */
const AR_WOMEN: Partial<typeof T.ar> = {
  title: "سجّلي في قائمة الانتظار",
  introWomen: "خدمتنا للنساء ما انفتحت بعد. اتركي إيميلچ ونبلغچ أول ما تنفتح.",
  submit: "سجّليني في القائمة",
  privacy: "نستخدم بياناتچ بس عشان نبلغچ أول ما نفتح، وما نبيعها ولا نعطيها لأي جهة ثانية للتسويق. وتقدرين تطلبين حذفها في أي وقت. شوفي [[سياسة الخصوصية|privacy]].",
  errEmail: "اكتبي إيميل صحيح.",
  errGeneric: "صار خطأ من جهتنا. حاولي مرة ثانية بعد شوي.",
  joinedTitle: "تم تسجيلچ في القائمة",
  joinedBody: "شكراً لچ. نراسلچ بالإيميل أول ما تنفتح خدمة النساء.",
  alreadyTitle: "إنتِ مسجّلة في القائمة من قبل",
  alreadyBody: "هذا الإيميل موجود في قائمة الانتظار. نتواصل وياچ أول ما نفتح.",
};

export function WaitlistForm({ source, gender = null, lang: langProp, country: countryProp, bare = false, onJoined, className }: WaitlistFormProps) {
  const lang = useLegalLang(langProp);
  const visitor = useCountry();
  const country = countryProp ?? visitor;
  const t = lang === "ar" && gender === "female" ? { ...T.ar, ...AR_WOMEN } : T[lang];
  const id = useId();
  const [email, setEmail] = useState("");
  const [adult, setAdult] = useState(false);
  const [locale, setLocale] = useState<LegalLang>(lang);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"email" | "adult" | "generic" | null>(null);
  const [result, setResult] = useState<WaitlistResult | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!EMAIL_RE.test(email.trim())) return setError("email");
    if (!adult) return setError("adult");
    setError(null);
    setBusy(true);
    try {
      // country: see lib/backend/waitlist (join-waitlist stores it with the entry)
      const entry = { email, phone: null, gender, locale, source, country };
      const r = await joinWaitlist(entry);
      setResult(r);
      onJoined?.(r);
    } catch (err) {
      setError(err instanceof BackendError && err.code === "invalid_email" ? "email" : "generic");
    } finally {
      setBusy(false);
    }
  }

  const dir = lang === "ar" ? "rtl" : "ltr";
  const cls = `wl${className ? " " + className : ""}`;

  if (result) {
    const already = result === "already";
    return (
      <div className={cls} dir={dir} lang={lang}>
        <div className="wl-card wl-done" role="status">
          <span className="wl-tick" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          <h3 className="wl-title">{already ? t.alreadyTitle : t.joinedTitle}</h3>
          <p className="wl-intro">{already ? t.alreadyBody : t.joinedBody}</p>
          {result === "saved_locally" && import.meta.env.DEV && <p className="wl-dev">{t.localNote}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={cls} dir={dir} lang={lang}>
      <form className="wl-card" onSubmit={submit} noValidate>
        {!bare && (
          <>
            <h3 className="wl-title">{t.title}</h3>
            <p className="wl-intro">{gender === "female" ? t.introWomen : t.introGeneral}</p>
          </>
        )}

        <label className="wl-field" htmlFor={`${id}-email`}>
          <span>{t.email}</span>
        </label>
        <input
          id={`${id}-email`}
          className={`wl-input${error === "email" ? " is-bad" : ""}`}
          type="email"
          inputMode="email"
          autoComplete="email"
          dir="ltr"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error === "email") setError(null);
          }}
          aria-invalid={error === "email" || undefined}
          aria-describedby={error === "email" ? `${id}-err` : undefined}
          placeholder="name@example.com"
        />

        {countryProp === undefined && (
          <div className="wl-field wl-country">
            <CountrySelect lang={lang} label={t.country} />
          </div>
        )}

        <div className="wl-field" role="group" aria-labelledby={`${id}-lang`}>
          <span id={`${id}-lang`}>{t.language}</span>
          <div className="wl-seg">
            {(["en", "ar"] as const).map((l) => (
              <button
                key={l}
                type="button"
                lang={l}
                className={locale === l ? "is-on" : ""}
                aria-pressed={locale === l}
                onClick={() => setLocale(l)}
              >
                {l === "en" ? "English" : "العربية"}
              </button>
            ))}
          </div>
        </div>

        <div className={`wl-check${error === "adult" ? " is-bad" : ""}`}>
          <input
            id={`${id}-adult`}
            type="checkbox"
            required
            checked={adult}
            onChange={(e) => {
              setAdult(e.target.checked);
              if (error === "adult") setError(null);
            }}
            aria-invalid={error === "adult" || undefined}
            aria-describedby={error === "adult" ? `${id}-err` : undefined}
          />
          <label htmlFor={`${id}-adult`}>{t.adult}</label>
        </div>

        {error && (
          <p id={`${id}-err`} className="wl-error" role="alert">
            {error === "email" ? t.errEmail : error === "adult" ? t.errAdult : t.errGeneric}
          </p>
        )}

        <button type="submit" className="wl-btn" disabled={busy} aria-busy={busy || undefined}>
          {busy ? t.sending : t.submit}
        </button>

        <p className="wl-privacy">
          <LegalText text={t.privacy} lang={lang} newTab />
        </p>
      </form>
    </div>
  );
}

export default WaitlistForm;
