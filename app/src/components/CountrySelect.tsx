/*
 * Country picker: "Saudi Arabia · SAR" / "السعودية · ر.س". No flags. The
 * choice sets the prices and currency across the site and is remembered on
 * this device (lib/pricing). Labels are rendered in the page language here,
 * so the subtree is excluded from the Arabic text swap (translate="no").
 */
import { useId } from "react";
import type { Lang } from "../lib/i18n";
import { COUNTRIES, countryName, currencyFor, currencyLabel, isSelling, setCountry, useCountry, type CountryCode } from "../lib/pricing";
import "./CountrySelect.css";

export const countryLabel = (c: CountryCode, lang: Lang) => `${countryName(c, lang)} · ${currencyLabel(currencyFor(c), lang)}`;

export function CountrySelect({
  lang,
  className,
  tone = "light",
  label,
  onChange,
}: {
  lang: Lang;
  className?: string;
  /** "dark": light text, for the landing nav over the hero photo */
  tone?: "light" | "dark";
  /** visible label before the select (otherwise it is labelled for screen readers only) */
  label?: string;
  onChange?: (c: CountryCode) => void;
}) {
  const id = useId();
  const country = useCountry();
  const known = COUNTRIES.some((c) => c.code === country);
  const selling = COUNTRIES.filter((c) => isSelling(c.code));
  const soon = COUNTRIES.filter((c) => !isSelling(c.code));
  const t =
    lang === "ar"
      ? { aria: "الدولة والعملة", now: "متوفر الحين", soon: "قريبًا" }
      : { aria: "Country and currency", now: "Available now", soon: "Coming soon" };
  return (
    <span className={`cs cs-${tone}${className ? " " + className : ""}`} translate="no" lang={lang}>
      {label ? (
        <label className="cs-label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <select
        id={id}
        className="cs-select"
        value={country}
        aria-label={label ? undefined : t.aria}
        onChange={(e) => {
          setCountry(e.target.value);
          onChange?.(e.target.value);
        }}
      >
        <optgroup label={t.now}>
          {selling.map((c) => (
            <option key={c.code} value={c.code}>
              {countryLabel(c.code, lang)}
            </option>
          ))}
        </optgroup>
        <optgroup label={t.soon}>
          {soon.map((c) => (
            <option key={c.code} value={c.code}>
              {countryLabel(c.code, lang)}
            </option>
          ))}
          {!known && <option value={country}>{countryLabel(country, lang)}</option>}
        </optgroup>
      </select>
    </span>
  );
}
