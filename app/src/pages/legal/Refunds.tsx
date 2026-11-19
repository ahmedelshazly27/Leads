/* Refund policy (EN/AR). DRAFT: have a Dutch lawyer review before launch. */
import { LegalPage } from "./Privacy";
import type { LegalLang } from "./content";

export function Refunds({ lang }: { lang?: LegalLang }) {
  return <LegalPage doc="refunds" lang={lang} />;
}

export default Refunds;
