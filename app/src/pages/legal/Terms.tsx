/* Terms of service (EN/AR). DRAFT: have a Dutch lawyer review before launch. */
import { LegalPage } from "./Privacy";
import type { LegalLang } from "./content";

export function Terms({ lang }: { lang?: LegalLang }) {
  return <LegalPage doc="terms" lang={lang} />;
}

export default Terms;
