/**
 * Brand and site settings in one place, so renaming the product or moving to
 * the real domain is a one-line change. Set at build time:
 *   VITE_BRAND_NAME   product name (default "Waddah"; Arabic "وضّاح")
 *   VITE_SITE_URL     public origin, no trailing slash
 *   VITE_INDEXABLE=1  allow search engines (leave unset on previews)
 */
export const BRAND_NAME: string = import.meta.env.VITE_BRAND_NAME || "Waddah";
/** Arabic form of the name, used on Arabic pages and in Arabic titles. */
export const BRAND_NAME_AR: string = import.meta.env.VITE_BRAND_NAME_AR || "وضّاح";
export const SITE_URL: string = (import.meta.env.VITE_SITE_URL || "https://glowup-preview-beta.vercel.app").replace(/\/$/, "");
export const INDEXABLE: boolean = import.meta.env.VITE_INDEXABLE === "1";
