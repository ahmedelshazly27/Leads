// Transactional email through Resend. EMAIL_FROM must be an address on a
// domain verified in Resend, e.g. "Name <reports@example.com>".
//
// Every customer email is written in the customer's language (profiles.locale)
// and every link goes to the page in that language: Arabic pages live under
// /ar (customerUrl).
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type EmailLocale = "en" | "ar";

export async function sendEmail(msg: EmailMessage): Promise<{ ok: boolean; id?: string; error?: string }> {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM");
  if (!key || !from) return { ok: false, error: "RESEND_API_KEY or EMAIL_FROM not set" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: `${res.status} ${body?.message ?? ""}`.trim() };
  return { ok: true, id: body?.id };
}

export const asLocale = (v: unknown): EmailLocale => (v === "ar" ? "ar" : "en");

/**
 * Absolute link to a customer page in the customer's language:
 * customerUrl("ar", "/orders/123") -> https://site/ar/orders/123.
 * `path` starts with "/" and may carry a query string.
 */
export function customerUrl(locale: EmailLocale, path: string): string {
  const site = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${site}${locale === "ar" ? "/ar" : ""}${p}`;
}

/** "19 November 2026" / "19 نوفمبر 2026" (Kuwait time, Latin digits as in the app). */
export function formatDate(iso: string, locale: EmailLocale): string {
  return new Date(iso).toLocaleDateString(locale === "ar" ? "ar-KW-u-nu-latn" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kuwait",
  });
}

export const firstName = (fullName: string | null | undefined): string | null =>
  fullName?.trim().split(/\s+/)[0] || null;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const brandName = () => Deno.env.get("BRAND_NAME") ?? "";

interface Button {
  label: string;
  href: string;
}

/**
 * One email in both formats. `paragraphs` are plain text (escaped here);
 * `quote` is shown as a boxed note (e.g. the reviewer's message).
 */
function compose(opts: {
  locale: EmailLocale;
  name: string | null;
  subject: string;
  paragraphs: string[];
  buttons: Button[];
  after?: string[];
  quote?: { label: string; text: string } | null;
  brand?: string;
}): Omit<EmailMessage, "to"> {
  const ar = opts.locale === "ar";
  const brand = opts.brand ?? brandName();
  const hi = ar ? (opts.name ? `مرحبا ${opts.name}،` : "مرحبا،") : opts.name ? `Hi ${opts.name},` : "Hi,";
  const after = opts.after ?? [];

  const text = [
    hi,
    ...opts.paragraphs,
    ...(opts.quote ? [`${opts.quote.label}\n${opts.quote.text}`] : []),
    ...opts.buttons.map((b) => `${b.label}: ${b.href}`),
    ...after,
    brand,
  ].filter(Boolean).join("\n\n");

  const font = ar
    ? "font-family:system-ui,-apple-system,Segoe UI,Tahoma,sans-serif;line-height:1.7"
    : "font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.6";
  const p = (s: string) => `<p>${escapeHtml(s)}</p>`;
  const button = (b: Button) =>
    `<p><a href="${
      escapeHtml(b.href)
    }" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">${
      escapeHtml(b.label)
    }</a></p>`;
  const quote = opts.quote
    ? `<p style="margin-bottom:4px;color:#444">${
      escapeHtml(opts.quote.label)
    }</p><blockquote style="margin:0 0 16px;padding:12px 16px;background:#f4f4f4;border-radius:8px;white-space:pre-wrap">${
      escapeHtml(opts.quote.text)
    }</blockquote>`
    : "";
  const html = `<div${ar ? ' dir="rtl"' : ""} style="${font};color:#111">
${p(hi)}
${opts.paragraphs.map(p).join("\n")}
${quote}
${opts.buttons.map(button).join("\n")}
${after.map(p).join("\n")}
${brand ? `<p style="color:#666;font-size:13px">${escapeHtml(brand)}</p>` : ""}</div>`;
  return { subject: opts.subject, html, text };
}

/* ------------------------------------------------------------------ */
/*  Report delivered                                                   */
/* ------------------------------------------------------------------ */

/** "Your report is ready". `link` should come from customerUrl(locale, "/orders/<id>"). */
export function reportReadyEmail(
  opts: { locale: EmailLocale; name: string | null; link: string; brand?: string },
): Omit<EmailMessage, "to"> {
  if (opts.locale === "ar") {
    return compose({
      locale: "ar",
      name: opts.name,
      brand: opts.brand,
      subject: "تقريرك جاهز",
      paragraphs: ["تقريرك جاهز. راجعه الفريق ووافق عليه، وتقدر تشوفه الحين مع خطتك والصور."],
      buttons: [{ label: "افتح التقرير", href: opts.link }],
    });
  }
  return compose({
    locale: "en",
    name: opts.name,
    brand: opts.brand,
    subject: "Your report is ready",
    paragraphs: [
      "Your report is ready. A reviewer has checked and approved it, and you can open it now with your plan and visuals.",
    ],
    buttons: [{ label: "Open my report", href: opts.link }],
  });
}

/* ------------------------------------------------------------------ */
/*  Photos need retaking (order set to changes_requested)              */
/* ------------------------------------------------------------------ */

export function changesRequestedEmail(
  opts: { locale: EmailLocale; name: string | null; link: string; message?: string | null; brand?: string },
): Omit<EmailMessage, "to"> {
  const message = opts.message?.trim() || null;
  if (opts.locale === "ar") {
    return compose({
      locale: "ar",
      name: opts.name,
      brand: opts.brand,
      subject: "تقريرك: نحتاج تعيد بعض الصور",
      paragraphs: [
        "راجع فريقنا صورك، ونحتاج تعيد تصوير بعضها قبل لا نكمّل تقريرك.",
        message
          ? "الملاحظة تحت توضح شو تعيد. افتح طلبك، صوّر من جديد وأرسل الصور. مدة المراجعة (72 ساعة) تبدأ من جديد لما ترسلها."
          : "افتح طلبك، صوّر من جديد وأرسل الصور. مدة المراجعة (72 ساعة) تبدأ من جديد لما ترسلها.",
      ],
      quote: message ? { label: "ملاحظة من المراجع:", text: message } : null,
      buttons: [{ label: "افتح طلبك", href: opts.link }],
    });
  }
  return compose({
    locale: "en",
    name: opts.name,
    brand: opts.brand,
    subject: "Your report: a few photos need retaking",
    paragraphs: [
      "Our reviewer has looked at your photos and needs some of them taken again before we can finish your report.",
      message
        ? "The note below says what to change. Open your order to take the photos again and send them. The 72-hour review time starts again when you send them."
        : "Open your order to take the photos again and send them. The 72-hour review time starts again when you send them.",
    ],
    quote: message ? { label: "Note from your reviewer:", text: message } : null,
    buttons: [{ label: "Open my order", href: opts.link }],
  });
}

/* ------------------------------------------------------------------ */
/*  Membership reminders                                               */
/* ------------------------------------------------------------------ */

export interface MembershipPrices {
  monthly: number;
  yearly: number;
}

const kwd = (n: number, locale: EmailLocale) => (locale === "ar" ? `${n} د.ك` : `${n} KWD`);

/** Whole days until `iso` (at least 1). */
export function daysUntil(iso: string, now = Date.now()): number {
  return Math.max(1, Math.ceil((Date.parse(iso) - now) / 86_400_000));
}

function arDays(n: number): string {
  if (n === 1) return "باچر";
  if (n === 2) return "بعد يومين";
  if (n <= 10) return `بعد ${n} أيام`;
  return `بعد ${n} يوم`;
}

/**
 * The included month (report bought on its own) ends soon. Nothing renews;
 * the email offers the two memberships. Links: customerUrl(locale,
 * "/account?join=membership_monthly") and "...=membership_yearly".
 */
export function includedEndingEmail(opts: {
  locale: EmailLocale;
  name: string | null;
  endsAt: string;
  monthlyLink: string;
  yearlyLink: string;
  prices: MembershipPrices;
  now?: number;
  brand?: string;
}): Omit<EmailMessage, "to"> {
  const days = daysUntil(opts.endsAt, opts.now);
  const date = formatDate(opts.endsAt, opts.locale);
  const { monthly, yearly } = opts.prices;
  if (opts.locale === "ar") {
    return compose({
      locale: "ar",
      name: opts.name,
      brand: opts.brand,
      subject: `شهر العضوية اللي مع تقريرك ينتهي ${arDays(days)}`,
      paragraphs: [
        `الـ30 يوم عضوية اللي جات مع تقريرك تنتهي يوم ${date}. ما راح يتجدد شي، ولا راح ينخصم منك أي مبلغ.`,
        "إذا تبي تكمّل مع فحص شهري يحدّث درجاتك وخطتك، وملاحظة من المراجع كل شهر، تقدر تشترك الحين. وتقدر تلغي أي وقت.",
      ],
      buttons: [
        { label: `اشترك شهري: ${kwd(monthly, "ar")} بالشهر`, href: opts.monthlyLink },
        {
          label: `اشترك سنوي: ${kwd(yearly, "ar")} لـ12 شهر، بعدها ${kwd(monthly, "ar")} بالشهر`,
          href: opts.yearlyLink,
        },
      ],
      after: ["تقريرك وخطتك يبقون لك في كل الأحوال."],
    });
  }
  return compose({
    locale: "en",
    name: opts.name,
    brand: opts.brand,
    subject: days === 1
      ? "Your included month of membership ends tomorrow"
      : `Your included month of membership ends in ${days} days`,
    paragraphs: [
      `The 30 days of membership that came with your report end on ${date}. Nothing renews and you will not be charged.`,
      "If you want to keep a monthly check-in scan with updated scores and plan, and a reviewer note each month, you can join now. Cancel any time.",
    ],
    buttons: [
      { label: `Join monthly: ${kwd(monthly, "en")} a month`, href: opts.monthlyLink },
      {
        label: `Join yearly: ${kwd(yearly, "en")} for 12 months, then ${kwd(monthly, "en")} a month`,
        href: opts.yearlyLink,
      },
    ],
    after: ["Your report and plan stay yours either way."],
  });
}

/**
 * Terms section 7: "We remind you by email about 30 days before the 12 months
 * end." Sent for a yearly membership that is not cancelling. Link:
 * customerUrl(locale, "/account").
 */
export function yearlyRenewalEmail(opts: {
  locale: EmailLocale;
  name: string | null;
  endsAt: string;
  accountLink: string;
  prices: MembershipPrices;
  brand?: string;
}): Omit<EmailMessage, "to"> {
  const date = formatDate(opts.endsAt, opts.locale);
  const { monthly } = opts.prices;
  if (opts.locale === "ar") {
    return compose({
      locale: "ar",
      name: opts.name,
      brand: opts.brand,
      subject: `عضويتك السنوية تخلص يوم ${date}`,
      paragraphs: [
        `مثل ما وعدناك، هذا تذكير: الـ12 شهر من عضويتك السنوية تخلص يوم ${date}.`,
        `بعدها تستمر عضويتك شهر بشهر بـ${kwd(monthly, "ar")} بالشهر على نفس البطاقة، لين ما تلغيها.`,
        `وإذا تبي توقف، ألغها أي وقت قبل ${date} من صفحة حسابك، وما راح ينخصم منك شي بعدها.`,
      ],
      buttons: [{ label: "افتح صفحة حسابك", href: opts.accountLink }],
    });
  }
  return compose({
    locale: "en",
    name: opts.name,
    brand: opts.brand,
    subject: `Your 12-month membership ends on ${date}`,
    paragraphs: [
      `This is the reminder we promised: the 12 months of your yearly membership end on ${date}.`,
      `After that, your membership continues month to month at ${
        kwd(monthly, "en")
      } a month on the same card, until you cancel.`,
      `If you would rather stop, cancel any time before ${date} on your account page and nothing more is charged.`,
    ],
    buttons: [{ label: "Open my account", href: opts.accountLink }],
  });
}
