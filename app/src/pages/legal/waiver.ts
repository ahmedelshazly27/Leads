/*
 * Canonical consumer texts shared by the legal pages and the order flow.
 * Kept in this small module (no legal-text imports) so the photo consent step
 * can import it without pulling in the full legal texts. content.ts re-exports
 * everything here.
 *
 * When WAIVER_TEXT changes, bump CONSENT_VERSION in lib/backend/consents.ts.
 */

export type WaiverLang = "en" | "ar";

/**
 * The withdrawal waiver the customer confirms before submitting photos
 * (consent kind "withdrawal_waiver"). Terms section 8 and refund policy
 * sections 1 and 2 describe the same thing.
 */
export const WAIVER_TEXT: Record<WaiverLang, string> = {
  en: "I ask you to start my report straight away, within my 14-day withdrawal period. I understand that if I withdraw after your review has started, I pay a proportional amount for the work already done, and that I lose my right of withdrawal once my report has been delivered.",
  ar: "أطلب منكم البدء في إعداد تقريري فوراً، خلال مدة الانسحاب البالغة 14 يوماً. وأفهم أنني إذا انسحبت بعد بدء مراجعتكم أدفع مبلغاً متناسباً مقابل العمل المُنجز، وأنني أفقد حقي في الانسحاب بمجرد تسليم تقريري.",
};

/** Short label for the waiver checkbox or its heading. */
export const WAIVER_LABEL: Record<WaiverLang, string> = {
  en: "Start my report now",
  ar: "ابدأوا تقريري الآن",
};

/**
 * Who can see submitted photos. The landing, the photo consent step, the PDF
 * and privacy policy section 6 must all say this (docs/CLAIMS.md, "Product /
 * process"). Admins can open every order (storage and row-level security:
 * is_admin()), so never say only the reviewer sees them.
 */
export const PHOTO_ACCESS_TEXT: Record<WaiverLang, string> = {
  en: "You, and the reviewer assigned to your order. Our admins, a small number of authorised staff, can also open orders to check quality and to help with support. Our image provider receives only the photos needed to make your AI illustrations.",
  ar: "أنتم، والمراجِع المكلّف بطلبكم. ويمكن أيضاً لمسؤولي النظام لدينا، وهم عدد محدود من الموظفين المخوّلين، فتح الطلبات لمراجعة الجودة وللمساعدة في الدعم. ولا يتلقّى مزوّد خدمة إنشاء الصور إلا الصور اللازمة لإنشاء صوركم التوضيحية.",
};
